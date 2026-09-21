import { type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

// Refreshes the Supabase session cookie on every request. Server Components
// can only read cookies, not write them, so without this the session would
// silently expire instead of auto-renewing — this is the one place allowed
// to write it (brick A2).
export default async function proxy(request: NextRequest) {
  const response = intlMiddleware(request);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Skip API routes, static files, Next internals, the dev-only UI showcase
  // and the command center (public/center/index.html, brick P5); match
  // everything else so unprefixed paths (e.g. `/sign-in`) redirect to
  // `/en/sign-in`.
  matcher: ["/((?!api|_next|_vercel|dev|center|.*\\..*).*)"],
};
