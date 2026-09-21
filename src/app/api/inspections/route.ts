import { NextResponse } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// Read-only mirror for the command center (public/center/index.html), which
// can't read repo files directly once Vercel is actually running `next
// build` instead of serving the raw repo as static files (brick P5).
// Ported from the pre-P5 api/inspections.js Vercel serverless function.
export async function GET() {
  const dir = path.join(process.cwd(), "docs", "inspections");
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  };

  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return NextResponse.json([], { headers });
  }

  const reports = [];
  for (const name of names) {
    if (!/^[A-Z][0-9]+\.json$/.test(name)) continue;
    try {
      reports.push(JSON.parse(await readFile(path.join(dir, name), "utf8")));
    } catch {
      reports.push({
        brick: name.replace(".json", ""),
        result: "fail",
        summary_fi: "Raportti on rikki eikä sitä voi lukea.",
        checks: [],
      });
    }
  }
  return NextResponse.json(reports, { headers });
}
