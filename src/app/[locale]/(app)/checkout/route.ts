import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPolarClient } from "@/lib/polar/client";
import { CREDIT_PACKS } from "@/lib/credits/packs";

// POST-only (same reasoning as /sign-out and /api/account/delete): starting
// a checkout is a real action, never triggerable by a plain link.
export async function POST(request: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL(`/${locale}/sign-in`, request.url));
  }

  const formData = await request.formData();
  const requestedProductId = formData.get("polarProductId");

  // The only thing taken from the client is which of packs.ts's known
  // products was picked — never a price or amount. Polar looks up that
  // product's real price itself from the product id we send it.
  const pack = CREDIT_PACKS.find((candidate) => candidate.polarProductId === requestedProductId);
  if (!pack) {
    return NextResponse.json({ error: "invalid_pack" }, { status: 400 });
  }

  try {
    const checkout = await createPolarClient().checkouts.create({
      products: [pack.polarProductId],
      externalCustomerId: user.id,
      successUrl: new URL(`/${locale}/account`, request.url).toString(),
    });
    return NextResponse.redirect(checkout.url, 303);
  } catch {
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
