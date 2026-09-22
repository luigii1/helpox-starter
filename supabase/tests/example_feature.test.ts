import { describe, expect, it } from "vitest";
import { InsufficientCreditsError, runExampleAction } from "../../src/features/example/run-example-action";
import { adminClient, createTestUsers } from "./helpers";

// F1's own done_when, proven end-to-end against real Supabase rather than
// mocked clients (supabase/tests/../src/features/example/run-example-action.test.ts
// already covers the pure branching logic).
describe("runExampleAction (real Supabase)", () => {
  it("using the feature lowers the balance by 1", async () => {
    const { userA } = await createTestUsers();
    const admin = adminClient();

    // userA already has 1 credit from the automatic sign-up grant (E5).
    const result = await runExampleAction(userA.client, admin, "abc", false);

    expect(result).toEqual({ ok: true, output: "cba", newBalance: 0 });
    const { data: profile } = await admin.from("profiles").select("credits").eq("id", userA.id).single();
    expect(profile?.credits).toBe(0);
  });

  it("a forced failure restores the credit it spent", async () => {
    const { userA } = await createTestUsers();
    const admin = adminClient();

    const result = await runExampleAction(userA.client, admin, "abc", true);

    expect(result).toEqual({ ok: false, newBalance: 1 });
    const { data: profile } = await admin.from("profiles").select("credits").eq("id", userA.id).single();
    expect(profile?.credits).toBe(1);

    // The refund left a paper trail — both the spend and its reversal are
    // in the ledger, not just silently undone.
    const { data: ledgerRows } = await admin
      .from("credit_ledger")
      .select("reason, delta")
      .eq("user_id", userA.id)
      .order("id", { ascending: true });
    expect(ledgerRows).toMatchObject([
      { reason: "grant", delta: 1 },
      { reason: "consume", delta: -1 },
      { reason: "refund", delta: 1 },
    ]);
  });

  it("throws InsufficientCreditsError instead of running the action when the balance is 0", async () => {
    const { userA } = await createTestUsers();
    const admin = adminClient();

    // Drain the automatic sign-up credit first.
    await userA.client.rpc("consume_credits", { p_amount: 1 });

    await expect(runExampleAction(userA.client, admin, "abc", false)).rejects.toThrow(InsufficientCreditsError);
  });
});
