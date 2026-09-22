import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { InsufficientCreditsError, runExampleAction } from "./run-example-action";

type RpcResult = { data: unknown; error: { message: string } | null };

function fakeClient(rpcResults: Record<string, RpcResult>): SupabaseClient {
  return {
    rpc: vi.fn((fn: string) => Promise.resolve(rpcResults[fn])),
  } as unknown as SupabaseClient;
}

describe("runExampleAction", () => {
  it("consumes 1 credit and returns the reversed input on success", async () => {
    const supabase = fakeClient({
      consume_credits: { data: { new_balance: 4, ledger_id: 42 }, error: null },
    });
    const admin = fakeClient({});

    const result = await runExampleAction(supabase, admin, "abc", false);

    expect(result).toEqual({ ok: true, output: "cba", newBalance: 4 });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("refunds the exact ledger row and reports the restored balance on a forced failure", async () => {
    const supabase = fakeClient({
      consume_credits: { data: { new_balance: 4, ledger_id: 42 }, error: null },
    });
    const admin = fakeClient({
      refund_credits: { data: null, error: null },
    });

    const result = await runExampleAction(supabase, admin, "abc", true);

    expect(result).toEqual({ ok: false, newBalance: 5 });
    expect(admin.rpc).toHaveBeenCalledWith("refund_credits", { p_ledger_id: 42 });
  });

  it("throws InsufficientCreditsError before touching the admin client when the balance is too low", async () => {
    const supabase = fakeClient({
      consume_credits: { data: null, error: { message: "insufficient_credits" } },
    });
    const admin = fakeClient({});

    await expect(runExampleAction(supabase, admin, "abc", false)).rejects.toThrow(InsufficientCreditsError);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("throws a plain error for any other consume failure", async () => {
    const supabase = fakeClient({
      consume_credits: { data: null, error: { message: "connection refused" } },
    });
    const admin = fakeClient({});

    await expect(runExampleAction(supabase, admin, "abc", false)).rejects.toThrow("connection refused");
  });

  it("throws if the refund itself fails after a simulated failure", async () => {
    const supabase = fakeClient({
      consume_credits: { data: { new_balance: 4, ledger_id: 42 }, error: null },
    });
    const admin = fakeClient({
      refund_credits: { data: null, error: { message: "refund exploded" } },
    });

    await expect(runExampleAction(supabase, admin, "abc", true)).rejects.toThrow("refund exploded");
  });
});
