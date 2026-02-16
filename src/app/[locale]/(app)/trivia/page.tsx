import { setRequestLocale, getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { TriviaPage as TriviaPageClient } from "./trivia-page";
import type { QuizLanguage } from "@/lib/trivia/types";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function TriviaPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Trivia");
  const session = await getSession();

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-4 py-20">
        <p className="text-lg text-muted-foreground">{t("loginRequired")}</p>
        <Button asChild>
          <Link href="/login">{t("loginButton")}</Link>
        </Button>
      </div>
    );
  }

  const preferredLocale = session.profile?.preferred_locale;
  const defaultLanguage: QuizLanguage =
    preferredLocale === "en" || preferredLocale === "my"
      ? preferredLocale
      : "auto";

  return (
    <TriviaPageClient
      userId={session.user.id}
      defaultLanguage={defaultLanguage}
    />
  );
}
