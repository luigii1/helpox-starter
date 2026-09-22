# helpox-starter

The reusable foundation for small paid web apps by Helpox: auth, database, payments with credits,
security, privacy and deployment, solved once.

## How this repo is built

The base is built like a Lego robot from an instruction manual: one page per robot part, one numbered step
at a time, in the order given in `docs/build-map.json`. Claude Code builds, a separate inspector agent checks
every step, and the owners approve by trying things out, not by reading code. Rules are in `CLAUDE.md`.

## Command center

Live on Vercel: every push gets its own preview deployment (see the project's Vercel dashboard for the
current URL). Open it to see the robot, the manual page you are on, what waits for your check and what
Claude Code should do next — no local setup needed.

For local development only:

```bash
node center/serve.mjs
```

Open http://localhost:4400. Requires Node.js 20 or newer. No other dependencies.

## Start

Open this folder in Claude Code and say:

> Lue CLAUDE.md ja tee seuraava vaihe.

## Starting a new product from this base

Once the base itself is finished (every brick in `docs/build-map.json` approved), turn it into a real
product by copying the repo — never build a product directly on top of `helpox-starter` itself.

1. **Copy the repo.** Create a new, separate GitHub repo for the product (do not fork — a fork stays
   linked to this one, which is not what you want) and push this repo's code into it. Give the new repo
   the product's own name.
2. **Rename the product.** Replace every "Helpox"/`helpox-starter` placeholder with the product's real
   name:
   - `package.json` → `"name"`
   - `src/app/layout.tsx` → the default `title`/`description` metadata
   - `messages/en.json` → `Marketing.siteName`, `Marketing.meta.title`, `Marketing.meta.description`,
     `Marketing.footer.copyright`, and the `[Company name]` / `[contact email]` /
     `[Business ID / registration number]` / `[product description]` placeholders under `Legal.privacy`
     and `Legal.terms` (brick G1) — with the product's own real legal details, still pending a lawyer's
     review before publishing (the draft notice stays until then)
   - `src/styles/tokens.css` → the palette, once the product has real brand colors (the file's own
     header comment explains the current values are a placeholder)
3. **Create the product's own accounts — never reuse another product's.** A fresh Supabase project, a
   fresh Polar organization, and a fresh Vercel project, all specific to this product:
   - Supabase: new project, run every migration in `supabase/migrations/` against it (in order — the
     Supabase GitHub integration does this automatically once connected, per the "Schema migrations
     deployed via Supabase's GitHub integration, not CLI" `docs/decisions.md` entry), and configure
     Google sign-in the same way the "Google sign-in needs manual Supabase-dashboard configuration
     (brick A1)" entry describes.
   - Polar: new sandbox organization, two credit-pack products (brick E1's shape: 5 credits / 12 credits),
     and its own webhook secret once brick E4 exists.
   - Vercel: new project connected to the new repo, with `vercel.json` already pinning it to a real
     Next.js build (brick P5).
   - **This is the actual security requirement for this brick:** every key, secret and webhook signing
     secret below belongs to the new product's own accounts. Copying a `.env.local` (or Vercel
     environment variables) from another product means that product can read or grant credits against
     this one's database, or forge webhook events against it — never do it, even temporarily.
4. **Set environment variables.** Copy `.env.example` to `.env.local` for local development, and set the
   same names in Vercel (Project Settings → Environment Variables, separately for Preview and
   Production — brick P5's own security requirement in `docs/build-map.json` is that Production and
   Preview use different Supabase projects and keys, never the same one). Every value comes from the
   new accounts created in step 3, never copied from another product.
5. **Delete the example feature.** Remove `src/features/example/`,
   `src/app/[locale]/(app)/features/example/`, `src/app/api/features/example/`, the `ExampleFeature`
   namespace in `messages/en.json`, and the dashboard link to it (brick F1) — it was only ever a template
   for how a credit-consuming feature is structured, not a real feature.
6. **Reset the build map.** `docs/build-map.json`'s `bricks` array tracks *this base's own construction*,
   which is now finished — keep it around as history if you like, but replace its `bricks` array (or the
   whole file) with a fresh, empty list before using the same command-center pattern (`docs/build-map.json`
   + the `inspector` subagent + `/center`) to track the product's *own* features. `docs/inspections/`
   should start empty too.
7. **Deploy and verify.** Push the new repo, confirm the Vercel deployment builds, sign up for real on the
   deployed URL (magic link or Google), confirm the sign-up credit arrives, and buy a pack with a Polar
   sandbox test card. Only once all of that works on the new project's own accounts is the copy done.
