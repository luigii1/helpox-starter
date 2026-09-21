"use client";

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Built on the native <dialog> element: it gives us a focus trap, Escape to
// close and backdrop styling for free, without a dependency.
export interface DialogHandle {
  showModal: () => void;
  close: () => void;
}

export interface DialogProps {
  title: string;
  children: ReactNode;
  className?: string;
  onClose?: () => void;
}

export const Dialog = forwardRef<DialogHandle, DialogProps>(function Dialog(
  { title, children, className, onClose },
  ref,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useImperativeHandle(ref, () => ({
    showModal: () => dialogRef.current?.showModal(),
    close: () => dialogRef.current?.close(),
  }));

  useEffect(() => {
    const el = dialogRef.current;
    if (!el || !onClose) return;
    el.addEventListener("close", onClose);
    return () => el.removeEventListener("close", onClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={cn(
        "relative rounded-lg border border-border bg-background p-6 text-foreground shadow-lg backdrop:bg-foreground/40",
        className,
      )}
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
      <button
        type="button"
        onClick={() => dialogRef.current?.close()}
        className="absolute right-4 top-4 text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label="Close"
      >
        ×
      </button>
    </dialog>
  );
});
