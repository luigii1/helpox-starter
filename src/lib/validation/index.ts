import { z } from "zod";
import { NextResponse } from "next/server";

// A stable error code, never a hard-coded English sentence — the UI maps
// this to a translated message via t() (CLAUDE.md §6). `issues` is for
// developers/logs, not for direct display to the user.
export type ValidationErrorBody = {
  error: "validation_failed";
  issues: { path: string; message: string }[];
};

export type ValidationResult<T> = { success: true; data: T } | { success: false; error: ValidationErrorBody };

function formatIssues(error: z.ZodError): ValidationErrorBody {
  return {
    error: "validation_failed",
    issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  };
}

// For server actions: validate plain input and get back a discriminated
// result, no HTTP semantics attached.
export function validate<T extends z.ZodType>(schema: T, input: unknown): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(input);
  if (!result.success) {
    return { success: false, error: formatIssues(result.error) };
  }
  return { success: true, data: result.data };
}

// For route handlers: same validation, but a failure comes back as a ready
// -to-return 400 NextResponse instead of a result object to branch on.
export function validateOrRespond<T extends z.ZodType>(
  schema: T,
  input: unknown,
): { data: z.infer<T> } | { response: NextResponse<ValidationErrorBody> } {
  const result = validate(schema, input);
  if (!result.success) {
    return { response: NextResponse.json(result.error, { status: 400 }) };
  }
  return { data: result.data };
}

// Parses a route handler's JSON body and validates it in one step. Malformed
// JSON (not just schema-invalid JSON) is also a 400, never an unhandled
// exception that would otherwise crash the handler with a 500.
export async function validateJsonBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { response: NextResponse<ValidationErrorBody> }> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return {
      response: NextResponse.json(
        { error: "validation_failed", issues: [{ path: "", message: "Invalid JSON body" }] },
        { status: 400 },
      ),
    };
  }
  return validateOrRespond(schema, json);
}
