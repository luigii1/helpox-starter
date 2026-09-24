# Decision log

Record every decision that changes the stack, adds a dependency, or departs from `CLAUDE.md`.
Newest first. One entry per decision: date, decision, why, alternatives considered.

---

## 2026-09-24 — `@playwright/test` dependency; E2E smoke test runs against the live Preview URL via a manual-only workflow, needs two new GitHub Actions secrets (brick T2)
**Decision:** Added `@playwright/test` as a dev dependency, `playwright.config.ts`, and `e2e/smoke.spec.ts`
(the one test file this repo has outside `src/`/`supabase/tests/` — CLAUDE.md's structure list doesn't
mention an `e2e/` folder, but it's the standard, expected location for Playwright specs, and inventing a
non-standard one instead would confuse tooling and future readers more than it would help). It signs a real
test user up, buys a pack for real in Polar's sandbox, spends a credit, and checks the balance — the one
place in this repo that proves the whole stack works together, not each piece mocked in isolation.

Runs only via `.github/workflows/e2e-smoke.yml`'s `workflow_dispatch` trigger (an input for the Preview URL),
**not** on every push/PR like `test.yml`: it needs a real, already-deployed, publicly reachable URL — Polar's
webhook has to be able to call it back — and this workflow has no way to discover that URL on its own since
Vercel's own GitHub integration (not this repo's workflows) is what creates Preview deployments.

Sign-in is done via `supabase.auth.admin.generateLink({type: "magiclink", ...})` rather than driving the real
sign-in form and waiting for an email: this is Supabase's own documented pattern for testing magic-link auth.

**Correction after inspection:** the first version of this test visited `generateLink`'s `action_link` and
redeemed it through the existing `/callback` route (`?code=` → `exchangeCodeForSession`), on the assumption
that this was the same path a real clicked email uses. The inspector caught that this doesn't work: this
app's Supabase clients use the PKCE flow (`@supabase/ssr`'s default), and PKCE's code_challenge/code_verifier
pairing is only ever set up by a *browser-invoked* `signInWithOtp` call — an admin-generated link has none, so
`exchangeCodeForSession` can't complete it. Added `src/app/[locale]/(auth)/confirm/route.ts`, a small
companion to `/callback` that verifies a `token_hash` directly via Supabase's own `verifyOtp` — a
PKCE-independent, equally real Supabase SDK verification method (not a hand-rolled check), which is what
`generateLink` actually supports. The test now redeems `hashed_token` through this new route instead.

**New GitHub Actions secrets needed** (Settings → Secrets and variables → Actions → "New repository secret",
same values already in Vercel): `SUPABASE_SERVICE_ROLE_KEY` (used only server-side, inside the test's own
Node process — never sent to the browser) and `NEXT_PUBLIC_SUPABASE_URL` (not actually secret, but stored as
a secret here anyway to keep the commander's setup to one consistent step rather than a secret *and* a
separate "variable").

**Second correction, after the first real run:** the suite failed immediately — not on Polar's checkout (the
part flagged as unverified below), but on the very first assertion, landing on Vercel's own login page
instead of the app. Vercel Preview deployments sit behind "Vercel Authentication" by default (a login wall in
front of the whole deployment); Production doesn't have this, which is why nothing in this repo noticed
before now — every earlier live test in this session used the Production URL, and the commander's own browser
never saw the wall since they're logged into Vercel already. Fixed by sending Vercel's own
"Protection Bypass for Automation" header (`x-vercel-protection-bypass`) on every request
(`playwright.config.ts`), sourced from a third GitHub Actions secret: `VERCEL_AUTOMATION_BYPASS_SECRET`
(Vercel Project Settings → Deployment Protection → "Protection Bypass for Automation" — Vercel generates the
value, nothing to invent). `e2e/smoke.spec.ts` also fails fast with a clear message now if it ever lands on
Vercel's login domain again, instead of a confusing "text not found" timeout.

**Open question this fix doesn't resolve:** the bypass header only helps Playwright's own browser get past the
wall — it says nothing about whether Vercel Authentication also blocks *Polar's* webhook POST to
`/api/webhooks/polar` on a Preview URL, since Polar has no way to send that header. If it does, no
Preview-based purchase's credits could ever be granted, regardless of anything in this test, and the real fix
would be disabling Preview deployment protection entirely (simplest — Preview URLs are already
effectively-unguessable random strings) rather than anything on this suite's side. Whether this is actually a
problem is unconfirmed pending the next live run.

**Why not run it against a local server instead** (like `test.yml`'s Vitest/RLS suite does, against a local
`supabase start`)? A local server in a CI runner isn't reachable from the public internet, so Polar's webhook
could never call it back — the credit-granting step this test exists to prove would be untestable.

**The one part of this test not verified against the real thing:** Polar's own checkout page markup — this
sandbox has no network access to polar.sh, so the card-entry selectors in `fillPolarCheckout()` (in
`e2e/smoke.spec.ts`) are a best-effort guess, not something seen live. Check the Playwright trace/screenshot
artifact from this workflow's first real run and fix those selectors to match if they're wrong.

---

## 2026-09-24 — `standardwebhooks` moves from dev to runtime dependency (brick E4 fix); `@polar-sh/sdk`'s webhook verifier has a real secret-encoding bug
**Decision:** `src/lib/polar/verify-webhook.ts` now calls `standardwebhooks`'s `Webhook` class directly instead
of going through `@polar-sh/sdk/webhooks`'s `validateEvent`. `standardwebhooks` moved from `devDependencies` to
`dependencies` accordingly — it's imported at runtime by the shipped webhook route now, not just by tests. This
supersedes the "dev-only, doesn't add anything to the deployed bundle" line in the entry below, which is now
stale for that reason.
**Why:** the commander's real Polar sandbox purchases consistently failed with an invalid-signature error, even
after confirming (character by character) that the webhook secret in Vercel exactly matched Polar's dashboard.
Testing directly against their real secret (a `whsec_<base64>=`-shaped string) proved the cause: `validateEvent`
re-encodes the secret with `Buffer.from(secret, "utf-8").toString("base64")` before handing it to
`standardwebhooks`. For a secret already in that wire format, this computes the wrong signing key — the raw
UTF-8 bytes of the whole `whsec_...` string (50 bytes), not the correct base64-decoded key (32 bytes) you get by
stripping the `whsec_` prefix and decoding the remainder, which is what `standardwebhooks`'s own constructor
does when given the secret unmodified. No signature can ever verify through that path, regardless of how
correctly the secret is copied. This is a real bug in `@polar-sh/sdk@0.49.0`, not a configuration error — worth
re-checking if the package is ever upgraded.
**Alternatives considered:** patching `@polar-sh/sdk`'s output or pre-transforming the secret to cancel out its
bug were both rejected as fragile, version-specific workarounds. Calling `standardwebhooks` directly is the
spec-compliant approach `@polar-sh/sdk` is itself a thin wrapper around, so it's no less correct and doesn't
depend on this particular SDK bug persisting or not.
**Consequence:** event payloads are no longer re-validated per type against the SDK's zod schemas after
signature verification (that only ever ran through the same broken `validateEvent` path). `route.ts` casts
`event.data as Order` at the one call site that needs the typed shape instead — the signature is what's
actually trusted here, and `handleOrderPaid` already checks defensively for the specific fields it reads.

---

## 2026-09-23 — New dev dependency: `standardwebhooks` (brick E4), and a Vitest `@/` alias
**Decision:** Added `standardwebhooks` (already an indirect dependency of `@polar-sh/sdk`, which uses it for
webhook signature verification) as an explicit **dev** dependency, so `supabase/tests`- and `src/lib`-level
tests can construct a genuinely, correctly signed test request and prove `verifyPolarWebhook` really rejects
a bad signature — not just that it calls some function. Also added a `resolve.alias` for `@/*` to
`vitest.config.ts`, matching `tsconfig.json`'s path — the first lib file this session that both (a) gets
unit-tested directly and (b) imports another local module via the `@/` alias (`src/lib/polar/handle-order-paid.ts`
imports `@/lib/credits/packs`); every earlier tested lib file only imported npm packages, so this gap in
Vitest's own resolution never showed up before.
**Why:** pnpm's strict dependency isolation means a transitive dependency isn't importable directly — the
webhook signature test needs to call `standardwebhooks` itself to build a valid signature, not just rely on
it existing somewhere in `node_modules`. It's dev-only (test code never ships), so this doesn't add anything
to the deployed bundle.
**Consequence:** Any future lib file can now use the `@/` alias and still be Vitest-testable, without each one
having to discover and fix this individually.

---

## 2026-09-23 — New dependency: `@polar-sh/sdk` (brick E3); verified against its real types instead of live docs
**Decision:** Added `@polar-sh/sdk` (official Polar Node SDK) for creating checkout sessions. `src/lib/polar/client.ts`
wraps it; `server` is read from a new `POLAR_SERVER` env var (`"production"` or anything else, defaulting to
sandbox) rather than inferred from the Vercel environment, so switching a product to real payments is a
deliberate, documented step, not an accident of which environment it's deployed to.
**Why:** CLAUDE.md §10 says to check current official docs rather than guess when unsure about a Polar API —
but this session's sandbox network blocks `docs.polar.sh` and `polar.sh` entirely (same restriction as the
S3 entry). The npm registry is reachable, though, so instead of guessing the SDK's method names and
parameters from training knowledge, the real package was installed and its actual generated TypeScript
types read directly from `node_modules` — `Checkouts.create()`'s `CheckoutCreate` type, the `Checkout`
response's `url` field, and the client's `server: "sandbox" | "production"` option all come from the
installed package's real source, then confirmed correct by `pnpm typecheck` passing against those same
types. This is more reliable than the docs site would have been for exact signatures, at the cost of not
seeing Polar's own prose (e.g. any usage guidance beyond the types) — worth re-checking against the live
docs once this sandbox's network policy allows it, or before brick E4 (webhook handling), which needs the
same SDK's event payload shapes.
**Consequence:** `E3`'s checkout creation was built without live network access to Polar at any point;
"Clicking Buy opens Polar sandbox checkout for the right product" (E3's done_when) could not be exercised
end-to-end from this sandbox — only the auth-gating and pack-id validation around the call were verified
live. The commander should confirm the first real click-through once deployed.
**Alternatives considered:** Calling Polar's REST API directly with `fetch` instead of the SDK — rejected;
CLAUDE.md §1 prefers boring, well-known libraries over hand-rolled HTTP, and the SDK's generated types are
exactly what made verification possible without live docs access in the first place.

---

## 2026-09-22 — Brick F1 pulled forward out of order: G4 needs a Plausible account the commander hasn't set up yet
**Decision:** Started brick F1 (step 30, "Example feature") instead of G4 (step 29, "Cookieless analytics"),
which is next in strict step order.
**Why:** G4's `done_when` requires a page view to actually appear in a real Plausible dashboard from the
deployed preview URL, and `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` needs a Plausible account and registered domain —
both only the commander can create, same shape of external blocker as E1's Polar sandbox. F1's dependencies
(`E2`, `A3`) are both `approved`, its `human_check` is `false`, and it needs nothing external. Same judgment
call already made for G2 (see the entry below) and P5.
**Consequence:** G4 stays `todo`, waiting on the commander's Plausible account and domain. Step order resumes
normally once G4 is unblocked — this is a one-off skip-ahead, not a change to the build plan's order itself.

---

## 2026-09-22 — Brick T1: GitHub branch protection doesn't bind admins/owners by default
**Finding, not a decision, but recorded here since it's a real security gap that was live for a few
minutes:** after the commander configured branch protection on `main` (required status check
`test`), a live verification test — opening a deliberately broken PR and attempting to merge it —
succeeded despite the required check failing. Root cause: GitHub's branch protection rules do not
apply to repository administrators/owners unless "Do not allow bypassing the above settings"
(sometimes labeled "Include administrators") is separately enabled. Without it, an admin (and the
API credential used to test this) can merge regardless of required checks.
**Consequence:** The deliberately broken commit was briefly on `main` — reverted immediately via
PR #33. The commander has been asked to also enable "Do not allow bypassing the above settings" on
the same rule. Brick T1 stays `awaiting_commander` (not approved) until a second live test — the
same kind of deliberately-broken-PR check — actually gets blocked.

---

## 2026-09-21 — Brick S3: Polar's exact checkout domain used a wildcard, unverified against live docs
**Decision:** The CSP's `connect-src`/`frame-src` allow `https://*.polar.sh` for Polar rather than one
exact subdomain (e.g. `checkout.polar.sh` or `buy.polar.sh`).
**Why:** CLAUDE.md §10 says to check official docs rather than guess when unsure about a Polar API —
this session's sandbox network couldn't actually reach `polar.sh` or `docs.polar.sh` (blocked by the
egress proxy), so the exact checkout hostname couldn't be confirmed. A wildcard on Polar's own domain
is still scoped to one vendor (not a blanket allowance) and won't need a follow-up CSP change if the
real hostname turns out to be `buy.polar.sh` vs `checkout.polar.sh` vs something else.
**Consequence:** Flagged here so the assumption isn't silently load-bearing. Must be re-checked once
brick E1+ actually wires up a real Polar checkout and a live checkout can be tested end-to-end — if
Polar's checkout ever needs a domain outside `*.polar.sh` (unlikely, but possible for a payment
processor sub-step), the CSP will need a follow-up commit then.

---

## 2026-09-21 — Brick G2 pulled forward out of order: E1 blocked on the commander's Polar setup
**Decision:** Started brick G2 (step 27, "Data export") instead of E1 (step 17, "Polar sandbox and
products"), which is next in strict step order.
**Why:** E1's `done_when` requires two real products to exist in a Polar sandbox organization —
something only the commander can create (a third-party account, sandbox mode, an access token).
The commander was asked directly what's needed (Polar account, two products, an access token) and
three hourly check-ins passed with no reply. G2's dependencies (`A3`, `D3`) are both `approved`, its
`human_check` is `false`, and it needs nothing external, so it's fully buildable right now. Per
CLAUDE.md §10 ("If a brick turns out to be wrong or too big, propose a change instead of
improvising"), pulling forward a brick that's genuinely ready, rather than sitting idle waiting on a
different brick's external blocker, is the same kind of judgment call already made once for P5.
**Consequence:** E1 stays `todo`, still waiting on the commander's Polar sandbox details. Step order
resumes normally once E1 is unblocked — this is a one-off skip-ahead, not a change to the build
plan's order itself.

---

## 2026-09-21 — Brick S4: rate limiting implemented in Postgres, not a new external service
**Decision:** `check_rate_limit(p_key, p_limit, p_window_seconds)` is a `SECURITY DEFINER` Postgres
function (migration `20260921204740_rate_limits.sql`) backed by a plain hit-counter table
(`rate_limit_hits`, RLS on with zero policies — no role can touch it directly). Application code
calls it via `supabase.rpc(...)` through the new `src/lib/rate-limit/` helper.
**Why:** CLAUDE.md §2 prefers "managed services, few dependencies, no servers of our own" and
requires a one-line justification for any *new* dependency. A dedicated rate-limiting service
(Upstash Redis, Vercel KV) would add a new external account for the commander to set up and a new
env var to wire through Vercel, for a base this small. Supabase is already the stack's database;
reusing it avoids both. The function self-cleans (deletes a key's own expired hits on every call to
that key), so there is no separate cleanup job to run — acceptable at this app's scale.
**Alternatives considered:** In-memory rate limiting (rejected outright — Vercel serverless
functions are not guaranteed to share memory across invocations or instances, so an in-memory
counter would not actually enforce a limit in production, which is a hole CLAUDE.md §4 doesn't
allow). Upstash/Vercel KV (rejected for now per above; revisit if request volume ever makes a
per-request Postgres round trip a real bottleneck).
**Consequence:** `src/lib/rate-limit/` is a new `lib/` subfolder, one level more than
`CLAUDE.md`'s current `src/` tree in §3 anticipates (it lists `validation/` but not
`rate-limit/`). Adding it follows the same shape as the other `lib/` subfolders already there
(`supabase/`, `polar/`, `credits/`) rather than inventing a new top-level folder, so treated as a
minor, in-pattern addition rather than something to stop and ask about.

---

## 2026-09-21 — Brick P5 pulled forward out of order: Vercel was never building the app
**Decision:** Started brick P5 (step 22) immediately, ahead of E1/E2 (steps 17-18), instead of
following strict step order.
**Why:** While answering the commander's question about where the sign-in page was, it became
clear Vercel was still running under the pre-P1 stop-gap setup (`buildCommand: null`,
`outputDirectory: "."` — see the 2026-09-21 "Fix: pin Vercel to serve the repo root as static
output" entry below), meaning `next build` had never actually run in production. A1's
`commander_check_fi` had already told the commander to test `/sign-in` live, which could not have
worked. `CLAUDE.md` §10 says propose a change instead of improvising when a brick turns out wrong
or mistimed — this is that: a self-discovered defect in guidance already given to the commander,
serious enough to fix immediately rather than wait for step order to reach it.
**Consequence:** `vercel.json` now just pins `{"framework": "nextjs"}`. The command center
(`public/center/index.html`, moved from `center/index.html`) is no longer rewritten to `/` — the
real app now owns `/` (→ `/en`) — it's served at `/center` instead, reading `docs/build-map.json`
and `docs/inspections/*.json` through two new Next.js API routes (`src/app/api/build-map`,
`src/app/api/inspections`) instead of the deleted `api/inspections.js` Vercel serverless function
and the old raw-file rewrite. `src/proxy.ts`'s matcher excludes `/center` from locale redirection.
Verified with a real production server (`pnpm build && pnpm start`, not just `pnpm dev`): `/` → 
`/en` redirect, `/en` and `/en/sign-in` render, `/dev/ui` 404s (correct for production), `/center`
and `/center/index.html` both serve with working `/api/build-map` and `/api/inspections` data. The
local `pnpm center` dev server (`center/serve.mjs`) was updated for the new file location and
re-tested. Still needs the commander: setting real Supabase env vars in Vercel (nothing currently
works live without them) and, per this brick's own security requirement, a second Supabase project
to actually separate preview from production — see `commander_check_fi`.

## 2026-09-21 — Internationalization: next-intl, locale routing, auth callback path change (brick H3)
**Decision:** Added `next-intl` (stack-fixed choice, CLAUDE.md §2) with `[locale]` routing —
`en` only for now, default locale, `always` URL prefix (so `/` redirects to `/en`, matching this
brick's own `done_when`: "`/en` works"). Moved `src/app/page.tsx` and `src/app/(auth)/**` under
`src/app/[locale]/`, per the target structure A1's decision entry already anticipated. The
dev-only `/dev/ui` page (brick H2) stays outside `[locale]` — it's never shown to a real user, so
translating it would be pure noise. Added `eslint-plugin-i18next`'s `no-literal-string` rule,
scoped to `src/app/[locale]/**` and `src/components/**`, as this brick's required "lint rule ...
that flags hard-coded JSX strings" — verified live by planting a hard-coded string and watching
lint fail, then restoring it and watching lint pass again.
**Consequence:** The auth callback URL changed from `/callback` to `/en/callback`. A1's
`commander_check_fi` was updated to reflect this, and to add a requirement that A1's original
guidance had actually missed: Supabase requires *any* `emailRedirectTo`/`redirectTo` target
(magic-link email included, not just Google OAuth) to be in the project's Redirect URLs allow-list
— A1 only mentioned this for Google. `supabase/config.toml`'s `additional_redirect_urls` was
updated to `/en/callback` for local dev/CI; the commander still needs to add the equivalent
production URL to the cloud project's dashboard themselves (same one-time step as already
described for Google, just also required for the plain email flow).
**Gotcha caught before commit:** the ESLint `files` glob `src/app/[locale]/**` silently matched
nothing, because `[locale]` is glob bracket-expression syntax (a character class), not a literal
folder name — the rule appeared to work (no errors) but was actually never running. Caught by
deliberately planting a violation and seeing lint stay clean; fixed by escaping the brackets
(`src/app/\\[locale\\]/**`) and re-proving both the fail and the pass.
**Also fixed in passing:** Next.js 16.3.5 warned that the `middleware.ts` file convention is
deprecated in favor of `proxy.ts` (same export shape) — renamed rather than leaving a fresh
deprecation warning in every `pnpm build`.

## 2026-09-21 — T1 changed to `human_check: true` (branch protection is a GitHub Settings action)
**Decision:** Brick T1's `human_check` was changed from `false` to `true` in `docs/build-map.json`.
Everything code-side is done: `.github/workflows/test.yml` now also runs `pnpm typecheck` and
`pnpm lint` (alongside the existing `check:secrets` and `test` steps) on every PR. But T1's
`done_when` — "A PR with a failing RLS test cannot be merged" — means the `test` check must be a
*required* GitHub branch protection rule on `main`, which is a repository Settings change, not a
file in this repo.
**Why:** No tool available in this session can call GitHub's branch-protection API (it needs repo
admin scope); this is structurally the same situation as brick A1's Google OAuth setup — a
one-time action only the commander can take in the GitHub UI. `commander_check_fi` on the T1 brick
gives the exact steps (Settings → Branches → Add rule → `main` → require the `test` status check).
**Consequence:** Once the commander confirms the rule is set, re-verify (e.g. check the rule via
the repo's branch protection settings, or confirm a red PR is blocked) before approving T1.

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
