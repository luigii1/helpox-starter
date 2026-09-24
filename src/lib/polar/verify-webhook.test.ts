import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Webhook } from "standardwebhooks";
import { verifyPolarWebhook, WebhookVerificationError, SDKValidationError } from "./verify-webhook";

const SECRET = "whsec_test_secret_do_not_use_in_production";

// The exact transform validateEvent (inside @polar-sh/sdk/webhooks) applies
// to the secret before handing it to standardwebhooks — replicated here so
// a signature built with the plain secret verifies correctly, the same way
// a real signature from Polar (signed with their copy of the same secret)
// would.
function signRequest(payload: string) {
  const base64Secret = Buffer.from(SECRET, "utf-8").toString("base64");
  const webhook = new Webhook(base64Secret);
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

    expect(() => verifyPolarWebhook(payload, headers, "whsec_a_completely_different_secret")).toThrow(
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
  // signature mismatch and
  // must not fall through to its "unrecognized event, acknowledge anyway"
  // branch either — both would report ok:true to Polar while never granting
  // credits, with nothing to show it happened. Confirms this throws, and
  // throws something other than WebhookVerificationError, so route.ts's
  // catch can tell the two apart.
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

  // A genuinely signed request for an event type this SDK version doesn't
  // recognize is the one case route.ts should acknowledge (200) without
  // granting anything — distinguished from every other failure above by
  // being an SDKValidationError, not a WebhookVerificationError.
  it("throws SDKValidationError for a validly signed but unrecognized event type", () => {
    const payload = JSON.stringify({ type: "some.future.event", data: {} });
    const headers = signRequest(payload);

    expect(() => verifyPolarWebhook(payload, headers, SECRET)).toThrow(SDKValidationError);
  });
});
