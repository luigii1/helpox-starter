import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// CLAUDE.md §4 / brick S3: only this origin plus the third-party services
// the browser actually talks to — Supabase (auth/session calls) and Polar
// (checkout, brick E1+). Analytics (brick G4) needs no extra entry: Vercel
// Web Analytics loads its script and posts events same-origin
// (/_vercel/insights/...), not from a third-party domain (see
// docs/decisions.md for why it replaced the originally planned Plausible).
// `*.polar.sh` covers both their sandbox and production hosts without
// hard-coding one exact subdomain — Polar's docs weren't reachable from
// this sandbox's network to confirm the precise hostname (see
// docs/decisions.md); this should be re-checked against a real checkout
// once brick E1+ wires one up. `'unsafe-inline'` on script-src is required
// because Next.js injects its own hydration payload as an inline <script>
// without a nonce — a nonce-based CSP needs per-request generation in
// src/proxy.ts, out of this brick's next.config-only scope. `'unsafe-eval'`
// is never included, in dev or production (the one explicit security
// requirement for this brick).
function buildContentSecurityPolicy(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data:`,
    `font-src 'self'`,
    `connect-src 'self' ${supabaseUrl} https://*.polar.sh`.trim(),
    `frame-src https://*.polar.sh`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
  ].join("; ");
}

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
  // Only applied in production: Turbopack's dev server needs eval and a
  // websocket connection for Fast Refresh that a strict CSP would fight
  // with, and the brick's own security requirement only ever mentions
  // "production CSP" — `pnpm dev` is unaffected.
  async headers() {
    if (process.env.NODE_ENV !== "production") {
      return [];
    }
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: buildContentSecurityPolicy() },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
