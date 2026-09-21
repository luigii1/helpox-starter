import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // CLAUDE.md is this repo's own hand-maintained instructions file (see project root);
  // don't let `next dev`/`next build` inject or rewrite content into it.
  agentRules: false,
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
