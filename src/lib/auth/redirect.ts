import { routing } from "@/i18n/routing";

/**
 * Where to send someone after sign-in. Only same-site paths are allowed
 * ("/my/chat"), never "//host", "/\\host" or absolute URLs, so a crafted
 * `next` can't bounce a signed-in user to another site. Falls back to the
 * locale's home page.
 */
export function safeNext(next: string | null | undefined, locale: string = routing.defaultLocale): string {
  const home = `/${locale}`;
  if (!next || typeof next !== "string") return home;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return home;
  if (/[\u0000-\u001f]/.test(next)) return home;
  try {
    // Must stay on a dummy origin once resolved (catches encoded tricks).
    const url = new URL(next, "http://x.invalid");
    if (url.origin !== "http://x.invalid") return home;
    return url.pathname + url.search + url.hash;
  } catch {
    return home;
  }
}

/** Locale at the start of a path ("/en/chat" → "en"), else the default. */
export function localeOf(pathname: string): string {
  const first = pathname.split("/")[1];
  return (routing.locales as readonly string[]).includes(first) ? first : routing.defaultLocale;
}
