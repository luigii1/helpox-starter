import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Every route under (app) requires a signed-in session. Checked here, on
// the server, not only by hiding a link in the UI (CLAUDE.md §4/security).
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/sign-in`);
  }

  return <>{children}</>;
}
