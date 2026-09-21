import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

// Placeholder for the authenticated product area (CLAUDE.md §3's `(app)/`)
// — proves the protected-area redirect from brick A2; real product pages
// replace this later.
export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Dashboard" });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 bg-background p-8 text-center text-foreground">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("signedInAs", { email: user?.email ?? "" })}</p>
    </main>
  );
}
