// Site navigation, shared by the desktop header and the phone tab bar.
// Hubs mirror the app's tabs; "Learn" holds the web's study content.
export const hubs = [
  { href: "/bible", key: "bible" },
  { href: "/ask", key: "ask" },
  { href: "/bookmarks", key: "saved" },
] as const;

export const learnLinks = [
  { href: "/characters", key: "characters" },
  { href: "/lessons", key: "lessons" },
  { href: "/questions", key: "questions" },
  { href: "/blog", key: "blog" },
  { href: "/podcast", key: "podcast" },
  { href: "/trivia", key: "trivia" },
] as const;

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
