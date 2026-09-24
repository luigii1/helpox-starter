import { Webhook, WebhookVerificationError } from "standardwebhooks";

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
export function verifyPolarWebhook(
  rawBody: string,
  headers: Record<string, string>,
  secret: string,
): PolarWebhookEvent {
  const webhook = new Webhook(secret);
  return webhook.verify(rawBody, headers) as PolarWebhookEvent;
}
