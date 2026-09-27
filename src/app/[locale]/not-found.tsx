import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations("Common");
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="font-serif text-6xl font-semibold text-maroon">404</p>
      <h1 className="mt-4 text-2xl font-semibold">{t("notFoundTitle")}</h1>
      <p className="mt-2 text-ink-3">{t("notFoundBody")}</p>
      <Button asChild className="mt-8">
        <Link href="/">{t("goHome")}</Link>
      </Button>
    </div>
  );
}
