import { describe, expect, it } from "vitest";
import { adminClient, createTestUsers } from "./helpers";

describe("credit_ledger RLS", () => {
  it("a user can read only their own ledger rows", async () => {
    const { userA, userB } = await createTestUsers();

    const admin = adminClient();
    const { error: insertError } = await admin
      .from("credit_ledger")
      .insert([
        { user_id: userA.id, delta: 1, reason: "grant" },
        { user_id: userB.id, delta: 1, reason: "grant" },
      ]);
    expect(insertError).toBeNull();

    const { data: ownRows, error: ownError } = await userA.client.from("credit_ledger").select("user_id");
    expect(ownError).toBeNull();
    expect(ownRows).toHaveLength(1);
    expect(ownRows?.[0]?.user_id).toBe(userA.id);
  });

  it("anon can read nothing", async () => {
    const { userA, anon } = await createTestUsers();

    const admin = adminClient();
    await admin.from("credit_ledger").insert({ user_id: userA.id, delta: 1, reason: "grant" });

    const { data, error } = await anon.from("credit_ledger").select("user_id");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("no client role can insert a ledger row", async () => {
    const { userA, anon } = await createTestUsers();

    const asUser = await userA.client.from("credit_ledger").insert({ user_id: userA.id, delta: 1, reason: "grant" });
    expect(asUser.error).not.toBeNull();

    const asAnon = await anon.from("credit_ledger").insert({ user_id: userA.id, delta: 1, reason: "grant" });
    expect(asAnon.error).not.toBeNull();
  });

  it("no client role can update or delete a ledger row", async () => {
    const { userA } = await createTestUsers();

    const admin = adminClient();
    const { data: inserted, error: insertError } = await admin
      .from("credit_ledger")
      .insert({ user_id: userA.id, delta: 1, reason: "grant" })
      .select("id")
      .single();
    expect(insertError).toBeNull();
    const id = inserted?.id;

    const updateResult = await userA.client.from("credit_ledger").update({ delta: 999 }).eq("id", id);
    expect(updateResult.error).not.toBeNull();

    const deleteResult = await userA.client.from("credit_ledger").delete().eq("id", id);
    expect(deleteResult.error).not.toBeNull();
  });
});
