import { describe, expect, it } from "vitest";
import { deleteAccount } from "../../src/lib/account/delete-account";
import { adminClient, createTestUsers } from "./helpers";

describe("deleteAccount (real Supabase)", () => {
  it("after deletion the user has zero rows in profiles and credit_ledger, and the auth user is gone", async () => {
    const { userA } = await createTestUsers();
    const admin = adminClient();

    // Give the user real data in both tables first, so "zero rows" below is
    // actually proving something was deleted, not just that nothing existed.
    await admin.rpc("grant_credits", {
      p_user_id: userA.id,
      p_amount: 5,
      p_reason: "grant",
      p_external_id: `signup:${userA.id}`,
    });

    const profileBefore = await admin.from("profiles").select("id").eq("id", userA.id);
    const ledgerBefore = await admin.from("credit_ledger").select("id").eq("user_id", userA.id);
    expect(profileBefore.data).toHaveLength(1);
    expect(ledgerBefore.data?.length).toBeGreaterThan(0);

    await deleteAccount(admin, userA.id);

    const profileAfter = await admin.from("profiles").select("id").eq("id", userA.id);
    const ledgerAfter = await admin.from("credit_ledger").select("id").eq("user_id", userA.id);
    expect(profileAfter.data).toEqual([]);
    expect(ledgerAfter.data).toEqual([]);

    const { data: authUser, error } = await admin.auth.admin.getUserById(userA.id);
    expect(authUser.user).toBeNull();
    expect(error).not.toBeNull();
  });

  it("does not touch another user's rows", async () => {
    const { userA, userB } = await createTestUsers();
    const admin = adminClient();

    await admin.rpc("grant_credits", {
      p_user_id: userB.id,
      p_amount: 2,
      p_reason: "grant",
      p_external_id: `signup:${userB.id}`,
    });

    await deleteAccount(admin, userA.id);

    const { data: profileB } = await admin.from("profiles").select("id, credits").eq("id", userB.id).single();
    expect(profileB?.id).toBe(userB.id);
    expect(profileB?.credits).toBe(2);
  });

  it("throws, rather than silently succeeding, when the user id doesn't exist", async () => {
    const admin = adminClient();
    await expect(deleteAccount(admin, "00000000-0000-0000-0000-000000000000")).rejects.toThrow();
  });
});
