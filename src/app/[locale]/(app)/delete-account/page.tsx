import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { CONTACT_EMAIL } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { DeleteAccountForm } from "./delete-account-form";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal" });
  return { title: t("deleteTitle") };
}

// Public page the app stores link to: how to delete an account in the app,
// here on the web (signed in), or by email.
export default async function DeleteAccountPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Legal" });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("deleteTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("lastUpdated")}</p>
      <p className="mt-6 leading-relaxed">{t("deleteIntro")}</p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{t("deleteInAppTitle")}</h2>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          {t("deleteInAppBody")}
        </p>
      </section>

      <section className="mt-8 rounded-lg border p-5">
        <h2 className="text-xl font-semibold">{t("deleteWebTitle")}</h2>
        {!user ? (
          <>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              {t("deleteWebSignedOut")}
            </p>
            <Button asChild className="mt-4">
              <Link href="/login?next=/delete-account">
                {t("deleteWebSignIn")}
              </Link>
            </Button>
          </>
        ) : user.is_anonymous ? (
          <p className="mt-2 leading-relaxed text-muted-foreground">
            {t("deleteWebGuest")}
          </p>
        ) : (
          <>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              {t("deleteWebSignedIn", { email: user.email ?? "" })}
            </p>
            <DeleteAccountForm />
          </>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{t("deleteWhatTitle")}</h2>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          {t("deleteWhatBody")}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{t("deleteEmailTitle")}</h2>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          {t("deleteEmailBody", { email: CONTACT_EMAIL })}
        </p>
      </section>
    </div>
  );
}
