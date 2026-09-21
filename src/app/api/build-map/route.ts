import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Read-only mirror for the command center (public/center/index.html), which
// can't read repo files directly once Vercel is actually running `next
// build` instead of serving the raw repo as static files (brick P5).
export async function GET() {
  const filePath = path.join(process.cwd(), "docs", "build-map.json");
  const body = await readFile(filePath, "utf8");
  return new NextResponse(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
