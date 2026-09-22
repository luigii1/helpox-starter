import type { SupabaseClient } from "@supabase/supabase-js";

// Thrown before any credit is spent — the route handler maps this to 402,
// distinct from an unexpected error (500).
export class InsufficientCreditsError extends Error {}

export type ExampleActionResult =
  | { ok: true; output: string; newBalance: number }
  | { ok: false; newBalance: number };

// A stand-in for whatever a real feature's server-side work looks like —
// reverses the input text. `simulateFailure` exists only so this brick's
// own done_when ("a forced failure restores [the credit]") is actually
// demonstrable and testable; a real feature has its own natural failure
// modes instead of a flag like this.
function performTrivialAction(input: string): string {
  return [...input].reverse().join("");
}

// The pattern every credit-consuming feature in this codebase follows
// (CLAUDE.md §5): spend the credit server-side and atomically, before doing
// the work; if the work then fails, refund the exact ledger row that spend
// created. `supabase` is the caller's own session — consume_credits always
// acts on auth.uid(), never a user id argument — while `admin` is
// service-role, because refund_credits is callable only by service_role.
export async function runExampleAction(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  input: string,
  simulateFailure: boolean,
): Promise<ExampleActionResult> {
  const { data, error } = await supabase.rpc("consume_credits", { p_amount: 1 });
  if (error) {
    if (error.message.includes("insufficient_credits")) {
      throw new InsufficientCreditsError();
    }
    throw new Error(`runExampleAction: consume failed: ${error.message}`);
  }
  const { new_balance: newBalance, ledger_id: ledgerId } = data as { new_balance: number; ledger_id: number };

  if (simulateFailure) {
    const { error: refundError } = await admin.rpc("refund_credits", { p_ledger_id: ledgerId });
    if (refundError) {
      throw new Error(`runExampleAction: refund failed: ${refundError.message}`);
    }
    return { ok: false, newBalance: newBalance + 1 };
  }

  return { ok: true, output: performTrivialAction(input), newBalance };
}
