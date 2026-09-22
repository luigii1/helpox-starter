import { Footer } from "@/components/marketing/footer";

// Wraps only page.tsx routes ((auth)/sign-in) — the route handlers in this
// group (callback, sign-out) return a Response directly and are never
// wrapped by a layout.
export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 flex-col">{children}</div>
      <Footer locale={locale} />
    </div>
  );
}
