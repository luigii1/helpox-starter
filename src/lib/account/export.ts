import type { SupabaseClient } from "@supabase/supabase-js";

export type AccountExport = {
  exported_at: string;
  account: { id: string; email: string | null };
  profile: { id: string; credits: number; created_at: string } | null;
  // There is no separate "products" table (CLAUDE.md §3) — Polar owns the
  // product catalog. Every purchase is instead a row here with
  // reason: "purchase" and an external_id/metadata identifying what was
  // bought, so this is where "product data" (brick G2's instructions)
  // actually lives for a given user.
  credit_ledger: {
    id: number;
    delta: number;
    reason: string;
    external_id: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
  }[];
};

// Builds the full GDPR export for one user (CLAUDE.md §4 "Users can export
// their data"). `supabase` must be a client scoped to that user's own
// session (RLS-enforced) — the explicit `.eq(..., userId)` filters below are
// a second, independent guard on top of RLS, not a substitute for it: even
// if `userId` were somehow wrong, RLS still limits every row to the
// session's own auth.uid(), so this can never return another user's data.
export async function buildAccountExport(
  supabase: SupabaseClient,
  userId: string,
  email: string | null,
): Promise<AccountExport> {
  const [profileResult, ledgerResult] = await Promise.all([
    supabase.from("profiles").select("id, credits, created_at").eq("id", userId).single(),
    supabase
      .from("credit_ledger")
      .select("id, delta, reason, external_id, metadata, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
  ]);

  if (profileResult.error) {
    throw new Error(`buildAccountExport: ${profileResult.error.message}`);
  }
  if (ledgerResult.error) {
    throw new Error(`buildAccountExport: ${ledgerResult.error.message}`);
  }

  return {
    exported_at: new Date().toISOString(),
    account: { id: userId, email },
    profile: profileResult.data,
    credit_ledger: ledgerResult.data ?? [],
  };
}
