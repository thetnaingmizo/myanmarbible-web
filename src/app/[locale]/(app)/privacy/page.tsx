import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CONTACT_EMAIL } from "@/lib/site";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal" });
  return { title: t("privacyTitle") };
}

const sections = [
  "pCollect",
  "pUse",
  "pAi",
  "pStorage",
  "pDelete",
  "pChildren",
  "pChanges",
  "pContact",
] as const;

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Legal" });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("privacyTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("lastUpdated")}</p>
      <p className="mt-6 leading-relaxed">{t("pIntro")}</p>
      {sections.map((s) => (
        <section key={s} className="mt-8">
          <h2 className="text-xl font-semibold">{t(`${s}Title`)}</h2>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            {t(`${s}Body`, { email: CONTACT_EMAIL })}
          </p>
        </section>
      ))}
    </div>
  );
}
