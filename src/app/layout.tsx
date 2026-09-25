import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// VERCEL_URL is set automatically by Vercel to the current deployment's own
// hostname (not a secret — it's the public URL). Needed so metadata like
// the Open Graph image resolves to an absolute URL instead of a relative
// one, which most link-preview scrapers won't follow.
const siteUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Helpox",
  description: "Helpox",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        {/* Cookieless (brick G4, docs/decisions.md): no config needed — it
            reads the deployment's own domain and only sends events in
            production ("auto" mode, the default), so no dev-only guard is
            needed here either. */}
        <Analytics />
      </body>
    </html>
  );
}
