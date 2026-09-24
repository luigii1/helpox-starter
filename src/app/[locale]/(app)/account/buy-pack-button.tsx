"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Status = "idle" | "loading" | "error";

export function BuyPackButton({ polarProductId, label }: { polarProductId: string; label: string }) {
  const t = useTranslations("Account");
  const locale = useLocale();
  const [status, setStatus] = useState<Status>("idle");

  async function handleClick() {
    setStatus("loading");

    const response = await fetch(`/${locale}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ polarProductId }),
    });

    if (!response.ok) {
      setStatus("error");
      return;
    }

    const body = (await response.json()) as { url: string };
    window.location.href = body.url;
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="secondary" className="w-full" disabled={status === "loading"} onClick={handleClick}>
        {status === "loading" ? t("buyPackLoading") : label}
      </Button>
      {status === "error" && <p className="text-sm text-danger">{t("buyError")}</p>}
    </div>
  );
}
