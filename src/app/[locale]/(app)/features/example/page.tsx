import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ExampleActionForm } from "./example-action-form";

export default async function ExampleFeaturePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ExampleFeature" });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("credits").eq("id", user.id).single()
    : { data: null };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 p-8">
      <Card className="flex w-full flex-col gap-4">
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <ExampleActionForm initialCredits={profile?.credits ?? 0} />
      </Card>
    </main>
  );
}
