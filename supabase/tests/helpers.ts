import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// `supabase status -o env` (run by .github/workflows/test.yml) has used a
// couple of different default variable name casings across CLI versions, so
// accept either and fail loudly if neither is set — never fall back to a
// hardcoded URL or key here.
function requireEnv(names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(
    `Missing one of: ${names.join(", ")}. Run \`supabase start\` then \`supabase status -o env\` and check the actual variable names printed.`,
  );
}

function supabaseUrl(): string {
  return requireEnv(["SUPABASE_URL", "API_URL"]);
}

function anonKey(): string {
  return requireEnv(["SUPABASE_ANON_KEY", "ANON_KEY"]);
}

function serviceRoleKey(): string {
  return requireEnv(["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"]);
}

export function anonClient(): SupabaseClient {
  return createClient(supabaseUrl(), anonKey());
}

export function adminClient(): SupabaseClient {
  return createClient(supabaseUrl(), serviceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type TestUser = {
  id: string;
  email: string;
  client: SupabaseClient;
};

async function createTestUser(): Promise<TestUser> {
  const email = `test-${randomUUID()}@example.com`;
  const password = randomUUID();

  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Failed to create test user: ${error?.message ?? "no user returned"}`);
  }

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    throw new Error(`Failed to sign in test user: ${signInError.message}`);
  }

  return { id: data.user.id, email, client };
}

export async function createTestUsers(): Promise<{
  userA: TestUser;
  userB: TestUser;
  anon: SupabaseClient;
}> {
  const [userA, userB] = await Promise.all([createTestUser(), createTestUser()]);
  return { userA, userB, anon: anonClient() };
}
