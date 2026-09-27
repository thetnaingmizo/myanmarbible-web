"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { cleanVerseText, num } from "@/lib/bible/reader-text";
import { compareVerses, type CompareRow } from "@/lib/bible/study-data";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { studyCall, type StudyError } from "../ai";
import { AiBadge, AiError, AiLoading, Disclaimer, SignInPrompt } from "./ai-bits";
import type { StudyContext } from "./context";

type Differ = { summary?: string; differences?: { phrases: Record<string, string>; note: string }[] };

/** Compare: the verse in every Bible (free), then AI "Why do they differ?". */
export function ComparePanel({ ctx, returnTo }: { ctx: StudyContext; returnTo: string }) {
  const t = useTranslations("Study");
  const [rows, setRows] = useState<CompareRow[] | null>(null);
  const [differ, setDiffer] = useState<{ loading: boolean; content?: Differ; remaining?: number; error?: StudyError } | null>(null);

  useEffect(() => {
    let live = true;
    compareVerses(ctx.book.book_number, ctx.chapter, ctx.numbers).then((r) => live && setRows(r));
    return () => {
      live = false;
    };
  }, [ctx.book.book_number, ctx.chapter, ctx.numbers]);

  // "Why do they differ?" looks at one verse in this Bible + up to two others.
  const first = ctx.numbers[0];
  const withText = (rows ?? []).filter((r) => r.verses.length > 0);
  const ids = [ctx.bible.id, ...withText.map((r) => r.bibleId).filter((id) => id !== ctx.bible.id)].slice(0, 3);

  async function explainDifferences() {
    setDiffer({ loading: true });
    const r = await studyCall<{ content: Differ; remaining?: number }>({
      mode: "differ",
      translationIds: ids,
      book: ctx.book.book_number,
      chapter: ctx.chapter,
      verse: first,
      lang: ctx.locale === "en" ? "en" : "my",
    });
    setDiffer(r.ok ? { loading: false, content: r.data.content, remaining: r.data.remaining } : { loading: false, error: r.error });
  }

  return (
    <div className="space-y-4">
      <p className="font-semibold text-ink">{ctx.reference}</p>
      {!rows ? (
        <div role="status" aria-busy="true" className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2 rounded-2xl border border-line p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ))}
        </div>
      ) : (
        rows.map((r) => {
          const burmese = r.language === "my";
          return (
            <article
              key={r.bibleId}
              className={cn("rounded-2xl border p-4", r.bibleId === ctx.bible.id ? "border-maroon/35 bg-maroon-tint/40" : "border-line bg-surface")}
            >
              <p className="flex items-center gap-2 text-xs text-ink-3">
                <span className="rounded-full bg-sunk px-2 py-0.5 font-bold uppercase text-ink-2">{r.code}</span>
                {r.name}
              </p>
              {r.verses.length ? (
                <p className={cn("mt-2 leading-relaxed", burmese ? "font-myanmar" : "font-serif")} lang={burmese ? "my" : undefined}>
                  {r.verses.map((v) => (
                    <span key={v.n}>
                      {r.verses.length > 1 && <span className="verse-num" data-latin={burmese ? undefined : ""}>{num(v.n, burmese)} </span>}
                      {cleanVerseText(v.text, true)}{" "}
                    </span>
                  ))}
                </p>
              ) : (
                <p className="mt-2 text-sm text-ink-3">{t("notInThisBible")}</p>
              )}
            </article>
          );
        })
      )}

      {rows && ids.length >= 2 && (
        <section className="space-y-3">
          {!ctx.signedIn ? (
            <SignInPrompt reason={t("signInForAi")} returnTo={returnTo} />
          ) : !differ ? (
            <Button variant="outline" onClick={explainDifferences} className="w-full border-gold/40 text-gold">
              <Sparkles aria-hidden />
              {t("differButton")}
            </Button>
          ) : differ.loading ? (
            <AiLoading />
          ) : differ.error ? (
            <AiError error={differ.error} onRetry={explainDifferences} />
          ) : (
            <div className="space-y-3 rounded-2xl bg-gold-tint/50 p-4">
              <AiBadge>{t("differButton")}</AiBadge>
              {differ.content?.summary && <p className="leading-relaxed">{differ.content.summary}</p>}
              {differ.content?.differences?.length ? (
                differ.content.differences.map((d, i) => (
                  <div key={i} className="rounded-xl bg-surface p-3">
                    <ul className="space-y-1 text-sm">
                      {Object.entries(d.phrases).map(([code, phrase]) => (
                        <li key={code}>
                          <span className="mr-2 rounded-full bg-sunk px-1.5 py-0.5 text-[10px] font-bold uppercase">{code}</span>“{phrase}”
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-sm leading-relaxed text-ink-2">{d.note}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink-2">{t("differSame")}</p>
              )}
              {differ.remaining != null && <p className="text-xs text-ink-3">{t("remaining", { count: num(differ.remaining, ctx.locale === "my") })}</p>}
            </div>
          )}
          {!differ && ctx.signedIn && <p className="text-xs text-ink-3">{t("differHint")}</p>}
          <Disclaimer />
        </section>
      )}
    </div>
  );
}
