import { describe, expect, it } from "vitest";
import { adminClient, createTestUsers } from "./helpers";

// F1's refund-on-failure needs the exact ledger row a consume created, so
// consume_credits (brick E2) now returns it alongside the new balance
// (supabase/migrations/20260922081942_consume_credits_returns_ledger_id.sql).
describe("consume_credits return shape", () => {
  it("returns the new balance and the id of the ledger row it just inserted", async () => {
    const { userA } = await createTestUsers();
    const admin = adminClient();

    // userA already has 1 credit from the automatic sign-up grant (E5).
    const { data, error } = await userA.client.rpc("consume_credits", { p_amount: 1 });
    expect(error).toBeNull();
    expect(data).toMatchObject({ new_balance: 0 });
    expect(typeof (data as { ledger_id: number }).ledger_id).toBe("number");

    const { data: ledgerRow } = await admin
      .from("credit_ledger")
      .select("id, delta, reason")
      .eq("id", (data as { ledger_id: number }).ledger_id)
      .single();
    expect(ledgerRow).toMatchObject({ delta: -1, reason: "consume" });
  });

  it("the returned ledger_id can be refunded, restoring the exact amount consumed", async () => {
    const { userA } = await createTestUsers();
    const admin = adminClient();

    const { data } = await userA.client.rpc("consume_credits", { p_amount: 1 });
    const { ledger_id: ledgerId } = data as { new_balance: number; ledger_id: number };

    const { error: refundError } = await admin.rpc("refund_credits", { p_ledger_id: ledgerId });
    expect(refundError).toBeNull();

    const { data: profile } = await admin.from("profiles").select("credits").eq("id", userA.id).single();
    expect(profile?.credits).toBe(1);
  });
});
