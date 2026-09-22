import { NextResponse } from "next/server";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateJsonBody } from "@/lib/validation";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { routing } from "@/i18n/routing";
import { InsufficientCreditsError, runExampleAction } from "@/features/example/run-example-action";

const schema = z.object({
  input: z.string().min(1).max(200),
  simulateFailure: z.boolean().optional().default(false),
});

// Keyed by user, not IP: this only runs for a signed-in session, and the
// limit is about one account hammering a credit-consuming endpoint
// (CLAUDE.md §4), not about anonymous traffic.
const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const withinLimit = await checkRateLimit(
    supabase,
    `example-action:user:${user.id}`,
    RATE_LIMIT,
    RATE_LIMIT_WINDOW_SECONDS,
  );
  if (!withinLimit) {
    // This route isn't nested under `[locale]` (it's an API route, not a
    // page), so there is no per-request locale to read — the client
    // already knows its own locale and reacts to the 429 status itself;
    // `message` here is just a reasonable default-locale fallback.
    const t = await getTranslations({ locale: routing.defaultLocale, namespace: "RateLimit" });
    return rateLimitResponse(t("tooManyRequests"), RATE_LIMIT_WINDOW_SECONDS);
  }

  const result = await validateJsonBody(request, schema);
  if ("response" in result) {
    return result.response;
  }

  try {
    const actionResult = await runExampleAction(
      supabase,
      createAdminClient(),
      result.data.input,
      result.data.simulateFailure,
    );
    return NextResponse.json(actionResult);
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
    }
    return NextResponse.json({ error: "action_failed" }, { status: 500 });
  }
}
