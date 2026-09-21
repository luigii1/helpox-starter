import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account" });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The (app) layout already redirects signed-out visitors before this
  // page renders, but `user` is still nullable to TypeScript — the `!` here
  // would be unsafe, so this reads defensively instead.
  const { data: profile } = user
    ? await supabase.from("profiles").select("credits").eq("id", user.id).single()
    : { data: null };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 p-8">
      <Card className="flex w-full flex-col gap-4">
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
        <p className="text-2xl font-semibold text-foreground">
          {t("credits", { count: profile?.credits ?? 0 })}
        </p>

        {/* Buy/delete are wired in later bricks (E1+, G3) — the buttons exist
            now so this page's layout doesn't have to change later. */}
        <div className="flex flex-col gap-2">
          <Button type="button" disabled>
            {t("buyCredits")}
          </Button>
          {/* Plain <a>, not next/link's Link: this downloads a file
              (Content-Disposition: attachment) from an API route, not a page
              — Link's client-side RSC navigation isn't meant for that. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/account/export">
            <Button type="button" variant="secondary" className="w-full">
              {t("exportData")}
            </Button>
          </a>
          <Button type="button" variant="danger" disabled>
            {t("deleteAccount")}
          </Button>
        </div>
      </Card>
    </main>
  );
}
