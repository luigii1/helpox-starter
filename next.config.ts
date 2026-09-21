import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CLAUDE.md is this repo's own hand-maintained instructions file (see project root);
  // don't let `next dev`/`next build` inject or rewrite content into it.
  agentRules: false,
};

export default nextConfig;
