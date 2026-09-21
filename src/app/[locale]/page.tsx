import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background p-8 text-center text-foreground">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      {user ? (
        <>
          <p className="text-muted-foreground">{t("signedInAs", { email: user.email ?? "" })}</p>
          <form action={`/${locale}/sign-out`} method="post">
            <Button type="submit" variant="secondary">
              {t("signOut")}
            </Button>
          </form>
        </>
      ) : (
        <>
          <p className="text-muted-foreground">{t("tagline")}</p>
          <Link href="/sign-in">
            <Button type="button">{t("signIn")}</Button>
          </Link>
        </>
      )}
    </main>
  );
}
