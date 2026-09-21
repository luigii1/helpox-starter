import { NextResponse } from "next/server";
import { z } from "zod";
import { validateJsonBody } from "@/lib/validation";

// Dev-only (404 outside development, same pattern as /dev/ui from brick H2):
// exists purely to prove brick S2's validation helper live over real HTTP,
// since nothing else in the app yet has a JSON-body route to exercise it on.
const schema = z.object({
  amount: z.number().int().positive(),
  reason: z.string().min(1),
});

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  const result = await validateJsonBody(request, schema);
  if ("response" in result) {
    return result.response;
  }

  return NextResponse.json({ ok: true, received: result.data });
}
