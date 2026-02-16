"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";
import { Button } from "@/components/ui/button";

type UserInfo = {
  displayName: string;
  avatarUrl?: string;
  role: string;
};

type Props = {
  user: UserInfo | null;
};

const navLinks = [
  { href: "/bible", key: "bible" },
  { href: "/characters", key: "characters" },
  { href: "/lessons", key: "lessons" },
  { href: "/questions", key: "questions" },
  { href: "/blog", key: "blog" },
  { href: "/podcast", key: "podcast" },
  { href: "/chat", key: "chat" },
  { href: "/verse-finder", key: "verseFinder" },
  { href: "/trivia", key: "trivia" },
] as const;

export function HeaderClient({ user }: Props) {
  const t = useTranslations("Common");

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
        <Link href="/" className="mr-6 text-lg font-bold">
          {t("appName")}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map(({ href, key }) => (
            <Link
              key={key}
              href={href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {t(key)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          {user ? (
            <UserMenu user={user} />
          ) : (
            <Button asChild size="sm">
              <Link href="/login">{t("login")}</Link>
            </Button>
          )}
          <div className="md:hidden">
            <MobileNav user={user} />
          </div>
        </div>
      </div>
    </header>
  );
}
