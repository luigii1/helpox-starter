import { Webhook, WebhookVerificationError } from "standardwebhooks";
import { Order$inboundSchema, type Order } from "@polar-sh/sdk/models/components/order.js";

export { WebhookVerificationError };

export type PolarWebhookEvent = { type: string; data: unknown };

// Uses standardwebhooks (the library Polar's own webhooks are built on)
// directly, rather than @polar-sh/sdk's `validateEvent` wrapper: that
// wrapper re-encodes the secret with `Buffer.from(secret, "utf-8")
// .toString("base64")` before constructing its Webhook instance, which
// computes the wrong signing key whenever the secret is in Polar's real
// `whsec_<base64>` wire format (confirmed against a real Polar webhook
// secret — it never verifies through that path even though it's exactly
// correct). Passing the secret straight through lets standardwebhooks do
// what its own constructor already implements: strip the whsec_ prefix and
// base64-decode the remainder itself.
//
// standardwebhooks' own .verify() only checks the signature and JSON-parses
// the body — it returns Polar's raw wire-format JSON as-is (snake_case:
// product_id, customer.external_id, ...), unlike @polar-sh/sdk's own
// validateEvent, which also transforms each event type into its typed,
// camelCase model. `event.data` here is therefore untyped on purpose; see
// parseOrderPaidEvent below for the one shape this app actually reads.
export function verifyPolarWebhook(
  rawBody: string,
  headers: Record<string, string>,
  secret: string,
): PolarWebhookEvent {
  const webhook = new Webhook(secret);
  return webhook.verify(rawBody, headers) as PolarWebhookEvent;
}

// Transforms a verified order.paid event's raw (snake_case) data into the
// typed, camelCase Order shape handleOrderPaid reads (order.productId,
// order.customer.externalId, ...). Reuses @polar-sh/sdk's own schema for
// this — only the SDK's *signature verification* was ever broken, not its
// per-type payload schemas, so there's no reason to reimplement this
// transform by hand.
export function parseOrderPaidEvent(data: unknown): Order {
  return Order$inboundSchema.parse(data);
}
