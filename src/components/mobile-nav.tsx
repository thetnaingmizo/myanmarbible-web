"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

type Props = {
  user: {
    displayName: string;
    role: string;
  } | null;
};

const navLinks = [
  { href: "/bible", key: "bible" },
  { href: "/chat", key: "chat" },
  { href: "/verse-finder", key: "verseFinder" },
  { href: "/trivia", key: "trivia" },
  { href: "/characters", key: "characters" },
  { href: "/lessons", key: "lessons" },
  { href: "/questions", key: "questions" },
  { href: "/blog", key: "blog" },
  { href: "/podcast", key: "podcast" },
] as const;

export function MobileNav({ user }: Props) {
  const t = useTranslations("Common");
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="px-2">
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
          <span className="sr-only">Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle>{t("appName")}</SheetTitle>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-1">
          {navLinks.map(({ href, key }) => (
            <Link
              key={key}
              href={href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              {t(key)}
            </Link>
          ))}
        </nav>
        <Separator className="my-4" />
        {user ? (
          <div className="flex flex-col gap-1">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              {t("profile")}
            </Link>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              {t("settings")}
            </Link>
            {user.role === "admin" && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                {t("admin")}
              </Link>
            )}
            <button
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="rounded-md px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-accent"
            >
              {t("logout")}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 px-3">
            <Button asChild size="sm">
              <Link href="/login" onClick={() => setOpen(false)}>
                {t("login")}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/register" onClick={() => setOpen(false)}>
                {t("register")}
              </Link>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
