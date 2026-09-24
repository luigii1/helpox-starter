import { test, expect, type Page } from "@playwright/test";
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
    const email = `e2e-smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

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
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkError || !linkData.properties?.hashed_token) {
      throw new Error(`Could not generate a sign-in link: ${linkError?.message ?? "no hashed_token in response"}`);
    }
    userId = linkData.user.id;

    const tokenHash = encodeURIComponent(linkData.properties.hashed_token);
    await page.goto(`/${LOCALE}/confirm?token_hash=${tokenHash}&type=magiclink`);

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
    await fillPolarCheckout(page);

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

// Polar's hosted checkout page — this app has no control over its markup,
// so these selectors are a best-effort guess at a typical card-entry form,
// not something verified against the real page (this sandbox has no network
// access to polar.sh). This is the one part of this suite most likely to
// need adjusting after its first real run — check the Playwright trace/
// screenshot artifact from that run and fix the selectors below to match.
async function fillPolarCheckout(page: Page): Promise<void> {
  const cardNumber = page
    .getByPlaceholder(/card number/i)
    .or(page.frameLocator("iframe").getByPlaceholder(/card number/i))
    .first();
  await cardNumber.waitFor({ timeout: 15_000 });
  await cardNumber.fill("4242424242424242");

  const expiry = page
    .getByPlaceholder(/mm\s*\/\s*yy/i)
    .or(page.frameLocator("iframe").getByPlaceholder(/mm\s*\/\s*yy/i))
    .first();
  await expiry.fill("12 / 34");

  const cvc = page
    .getByPlaceholder(/cvc|cvv/i)
    .or(page.frameLocator("iframe").getByPlaceholder(/cvc|cvv/i))
    .first();
  await cvc.fill("123");

  await page.getByRole("button", { name: /pay|purchase|subscribe|complete/i }).click();
}
