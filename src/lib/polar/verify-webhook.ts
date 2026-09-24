import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { SDKValidationError } from "@polar-sh/sdk/models/errors/sdkvalidationerror.js";

export { WebhookVerificationError, SDKValidationError };

// Thin wrapper so the route handler (the only file that reads
// POLAR_WEBHOOK_SECRET, and so the only one that needs `import "server-only"`)
// can hand this a plain secret string — kept separate so this part is
// testable with a constructed secret, without pulling `server-only` into
// the test.
export function verifyPolarWebhook(rawBody: string, headers: Record<string, string>, secret: string) {
  return validateEvent(rawBody, headers, secret);
}
