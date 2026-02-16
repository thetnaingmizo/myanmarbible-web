"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { updatePassword } from "@/lib/auth/profile-actions";
import { routing } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handlePasswordChange(formData: FormData) {
    setLoading(true);
    setPasswordError("");
    setPasswordSuccess("");
    const result = await updatePassword(formData);
    if (result?.error) {
      setPasswordError(result.error);
    } else {
      setPasswordSuccess(t("passwordUpdated"));
    }
    setLoading(false);
  }

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

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("changePassword")}</CardTitle>
        </CardHeader>
        <CardContent>
          {passwordError && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="mb-4 rounded-md bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
              {passwordSuccess}
            </div>
          )}
          <form action={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t("newPassword")}</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={loading}>
              {t("updatePassword")}
            </Button>
          </form>
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
          <Button variant="destructive" size="sm" disabled>
            {t("deleteAccount")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
