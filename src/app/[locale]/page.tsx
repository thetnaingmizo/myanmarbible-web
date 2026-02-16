import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HomeContent />;
}

function HomeContent() {
  const t = useTranslations("Landing");
  const tc = useTranslations("Common");

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
        {tc("appName")}
      </h1>
      <p className="mb-2 text-2xl font-semibold text-primary">
        {t("heroTitle")}
      </p>
      <p className="mb-8 max-w-2xl text-lg text-muted-foreground">
        {t("heroDescription")}
      </p>
      <div className="flex gap-4">
        <Link
          href="/chat"
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          {t("startChat")}
        </Link>
        <Link
          href="/bible"
          className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {t("exploreBible")}
        </Link>
      </div>
    </div>
  );
}
