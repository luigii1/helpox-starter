"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Status = "idle" | "sending" | "sent" | "error";

export default function SignInPage() {
  const t = useTranslations("SignIn");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/${locale}/callback` },
    });
    setStatus(error ? "error" : "sent");
  }

  async function handleGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/${locale}/callback` },
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 p-8">
      <Card className="flex w-full flex-col gap-4">
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>

        {status === "sent" ? (
          <p className="text-sm text-muted-foreground">{t("checkInbox", { email })}</p>
        ) : (
          <form onSubmit={handleMagicLink} className="flex flex-col gap-3">
            <Input
              type="email"
              required
              placeholder={t("emailPlaceholder")}
              aria-label={t("emailLabel")}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button type="submit" disabled={status === "sending"}>
              {status === "sending" ? t("sending") : t("sendLink")}
            </Button>
            {status === "error" && <p className="text-sm text-danger">{t("error")}</p>}
          </form>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {t("or")}
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button type="button" variant="secondary" onClick={handleGoogle}>
          {t("continueWithGoogle")}
        </Button>
      </Card>
    </main>
  );
}
