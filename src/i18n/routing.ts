import { defineRouting } from "next-intl/routing";

// Only "en" for now (CLAUDE.md §6). Adding another locale is: a new
// messages/<locale>.json file plus one more entry in this array.
export const routing = defineRouting({
  locales: ["en"],
  defaultLocale: "en",
});
