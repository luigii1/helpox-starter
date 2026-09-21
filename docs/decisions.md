# Decision log

Record every decision that changes the stack, adds a dependency, or departs from `CLAUDE.md`.
Newest first. One entry per decision: date, decision, why, alternatives considered.

---

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
