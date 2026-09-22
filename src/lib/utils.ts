export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

// Deliberately broken: fails eslint's i18next/no-literal-string rule and
// tsc. Only exists to verify GitHub branch protection actually blocks a
// merge (brick T1's done_when) — reverted/deleted right after, never
// intended to be merged.
export const brokenOnPurpose: number = "this is not a number";
