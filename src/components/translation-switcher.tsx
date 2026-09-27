"use client";

import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

type Translation = {
  id: string;
  code: string;
  name_en: string;
  name_my: string | null;
  language: string;
};

type Props = {
  translations: Translation[];
  current: string;
  /**
   * Map of translationId → href for navigation.
   * If not provided, defaults to `/bible?t=<id>`.
   */
  hrefMap?: Record<string, string>;
};

export function TranslationSwitcher({ translations, current, hrefMap }: Props) {
  const locale = useLocale();
  const router = useRouter();

  return (
    // Scrolls sideways on narrow screens instead of widening the page.
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
      {translations.map((t) => (
        <Button
          key={t.id}
          variant={current === t.id ? "default" : "outline"}
          size="sm"
          className="shrink-0"
          aria-pressed={current === t.id}
          onClick={() => {
            const href = hrefMap?.[t.id] ?? `/bible?t=${t.id}`;
            router.push(href);
          }}
        >
          {locale === "my" && t.name_my ? t.name_my : t.name_en}
        </Button>
      ))}
    </div>
  );
}
