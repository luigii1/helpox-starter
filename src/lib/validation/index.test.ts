import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validate, validateOrRespond, validateJsonBody } from "./index";

const schema = z.object({
  amount: z.number().int().positive(),
  reason: z.string().min(1),
});

describe("validate", () => {
  it("returns the parsed data on valid input", () => {
    const result = validate(schema, { amount: 5, reason: "purchase" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ amount: 5, reason: "purchase" });
    }
  });

  it("returns a validation_failed error, not a throw, on malformed input", () => {
    expect(() => validate(schema, { amount: -1, reason: "" })).not.toThrow();
    const result = validate(schema, { amount: -1, reason: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.error).toBe("validation_failed");
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it("returns a validation_failed error on completely wrong input shapes", () => {
    expect(() => validate(schema, "not an object")).not.toThrow();
    expect(() => validate(schema, null)).not.toThrow();
    expect(() => validate(schema, undefined)).not.toThrow();
    const result = validate(schema, "not an object");
    expect(result.success).toBe(false);
  });
});

describe("validateOrRespond", () => {
  it("returns data for valid input", async () => {
    const result = validateOrRespond(schema, { amount: 1, reason: "grant" });
    expect("data" in result).toBe(true);
  });

  it("returns a 400 NextResponse for invalid input, not a thrown error", async () => {
    const result = validateOrRespond(schema, { amount: "not a number", reason: "x" });
    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.error).toBe("validation_failed");
    }
  });
});

describe("validateJsonBody", () => {
  it("returns data for a valid JSON body", async () => {
    const request = new Request("http://localhost/api/example", {
      method: "POST",
      body: JSON.stringify({ amount: 3, reason: "grant" }),
    });
    const result = await validateJsonBody(request, schema);
    expect("data" in result).toBe(true);
  });

  it("returns a 400, not a crash, for a schema-invalid JSON body", async () => {
    const request = new Request("http://localhost/api/example", {
      method: "POST",
      body: JSON.stringify({ amount: -5 }),
    });
    const result = await validateJsonBody(request, schema);
    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.status).toBe(400);
    }
  });

  it("returns a 400, not a crash, for malformed (non-JSON) body text", async () => {
    const request = new Request("http://localhost/api/example", {
      method: "POST",
      body: "{not valid json",
    });
    const result = await validateJsonBody(request, schema);
    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.error).toBe("validation_failed");
    }
  });
});
