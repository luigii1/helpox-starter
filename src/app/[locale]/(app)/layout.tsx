import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Footer } from "@/components/marketing/footer";

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

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 flex-col">{children}</div>
      <Footer locale={locale} />
    </div>
  );
}
