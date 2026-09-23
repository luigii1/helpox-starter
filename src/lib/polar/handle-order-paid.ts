import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order } from "@polar-sh/sdk/models/components/order.js";
import { creditsForProductId } from "@/lib/credits/packs";

// The credit-granting side of the webhook (brick E4) — kept separate from
// the route handler so it's testable with a plain mocked or real admin
// client, the same pattern as src/features/example/run-example-action.ts.
// Idempotent on the Polar order id: grant_credits' own unique external_id
// makes a replayed or duplicate-delivered event a no-op, never a double
// grant — this function doesn't need to detect a duplicate itself.
export async function handleOrderPaid(admin: SupabaseClient, order: Order): Promise<void> {
  const credits = order.productId ? creditsForProductId(order.productId) : null;
  const userId = order.customer.externalId;

  // Nothing to grant against (unknown product, e.g. a leftover test
  // product) or no way to know which account paid — acknowledge by simply
  // returning; the route responds 200 either way.
  if (!credits || !userId) {
    return;
  }

  const { error } = await admin.rpc("grant_credits", {
    p_user_id: userId,
    p_amount: credits,
    p_reason: "purchase",
    p_external_id: `polar:${order.id}`,
  });

  if (error) {
    throw new Error(`handleOrderPaid: grant failed: ${error.message}`);
  }
}
