import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/safe-redirect";

const codeSchema = z.string().min(1);

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNextPath(searchParams.get("next"));
  const codeResult = codeSchema.safeParse(searchParams.get("code"));

  if (codeResult.success) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(codeResult.data);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth`);
}
