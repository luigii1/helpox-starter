import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip API routes, static files, Next internals, the dev-only UI showcase
  // and the command center (public/center/index.html, brick P5); match
  // everything else so unprefixed paths (e.g. `/sign-in`) redirect to
  // `/en/sign-in`.
  matcher: ["/((?!api|_next|_vercel|dev|center|.*\\..*).*)"],
};
