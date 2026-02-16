import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("Common");

  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between sm:px-6">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {t("appName")}
        </p>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          <a href="#" className="hover:underline">
            Privacy
          </a>
          <a href="#" className="hover:underline">
            Terms
          </a>
        </nav>
      </div>
    </footer>
  );
}
