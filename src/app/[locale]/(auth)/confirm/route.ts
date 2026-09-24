import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/safe-redirect";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

// Companion to /callback: that route completes a PKCE `?code=` exchange —
// what a real user's clicked magic-link email produces, since
// signInWithOtp (called from the sign-in page) registers a code_challenge
// before Supabase ever sends the email. This route completes the same
// magic-link sign-in a different way: verifying a token_hash directly via
// Supabase's own verifyOtp, which needs no code_challenge/code_verifier
// pairing at all. Supabase's admin API (auth.admin.generateLink, used by
// e2e/smoke.spec.ts to sign a real test user in without a real inbox — see
// docs/decisions.md) can only ever produce a token_hash this way, never a
// PKCE-paired code, since generateLink isn't invoked by a browser that
// registered one. Both routes end in the same place: a real session,
// verified by Supabase's own SDK method, never a hand-rolled check.
const RATE_LIMIT = 20;
const RATE_LIMIT_WINDOW_SECONDS = 60;

// Scoped to exactly the one type this app ever generates a token_hash for
// today — narrower than accepting any Supabase EmailOtpType.
const paramsSchema = z.object({
  token_hash: z.string().min(1),
  type: z.literal("magiclink"),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { searchParams, origin } = new URL(request.url);
  const next = safeNextPath(searchParams.get("next"));
  const parsed = paramsSchema.safeParse({
    token_hash: searchParams.get("token_hash"),
    type: searchParams.get("type"),
  });
  const supabase = await createClient();

  const withinLimit = await checkRateLimit(
    supabase,
    `auth-confirm:ip:${getClientIp(request)}`,
    RATE_LIMIT,
    RATE_LIMIT_WINDOW_SECONDS,
  );
  if (!withinLimit) {
    const t = await getTranslations({ locale, namespace: "RateLimit" });
    return rateLimitResponse(t("tooManyRequests"), RATE_LIMIT_WINDOW_SECONDS);
  }

  if (parsed.success) {
    const { error } = await supabase.auth.verifyOtp(parsed.data);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // TEMPORARY diagnostic (remove once the E2E suite signs in
    // successfully): server-side only, in Vercel's own Runtime Logs —
    // never the token_hash itself, only Supabase's own explanation of why
    // verification failed, which doesn't embed the token or any secret.
    console.error("confirm route: verifyOtp failed", {
      message: error.message,
      status: error.status,
      code: error.code,
    });
  } else {
    console.error("confirm route: invalid query params", parsed.error.flatten());
  }

  return NextResponse.redirect(`${origin}/${locale}/sign-in?error=auth`);
}
