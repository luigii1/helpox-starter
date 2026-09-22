import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Next.js's file-convention OG image (auto-linked into generateMetadata's
// openGraph.images for this route) — generated at request time, no static
// asset to keep in sync with the tagline. Text comes from the same
// Marketing messages as the page itself (CLAUDE.md §6), not hard-coded.
export default async function OpengraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Marketing" });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          backgroundColor: "#13171c",
          color: "#e8ecf1",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 600 }}>{t("siteName")}</div>
        <div style={{ fontSize: 36, color: "#9aa5b2" }}>{t("hero.title")}</div>
      </div>
    ),
    { ...size },
  );
}
