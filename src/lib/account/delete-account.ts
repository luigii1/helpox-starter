import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Deletes the auth user via the admin (service-role) client. Every row this
// user owns cascades away automatically — profiles and credit_ledger both
// reference auth.users(id) with ON DELETE CASCADE (supabase/migrations/
// 20260921133608_profiles.sql, 20260921134645_credit_ledger.sql) — there is
// nothing else to clean up by hand, and any future table that references
// auth.users the same way is covered without touching this function.
export async function deleteAccount(adminClient: SupabaseClient, userId: string): Promise<void> {
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) {
    throw new Error(`deleteAccount: ${error.message}`);
  }
}
