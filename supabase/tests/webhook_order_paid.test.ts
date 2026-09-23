import { describe, expect, it } from "vitest";
import type { Order } from "@polar-sh/sdk/models/components/order.js";
import { handleOrderPaid } from "../../src/lib/polar/handle-order-paid";
import { adminClient, createTestUsers } from "./helpers";

// E4's own done_when, proven end-to-end against real Supabase: a paid order
// grants exactly the right number of credits, and redelivering the same
// order (Polar retries on anything but a 2xx, and could in principle send
// the same event twice) grants nothing further.
function fakeOrder(overrides: Omit<Partial<Order>, "customer"> & { customer?: Partial<Order["customer"]> }): Order {
  return {
    id: "order_should_be_overridden",
    productId: "6a7960c1-e346-4057-8fb2-9760484477ec",
    customer: { externalId: "should-be-overridden" },
    ...overrides,
  } as Order;
}

describe("handleOrderPaid (real Supabase)", () => {
  it("a paid order grants exactly the pack's credits, on top of the automatic sign-up credit", async () => {
    const { userA } = await createTestUsers();
    const admin = adminClient();

    await handleOrderPaid(
      admin,
      fakeOrder({ id: `order_${userA.id}`, productId: "6a7960c1-e346-4057-8fb2-9760484477ec", customer: { externalId: userA.id } }),
    );

    // 1 automatic sign-up credit (E5) + 5 from this order.
    const { data: profile } = await admin.from("profiles").select("credits").eq("id", userA.id).single();
    expect(profile?.credits).toBe(6);
  });

  it("redelivering the same order id grants nothing further", async () => {
    const { userA } = await createTestUsers();
    const admin = adminClient();
    const order = fakeOrder({
      id: `order_${userA.id}`,
      productId: "d2aec929-1dc5-49c5-bdc5-556ebe50c422",
      customer: { externalId: userA.id },
    });

    await handleOrderPaid(admin, order);
    await handleOrderPaid(admin, order);
    await handleOrderPaid(admin, order);

    // 1 automatic sign-up credit (E5) + 12 from the order, granted once
    // despite three deliveries.
    const { data: profile } = await admin.from("profiles").select("credits").eq("id", userA.id).single();
    expect(profile?.credits).toBe(13);

    const { data: ledgerRows } = await admin
      .from("credit_ledger")
      .select("id")
      .eq("external_id", `polar:order_${userA.id}`);
    expect(ledgerRows).toHaveLength(1);
  });

  it("does nothing for an unknown product id — never a silent wrong-amount grant", async () => {
    const { userA } = await createTestUsers();
    const admin = adminClient();

    await handleOrderPaid(
      admin,
      fakeOrder({ id: `order_${userA.id}`, productId: "not-a-real-product", customer: { externalId: userA.id } }),
    );

    // Only the automatic sign-up credit — nothing from the unrecognized order.
    const { data: profile } = await admin.from("profiles").select("credits").eq("id", userA.id).single();
    expect(profile?.credits).toBe(1);
  });
});
