"use client";

import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { TabBar } from "./mobile-nav";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { hubs, isActive, learnLinks } from "./nav-items";

type UserInfo = {
  displayName: string;
  avatarUrl?: string;
  role: string;
};

type Props = {
  user: UserInfo | null;
};

const linkClass = (active: boolean) =>
  cn(
    "rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
    active ? "bg-maroon-tint text-maroon" : "text-ink-2 hover:bg-sunk hover:text-ink"
  );

export function HeaderClient({ user }: Props) {
  const t = useTranslations("Common");
  const pathname = usePathname();
  const learnActive = learnLinks.some(({ href }) => isActive(pathname, href));

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-surface focus:px-4 focus:py-2"
      >
        {t("skipToContent")}
      </a>
      <header className="sticky top-0 z-50 w-full border-b border-hairline bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <Link href="/" className="mr-3 flex shrink-0 items-center gap-2" aria-label={t("appName")}>
            <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-maroon-button text-sm font-bold text-white">
              MB
            </span>
            <span className="font-serif text-lg font-semibold text-ink">{t("appName")}</span>
          </Link>

          <nav aria-label={t("menu")} className="hidden items-center gap-1 md:flex">
            {hubs.map(({ href, key }) => (
              <Link
                key={key}
                href={href}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                className={linkClass(isActive(pathname, href))}
              >
                {t(key)}
              </Link>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(linkClass(learnActive), "flex items-center gap-1 outline-none")}>
                {t("learn")}
                <ChevronDown className="size-4" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {learnLinks.map(({ href, key }) => (
                  <DropdownMenuItem key={key} asChild>
                    <Link href={href} aria-current={isActive(pathname, href) ? "page" : undefined}>
                      {t(key)}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <LanguageSwitcher />
            {user ? (
              <UserMenu user={user} />
            ) : (
              // Phones reach sign-in from the tab bar's "Me".
              <Button asChild size="sm" className="ml-1 hidden sm:inline-flex">
                <Link href="/login">{t("signIn")}</Link>
              </Button>
            )}
          </div>
        </div>
      </header>
      <TabBar signedIn={!!user} />
    </>
  );
}
