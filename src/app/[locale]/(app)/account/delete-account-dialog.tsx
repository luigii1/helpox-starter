"use client";

import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, type DialogHandle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Status = "idle" | "deleting" | "error";

// The literal word the server checks for too (src/app/api/account/delete/
// route.ts) — "fresh confirmation" (CLAUDE.md/brick G3 security) means the
// user has to deliberately type this immediately before deleting, not just
// click a button that happened to be on the page.
const CONFIRMATION_PHRASE = "DELETE";

export function DeleteAccountDialog() {
  const t = useTranslations("Account");
  const router = useRouter();
  const dialogRef = useRef<DialogHandle>(null);
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("deleting");

    const response = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation }),
    });

    if (!response.ok) {
      setStatus("error");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="danger" onClick={() => dialogRef.current?.showModal()}>
        {t("deleteAccount")}
      </Button>
      <Dialog ref={dialogRef} title={t("deleteConfirmTitle")}>
        <form onSubmit={handleDelete} className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t("deleteConfirmBody")}</p>
          <Input
            required
            placeholder={t("deleteConfirmPlaceholder")}
            aria-label={t("deleteConfirmLabel", { phrase: CONFIRMATION_PHRASE })}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          <Button
            type="submit"
            variant="danger"
            disabled={confirmation !== CONFIRMATION_PHRASE || status === "deleting"}
          >
            {status === "deleting" ? t("deleting") : t("deleteConfirmButton")}
          </Button>
          {status === "error" && <p className="text-sm text-danger">{t("deleteError")}</p>}
        </form>
      </Dialog>
    </>
  );
}
