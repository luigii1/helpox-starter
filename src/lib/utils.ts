export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

// Deliberately broken (2nd verification): fails tsc. Only exists to
// re-verify GitHub branch protection now blocks admin merges too, after
// enabling "Do not allow bypassing the above settings". Reverted right
// after — never intended to be merged.
export const brokenOnPurposeAgain: number = "still not a number";
