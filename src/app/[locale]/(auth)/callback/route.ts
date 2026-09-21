import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/safe-redirect";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

const codeSchema = z.string().min(1);

// Keyed by IP, not by user: this runs before a session exists, so there is
// no user yet to key on. 20 attempts per minute is generous for a real
// sign-in flow (including retries after a typo'd/expired link) while still
// blocking a script hammering the endpoint (CLAUDE.md §4).
const RATE_LIMIT = 20;
const RATE_LIMIT_WINDOW_SECONDS = 60;

export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { searchParams, origin } = new URL(request.url);
  // Falls back to "/" (bare, no locale) when `next` is missing or unsafe —
  // the i18n middleware redirects that to `/${locale}` on the next request.
  const next = safeNextPath(searchParams.get("next"));
  const codeResult = codeSchema.safeParse(searchParams.get("code"));
  const supabase = await createClient();

  const withinLimit = await checkRateLimit(
    supabase,
    `auth-callback:ip:${getClientIp(request)}`,
    RATE_LIMIT,
    RATE_LIMIT_WINDOW_SECONDS,
  );
  if (!withinLimit) {
    const t = await getTranslations({ locale, namespace: "RateLimit" });
    return rateLimitResponse(t("tooManyRequests"), RATE_LIMIT_WINDOW_SECONDS);
  }

  if (codeResult.success) {
    const { error } = await supabase.auth.exchangeCodeForSession(codeResult.data);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/${locale}/sign-in?error=auth`);
}
