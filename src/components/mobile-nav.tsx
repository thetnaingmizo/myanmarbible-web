"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BookOpen, Bookmark, GraduationCap, MessageCircleQuestion, UserRound } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { hubs, isActive, learnLinks } from "./nav-items";

const icons = { bible: BookOpen, ask: MessageCircleQuestion, saved: Bookmark } as const;

const tabClass = (active: boolean) =>
  cn(
    "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold",
    active ? "text-maroon" : "text-ink-3"
  );

const pillClass = (active: boolean) =>
  cn("flex h-7 w-14 items-center justify-center rounded-full", active && "bg-maroon-tint");

/** Phone-width bottom tab bar, like the app's: Bible · Ask · Saved · Learn · Me. */
export function TabBar({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("Common");
  const pathname = usePathname();
  const [learnOpen, setLearnOpen] = useState(false);
  const learnActive = learnLinks.some(({ href }) => isActive(pathname, href));
  const meHref = signedIn ? "/settings" : "/login";
  const meActive = ["/settings", "/profile", "/login"].some((h) => isActive(pathname, h));

  return (
    <>
      <nav
        aria-label={t("menu")}
        className="fixed inset-x-0 bottom-0 z-50 flex border-t border-hairline bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {hubs.map(({ href, key }) => {
          const Icon = icons[key];
          const active = isActive(pathname, href);
          return (
            <Link key={key} href={href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
              <span className={pillClass(active)}>
                <Icon className="size-5" aria-hidden />
              </span>
              {t(key)}
            </Link>
          );
        })}
        <button type="button" onClick={() => setLearnOpen(true)} className={tabClass(learnActive)} aria-haspopup="dialog">
          <span className={pillClass(learnActive)}>
            <GraduationCap className="size-5" aria-hidden />
          </span>
          {t("learn")}
        </button>
        <Link href={meHref} aria-current={meActive ? "page" : undefined} className={tabClass(meActive)}>
          <span className={pillClass(meActive)}>
            <UserRound className="size-5" aria-hidden />
          </span>
          {t("me")}
        </Link>
      </nav>

      <Sheet open={learnOpen} onOpenChange={setLearnOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <SheetHeader>
            <SheetTitle>{t("learn")}</SheetTitle>
          </SheetHeader>
          <nav className="grid grid-cols-2 gap-2 px-4">
            {learnLinks.map(({ href, key }) => (
              <Link
                key={key}
                href={href}
                onClick={() => setLearnOpen(false)}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                className={cn(
                  "rounded-xl border border-line px-4 py-3 text-sm font-semibold",
                  isActive(pathname, href) ? "bg-maroon-tint text-maroon" : "bg-surface text-ink"
                )}
              >
                {t(key)}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
