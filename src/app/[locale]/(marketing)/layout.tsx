import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

// Shared header/footer for every public marketing page (the landing page
// now, privacy/terms later in brick G1). The header's CTA is auth-aware —
// signed-in visitors get a link to their dashboard instead of sign-in —
// but nothing here gates access; (marketing) pages are public by design.
export default async function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Marketing" });
  const format = await getFormatter({ locale });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between p-4">
          <Link href="/" className="text-lg font-semibold text-foreground">
            {t("siteName")}
          </Link>
          <Link
            href={user ? "/dashboard" : "/sign-in"}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            {user ? t("nav.dashboard") : t("nav.signIn")}
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl p-4 text-sm text-muted-foreground">
          {t("footer.copyright", { year: format.number(new Date().getFullYear(), { useGrouping: false }) })}
        </div>
      </footer>
    </div>
  );
}
