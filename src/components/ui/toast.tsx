"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "danger";
type ToastItem = { id: number; message: string; variant: ToastVariant };

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  default: "bg-foreground text-background",
  success: "bg-success text-primary-foreground",
  danger: "bg-danger text-primary-foreground",
};

type ShowToast = (message: string, variant?: ToastVariant) => void;
const ToastContext = createContext<ShowToast | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback<ShowToast>((message, variant = "default") => {
    const id = Date.now();
    setToasts((current) => [...current, { id, message, variant }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn("rounded-md px-4 py-2 text-sm shadow-lg", VARIANT_CLASSES[toast.variant])}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
