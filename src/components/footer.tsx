import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PLAY_STORE_URL } from "@/lib/site";

export function Footer() {
  const t = useTranslations("Common");
  const legal = useTranslations("Legal");

  return (
    <footer className="mb-[calc(3.5rem+env(safe-area-inset-bottom))] border-t border-hairline bg-sunk/50 md:mb-0">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <p className="font-serif text-lg font-semibold text-ink">{t("appName")}</p>
          <p className="mt-1 text-sm text-ink-3">&copy; {new Date().getFullYear()}</p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-2">
          <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-maroon hover:underline">
            {t("getApp")}
          </a>
          <Link href="/privacy" className="hover:underline">
            {t("privacy")}
          </Link>
          <Link href="/terms" className="hover:underline">
            {t("terms")}
          </Link>
          <Link href="/delete-account" className="hover:underline">
            {legal("deleteTitle")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
