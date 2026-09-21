import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("allows a plain relative path", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
  });

  it("defaults to / when missing or empty", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });

  it("rejects a protocol-relative URL (different host)", () => {
    expect(safeNextPath("//evil.example")).toBe("/");
  });

  it("rejects an absolute URL with a scheme", () => {
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("javascript://alert(1)")).toBe("/");
  });

  it("rejects a value that doesn't start with /", () => {
    expect(safeNextPath("evil.example")).toBe("/");
  });
});
