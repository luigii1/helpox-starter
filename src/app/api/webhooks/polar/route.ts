import "server-only";
import { NextResponse } from "next/server";
import { verifyPolarWebhook, WebhookVerificationError, SDKValidationError } from "@/lib/polar/verify-webhook";
import { handleOrderPaid } from "@/lib/polar/handle-order-paid";
import { createAdminClient } from "@/lib/supabase/admin";

// Node runtime (not edge): needed for the raw-body signature verification
// below, and the service-role client this route uses (CLAUDE.md §4).
export const runtime = "nodejs";

// POST /api/webhooks/polar — Polar calls this after a checkout completes.
// The raw text body (not request.json()) is what the signature is computed
// over, so it has to be read before anything else touches the request.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers);

  let event;
  try {
    event = verifyPolarWebhook(rawBody, headers, process.env.POLAR_WEBHOOK_SECRET!);
  } catch (error) {
    // Signature verification fails before any processing — 403, nothing
    // else touched. Never log the body or headers here: an invalid
    // signature could be an honest misconfiguration, not necessarily an
    // attack, but the payload could still contain personal data.
    if (error instanceof WebhookVerificationError) {
      return NextResponse.json({ error: "invalid_signature" }, { status: 403 });
    }
    if (error instanceof SDKValidationError) {
      // Signature was valid but the event type/shape isn't one this SDK
      // version recognizes — acknowledge so Polar doesn't retry forever,
      // there's just nothing for this route to do with it.
      return NextResponse.json({ ok: true });
    }
    // Anything else — most importantly a missing/malformed
    // POLAR_WEBHOOK_SECRET, which throws before signature verification even
    // runs — is a real failure, never a thing to report as success: doing so
    // would silently swallow every event (including order.paid) with no
    // credits ever granted and nothing to show for it. 500 makes Polar retry
    // and shows up in its delivery log instead of vanishing.
    //
    // TEMPORARY diagnostic (remove once the commander's live purchase
    // grants credits correctly): server-side only, in Vercel's own Runtime
    // Logs — never in the HTTP response, since Polar (or anyone who finds
    // this public URL) sees that. Never the secret's value, only whether
    // it's present at all in this deployment's environment, its length, and
    // whether it has the shape Polar's dashboard shows it in — enough to
    // tell "env var missing/empty here" apart from "env var present but
    // doesn't match Polar's copy" without exposing anything usable.
    const secret = process.env.POLAR_WEBHOOK_SECRET;
    console.error("polar webhook verification_failed diagnostic", {
      secretConfigured: typeof secret === "string" && secret.length > 0,
      secretLength: secret?.length ?? 0,
      secretHasWhsecPrefix: secret?.startsWith("whsec_") ?? false,
    });
    return NextResponse.json({ error: "verification_failed" }, { status: 500 });
  }

  // Only order.paid is subscribed to in Polar's dashboard, but this checks
  // explicitly rather than assuming — any other event type is acknowledged
  // and ignored.
  if (event.type !== "order.paid") {
    return NextResponse.json({ ok: true });
  }

  try {
    await handleOrderPaid(createAdminClient(), event.data);
  } catch {
    return NextResponse.json({ error: "grant_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
