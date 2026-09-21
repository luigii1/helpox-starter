import { z } from "zod";

// Only an exact-origin-relative path is a safe redirect target: no scheme
// (blocks `javascript:`/`https://evil.example`) and no protocol-relative
// `//` (the browser would treat that as a different host).
const safeNextPathSchema = z
  .string()
  .refine((value) => value.startsWith("/") && !value.startsWith("//") && !value.includes("://"));

export function safeNextPath(value: string | null | undefined): string {
  if (!value) return "/";
  const parsed = safeNextPathSchema.safeParse(value);
  return parsed.success ? parsed.data : "/";
}
