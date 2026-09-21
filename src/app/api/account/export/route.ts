import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAccountExport } from "@/lib/account/export";

// GET, not POST: this only reads the caller's own rows and changes nothing,
// so it's the right verb for a plain download link. The session cookie is
// the only input — nothing external to validate.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  let exportData;
  try {
    exportData = await buildAccountExport(supabase, user.id, user.email ?? null);
  } catch {
    return NextResponse.json({ error: "export_failed" }, { status: 500 });
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="helpox-data-export-${user.id}.json"`,
    },
  });
}
