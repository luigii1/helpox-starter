import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

type Section = { heading: string; body: string[] };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal.privacy.meta" });
  return { title: t("title"), description: t("description") };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal" });
  const tPrivacy = await getTranslations({ locale, namespace: "Legal.privacy" });
  const sections = tPrivacy.raw("sections") as Section[];

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12">
      <div className="mb-8 rounded-lg border border-danger bg-danger/10 p-4 text-sm text-danger">
        {t("draftNotice")}
      </div>
      <h1 className="mb-8 text-3xl font-semibold text-foreground">{tPrivacy("title")}</h1>
      <div className="flex flex-col gap-6">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="mb-2 text-lg font-medium text-foreground">{section.heading}</h2>
            <div className="flex flex-col gap-2">
              {section.body.map((paragraph) => (
                <p key={paragraph} className="text-sm text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
