import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip API routes, static files and Next internals; match everything else
  // so unprefixed paths (e.g. `/sign-in`) get redirected to `/en/sign-in`.
  matcher: ["/((?!api|_next|_vercel|dev|.*\\..*).*)"],
};
