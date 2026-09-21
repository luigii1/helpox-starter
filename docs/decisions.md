# Decision log

Record every decision that changes the stack, adds a dependency, or departs from `CLAUDE.md`.
Newest first. One entry per decision: date, decision, why, alternatives considered.

---

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
