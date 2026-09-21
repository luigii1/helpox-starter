import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // CLAUDE.md is this repo's own hand-maintained instructions file (see project root);
  // don't let `next dev`/`next build` inject or rewrite content into it.
  agentRules: false,
  // The command center (public/center/index.html) reads docs/build-map.json and
  // docs/inspections/*.json at runtime via fs, not via a JS import, so Next's
  // build-time file tracing wouldn't otherwise bundle them into the deployed
  // serverless functions (brick P5).
  outputFileTracingIncludes: {
    "/api/build-map": ["./docs/build-map.json"],
    "/api/inspections": ["./docs/inspections/*.json"],
  },
  async rewrites() {
    return [{ source: "/center", destination: "/center/index.html" }];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
