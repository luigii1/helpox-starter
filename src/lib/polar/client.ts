import "server-only";
import { Polar } from "@polar-sh/sdk";

// "sandbox" until a product's own real Polar organization goes live (see
// README.md's "Starting a new product" guide) — an explicit env var rather
// than inferring from the Vercel environment, so switching to production
// is a deliberate, documented action, not an accident of where it's deployed.
export function createPolarClient(): Polar {
  return new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN!,
    server: process.env.POLAR_SERVER === "production" ? "production" : "sandbox",
  });
}
