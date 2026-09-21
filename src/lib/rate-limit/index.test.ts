import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkRateLimit, getClientIp, rateLimitResponse } from "./index";

function fakeRequest(headers: Record<string, string>): Request {
  return new Request("http://localhost/en/callback", { headers });
}

function fakeSupabase(response: { data: unknown; error: { message: string } | null }): SupabaseClient {
  return { rpc: vi.fn().mockResolvedValue(response) } as unknown as SupabaseClient;
}

describe("getClientIp", () => {
  it("returns the first address from x-forwarded-for", () => {
    expect(getClientIp(fakeRequest({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is missing", () => {
    expect(getClientIp(fakeRequest({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
  });

  it("falls back to 'unknown' when neither header is present", () => {
    expect(getClientIp(fakeRequest({}))).toBe("unknown");
  });
});

describe("checkRateLimit", () => {
  it("calls check_rate_limit with the given key, limit and window, returns true", async () => {
    const supabase = fakeSupabase({ data: true, error: null });
    const result = await checkRateLimit(supabase, "auth-callback:ip:1.2.3.4", 20, 60);
    expect(result).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith("check_rate_limit", {
      p_key: "auth-callback:ip:1.2.3.4",
      p_limit: 20,
      p_window_seconds: 60,
    });
  });

  it("returns false when the database says the limit is exceeded", async () => {
    const supabase = fakeSupabase({ data: false, error: null });
    const result = await checkRateLimit(supabase, "key", 1, 60);
    expect(result).toBe(false);
  });

  it("throws, rather than silently allowing the request, when the RPC call errors", async () => {
    const supabase = fakeSupabase({ data: null, error: { message: "connection refused" } });
    await expect(checkRateLimit(supabase, "key", 1, 60)).rejects.toThrow("connection refused");
  });
});

describe("rateLimitResponse", () => {
  it("returns a 429 with a Retry-After header and the given message", async () => {
    const response = rateLimitResponse("Too many requests. Please wait a moment and try again.", 60);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    const body = await response.json();
    expect(body).toEqual({
      error: "rate_limited",
      message: "Too many requests. Please wait a moment and try again.",
    });
  });
});
