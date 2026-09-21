import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAccountExport } from "./export";

type QueryResult = { data: unknown; error: { message: string } | null };

function fakeChain(result: QueryResult) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
  };
  return chain;
}

function fakeSupabase(profileResult: QueryResult, ledgerResult: QueryResult): SupabaseClient {
  const profileChain = fakeChain(profileResult);
  const ledgerChain = fakeChain(ledgerResult);
  return {
    from: vi.fn((table: string) => (table === "profiles" ? profileChain : ledgerChain)),
  } as unknown as SupabaseClient;
}

describe("buildAccountExport", () => {
  it("returns the profile and ledger scoped to the given user", async () => {
    const supabase = fakeSupabase(
      { data: { id: "user-a", credits: 5, created_at: "2026-01-01T00:00:00Z" }, error: null },
      {
        data: [{ id: 1, delta: 5, reason: "grant", external_id: "signup:user-a", metadata: {}, created_at: "2026-01-01T00:00:00Z" }],
        error: null,
      },
    );

    const result = await buildAccountExport(supabase, "user-a", "a@example.com");

    expect(result.account).toEqual({ id: "user-a", email: "a@example.com" });
    expect(result.profile).toEqual({ id: "user-a", credits: 5, created_at: "2026-01-01T00:00:00Z" });
    expect(result.credit_ledger).toHaveLength(1);
    expect(result.credit_ledger[0]?.external_id).toBe("signup:user-a");
    expect(new Date(result.exported_at).toString()).not.toBe("Invalid Date");
  });

  it("scopes both queries to the given userId, not just relying on caller intent", async () => {
    const supabase = fakeSupabase(
      { data: { id: "user-a", credits: 0, created_at: "2026-01-01T00:00:00Z" }, error: null },
      { data: [], error: null },
    );

    await buildAccountExport(supabase, "user-a", null);

    const profileChain = (supabase.from as ReturnType<typeof vi.fn>).mock.results[0].value;
    const ledgerChain = (supabase.from as ReturnType<typeof vi.fn>).mock.results[1].value;
    expect(profileChain.eq).toHaveBeenCalledWith("id", "user-a");
    expect(ledgerChain.eq).toHaveBeenCalledWith("user_id", "user-a");
  });

  it("returns an empty ledger array, never null, when there are no rows", async () => {
    const supabase = fakeSupabase(
      { data: { id: "user-a", credits: 0, created_at: "2026-01-01T00:00:00Z" }, error: null },
      { data: null, error: null },
    );

    const result = await buildAccountExport(supabase, "user-a", null);
    expect(result.credit_ledger).toEqual([]);
  });

  it("throws, rather than returning partial data, when the profile query errors", async () => {
    const supabase = fakeSupabase({ data: null, error: { message: "no rows" } }, { data: [], error: null });
    await expect(buildAccountExport(supabase, "user-a", null)).rejects.toThrow("no rows");
  });

  it("throws when the ledger query errors", async () => {
    const supabase = fakeSupabase(
      { data: { id: "user-a", credits: 0, created_at: "2026-01-01T00:00:00Z" }, error: null },
      { data: null, error: { message: "connection refused" } },
    );
    await expect(buildAccountExport(supabase, "user-a", null)).rejects.toThrow("connection refused");
  });
});
