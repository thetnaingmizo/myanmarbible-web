"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { num, shortBurmeseBookName } from "@/lib/bible/reader-text";
import { studyCall, type StudyError } from "../ai";
import { AiBadge, AiError, AiLoading, Disclaimer } from "./ai-bits";
import type { StudyContext } from "./context";

type Style = "standard" | "short" | "kids";
type Explanation = {
  background?: string;
  meaning?: string;
  life?: string;
  verses?: { n: number; book: number; chapter: number; verse: number }[];
};
type Result = { cached: boolean; remaining?: number; content: Explanation };

/** Explain: background · meaning · for your life (ai-study "explain", cached for everyone). */
export function ExplainPanel({ ctx }: { ctx: StudyContext }) {
  const t = useTranslations("Study");
  const [style, setStyle] = useState<Style>("standard");
  const [lang, setLang] = useState<"my" | "en">(ctx.locale === "en" ? "en" : "my");
  const [state, setState] = useState<{ loading: boolean; result?: Result; error?: StudyError }>({ loading: true });

  const first = ctx.numbers[0];
  const last = ctx.numbers[ctx.numbers.length - 1];

  const load = useCallback(async () => {
    setState({ loading: true });
    const r = await studyCall<Result>({
      mode: "explain",
      translationId: ctx.bible.id,
      book: ctx.book.book_number,
      chapter: ctx.chapter,
      verse: first,
      verseEnd: last,
      lang,
      style,
    });
    setState(r.ok ? { loading: false, result: r.data } : { loading: false, error: r.error });
  }, [ctx.bible.id, ctx.book.book_number, ctx.chapter, first, last, lang, style]);

  useEffect(() => {
    // Fetching is the point of this effect: it runs when the panel opens or
    // the reader picks another style or language.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const burmeseBible = ctx.bible.language === "my";
  const bookById = new Map(ctx.books.map((b) => [b.book_number, b]));
  const refLabel = (v: { book: number; chapter: number; verse: number }) => {
    const b = bookById.get(v.book);
    if (!b) return null;
    const name = (burmeseBible && b.name_my ? shortBurmeseBookName(b.name_my) : b.name_en).replace(/​/g, "");
    return { href: `/bible/${b.id}/${v.chapter}?v=${v.verse}`, label: `${name} ${num(`${v.chapter}:${v.verse}`, burmeseBible)}` };
  };

  const c = state.result?.content;
  // "[V2]" in the text points at c.verses[n=2]: show it as a small link.
  const withCitations = (text: string) =>
    text.split(/(\[V\d+\])/).map((part, i) => {
      const m = /^\[V(\d+)\]$/.exec(part);
      if (!m) return part;
      const v = c?.verses?.find((x) => x.n === Number(m[1]));
      const r = v ? refLabel(v) : null;
      return r ? (
        <Link key={i} href={r.href} title={r.label} className="mx-0.5 rounded bg-surface px-1 align-super text-[0.7em] font-semibold text-maroon hover:underline">
          {r.label}
        </Link>
      ) : null;
    });
  const sections: [string, string | undefined][] = [
    [t("background"), c?.background],
    [t("meaning"), c?.meaning],
    [t("life"), c?.life],
  ];

  return (
    <div className="space-y-4">
      <p className="font-semibold text-ink">{ctx.reference}</p>
      <div className="flex flex-wrap gap-2">
        <div className="flex rounded-full bg-sunk p-1 text-xs font-semibold" role="group">
          {(["standard", "short", "kids"] as Style[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={style === s}
              onClick={() => setStyle(s)}
              className={cn("rounded-full px-3 py-1.5", style === s ? "bg-surface text-maroon shadow-sm" : "text-ink-2")}
            >
              {t(s)}
            </button>
          ))}
        </div>
        <div className="flex rounded-full bg-sunk p-1 text-xs font-semibold" role="group">
          {(["my", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => setLang(l)}
              className={cn("rounded-full px-3 py-1.5", lang === l ? "bg-surface text-maroon shadow-sm" : "text-ink-2")}
            >
              {l === "my" ? t("langMy") : t("langEn")}
            </button>
          ))}
        </div>
      </div>

      {state.loading ? (
        <AiLoading />
      ) : state.error ? (
        <AiError error={state.error} onRetry={load} />
      ) : (
        <div className="space-y-4 rounded-2xl bg-gold-tint/50 p-4" lang={lang}>
          <AiBadge />
          {sections.map(([title, body]) =>
            body ? (
              <section key={title}>
                <h3 className="text-sm font-semibold text-ink-2">{title}</h3>
                <p className="mt-1 leading-relaxed text-ink">{withCitations(body)}</p>
              </section>
            ) : null
          )}
          {!!c?.verses?.length && (
            <section>
              <h3 className="text-sm font-semibold text-ink-2">{t("citedVerses")}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {c.verses.map((v) => {
                  const r = refLabel(v);
                  return r ? (
                    <Link key={v.n} href={r.href} className="rounded-full border border-line bg-surface px-3 py-1 text-sm font-medium text-maroon hover:bg-sunk">
                      {r.label}
                    </Link>
                  ) : null;
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {state.result?.remaining != null && <p className="text-xs text-ink-3">{t("remaining", { count: num(state.result.remaining, ctx.locale === "my") })}</p>}
      <p className="text-xs text-ink-3">{t("usesOne")}</p>
      <Disclaimer />
      <Link href={`/ask?about=${encodeURIComponent(ctx.reference)}`} className="inline-flex h-10 items-center rounded-full border border-line px-5 text-sm font-semibold text-ink hover:bg-sunk">
        {t("askMore")}
      </Link>
    </div>
  );
}
