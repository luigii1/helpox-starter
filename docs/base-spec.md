# helpox-starter — Base specification

This document describes the **target state** of the reusable Helpox base. When every item below works
and the launch checklist passes, the base is complete and can be copied to start a new product.

Estimated effort: 4–6 focused weekends. The milestones below describe *what* the base must do;
`docs/build-map.json` breaks them into 33 ordered bricks and is the plan to build from. The first brick
is the command center, the local page the owners use to follow the build.

---

## Milestone 1 — Skeleton and design system

**Goal:** a deployed, empty, branded site.

- Next.js App Router project, TypeScript strict, pnpm, ESLint, Prettier
- Tailwind with design tokens in `src/styles/tokens.css` (placeholder Helpox palette until brand is decided)
- Light/dark mode via tokens
- UI primitives: Button, Input, Textarea, Card, Dialog, Toast, Badge
- next-intl with `[locale]` routing, `en` as default locale
- Marketing layout: header, footer, landing page with hero, feature grid, pricing section, FAQ
- Deployed to Vercel with preview deployments on every branch

**Done when:** the landing page is live on a Vercel URL, works at 360 px, and has zero hard-coded strings.

---

## Milestone 2 — Auth and profiles

**Goal:** users can sign up, sign in and sign out.

- Supabase Auth: email magic link + Google OAuth
- `profiles` table (1:1 with `auth.users`), created by trigger on sign-up
- Protected `(app)` route group with middleware session refresh
- Account page: email, credit balance, sign out

**Schema**
```sql
profiles (
  id uuid primary key references auth.users on delete cascade,
  credits integer not null default 0 check (credits >= 0),
  created_at timestamptz not null default now()
)
```
RLS: a user can `select` only their own row. No client `insert`/`update`/`delete`.

**Done when:** RLS tests prove user A cannot read user B's profile.

---

## Milestone 3 — Payments and credits

**Goal:** a user can buy a credit pack and spend credits.

**Flow**
1. User clicks "Buy" → server action creates a Polar checkout session with the Supabase user id as the
   external customer id
2. User pays on Polar's hosted checkout
3. Polar sends the paid-order webhook → `/api/webhooks/polar`
4. Handler verifies signature → looks up pack → inserts ledger row + increments balance in one DB function
5. User returns to the app; balance updates on refresh

**Schema**
```sql
credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('purchase','consume','refund','grant')),
  external_id text unique,          -- Polar order id for purchases; ensures idempotency
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
)
```
RLS: users can `select` their own ledger rows. No client writes.

**Database functions** (`SECURITY DEFINER`, `search_path = ''`)
- `grant_credits(user_id, amount, reason, external_id)` — service role only; ledger insert + balance update in one transaction; no-op on duplicate `external_id`
- `consume_credits(amount)` — callable by `authenticated`; uses `auth.uid()`; atomic conditional update; returns new balance or raises `insufficient_credits`
- `refund_credits(ledger_id)` — service role only

**Config**
- Credit packs defined in one place (`src/lib/credits/packs.ts`) mapping Polar product ids → credit amounts
- Default packs: 5 credits €4.99 and 12 credits €9.99 (see `docs/decisions.md`)
- Sign-up bonus: 1 free credit, granted once per account after email verification
  (`external_id = 'signup:<user_id>'` guarantees it cannot be granted twice)
- Credits never expire; the pricing page says so

**Done when:**
- Test-mode purchase grants credits exactly once, even if the webhook is replayed
- A forged webhook without a valid signature is rejected
- Two concurrent `consume_credits` calls on a balance of 1 result in exactly one success
- A new verified user has exactly 1 credit; re-running the sign-up grant does not add a second
- Local development works with Polar's sandbox and a tunnel to the webhook

---

## Milestone 4 — Privacy, legal and account control

**Goal:** the base is GDPR-ready.

- Privacy policy and terms of service pages (templates with placeholders — to be reviewed by a professional)
- Data export: account page button → JSON download of the user's profile, ledger and product data
- Account deletion: confirmation dialog → server action deletes the auth user (cascades to all rows)
- Vercel Web Analytics (cookieless), only sends events in production
- Footer links to privacy, terms, contact
- No cookie banner (only essential auth cookies are set) — documented in `docs/decisions.md`

**Done when:** a deleted test user leaves zero rows in any table.

---

## Milestone 5 — Hardening and release tooling

**Goal:** safe to put real money through.

- Security headers in `next.config` (CSP, HSTS, Referrer-Policy, X-Content-Type-Options, frame-ancestors)
- Rate limiting on auth callbacks, checkout creation and credit consumption
- Error monitoring (lightweight; decision recorded before adding)
- Playwright smoke test: sign up → buy pack (sandbox) → consume credit → see balance
- GitHub Actions: typecheck, lint, unit + RLS tests on every PR
- `docs/launch-checklist.md` completed once end-to-end against a staging environment

**Done when:** CI is green and the full launch checklist passes on staging.

---

## Milestone 6 — Template extraction

**Goal:** starting a new product takes one hour.

- A single `src/features/example/` folder demonstrates the pattern: a page that consumes one credit to perform an action
- `README.md` "Start a new product" section: copy repo, rename, create Supabase + Polar + Vercel projects, set env vars, replace tokens and copy, delete the example feature
- `.env.example` listing every required variable with comments

**Done when:** a fresh copy can be deployed as a new product by following the README alone.

---

## Out of scope for the base

See `CLAUDE.md` §9.
