import { describe, expect, it } from "vitest";
import { createTestUsers } from "./helpers";

describe("profiles RLS", () => {
  it("a user can read only their own profile row", async () => {
    const { userA, userB } = await createTestUsers();

    const { data: ownRow, error: ownError } = await userA.client
      .from("profiles")
      .select("id")
      .eq("id", userA.id)
      .single();
    expect(ownError).toBeNull();
    expect(ownRow?.id).toBe(userA.id);

    const { data: othersRow, error: othersError } = await userA.client
      .from("profiles")
      .select("id")
      .eq("id", userB.id)
      .maybeSingle();
    expect(othersError).toBeNull();
    expect(othersRow).toBeNull();
  });

  it("anon can read nothing", async () => {
    const { userA, anon } = await createTestUsers();

    const { data, error } = await anon
      .from("profiles")
      .select("id")
      .eq("id", userA.id)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("a user cannot update their own credits", async () => {
    const { userA } = await createTestUsers();

    const { error } = await userA.client.from("profiles").update({ credits: 999 }).eq("id", userA.id);

    expect(error).not.toBeNull();
  });
});
