"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const localeLabels: Record<string, string> = {
  my: "မြန်မာ",
  en: "English",
};

export function SettingsForm() {
  const t = useTranslations("Settings");
  const locale = useLocale();
  const router = useRouter();
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("language")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {routing.locales.map((l) => (
              <Button
                key={l}
                variant={locale === l ? "default" : "outline"}
                size="sm"
                onClick={() => router.replace("/settings", { locale: l })}
              >
                {localeLabels[l]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-lg text-destructive">
            {t("deleteAccount")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            {t("deleteAccountWarning")}
          </p>
          <Button variant="destructive" size="sm" asChild>
            <Link href="/delete-account">{t("deleteAccount")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
