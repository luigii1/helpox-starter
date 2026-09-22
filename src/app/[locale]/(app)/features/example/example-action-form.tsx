"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Status = "idle" | "running" | "error" | "insufficient" | "rate_limited";

type ActionResponse = { ok: true; output: string; newBalance: number } | { ok: false; newBalance: number };

export function ExampleActionForm({ initialCredits }: { initialCredits: number }) {
  const t = useTranslations("ExampleFeature");
  const [input, setInput] = useState("");
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [credits, setCredits] = useState(initialCredits);
  const [output, setOutput] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("running");
    setOutput(null);

    const response = await fetch("/api/features/example", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, simulateFailure }),
    });

    if (response.status === 402) {
      setStatus("insufficient");
      return;
    }
    if (response.status === 429) {
      setStatus("rate_limited");
      return;
    }
    if (!response.ok) {
      setStatus("error");
      return;
    }

    const body = (await response.json()) as ActionResponse;
    setCredits(body.newBalance);
    if (body.ok) {
      setOutput(body.output);
      setStatus("idle");
    } else {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t("creditsLabel", { count: credits })}</p>
      <Input
        required
        placeholder={t("inputPlaceholder")}
        aria-label={t("inputLabel")}
        value={input}
        onChange={(event) => setInput(event.target.value)}
      />
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={simulateFailure}
          onChange={(event) => setSimulateFailure(event.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        {t("simulateFailureLabel")}
      </label>
      <Button type="submit" disabled={status === "running" || credits < 1}>
        {status === "running" ? t("running") : t("runButton")}
      </Button>
      {status === "insufficient" && <p className="text-sm text-danger">{t("insufficientCredits")}</p>}
      {status === "rate_limited" && <p className="text-sm text-danger">{t("rateLimited")}</p>}
      {status === "error" && <p className="text-sm text-danger">{t("actionFailed")}</p>}
      {output !== null && <p className="text-sm text-foreground">{t("outputLabel", { output })}</p>}
    </form>
  );
}
