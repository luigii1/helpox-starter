import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Mirrors tsconfig.json's "@/*" path — no test file needed this until a
// tested lib file (src/lib/polar/handle-order-paid.ts) first imported
// another local module via the alias instead of a relative path.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["supabase/tests/**/*.test.ts", "src/**/*.test.ts"],
  },
});
