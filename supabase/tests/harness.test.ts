import { describe, expect, it } from "vitest";
import { createTestUsers } from "./helpers";

describe("RLS test harness", () => {
  it("signs in two different users and gives an anon client", async () => {
    const { userA, userB, anon } = await createTestUsers();

    expect(userA.id).not.toBe(userB.id);

    const { data: dataA, error: errorA } = await userA.client.auth.getUser();
    expect(errorA).toBeNull();
    expect(dataA.user?.id).toBe(userA.id);

    const { data: dataB, error: errorB } = await userB.client.auth.getUser();
    expect(errorB).toBeNull();
    expect(dataB.user?.id).toBe(userB.id);

    const { data: anonData } = await anon.auth.getUser();
    expect(anonData.user).toBeNull();
  });
});
