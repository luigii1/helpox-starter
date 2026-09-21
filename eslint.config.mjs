import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";
import i18next from "eslint-plugin-i18next";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettierConfig,
  // Every user-visible string in localized pages must go through next-intl's
  // t() (CLAUDE.md §6), so a hard-coded JSX string there is a bug, not a
  // style nit. Scoped to the localized app tree and shared UI components —
  // not the dev-only /dev/ui showcase, which is never shown to a real user.
  {
    files: ["src/app/\\[locale\\]/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Not part of the Next.js app:
    "center/**",
    "api/**",
  ]),
]);

export default eslintConfig;
