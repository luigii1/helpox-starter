import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type FeatureItem = { title: string; description: string };
type FaqItem = { q: string; a: string };

// CLAUDE.md §5: 1 free credit on sign-up, then one-time packs. Numeric
// amounts only, formatted at render time — the surrounding labels all come
// from messages/en.json (CLAUDE.md §6).
const CREDIT_PACKS = [
  { credits: 5, priceEur: 4.99 },
  { credits: 12, priceEur: 9.99 },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Marketing.meta" });
  return {
    title: t("title"),
    description: t("description"),
    openGraph: { title: t("title"), description: t("description") },
  };
}

export default async function MarketingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Marketing" });
  const format = await getFormatter({ locale });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const features = t.raw("features.items") as FeatureItem[];
  const faqItems = t.raw("faq.items") as FaqItem[];

  return (
    <>
      <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 py-16 text-center sm:py-24">
        <h1 className="text-3xl font-semibold text-foreground sm:text-5xl">{t("hero.title")}</h1>
        <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">{t("hero.subtitle")}</p>
        <Link href={user ? "/dashboard" : "/sign-in"}>
          <Button type="button">{t("hero.cta")}</Button>
        </Link>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-12">
        <h2 className="mb-6 text-center text-2xl font-semibold text-foreground">{t("features.title")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <Card key={feature.title} className="flex flex-col gap-2">
              <h3 className="font-medium text-foreground">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-12">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-semibold text-foreground">{t("pricing.title")}</h2>
          <p className="text-muted-foreground">{t("pricing.subtitle")}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="flex flex-col items-center gap-2 text-center">
            <p className="text-sm text-muted-foreground">{t("pricing.freeLabel")}</p>
            <p className="text-2xl font-semibold text-foreground">{t("pricing.freeAmount", { count: 1 })}</p>
          </Card>
          {CREDIT_PACKS.map((pack) => (
            <Card key={pack.credits} className="flex flex-col items-center gap-2 text-center">
              <p className="text-sm text-muted-foreground">{t("pricing.packLabel", { count: pack.credits })}</p>
              <p className="text-2xl font-semibold text-foreground">
                {format.number(pack.priceEur, { style: "currency", currency: "EUR" })}
              </p>
            </Card>
          ))}
        </div>
        <div className="mt-6 flex justify-center">
          <Link href={user ? "/dashboard" : "/sign-in"}>
            <Button type="button" variant="secondary">
              {t("pricing.cta")}
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 py-12">
        <h2 className="mb-6 text-center text-2xl font-semibold text-foreground">{t("faq.title")}</h2>
        <div className="flex flex-col gap-2">
          {faqItems.map((item) => (
            <details key={item.q} className="rounded-lg border border-border p-4">
              <summary className="cursor-pointer font-medium text-foreground">{item.q}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
