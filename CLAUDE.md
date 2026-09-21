# CLAUDE.md — helpox-starter

This repository is **helpox-starter**: the reusable foundation for small, paid web apps built by Helpox.
Every future Helpox product starts as a copy of this repo. The goal is that auth, database, payments,
credits, security, legal pages, i18n and deployment are solved **once, correctly** — so each new product
only adds its own feature.

Read this file fully at the start of every session. When a rule here conflicts with a user request,
point out the conflict before proceeding.

---

## 1. Principles

1. **Small and finished beats big and growing.** Products built on this base do one thing and are then done.
2. **Low maintenance is a feature.** Prefer managed services, few dependencies, no servers of our own.
3. **Security is not optional and not "later".** Every rule in §4 applies from the first commit.
4. **No surprises for the user.** No tracking cookies, clear pricing, real account deletion.
5. **Boring, documented choices.** If a well-known library solves it, use it. Never hand-roll auth, crypto or payments.

---

## 2. Stack (fixed — do not substitute without an entry in `docs/decisions.md`)

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router), TypeScript `strict` | Server Components by default |
| Hosting | Vercel | Node runtime for webhooks |
| Database & Auth | Supabase (Postgres, Auth, RLS) | Supabase Auth only, never custom auth |
| Payments | Polar (Merchant of Record) | Polar handles VAT/sales tax globally |
| Validation | zod | All external input |
| i18n | next-intl | English default; every UI string via `t()` |
| Styling | Tailwind CSS + design tokens | Tokens in `src/styles/tokens.css` |
| Analytics | Plausible (cookieless) | No Google Analytics, no ad pixels |
| Unit/integration tests | Vitest | Includes RLS tests against local Supabase |
| E2E smoke tests | Playwright | Sign-up → buy → use credit happy path |
| Package manager | pnpm | |

Adding any new runtime dependency requires a one-line justification in `docs/decisions.md`.

---

## 3. Project structure

```
src/
  app/
    [locale]/
      (marketing)/        # landing, pricing, legal pages — public, static where possible
      (app)/              # authenticated product area
      (auth)/             # sign-in, sign-up, callback
    api/
      webhooks/polar/     # Polar webhook route handler (Node runtime)
  components/
    ui/                   # design-system primitives (Button, Input, Card…)
    marketing/            # landing-page sections
  lib/
    supabase/
      server.ts           # server client (user session, anon key)
      admin.ts            # service-role client — SERVER ONLY, see §4
      client.ts           # browser client (anon key)
    polar/                # checkout creation, webhook verification
    credits/              # credit balance + consumption helpers
    validation/           # zod schemas
  i18n/                   # next-intl config
  messages/               # en.json (+ other locales later)
  styles/
    tokens.css            # brand tokens: colors, type, radius, spacing
supabase/
  migrations/             # SQL migrations — the ONLY way schema changes
  tests/                  # RLS tests
center/
  index.html              # command center UI (reads docs/ live)
  serve.mjs               # zero-dependency local server, 127.0.0.1:4400
.claude/
  agents/inspector.md     # the inspector subagent (see §10)
docs/
  build-map.json          # the build plan: modules, bricks, order, status (see §10)
  inspections/            # inspector reports, one JSON per brick
  base-spec.md            # what this base must do
  decisions.md            # decision log
  launch-checklist.md     # run before every production release
```

Do not invent new top-level folders. If something doesn't fit, ask.

---

## 4. Security rules (hard rules — never break)

### Secrets
- `SUPABASE_SERVICE_ROLE_KEY` and `POLAR_*` secrets are used **only** in `src/lib/supabase/admin.ts`
  and server-only modules. Those files start with `import 'server-only'`.
- Never prefix a secret with `NEXT_PUBLIC_`. Only the Supabase URL, anon key and Plausible domain may be public.
- Never log secrets, tokens, full webhook payloads or personal data.

### Database
- **Every table has RLS enabled** in the same migration that creates it. No exceptions.
- **Every table has at least one RLS test** in `supabase/tests/` proving that user A cannot read or write user B's rows.
- Credit balances and the credit ledger are **not writable by any client role**. Only `SECURITY DEFINER`
  functions and the service role modify them.
- `SECURITY DEFINER` functions set `search_path = ''` and fully qualify every object.
- Schema changes happen only through files in `supabase/migrations/`. Never edit a production schema by hand.

### Payments
- Credits are granted **only** by the Polar webhook, never from a success page or client call.
- The webhook **always** verifies the signature before doing anything. Invalid signature → 403, no processing.
- Webhook processing is **idempotent**: the Polar event/order id is stored with a unique constraint;
  a duplicate delivery returns 200 and does nothing.
- The webhook route uses the Node runtime and reads the raw body for verification.

### Input and output
- Validate every request body, query param and form with zod on the server.
- Rate-limit auth-adjacent and credit-consuming endpoints.
- Set security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, frame-ancestors) in `next.config`.
- Rich text / user HTML is sanitized before rendering. Never use `dangerouslySetInnerHTML` on user content.

### Privacy (GDPR)
- The app sets **no non-essential cookies**. Therefore no cookie banner. Adding any tracking, ad pixel or
  third-party embed that sets cookies is forbidden without a decision entry and a consent solution.
- Users can **export** their data and **delete** their account. Deletion removes their rows and auth user.
- Collect the minimum personal data needed.

---

## 5. Credits model

- One-time credit packs purchased via Polar Checkout. **No subscriptions** in the base.
- `credit_ledger` is the source of truth (append-only). `profiles.credits` is a cached balance kept in sync
  by the same database functions that write the ledger.
- Consumption is atomic: a single `update … where credits >= n returning` inside a `SECURITY DEFINER` function.
  Never read-then-write from application code.
- Failed product actions refund the credit with a ledger entry (`reason = 'refund'`).
- Pricing guidance: keep prices low and fair (~€1 per credit), but no single purchase below ~€3 —
  Polar's fixed per-transaction fee eats most of a €1 sale. Defaults: **1 free credit on sign-up**,
  5 credits €4.99, 12 credits €9.99. Credits never expire. See `docs/decisions.md`.
- The sign-up credit is granted through `grant_credits` with `reason = 'grant'` and an `external_id` of
  `signup:<user_id>`, so it can only ever be granted once per account.

---

## 6. i18n and copy

- All code, comments, commit messages, docs and identifiers are in **English**.
- Every user-visible string goes through `t('namespace.key')`. No hard-coded UI strings, including in errors and emails.
- Dates, numbers and currencies are formatted with next-intl formatters, never manually.

---

## 7. Design system

- Colors, typography, radius and spacing come from tokens in `src/styles/tokens.css`. Components never use raw hex values.
- Light and dark mode are both supported via tokens.
- UI primitives live in `src/components/ui/`. Reuse before creating new ones.
- Mobile-first layouts; every page must work at 360 px width.

---

## 8. Definition of done

A change is done only when all of these pass:

1. `pnpm typecheck` — no errors
2. `pnpm lint` — no errors
3. `pnpm test` — all unit and RLS tests pass
4. New tables have RLS + tests; new strings are in `messages/en.json`
5. No new secrets in client code (`grep` for `SERVICE_ROLE` outside `lib/supabase/admin.ts` returns nothing)
6. If the change touches auth, payments, credits or data deletion: the relevant section of
   `docs/launch-checklist.md` has been re-run

Never report a task as complete if any of these fail. Say what failed.

---

## 9. What this base deliberately does NOT do

- Subscriptions or recurring billing
- Real-time collaboration / multi-user editing
- Custom authentication
- Native mobile apps (web/PWA only)
- Tracking cookies, ad pixels, Google Analytics
- Admin dashboards beyond what Supabase Studio and Polar already provide

If a product needs one of these, it's a product-level decision recorded in that product's `docs/decisions.md`.

---

## 10. Working style for AI sessions

### Build map (the "Lego manual")
`docs/build-map.json` is the build plan. The base is assembled one **brick** at a time, in `step` order.
The owners watch progress in the **command center** (`node center/serve.mjs` → http://localhost:4400),
which reads `build-map.json` and `docs/inspections/` live.

### The crew (the build is shown as assembling a Lego-style robot from an instruction manual)
Each module in `build-map.json` is one robot part and one page of the manual; each brick is a numbered
step on that page. Step titles are plain Finnish with the code term in parentheses. Use them when talking
to the owners.
- **Builder** (*rakentaja*) — you, the main session. You build one step at a time.
- **Inspector** (*tarkastaja*) — the `inspector` subagent (`.claude/agents/inspector.md`). It checks your
  work with no build context and writes `docs/inspections/<id>.json`. You never inspect your own step.
- **Owners** (*te*) — they **do not read code**. They do the step's own check (`commander_check_fi`) and approve.

### The flow for every brick
1. Find the next brick: the first `todo` brick whose `depends_on` are all `approved`.
   Tell the commander in one plain Finnish sentence which brick it is and why it matters (`why_fi`).
2. Set status `building`. Build **only this brick**, with tests for its `done_when` and every `security` item.
3. When §8 passes, set status `inspecting` and run the `inspector` subagent with the brick id.
4. If the report is `fail`: set status `rework`, fix exactly what it lists, go back to step 3.
   Never edit or overrule an inspection report.
5. If the report is `pass`:
   - `human_check: true` → set `awaiting_commander` and give the commander the `commander_check_fi`
     in plain Finnish, plus anything they need (a URL, a test card number). Wait.
   - otherwise → set `approved`.
6. Commit code, report and `build-map.json` together. Do not start the next brick without being asked.

Only the commander approves a `human_check` brick: set `approved` only after they say it passed.
If a brick turns out to be wrong or too big, propose a change to `build-map.json` instead of improvising.

### Talking to the commander
The commanders are not programmers. Explain in plain Finnish what was built and what they should see,
never how the code works, unless they ask. No code in messages to them unless asked.

### General
- Before large changes, state the plan in a few lines and wait for confirmation.
- Prefer small, reviewable commits.
- When unsure about a Polar, Supabase or Next.js API, check the current official docs rather than guessing.
- If asked to "just make it work" in a way that breaks §4, refuse that part and propose the secure alternative.
