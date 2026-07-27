import type { Metadata } from "next";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  BookOpen,
  BookMarked,
  CloudOff,
  GraduationCap,
  MessageCircle,
  Play,
  Search,
  Sparkles,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.zofate.myanmarbible";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Landing" });
  const tc = await getTranslations({ locale, namespace: "Common" });
  return {
    title: { absolute: `${tc("appName")} — ${t("heroTitle")}` },
    description: t("heroDescription"),
    openGraph: {
      title: tc("appName"),
      description: t("heroDescription"),
      images: ["/screenshots/reader-my.png"],
    },
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HomeContent />;
}

function HomeContent() {
  const t = useTranslations("Landing");
  const tc = useTranslations("Common");

  const features = [
    { icon: BookOpen, title: t("readerFeature"), desc: t("readerFeatureDesc") },
    { icon: MessageCircle, title: t("chatFeature"), desc: t("chatFeatureDesc") },
    {
      icon: Search,
      title: t("verseFinderFeature"),
      desc: t("verseFinderFeatureDesc"),
    },
    { icon: CloudOff, title: t("offlineFeature"), desc: t("offlineFeatureDesc") },
    { icon: Sparkles, title: t("triviaFeature"), desc: t("triviaFeatureDesc") },
    {
      icon: GraduationCap,
      title: t("contentFeature"),
      desc: t("contentFeatureDesc"),
    },
  ];

  const stats = [
    { value: t("statTranslationsValue"), label: t("statTranslationsLabel") },
    { value: t("statVersesValue"), label: t("statVersesLabel") },
    { value: t("statYearsValue"), label: t("statYearsLabel") },
    { value: t("statFreeValue"), label: t("statFreeLabel") },
  ];

  const faqs = [1, 2, 3, 4, 5].map((n) => ({
    q: t(`faqQ${n}`),
    a: t(`faqA${n}`),
  }));

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_70%_-10%,--theme(--color-primary/8%),transparent)]"
        />
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
          <div className="flex flex-col items-start text-left">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {t("heroBadge")}
            </span>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-balance sm:text-5xl">
              {t("heroTitle")}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              {t("heroDescription")}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild size="lg">
                <Link href="/bible">
                  <BookMarked aria-hidden />
                  {t("exploreBible")}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/chat">
                  <MessageCircle aria-hidden />
                  {t("startChat")}
                </Link>
              </Button>
            </div>
            <dl className="mt-12 grid w-full max-w-xl grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt className="order-last mt-1 text-sm leading-snug text-muted-foreground">
                    {s.label}
                  </dt>
                  <dd className="text-2xl font-bold text-primary">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative mx-auto hidden w-full max-w-xs md:block">
            <div
              aria-hidden
              className="absolute -inset-6 rounded-[3rem] bg-primary/10 blur-2xl"
            />
            <div className="relative overflow-hidden rounded-[2.25rem] border-[6px] border-foreground/85 bg-foreground/85 shadow-2xl">
              <Image
                src="/screenshots/reader-my.png"
                alt={t("screenshotAlt")}
                width={554}
                height={1200}
                priority
                className="w-full rounded-[1.9rem]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/40">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              {t("featuresTitle")}
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              {t("featuresSubtitle")}
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* App download */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-8 px-4 py-16 text-center sm:px-6 md:py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight">
              {t("downloadTitle")}
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-primary-foreground/85">
              {t("downloadDescription")}
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
            <Button asChild size="lg" variant="secondary" className="gap-2">
              <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
                <Play className="fill-current" aria-hidden />
                {t("downloadAndroid")}
              </a>
            </Button>
            <span className="inline-flex h-10 items-center rounded-md border border-primary-foreground/30 px-6 text-sm text-primary-foreground/80">
              {t("downloadIosSoon")}
            </span>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 md:py-24">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            {t("faqTitle")}
          </h2>
          <Accordion type="single" collapsible className="mt-10">
            {faqs.map((f, i) => (
              <AccordionItem key={f.q} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-base">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-base leading-relaxed text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t bg-muted/40">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center px-4 py-16 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight">
            {t("finalCtaTitle")}
          </h2>
          <p className="mt-3 max-w-xl text-lg text-muted-foreground">
            {t("finalCtaDescription")}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/bible">
                <BookOpen aria-hidden />
                {t("exploreBible")}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
                <Play className="fill-current" aria-hidden />
                {t("downloadAndroid")}
              </a>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">{tc("appName")}</p>
        </div>
      </section>
    </div>
  );
}
