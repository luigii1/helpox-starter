import type { Metadata } from "next";
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
