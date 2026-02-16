import { setRequestLocale, getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ChatWindow } from "./chat-window";
import type { ResponseLanguage } from "@/lib/chat/store";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ChatPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Chat");
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

  // Derive default language from user's preferred locale
  const preferredLocale = session.profile?.preferred_locale;
  const defaultLanguage: ResponseLanguage =
    preferredLocale === "en" || preferredLocale === "my" ? preferredLocale : "auto";

  return <ChatWindow userId={session.user.id} defaultLanguage={defaultLanguage} />;
}
