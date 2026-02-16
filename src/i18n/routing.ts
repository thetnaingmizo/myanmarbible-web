import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["my", "en"],
  defaultLocale: "my",
});
