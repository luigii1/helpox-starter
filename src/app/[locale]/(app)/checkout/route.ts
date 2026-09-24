import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createPolarClient } from "@/lib/polar/client";
import { CREDIT_PACKS } from "@/lib/credits/packs";
import { validateJsonBody } from "@/lib/validation";

const schema = z.object({ polarProductId: z.string() });

// POST-only (same reasoning as /sign-out and /api/account/delete): starting
// a checkout is a real action, never triggerable by a plain link.
//
// Returns the checkout URL as JSON rather than an HTTP redirect, and the
// client (see account/buy-pack-button.tsx) navigates to it itself. A plain
// <form method="post"> redirecting straight to Polar's hosted checkout hit
// browsers' `form-action` CSP check on Vercel Preview deployments (their
// injected preview toolbar appears to interact with it) — a fetch-then-
// navigate isn't a form submission at all, so `form-action` never applies;
// the fetch itself is covered by `connect-src 'self'`, already allowed.
export async function POST(request: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const result = await validateJsonBody(request, schema);
  if ("response" in result) {
    return result.response;
  }

  // The only thing taken from the client is which of packs.ts's known
  // products was picked — never a price or amount. Polar looks up that
  // product's real price itself from the product id we send it.
  const pack = CREDIT_PACKS.find((candidate) => candidate.polarProductId === result.data.polarProductId);
  if (!pack) {
    return NextResponse.json({ error: "invalid_pack" }, { status: 400 });
  }

  try {
    const checkout = await createPolarClient().checkouts.create({
      products: [pack.polarProductId],
      externalCustomerId: user.id,
      successUrl: new URL(`/${locale}/account`, request.url).toString(),
    });
    return NextResponse.json({ url: checkout.url });
  } catch {
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
