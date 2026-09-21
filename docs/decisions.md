# Decision log

Record every decision that changes the stack, adds a dependency, or departs from `CLAUDE.md`.
Newest first. One entry per decision: date, decision, why, alternatives considered.

---

## 2026-09-21 — Auth routes built flat, not under `[locale]/` (brick A1)
**Decision:** `src/app/(auth)/sign-in`, `/callback`, `/sign-out` were added directly under
`src/app/`, not under a `src/app/[locale]/` segment, even though `CLAUDE.md` §3's target structure
shows `(auth)` nested inside `[locale]/`.
**Why:** Locale routing (`[locale]/`) is brick H3 (step 24, still `todo`), which comes after A1
(step 11) in build order. Building `[locale]/` now to satisfy A1 would mean building H3's work
early, and moving `/` and `/dev/ui` under it too — out of scope for "build only this brick."
**Consequence:** H3 will need to move `(auth)`, `page.tsx` and future routes under `[locale]/`
when it lands; noted here so that move isn't a surprise. No behavior change for A1 itself — the
Supabase redirect URLs registered for `/callback` will need updating to `/{locale}/callback` (or
the callback kept outside the locale segment, a call for H3 to make) at that point.

## 2026-09-21 — New dependency: `zod` (brick A1)
**Decision:** Added `zod`, used to validate the `code` query param on the auth callback route
(`src/app/(auth)/callback/route.ts`) and to build the open-redirect-safe `next` path sanitizer
(`src/lib/auth/safe-redirect.ts`, unit-tested in `safe-redirect.test.ts`).
**Why:** Already the fixed stack choice for input validation per `CLAUDE.md` §2 ("Validation:
zod — All external input"); A1 is the first brick to actually validate a request, so this is
adopting the already-declared stack rather than a new substitution.
**Consequence:** `vitest.config.ts`'s test `include` was widened from only `supabase/tests/**` to
also pick up colocated `src/**/*.test.ts` files, so the redirect-safety logic can have a real,
CI-runnable unit test that doesn't need a live Supabase stack (unlike the RLS tests).

## 2026-09-21 — Google sign-in needs manual Supabase-dashboard configuration (brick A1)
**Decision:** `supabase/config.toml` now has an `[auth.external.google]` block (disabled,
credentials via `env(...)` substitution) matching the existing Apple stub — this only affects
`supabase start` for local dev/CI. The deployed cloud project's Google provider must be enabled
separately in the Supabase dashboard (Authentication → Providers → Google, with a real Google
Cloud OAuth client ID/secret) and the app's `/callback` URL added to Authentication → URL
Configuration's redirect allow-list. Supabase's GitHub integration (see the 2026-09-21 migrations
entry above) only syncs `supabase/migrations/*.sql`, not `config.toml`'s auth provider settings.
**Why:** No CLI/API access to the cloud project's Auth settings is possible from this session
(network policy) or was set up for automatic config sync — this is a one-time, dashboard-only
setup step by design, not something code can do.
**Consequence:** A1 is `human_check: true` for exactly this reason — magic-link sign-in can be
built and is testable in principle without external config, but Google sign-in is code-complete
and cannot be verified end-to-end until the commander does this dashboard step. The
`commander_check_fi` spells out what to do.

## 2026-09-21 — New dependencies: `@supabase/ssr` and `server-only` (brick P4)
**Decision:** Added `@supabase/ssr` (runtime) and `server-only` (runtime) as dependencies.
`src/lib/supabase/server.ts` uses `@supabase/ssr`'s `createServerClient` to read the signed-in
user's session from cookies in Server Components / Route Handlers; `src/lib/supabase/client.ts`
uses its `createBrowserClient`. `admin.ts` and `server.ts` both start with `import "server-only"`.
**Why:** `@supabase/ssr` is Supabase's own officially documented package for the Next.js App
Router — plain `@supabase/supabase-js` has no cookie handling, so a server client needs it to
read the user's session at all. `server-only` is the standard, zero-config way to make importing
a module from client code fail the build, which is exactly `CLAUDE.md` §4's requirement and P4's
`done_when` (verified: a temporary "use client" page importing `admin.ts` failed `pnpm build`
with `'server-only' cannot be imported from a Client Component module`; removed after confirming).
**Alternatives considered:** hand-rolling cookie parsing — rejected, exactly the kind of
hand-rolled auth-adjacent code CLAUDE.md §1 says to avoid when a well-known library solves it.

## 2026-09-21 — Schema migrations deployed via Supabase's GitHub integration, not CLI
**Decision:** The cloud Supabase project (`helpox-starter-dev`) applies `supabase/migrations/*.sql`
automatically through Supabase's own GitHub integration (dashboard-configured: Project Settings →
Integrations → GitHub, watching `main`, directory `/`), not via `supabase link` / `supabase db push`
run by anyone. `supabase/config.toml` and migrations are still authored locally (pure file operations,
no network) exactly as `CLAUDE.md` §3/§4 require.
**Why:** This session's environment cannot reach `supabase.com`, `api.supabase.com` or Docker Hub at
all — every host tried returned a 403 policy denial from the egress proxy, confirmed repeatedly. The
commander also does not want to install or run anything on their own machine (mirrors the earlier
decision to check the command center via Vercel instead of localhost). The GitHub integration needs
neither.
**Consequence:** `supabase start` (the local Postgres/Auth/Storage stack, needed for RLS tests per
`CLAUDE.md` §2) cannot be run or verified from this session either — Docker image pulls hit the same
block. That verification is deferred to brick T1's GitHub Actions CI, which has normal internet access
and can run the full local stack. Until T1 exists, a brick that needs to prove RLS behavior (D1/D2/D3)
will need to say plainly that live verification is pending CI, the same way P3 did for its cloud check.
**Verification:** confirmed via the "Supabase Preview" GitHub check appearing on PR #9 (linked to the
correct project) and the commander confirming the empty migration's timestamp appears on the
project's Database → Migrations page.

## 2026-09-21 — Command center UI: plain paper-manual, no robot
**Decision:** `center/index.html` no longer draws a robot illustration or shows a separate
"what's next" status box above the manual. It shows only: numbered pages (one per module), each
page's bricks as a checklist (checkbox checked = approved; a small tag for awaiting_commander/
building/inspecting/rework; nothing shown for plain todo), an overall progress bar, and two
page-turn buttons centered below the checklist. Clicking a row expands why_fi and, for
awaiting_commander, the commander_check_fi and any inspection summary — an awaiting_commander
brick auto-expands so the commander doesn't have to hunt for what to check.
**Why:** The commander asked for it directly — a page that reads like a paper instruction manual
getting filled in as work completes, without the robot metaphor's visual layer or a separate status
box competing with the manual for attention.
**Consequence:** C1's `done_when` and `commander_check_fi` in `docs/build-map.json` were updated to
match (no more "shows the robot model"). The robot metaphor name in this file's history and in
`CLAUDE.md` §10 ("Lego-robotti") is now only a naming/talking-point convention for module ↔ manual
page ↔ robot part, not something rendered on the page.

## 2026-09-21 — Fix: pin Vercel to serve the repo root as static output
**Decision:** `vercel.json` now sets `"buildCommand": null` and `"outputDirectory": "."`.
**Why:** After brick P1 added `package.json` (with a `next build` script), the commander's Vercel
deployment failed: `Error: No Output Directory named "public" found after the Build completed.` Vercel's
"Other" framework preset expects build output in `public/` once a `package.json` exists, even with no
explicit Build Command override — it ran a build step and then looked for `public/`, which doesn't exist.
Setting `buildCommand: null` stops any build from running; `outputDirectory: "."` tells Vercel to serve the
repo root exactly as it did before `package.json` existed.
**Consequence:** C1 was reopened (`approved` → `building`) since its `done_when` — the deployment actually
working — was not true when the commander's earlier check passed (P1 didn't exist yet, so this failure mode
didn't exist yet either). Re-inspected and awaiting the commander's check again.
**Note:** this is still the same stop-gap noted in the entry below — revisit at brick P5.

## 2026-09-21 — Command center checked on Vercel, not localhost
**Decision:** The command center is deployed on Vercel (Framework Preset: Other, no build command;
`vercel.json` rewrites `/` to `/center/index.html`; `api/inspections.js` is a Node serverless function
mirroring `center/serve.mjs`'s `/api/inspections` route). Every push gets its own preview deployment.
The commander does the `commander_check_fi` for every brick against the Vercel URL. `center/serve.mjs`
stays for local development only.
**Why:** The commander does not want to run anything on their own machine to check progress.
**Consequence — read before approving any brick:** with Framework Preset "Other" and no `outputDirectory`,
Vercel serves the *entire* repository as static files at their repo path (e.g. `/CLAUDE.md`,
`/docs/decisions.md` are publicly reachable, not just `center/` and `docs/build-map.json`). The commander
chose public (no Vercel Deployment Protection) since nothing in the repo is a secret or personal data —
this must stay true. `SUPABASE_SERVICE_ROLE_KEY`, `POLAR_*` and any other secret must only ever be a Vercel
environment variable, never a file in the repo (already required by `CLAUDE.md` §4). This replaces the
"binds to 127.0.0.1 only" security rule from the 2026-09-21 command-center decision below. Once P1 (the
real Next.js app) exists and is deployed to its own Vercel project (brick P5), this stop-gap setup should
be revisited — it was chosen for speed while only `center/` and `docs/` exist.
**Alternatives considered:** restricting the static output to only `center/` and `docs/build-map.json` via
a dedicated output folder — rejected for now since it needs a new top-level folder and duplicated files,
which `CLAUDE.md` §3 says to avoid without asking; Vercel Deployment Protection (password) — needs a paid
plan, declined by the commander.

## 2026-09-21 — Build with a command center, mechanic and inspector
**Decision:** The base is built brick by brick from `docs/build-map.json`. The main Claude Code session
(mechanic) builds; a separate `inspector` subagent verifies every brick and writes a report; the owners
(commanders) approve `human_check` bricks by using the result, never by reading code. Progress is shown in
a local command center (`center/`), which is the first brick.
**Why:** The owners are not programmers. Security must be verified by something other than the code's
author, and progress must be visible without reading code.
**Consequence:** `center/` and `.claude/agents/` are added to the structure. The command center has no
dependencies and binds only to 127.0.0.1.
**Metaphor:** the build is shown as assembling a Lego-style robot from an instruction manual. Each module is one
robot part and one page; each brick is a numbered step. Kept deliberately simple after trying a rocket and
an apartment building.

## 2026-09-21 — "First one free, then €1 each" pricing
**Decision:** 1 free credit on sign-up; then 5 credits for €4.99 or 12 credits for €9.99. Credits never
expire. No single purchase below ~€3.
**Customer message:** "First trip free. Then €1 per trip. No subscription."
**Why:** Fairness and pay-per-use is a core selling point versus competitors charging ~€5/month.
Selling €1 credits one at a time would leave only ~30% after VAT and Polar's fixed fee, and cheap single
purchases attract card-testing fraud and chargebacks ($15 each). Packs keep the €1-per-credit feel while each
purchase is ~€5, leaving ~65% net. The free credit removes the barrier to trying.
**Consequence:** revenue depends on volume and cheap distribution (sharing, creators), not paid ads.
The free credit is granted only after email verification and once per account (idempotent `external_id`).

## 2026-09-21 — Polar as payment provider
**Decision:** Use Polar as Merchant of Record for all payments.
**Why:** Helpox is a small Finnish company selling digital products to consumers globally. A Merchant of
Record handles VAT, sales tax and GST in every jurisdiction, so Helpox has one payout source instead of
tax obligations in dozens of countries. Polar is developer-focused with a good SDK.
**Costs to know (verify at polar.sh before launch):** new organizations pay 5% + $0.50 per transaction on
the free Starter plan; +1.5% on international cards; $15 per dispute; small payout fees.
**Consequence:** keep every purchase at ~€3 or more — the fixed fee makes tiny purchases inefficient.
**Alternatives:** Stripe (cheaper per transaction, but Helpox would handle EU OSS VAT and non-EU taxes
itself); Lemon Squeezy and Paddle (similar pricing, MoR).

## 2026-09-21 — No cookie banner
**Decision:** The base sets only essential authentication cookies and uses cookieless Plausible analytics.
**Why:** Essential cookies do not require consent under the ePrivacy Directive, so no consent banner is
needed. Faster pages, better conversion, less to maintain.
**Consequence:** any tracking, ad pixel or cookie-setting embed requires a new decision and a consent solution.

## 2026-09-21 — English for all code and docs
**Decision:** Code, comments, identifiers, commits and docs are in English; UI defaults to English with next-intl.
**Why:** Products target global markets; AI assistants follow English instructions most reliably.

## 2026-09-21 — Name: helpox-starter
**Decision:** The reusable base is called `helpox-starter`. Each product gets its own name and repo, copied from it.
**Why:** Internal, descriptive, English like the rest of the code. Product names are decided per product.

## 2026-09-21 — One-time credit packs, no subscriptions
**Decision:** The base supports only one-time purchases of credit packs.
**Why:** Helpox products are small, finished tools. Subscriptions create an expectation of continuous
development and add billing complexity (dunning, cancellations, proration).
