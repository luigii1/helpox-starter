import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// A stable error code, never a hard-coded English sentence for the API
// consumer to branch on (CLAUDE.md §6) — `message` alongside it is the
// already-translated text for the given locale, for a human reading the
// response directly (e.g. a non-JS auth redirect flow).
export type RateLimitedBody = {
  error: "rate_limited";
  message: string;
};

// Best-effort client IP for a request arriving through Vercel, which sets
// x-forwarded-for on every request it proxies. Never trusted for anything
// but rate-limit bucketing — it is not an identity check.
export function getClientIp(request: NextRequest | Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

// Records one hit for `key` and reports whether the caller is still under
// `limit` within the trailing `windowSeconds`, via the check_rate_limit
// Postgres function (supabase/migrations/20260921204740_rate_limits.sql).
// The limit is enforced in the database, not here — this is just the
// client-side call, so there is nothing to bypass by skipping this helper
// other than skipping the rate limit itself.
export async function checkRateLimit(
  supabase: SupabaseClient,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    throw new Error(`checkRateLimit: ${error.message}`);
  }
  return data === true;
}

// A ready-to-return 429 with a Retry-After header and an already-translated
// message. `retryAfterSeconds` is the rate limit's own window — an
// approximation of when the caller might succeed again, not an exact time.
export function rateLimitResponse(message: string, retryAfterSeconds: number): NextResponse<RateLimitedBody> {
  return NextResponse.json(
    { error: "rate_limited", message },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}
