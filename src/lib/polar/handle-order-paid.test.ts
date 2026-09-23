import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order } from "@polar-sh/sdk/models/components/order.js";
import { handleOrderPaid } from "./handle-order-paid";

// A partial Order is fine — handleOrderPaid only reads id, productId and
// customer.externalId, and TypeScript won't let a call site accidentally
// use anything else this cast doesn't provide.
function fakeOrder(overrides: Omit<Partial<Order>, "customer"> & { customer?: Partial<Order["customer"]> }): Order {
  return {
    id: "order_1",
    productId: "6a7960c1-e346-4057-8fb2-9760484477ec",
    customer: { externalId: "user-a" },
    ...overrides,
  } as Order;
}

function fakeAdmin(rpcError: { message: string } | null = null): SupabaseClient {
  return {
    rpc: vi.fn(() => Promise.resolve({ data: null, error: rpcError })),
  } as unknown as SupabaseClient;
}

describe("handleOrderPaid", () => {
  it("grants the right number of credits for a known product, keyed on the order id", async () => {
    const admin = fakeAdmin();
    const order = fakeOrder({ id: "order_42", productId: "6a7960c1-e346-4057-8fb2-9760484477ec" });

    await handleOrderPaid(admin, order);

    expect(admin.rpc).toHaveBeenCalledWith("grant_credits", {
      p_user_id: "user-a",
      p_amount: 5,
      p_reason: "purchase",
      p_external_id: "polar:order_42",
    });
  });

  it("grants the larger pack's amount for the other known product", async () => {
    const admin = fakeAdmin();
    const order = fakeOrder({ id: "order_43", productId: "d2aec929-1dc5-49c5-bdc5-556ebe50c422" });

    await handleOrderPaid(admin, order);

    expect(admin.rpc).toHaveBeenCalledWith(
      "grant_credits",
      expect.objectContaining({ p_amount: 12, p_external_id: "polar:order_43" }),
    );
  });

  it("does nothing for a product id this codebase doesn't know about", async () => {
    const admin = fakeAdmin();
    const order = fakeOrder({ productId: "unknown-product-id" });

    await handleOrderPaid(admin, order);

    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("does nothing when the order has no product id at all", async () => {
    const admin = fakeAdmin();
    const order = fakeOrder({ productId: null });

    await handleOrderPaid(admin, order);

    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("does nothing when the customer has no external id (never went through our checkout)", async () => {
    const admin = fakeAdmin();
    const order = fakeOrder({ customer: { externalId: null } });

    await handleOrderPaid(admin, order);

    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("throws if the grant itself fails, so the route can respond with an error instead of a silent 200", async () => {
    const admin = fakeAdmin({ message: "connection refused" });
    const order = fakeOrder({});

    await expect(handleOrderPaid(admin, order)).rejects.toThrow("connection refused");
  });
});
