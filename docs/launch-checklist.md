# Launch checklist

Run this **before every production release** that touches auth, payments, credits, data or legal pages,
and in full before the first launch of any product built on helpox-starter.

Tick every box. If one fails, do not release.

---

## A. Secrets and configuration
- [ ] `SUPABASE_SERVICE_ROLE_KEY` appears only in `src/lib/supabase/admin.ts` and server-only modules
- [ ] No secret is prefixed `NEXT_PUBLIC_`
- [ ] Production env vars are set in Vercel and differ from preview/development values
- [ ] Polar is in **production** mode in production, **sandbox** everywhere else
- [ ] The production Polar webhook points to the production URL and uses the production secret
- [ ] `.env*` files are git-ignored; no secrets in git history

## B. Database and RLS
- [ ] Every table has RLS enabled (`select relname from pg_class where relrowsecurity = false` on public tables returns nothing)
- [ ] All RLS tests pass against a fresh local database built from migrations
- [ ] Manual check: signed in as user A, calling the Supabase API with A's token cannot read user B's data
- [ ] Manual check: with only the anon key (signed out), no user data is readable
- [ ] No client role can update `profiles.credits` or insert into `credit_ledger`
- [ ] Production schema matches migrations (no manual changes)

## C. Payments and credits
- [ ] Sandbox purchase grants the correct number of credits
- [ ] Replaying the same webhook does not grant credits twice
- [ ] A request to the webhook with an invalid signature returns 403 and changes nothing
- [ ] Consuming a credit with zero balance fails cleanly with a translated message
- [ ] Refund path returns the credit to the ledger
- [ ] Pricing page shows prices consistent with Polar products
- [ ] Polar product names and descriptions are correct (they appear on customer receipts)

## D. Privacy and legal
- [ ] Privacy policy and terms are published and linked in the footer
- [ ] Legal texts name the right company (Helpox), contact address and processors (Supabase, Vercel, Polar, Plausible)
- [ ] Browser devtools show no cookies other than Supabase auth cookies
- [ ] No third-party scripts other than Plausible load on any page
- [ ] Data export downloads complete JSON of the user's data
- [ ] Account deletion removes the auth user and all related rows (verify in the database)

## E. Security headers and hardening
- [ ] securityheaders.com (or equivalent) grade A or better on production
- [ ] Rate limiting active on checkout creation, auth callback and credit consumption
- [ ] Error pages do not leak stack traces or internal details
- [ ] Dependencies audited (`pnpm audit`) with no high/critical issues unaddressed

## F. Product quality
- [ ] Playwright smoke test passes against staging
- [ ] Every page works at 360 px width and on a real phone
- [ ] Light and dark mode both readable
- [ ] No hard-coded UI strings (all in `messages/en.json`)
- [ ] Page titles, meta descriptions and Open Graph images set for public pages
- [ ] 404 and error pages are branded

## G. Operations
- [ ] Support email works and someone reads it
- [ ] Supabase backups enabled on the production project
- [ ] Spend limits / budget alerts set on Vercel, Supabase and any map or API provider
- [ ] You know how to issue a refund in Polar

---

## AI-assisted review (do this last)

Ask a fresh AI session, with no prior context, to act as an attacker:

> "You are a security tester. Here is the repository. Try to (1) read another user's data,
> (2) grant yourself credits without paying, (3) find any secret exposed to the browser.
> Report exact file and line for anything you find."

Fix everything it finds, then re-run sections B and C.
