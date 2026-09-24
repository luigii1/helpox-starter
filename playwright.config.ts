import { defineConfig } from "@playwright/test";

// This suite never starts its own server (no `webServer` entry below): it
// exercises a real, already-deployed Preview URL end to end — including a
// real Polar sandbox checkout and a real webhook delivery back to that
// deployment — which only works against something publicly reachable.
// PLAYWRIGHT_BASE_URL is required; see e2e/smoke.spec.ts and
// .github/workflows/e2e-smoke.yml for how it's supplied.
if (!process.env.PLAYWRIGHT_BASE_URL) {
  throw new Error(
    "PLAYWRIGHT_BASE_URL is required — point it at a deployed Preview URL. This suite never runs against localhost.",
  );
}

// Vercel Preview deployments are protected by "Vercel Authentication" by
// default (a login wall in front of the whole deployment, confirmed live —
// the first real run of this suite hit it instead of the app). Production
// isn't protected the same way, which is why nothing in this repo noticed
// this until a Preview URL was actually driven headlessly. Vercel's own
// "Protection Bypass for Automation" setting (Project Settings → Deployment
// Protection) issues a secret for exactly this case; sending it on every
// request as this header skips the wall. Optional here (undefined just
// means no header is added) so this config still works unmodified against
// an unprotected deployment.
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    extraHTTPHeaders: bypassSecret ? { "x-vercel-protection-bypass": bypassSecret } : undefined,
  },
});
