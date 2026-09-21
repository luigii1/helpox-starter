"use client";

import { useRef } from "react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, type DialogHandle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToastProvider, useToast } from "@/components/ui/toast";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
}

function ToastDemo() {
  const showToast = useToast();
  return (
    <>
      <Button variant="secondary" onClick={() => showToast("Default toast")}>
        Show toast
      </Button>
      <Button variant="secondary" onClick={() => showToast("Saved successfully", "success")}>
        Show success toast
      </Button>
      <Button variant="danger" onClick={() => showToast("Something went wrong", "danger")}>
        Show danger toast
      </Button>
    </>
  );
}

function DialogDemo() {
  const dialogRef = useRef<DialogHandle>(null);
  return (
    <>
      <Button onClick={() => dialogRef.current?.showModal()}>Open dialog</Button>
      <Dialog ref={dialogRef} title="Example dialog">
        <p className="text-sm text-muted-foreground">
          Press Escape, click the backdrop or the × to close. Focus is trapped inside while open.
        </p>
      </Dialog>
    </>
  );
}

export default function UiShowcasePage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <ToastProvider>
      <main className="mx-auto flex max-w-2xl flex-col gap-8 bg-background p-8 text-foreground">
        <h1 className="text-2xl font-semibold">UI primitives</h1>
        <p className="text-sm text-muted-foreground">
          Dev-only page (returns 404 outside development). Reflects the OS/browser color scheme via
          src/styles/tokens.css.
        </p>

        <Section title="Button">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </Section>

        <Section title="Badge">
          <Badge>Default</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="danger">Danger</Badge>
        </Section>

        <Section title="Input">
          <Input placeholder="you@example.com" aria-label="Email" className="max-w-xs" />
          <Input placeholder="Disabled" disabled className="max-w-xs" />
        </Section>

        <Section title="Textarea">
          <Textarea placeholder="Write something…" aria-label="Message" className="max-w-xs" />
        </Section>

        <Section title="Card">
          <Card className="max-w-xs">
            <p className="text-sm">A card is just a bordered, padded box using the same tokens.</p>
          </Card>
        </Section>

        <Section title="Dialog">
          <DialogDemo />
        </Section>

        <Section title="Toast">
          <ToastDemo />
        </Section>
      </main>
    </ToastProvider>
  );
}
