import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Webhook } from "standardwebhooks";
import { verifyPolarWebhook, WebhookVerificationError } from "./verify-webhook";

// Shaped exactly like a real Polar webhook secret (whsec_ prefix, base64
// payload, = padding) — not a real one. This shape matters: the bug this
// file guards against (see verify-webhook.ts) only reproduces with a secret
// in this wire format, not with an arbitrary plain string.
const SECRET = `whsec_${randomBytes(32).toString("base64")}`;

function signRequest(payload: string) {
  const webhook = new Webhook(SECRET);
  const id = `msg_${randomUUID()}`;
  const timestamp = new Date();
  const signature = webhook.sign(id, timestamp, payload);
  return {
    "webhook-id": id,
    "webhook-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
    "webhook-signature": signature,
  };
}

function orderPaidPayload(overrides: { productId?: string | null } = {}) {
  return JSON.stringify({
    type: "order.paid",
    timestamp: new Date().toISOString(),
    data: {
      id: "order_1",
      created_at: new Date().toISOString(),
      modified_at: null,
      status: "paid",
      paid: true,
      subtotal_amount: 499,
      discount_amount: 0,
      net_amount: 499,
      tax_amount: 0,
      total_amount: 499,
      applied_balance_amount: 0,
      due_amount: 0,
      refunded_amount: 0,
      refunded_tax_amount: 0,
      currency: "eur",
      billing_reason: "purchase",
      billing_name: null,
      billing_address: null,
      invoice_number: null,
      is_invoice_generated: false,
      receipt_number: null,
      customer_id: "customer_1",
      product_id: overrides.productId ?? "6a7960c1-e346-4057-8fb2-9760484477ec",
      discount_id: null,
      subscription_id: null,
      checkout_id: null,
      metadata: {},
      platform_fee_amount: 0,
      platform_fee_currency: null,
      customer: {
        id: "customer_1",
        created_at: new Date().toISOString(),
        modified_at: null,
        metadata: {},
        external_id: "user-a",
        email: "a@example.com",
        email_verified: true,
        type: "regular",
        name: null,
        billing_name: null,
        billing_address: null,
        tax_id: null,
        organization_id: "org_1",
        avatar_url: null,
        deleted_at: null,
      },
      product: null,
      discount: null,
      subscription: null,
      items: [],
      description: "",
      refundable_amount: 499,
      refundable_tax_amount: 0,
    },
  });
}

describe("verifyPolarWebhook", () => {
  it("accepts a request genuinely signed with the matching secret", () => {
    const payload = orderPaidPayload();
    const headers = signRequest(payload);

    const event = verifyPolarWebhook(payload, headers, SECRET);

    expect(event.type).toBe("order.paid");
  });

  it("rejects a request signed with the wrong secret", () => {
    const payload = orderPaidPayload();
    const headers = signRequest(payload);

    expect(() => verifyPolarWebhook(payload, headers, `whsec_${randomBytes(32).toString("base64")}`)).toThrow(
      WebhookVerificationError,
    );
  });

  it("rejects a request whose body was tampered with after signing", () => {
    const payload = orderPaidPayload();
    const headers = signRequest(payload);
    const tamperedPayload = orderPaidPayload({ productId: "some-other-product" });

    expect(() => verifyPolarWebhook(tamperedPayload, headers, SECRET)).toThrow(WebhookVerificationError);
  });

  it("rejects a request with no signature headers at all", () => {
    const payload = orderPaidPayload();

    expect(() => verifyPolarWebhook(payload, {}, SECRET)).toThrow();
  });

  // Regression test: if the webhook secret env var is unset in the
  // deployment (e.g. only added to one Vercel environment while Polar's
  // webhook points at another), the route must not treat that as a
  // signature mismatch — it must throw something other than
  // WebhookVerificationError, so route.ts's catch can tell the two apart
  // and report a real failure (500) instead of quietly succeeding.
  it("throws something other than WebhookVerificationError when the secret is missing", () => {
    const payload = orderPaidPayload();
    const headers = signRequest(payload);

    expect(() => verifyPolarWebhook(payload, headers, undefined as unknown as string)).toThrow();
    try {
      verifyPolarWebhook(payload, headers, undefined as unknown as string);
      expect.unreachable();
    } catch (error) {
      expect(error).not.toBeInstanceOf(WebhookVerificationError);
    }
  });

  // A genuinely signed request for an event type this route doesn't
  // subscribe to must still verify successfully — route.ts's own
  // `event.type !== "order.paid"` check is what acknowledges and ignores
  // it, not a verification failure.
  it("verifies successfully for a validly signed event of an unrelated type", () => {
    const payload = JSON.stringify({ type: "checkout.created", data: {} });
    const headers = signRequest(payload);

    const event = verifyPolarWebhook(payload, headers, SECRET);

    expect(event.type).toBe("checkout.created");
  });
});
