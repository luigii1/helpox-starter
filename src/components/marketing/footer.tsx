import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

// Shared across every route group ((marketing), (app), (auth)) so the legal
// pages are always reachable (CLAUDE.md launch checklist §D: "linked in the
// footer"), not just from the public landing page.
export async function Footer({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "Marketing.footer" });
  const format = await getFormatter({ locale });

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-2 p-4 text-sm text-muted-foreground sm:flex-row">
        <span>{t("copyright", { year: format.number(new Date().getFullYear(), { useGrouping: false }) })}</span>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-foreground hover:underline">
            {t("privacyLink")}
          </Link>
          <Link href="/terms" className="hover:text-foreground hover:underline">
            {t("termsLink")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
