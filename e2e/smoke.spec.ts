import { test, expect, type Page, type Locator } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { CREDIT_PACKS } from "@/lib/credits/packs";
import { deleteAccount } from "@/lib/account/delete-account";

// Brick T2: the one full-stack proof that sign-up, a real Polar sandbox
// purchase, and spending a credit actually work together end to end against
// a live deployment — not just each piece in isolation (every other test in
// this repo mocks or unit-tests one layer at a time). See
// docs/decisions.md for why this needs its own workflow and secret, and
// why sign-in is done via an admin-generated link rather than driving the
// real sign-in form.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both required to run this suite " +
      "(it signs a real test user up and tears them down again via the admin API).",
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const LOCALE = "en";
const PACK = CREDIT_PACKS[0]!;
const SIGNUP_CREDITS = 1;

test.describe("smoke", () => {
  let userId: string | undefined;

  test.afterEach(async () => {
    if (!userId) return;
    await deleteAccount(admin, userId);
    userId = undefined;
  });

  test("sign up, buy a pack in the Polar sandbox, spend a credit, balance is correct", async ({ page }) => {
    // A live run showed Polar's checkout validates the email's domain
    // actually accepts mail, rejecting @example.com outright ("The domain
    // name example.com does not accept email"). A Gmail "+" alias is a
    // real, deliverable address Polar accepts, and a fresh alias per run
    // (still unique via the same timestamp+random suffix) still exercises
    // sign-up as a brand-new account each time; any mail Polar happens to
    // send lands in that one real inbox.
    const email = `h.roivainen+e2e-smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@gmail.com`;

    // 1. "Sign up": a real Supabase user, signed in via a real magic link —
    // generated directly through the admin API instead of sent by email,
    // Supabase's own documented way to test this flow without a real inbox.
    // generateLink's action_link can't be used directly here: this app's
    // Supabase clients use the PKCE flow (@supabase/ssr's default), and
    // PKCE's code_challenge/code_verifier pairing is only ever set up by a
    // browser-invoked signInWithOtp call — an admin-generated link has none,
    // so visiting it can't complete through /callback's `?code=` exchange.
    // src/app/[locale]/(auth)/confirm/route.ts is the PKCE-independent
    // counterpart: it verifies the token_hash directly via Supabase's own
    // verifyOtp, exactly what a real signInWithOtp() email would also
    // support (see that route's comment for the full explanation).
    //
    // The user is created explicitly first (unconfirmed) rather than left
    // for generateLink to create implicitly: a live run hit "Email link is
    // invalid or has expired" (otp_expired) on every attempt, always for a
    // brand-new email — a known Supabase bug where generateLink's implicit
    // user creation races its own token generation for a first-ever magic
    // link (supabase/supabase#22521). Creating the user first avoids that
    // race; email_confirm stays false so the credit-granting trigger still
    // fires via its UPDATE path (see 20260922074420_signup_credit.sql) when
    // /confirm's verifyOtp call confirms the email below — the same path a
    // real magic-link signup takes, not the INSERT path Google sign-in uses.
    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: false,
    });
    if (createError || !createdUser.user) {
      throw new Error(`Could not create the test user: ${createError?.message ?? "no user in response"}`);
    }
    userId = createdUser.user.id;

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkError || !linkData.properties?.hashed_token) {
      throw new Error(`Could not generate a sign-in link: ${linkError?.message ?? "no hashed_token in response"}`);
    }

    const tokenHash = encodeURIComponent(linkData.properties.hashed_token);
    await page.goto(`/${LOCALE}/confirm?token_hash=${tokenHash}&type=magiclink`);

    // Fails fast with a clear reason instead of a confusing "text not
    // found" timeout later: a Preview deployment behind Vercel's own
    // "Vercel Authentication" wall (on by default, unlike Production —
    // see playwright.config.ts) redirects every request here instead of
    // ever reaching the app. VERCEL_AUTOMATION_BYPASS_SECRET must be set.
    if (/vercel\.com\/login|accounts\.vercel\.com/i.test(page.url())) {
      throw new Error(
        "Landed on Vercel's own login page instead of the app — this Preview deployment is behind " +
          "Vercel Authentication and VERCEL_AUTOMATION_BYPASS_SECRET isn't set (or is wrong). " +
          "See docs/decisions.md.",
      );
    }

    // Confirm sign-in actually completed and the signup bonus was granted,
    // rather than trusting that the redirect landed somewhere sensible.
    await page.goto(`/${LOCALE}/dashboard`);
    await expect(page.getByText(`Signed in as ${email}.`)).toBeVisible();

    await page.goto(`/${LOCALE}/account`);
    await expect(page.getByText(`Credits: ${SIGNUP_CREDITS}`)).toBeVisible();

    // 2. Buy a pack for real, in Polar's sandbox — this is the one step
    // this suite doesn't control the markup of. See fillPolarCheckout.
    await page.getByRole("button", { name: new RegExp(`^${PACK.credits} credits`) }).click();
    await page.waitForURL(/checkout\.polar\.sh|polar\.sh/i, { timeout: 20_000 });
    await fillPolarCheckout(page, email);

    // Polar redirects back to our own successUrl (the account page) once
    // the checkout completes; the credit grant itself happens async, via
    // Polar's webhook, so this polls rather than asserting immediately.
    await page.waitForURL(new RegExp(`/${LOCALE}/account`), { timeout: 60_000 });
    await expect(async () => {
      await page.reload();
      await expect(page.getByText(`Credits: ${SIGNUP_CREDITS + PACK.credits}`)).toBeVisible();
    }).toPass({ timeout: 60_000, intervals: [2_000, 3_000, 5_000] });

    // 3. Spend one credit through the example feature and confirm the
    // balance reflects it.
    await page.goto(`/${LOCALE}/features/example`);
    await page.getByLabel("Text").fill("smoke test");
    await page.getByRole("button", { name: /run \(uses 1 credit\)/i }).click();
    await expect(page.getByText(/^Result:/)).toBeVisible({ timeout: 15_000 });

    await page.goto(`/${LOCALE}/account`);
    await expect(page.getByText(`Credits: ${SIGNUP_CREDITS + PACK.credits - 1}`)).toBeVisible();
  });
});

// Polar's hosted checkout page — this app has no control over its markup.
// Three live runs now confirm its actual structure: "Email", "Cardholder
// name" and a "Country" combobox are plain fields directly on the page
// (getByLabel found and filled them correctly), but "Card number" timed
// out the entire 90s test waiting for a same-named getByLabel to appear —
// despite looking like a normal field in the failure screenshot. Card
// data is the one part of a checkout PCI compliance usually pulls into
// an isolated iframe (Stripe's Elements, which Polar is built on, always
// does this for its card fields), rendered borderless so it's visually
// indistinguishable from the surrounding page — exactly why a screenshot
// alone couldn't reveal it, only the getByLabel timeout could.
//
// locateInFrames polls the top-level page and every current iframe for a
// matching label, rather than a composite .or() (Playwright rejects
// mixing a page locator with one built from frameLocator() — hit on an
// earlier run) and rather than assuming either the page or an iframe.
async function locateInFrames(page: Page, label: string): Promise<Locator> {
  const timeoutMs = 30_000;
  const pollIntervalMs = 500;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const frame of [page, ...page.frames()]) {
      const locator = frame.getByLabel(label).first();
      if (await locator.count()) return locator;
    }
    await page.waitForTimeout(pollIntervalMs);
  }
  throw new Error(`Could not find a field labeled "${label}" on Polar's checkout page or in any of its iframes.`);
}

// Email really does start blank: our own checkout/route.ts sends
// externalCustomerId but no customerEmail to Polar.
//
// Best-effort: picks whichever first real option the Country combobox
// offers, native <select> or a custom listbox alike — this smoke test
// doesn't care which country, only that the field ends up filled if the
// form requires it. Its accessible name wasn't confirmed as "Country"
// specifically (vs. the "Billing address" heading above it), so this
// targets the only combobox on the page rather than a name pattern.
async function selectFirstCountry(page: Page): Promise<void> {
  const combobox = page.getByRole("combobox").first();
  if (!(await combobox.count())) return;

  const tagName = await combobox.evaluate((el) => el.tagName.toLowerCase());
  if (tagName === "select") {
    await combobox.selectOption({ index: 1 });
    return;
  }
  await combobox.click();
  await page.getByRole("option").first().click();
}

async function fillPolarCheckout(page: Page, email: string): Promise<void> {
  await page.getByLabel("Email").fill(email);

  const cardNumber = await locateInFrames(page, "Card number");
  await cardNumber.fill("4242424242424242");

  const expiry = await locateInFrames(page, "Expiration date");
  await expiry.fill("12 / 34");

  const cvc = await locateInFrames(page, "Security code");
  await cvc.fill("123");

  await page.getByLabel("Cardholder name").fill("E2E Smoke Test");
  await selectFirstCountry(page);

  await page.getByRole("button", { name: /pay|purchase|subscribe|complete/i }).click();
}
