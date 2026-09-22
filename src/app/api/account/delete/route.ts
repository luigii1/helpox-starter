import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteAccount } from "@/lib/account/delete-account";
import { validateJsonBody } from "@/lib/validation";

// The literal word, not translated: it has to match exactly what the client
// dialog requires the user to type, and a fixed value keeps that check
// identical regardless of locale (only "en" exists today, but this won't
// need to change when a second one is added).
const schema = z.object({ confirmation: z.literal("DELETE") });

// POST-only (same reasoning as /sign-out): a destructive action must never
// be triggerable by a plain link, an <img> tag, or prefetching. The
// confirmation body is the "fresh confirmation" security requirement
// enforced server-side, not just as client-side UX the caller could skip
// by hitting this route directly.
export async function POST(request: Request) {
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

  try {
    // Always the session's own id — never a client-supplied one, so there
    // is no way to make this request delete anyone but the caller.
    await deleteAccount(createAdminClient(), user.id);
  } catch {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  // The user no longer exists, so their session is already invalid at
  // Supabase's end; signOut() just clears the now-stale cookie locally.
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
