import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const VARIANT_CLASSES = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success text-primary-foreground",
  danger: "bg-danger text-primary-foreground",
} as const;

export type BadgeVariant = keyof typeof VARIANT_CLASSES;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
