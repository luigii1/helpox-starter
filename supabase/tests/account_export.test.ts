import { describe, expect, it } from "vitest";
import { buildAccountExport } from "../../src/lib/account/export";
import { adminClient, createTestUsers } from "./helpers";

describe("buildAccountExport (real Supabase, RLS-enforced)", () => {
  it("an export for user A contains only user A's profile and ledger rows", async () => {
    const { userA, userB } = await createTestUsers();
    const admin = adminClient();

    await admin.rpc("grant_credits", {
      p_user_id: userA.id,
      p_amount: 5,
      p_reason: "grant",
      p_external_id: `signup:${userA.id}`,
    });
    await admin.rpc("grant_credits", {
      p_user_id: userB.id,
      p_amount: 7,
      p_reason: "grant",
      p_external_id: `signup:${userB.id}`,
    });

    const exportA = await buildAccountExport(userA.client, userA.id, userA.email);

    expect(exportA.account.id).toBe(userA.id);
    expect(exportA.profile?.id).toBe(userA.id);
    expect(exportA.profile?.credits).toBe(5);
    expect(exportA.credit_ledger.every((row) => row.external_id !== `signup:${userB.id}`)).toBe(true);
    expect(exportA.credit_ledger.some((row) => row.external_id === `signup:${userA.id}`)).toBe(true);
  });

  it("RLS blocks the export even if userA's own client is asked for userB's id", async () => {
    const { userA, userB } = await createTestUsers();
    const admin = adminClient();

    await admin.rpc("grant_credits", {
      p_user_id: userB.id,
      p_amount: 3,
      p_reason: "grant",
      p_external_id: `signup:${userB.id}`,
    });

    // userA's own session can never see userB's rows, no matter which id the
    // caller passes in — RLS is what actually enforces this, not the
    // function argument.
    await expect(buildAccountExport(userA.client, userB.id, userB.email)).rejects.toThrow();
  });

  it("an anonymous client cannot export anyone's data", async () => {
    const { userA, anon } = await createTestUsers();
    const admin = adminClient();

    await admin.rpc("grant_credits", {
      p_user_id: userA.id,
      p_amount: 1,
      p_reason: "grant",
      p_external_id: `signup:${userA.id}`,
    });

    await expect(buildAccountExport(anon, userA.id, userA.email)).rejects.toThrow();
  });
});
