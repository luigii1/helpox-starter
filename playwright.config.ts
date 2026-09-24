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
  },
});
