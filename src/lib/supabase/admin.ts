import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client: bypasses RLS entirely. Only for code that must
// intentionally cross RLS (e.g. Trigger.dev tasks, the Polar webhook
// granting credits). Never import this from a client component — the
// `server-only` import above makes that fail the build (see CLAUDE.md §4).
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
