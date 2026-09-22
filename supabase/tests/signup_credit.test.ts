import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { adminClient } from "./helpers";

// E5: the one-time sign-up credit, granted by a database trigger
// (`on_auth_user_email_confirmed`) rather than application code, so it
// fires no matter which of the app's two sign-in methods actually confirms
// the email. `createTestUsers()` in helpers.ts always creates already-
// confirmed users (it needs a signed-in session immediately), so it can't
// exercise the unconfirmed-then-confirmed path — these tests create users
// directly against the admin API instead.
describe("automatic sign-up credit (E5)", () => {
  it("a user created already confirmed (Google-style) gets exactly 1 credit", async () => {
    const admin = adminClient();
    const email = `test-${randomUUID()}@example.com`;

    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    expect(error).toBeNull();
    const userId = data.user?.id as string;

    const { data: profile } = await admin.from("profiles").select("credits").eq("id", userId).single();
    expect(profile?.credits).toBe(1);

    const { data: ledgerRows } = await admin
      .from("credit_ledger")
      .select("delta, reason, external_id")
      .eq("user_id", userId);
    expect(ledgerRows).toHaveLength(1);
    expect(ledgerRows?.[0]).toMatchObject({
      delta: 1,
      reason: "grant",
      external_id: `signup:${userId}`,
    });
  });

  it("a user created unconfirmed (magic-link-style) gets no credit until the email is confirmed", async () => {
    const admin = adminClient();
    const email = `test-${randomUUID()}@example.com`;

    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: false,
    });
    expect(error).toBeNull();
    const userId = data.user?.id as string;

    const { data: beforeConfirm } = await admin.from("profiles").select("credits").eq("id", userId).single();
    expect(beforeConfirm?.credits).toBe(0);
    const { data: ledgerBefore } = await admin.from("credit_ledger").select("id").eq("user_id", userId);
    expect(ledgerBefore).toHaveLength(0);

    const { error: confirmError } = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
    expect(confirmError).toBeNull();

    const { data: afterConfirm } = await admin.from("profiles").select("credits").eq("id", userId).single();
    expect(afterConfirm?.credits).toBe(1);
    const { data: ledgerAfter } = await admin
      .from("credit_ledger")
      .select("delta, reason, external_id")
      .eq("user_id", userId);
    expect(ledgerAfter).toHaveLength(1);
    expect(ledgerAfter?.[0]).toMatchObject({
      delta: 1,
      reason: "grant",
      external_id: `signup:${userId}`,
    });
  });

  it("confirming again does not grant a second credit", async () => {
    const admin = adminClient();
    const email = `test-${randomUUID()}@example.com`;

    const { data } = await admin.auth.admin.createUser({ email, email_confirm: false });
    const userId = data.user?.id as string;

    await admin.auth.admin.updateUserById(userId, { email_confirm: true });
    // Nothing in the app re-confirms an already-confirmed user, but the
    // trigger fires on every update of email_confirmed_at — prove a repeat
    // touch is still a no-op, relying on grant_credits' own idempotent
    // external_id rather than on the trigger only firing once.
    await admin.auth.admin.updateUserById(userId, { email_confirm: true });

    const { data: profile } = await admin.from("profiles").select("credits").eq("id", userId).single();
    expect(profile?.credits).toBe(1);
    const { data: ledgerRows } = await admin.from("credit_ledger").select("id").eq("user_id", userId);
    expect(ledgerRows).toHaveLength(1);
  });
});
