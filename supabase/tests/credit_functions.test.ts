import { describe, expect, it } from "vitest";
import { adminClient, createTestUsers } from "./helpers";

describe("credit database functions", () => {
  it("grant twice with the same external_id adds credits once", async () => {
    const { userA } = await createTestUsers();
    const admin = adminClient();

    const first = await admin.rpc("grant_credits", {
      p_user_id: userA.id,
      p_amount: 5,
      p_reason: "purchase",
      p_external_id: "order:duplicate-test",
    });
    expect(first.error).toBeNull();

    const second = await admin.rpc("grant_credits", {
      p_user_id: userA.id,
      p_amount: 5,
      p_reason: "purchase",
      p_external_id: "order:duplicate-test",
    });
    expect(second.error).toBeNull();

    const { data: profile } = await admin.from("profiles").select("credits").eq("id", userA.id).single();
    expect(profile?.credits).toBe(5);

    const { data: ledgerRows } = await admin
      .from("credit_ledger")
      .select("id")
      .eq("external_id", "order:duplicate-test");
    expect(ledgerRows).toHaveLength(1);
  });

  it("two concurrent consumes on a balance of 1 give exactly one success", async () => {
    const { userA } = await createTestUsers();
    const admin = adminClient();

    await admin.rpc("grant_credits", {
      p_user_id: userA.id,
      p_amount: 1,
      p_reason: "grant",
      p_external_id: `signup:${userA.id}`,
    });

    const [first, second] = await Promise.all([
      userA.client.rpc("consume_credits", { p_amount: 1 }),
      userA.client.rpc("consume_credits", { p_amount: 1 }),
    ]);

    const results = [first, second];
    const successes = results.filter((r) => r.error === null);
    const failures = results.filter((r) => r.error !== null);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.error?.message).toContain("insufficient_credits");

    const { data: profile } = await admin.from("profiles").select("credits").eq("id", userA.id).single();
    expect(profile?.credits).toBe(0);
  });

  it("an authenticated user cannot call grant_credits", async () => {
    const { userA } = await createTestUsers();

    const { error } = await userA.client.rpc("grant_credits", {
      p_user_id: userA.id,
      p_amount: 1000,
      p_reason: "grant",
      p_external_id: "hack:attempt",
    });

    expect(error).not.toBeNull();

    const admin = adminClient();
    const { data: profile } = await admin.from("profiles").select("credits").eq("id", userA.id).single();
    expect(profile?.credits).toBe(0);
  });

  it("an authenticated user cannot call refund_credits", async () => {
    const { userA } = await createTestUsers();

    const { error } = await userA.client.rpc("refund_credits", { p_ledger_id: 1 });
    expect(error).not.toBeNull();
  });

  it("consume_credits always uses the caller's own auth.uid(), never a user id argument", async () => {
    const { userA, userB } = await createTestUsers();
    const admin = adminClient();

    await admin.rpc("grant_credits", {
      p_user_id: userB.id,
      p_amount: 1,
      p_reason: "grant",
      p_external_id: `signup:${userB.id}`,
    });

    // consume_credits takes only an amount — there is no user id parameter
    // userA could pass to spend userB's balance.
    const { error } = await userA.client.rpc("consume_credits", { p_amount: 1 });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("insufficient_credits");

    const { data: profileB } = await admin.from("profiles").select("credits").eq("id", userB.id).single();
    expect(profileB?.credits).toBe(1);
  });

  it("refund_credits reverses a ledger entry and is idempotent", async () => {
    const { userA } = await createTestUsers();
    const admin = adminClient();

    await admin.rpc("grant_credits", {
      p_user_id: userA.id,
      p_amount: 3,
      p_reason: "grant",
      p_external_id: `signup:${userA.id}`,
    });
    await userA.client.rpc("consume_credits", { p_amount: 1 });

    const { data: consumeRow } = await admin
      .from("credit_ledger")
      .select("id")
      .eq("user_id", userA.id)
      .eq("reason", "consume")
      .single();
    const ledgerId = consumeRow?.id;

    await admin.rpc("refund_credits", { p_ledger_id: ledgerId });
    const { data: afterFirstRefund } = await admin.from("profiles").select("credits").eq("id", userA.id).single();
    expect(afterFirstRefund?.credits).toBe(3);

    await admin.rpc("refund_credits", { p_ledger_id: ledgerId });
    const { data: afterSecondRefund } = await admin.from("profiles").select("credits").eq("id", userA.id).single();
    expect(afterSecondRefund?.credits).toBe(3);
  });
});
