import type { SupabaseClient } from "@supabase/supabase-js";

// Deletes the auth user via the admin (service-role) client. Every row this
// user owns cascades away automatically — profiles and credit_ledger both
// reference auth.users(id) with ON DELETE CASCADE (supabase/migrations/
// 20260921133608_profiles.sql, 20260921134645_credit_ledger.sql) — there is
// nothing else to clean up by hand, and any future table that references
// auth.users the same way is covered without touching this function.
//
// No `import "server-only"` here (unlike src/lib/supabase/admin.ts): this
// function only ever receives an already-constructed client as a parameter
// and never reads a secret itself, so the guard would add no real
// protection — it would just make this file (and anything that imports it,
// including this repo's own supabase/tests/*.test.ts files, which run
// under Vitest, not Next's webpack) fail to load outside a Next.js build.
// The actual protection against leaking the service-role key to client code
// lives on admin.ts's own `createAdminClient()`, which this never bypasses.
export async function deleteAccount(adminClient: SupabaseClient, userId: string): Promise<void> {
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) {
    throw new Error(`deleteAccount: ${error.message}`);
  }
}
