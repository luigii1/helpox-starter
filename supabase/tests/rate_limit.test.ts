import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { anonClient, createTestUsers } from "./helpers";

describe("check_rate_limit", () => {
  it("allows calls up to the limit, then denies the next one", async () => {
    const client = anonClient();
    const key = `test:${randomUUID()}`;

    const first = await client.rpc("check_rate_limit", { p_key: key, p_limit: 3, p_window_seconds: 60 });
    const second = await client.rpc("check_rate_limit", { p_key: key, p_limit: 3, p_window_seconds: 60 });
    const third = await client.rpc("check_rate_limit", { p_key: key, p_limit: 3, p_window_seconds: 60 });
    const fourth = await client.rpc("check_rate_limit", { p_key: key, p_limit: 3, p_window_seconds: 60 });

    expect([first.data, second.data, third.data]).toEqual([true, true, true]);
    expect(fourth.data).toBe(false);
  });

  it("tracks different keys independently", async () => {
    const client = anonClient();
    const keyA = `test:${randomUUID()}`;
    const keyB = `test:${randomUUID()}`;

    await client.rpc("check_rate_limit", { p_key: keyA, p_limit: 1, p_window_seconds: 60 });
    const keyAExhausted = await client.rpc("check_rate_limit", { p_key: keyA, p_limit: 1, p_window_seconds: 60 });
    const keyBFresh = await client.rpc("check_rate_limit", { p_key: keyB, p_limit: 1, p_window_seconds: 60 });

    expect(keyAExhausted.data).toBe(false);
    expect(keyBFresh.data).toBe(true);
  });

  it("frees the limit again once the window has passed", async () => {
    const client = anonClient();
    const key = `test:${randomUUID()}`;

    const first = await client.rpc("check_rate_limit", { p_key: key, p_limit: 1, p_window_seconds: 1 });
    const second = await client.rpc("check_rate_limit", { p_key: key, p_limit: 1, p_window_seconds: 1 });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const third = await client.rpc("check_rate_limit", { p_key: key, p_limit: 1, p_window_seconds: 1 });

    expect(first.data).toBe(true);
    expect(second.data).toBe(false);
    expect(third.data).toBe(true);
  });

  it("is callable by an authenticated user too, not just anon", async () => {
    const { userA } = await createTestUsers();
    const key = `test:${randomUUID()}`;

    const { data, error } = await userA.client.rpc("check_rate_limit", {
      p_key: key,
      p_limit: 1,
      p_window_seconds: 60,
    });

    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  it("rejects a non-positive limit or window instead of silently allowing everything", async () => {
    const client = anonClient();
    const key = `test:${randomUUID()}`;

    const badLimit = await client.rpc("check_rate_limit", { p_key: key, p_limit: 0, p_window_seconds: 60 });
    const badWindow = await client.rpc("check_rate_limit", { p_key: key, p_limit: 1, p_window_seconds: 0 });

    expect(badLimit.error).not.toBeNull();
    expect(badWindow.error).not.toBeNull();
  });

  it("does not let a client read the underlying hit table directly", async () => {
    const client = anonClient();
    const { error } = await client.from("rate_limit_hits").select("id").limit(1);
    expect(error).not.toBeNull();
  });
});
