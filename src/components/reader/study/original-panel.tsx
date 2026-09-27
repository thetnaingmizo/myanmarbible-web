"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { num } from "@/lib/bible/reader-text";
import { originalWords, wordOccurrences, type LexiconEntry, type OriginalWord } from "@/lib/bible/study-data";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { studyCall, type StudyError } from "../ai";
import { AiBadge, AiError, AiLoading, SignInPrompt } from "./ai-bits";
import type { StudyContext } from "./context";

type Renderings = { content: { phrases: Record<string, string> }; glossMy?: string | null; glossMyStatus?: string | null };

/**
 * Original words (STEPBible TAGNT/TAHOT, CC BY 4.0): word by word, then one
 * word's lexicon entry, how often it occurs, and (AI) how each Bible renders it.
 */
export function OriginalPanel({ ctx, returnTo }: { ctx: StudyContext; returnTo: string }) {
  const t = useTranslations("Study");
  const verse = ctx.numbers[0];
  const hebrew = ctx.book.book_number <= 39;
  const [data, setData] = useState<{ words: OriginalWord[]; lexicon: LexiconEntry[] } | null>(null);
  const [picked, setPicked] = useState<OriginalWord | null>(null);
  const [occurs, setOccurs] = useState<number | null>(null);
  const [render, setRender] = useState<{ loading: boolean; data?: Renderings; error?: StudyError } | null>(null);

  useEffect(() => {
    let live = true;
    originalWords(ctx.book.book_number, ctx.chapter, verse).then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, [ctx.book.book_number, ctx.chapter, verse]);

  function pick(w: OriginalWord) {
    setPicked(w);
    setOccurs(null);
    setRender(null);
    if (w.strong) wordOccurrences(w.strong).then(setOccurs);
  }

  const entry = picked?.strong ? data?.lexicon.find((l) => l.strong === picked.strong) : undefined;

  async function loadRenderings() {
    if (!picked?.strong) return;
    setRender({ loading: true });
    const others = ctx.bibles.filter((b) => b.id !== ctx.bible.id).map((b) => b.id);
    const r = await studyCall<Renderings>({
      mode: "word",
      strong: picked.strong,
      position: picked.position,
      book: ctx.book.book_number,
      chapter: ctx.chapter,
      verse,
      translationIds: [ctx.bible.id, ...others].slice(0, 3),
    });
    setRender(r.ok ? { loading: false, data: r.data } : { loading: false, error: r.error });
  }

  const glossMy = render?.data?.glossMy ?? entry?.gloss_my;
  const glossStatus = render?.data?.glossMyStatus ?? entry?.gloss_my_status;
  const codeOf = new Map(ctx.bibles.map((b) => [b.id, b.code]));

  return (
    <div className="space-y-4">
      <p className="font-semibold text-ink">
        {ctx.reference.replace(/[:：][^:：]*$/, "")}:{num(verse, ctx.bible.language === "my")}
      </p>

      {!data ? (
        <div role="status" aria-busy="true" className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-20 rounded-xl" />
          ))}
        </div>
      ) : data.words.length === 0 ? (
        <p className="text-sm text-ink-3">{t("noWords")}</p>
      ) : !picked ? (
        <>
          <p className="text-sm text-ink-3">{t("tapWord")}</p>
          <div className="flex flex-wrap gap-2" dir={hebrew ? "rtl" : "ltr"}>
            {data.words.map((w) => (
              <button
                key={w.position}
                type="button"
                onClick={() => pick(w)}
                disabled={!w.strong}
                className="rounded-xl border border-line bg-surface px-3 py-2 text-center hover:border-maroon/40 hover:bg-sunk disabled:opacity-60"
              >
                <span className="block font-serif text-lg" lang={hebrew ? "he" : "grc"}>
                  {w.word}
                </span>
                <span className="block text-xs text-ink-3" dir="ltr">
                  {w.gloss}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <button type="button" onClick={() => setPicked(null)} className="flex items-center gap-1 text-sm font-semibold text-maroon">
            <ChevronLeft className="size-4" aria-hidden />
            {t("back")}
          </button>
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="font-serif text-3xl" lang={hebrew ? "he" : "grc"} dir={hebrew ? "rtl" : "ltr"}>
              {entry?.lemma ?? picked.word}
            </p>
            <p className="mt-1 text-sm text-ink-3">
              {[entry?.translit ?? picked.translit, picked.strong, entry?.pos].filter(Boolean).join(" · ")}
            </p>
            <h3 className="mt-4 text-sm font-semibold text-ink-2">{t("meaningLabel")}</h3>
            <p className="mt-1">{entry?.gloss ?? picked.gloss}</p>
            {entry?.definition && (
              // STEPBible marks senses with "__1." etc.; show them as lines.
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-2">
                {entry.definition.replace(/\s*;?\s*__/g, "\n").replace(/\s+;\s+/g, "; ").trim()}
              </p>
            )}
            {glossMy && (
              <>
                <h3 className="mt-4 flex items-center gap-2 text-sm font-semibold text-ink-2">
                  {t("inMyanmar")}
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px]", glossStatus === "reviewed" ? "bg-sunk text-success" : "bg-gold-tint text-gold")}>
                    {glossStatus === "reviewed" ? t("reviewed") : t("aiDraft")}
                  </span>
                </h3>
                <p className="mt-1" lang="my">
                  {glossMy}
                </p>
              </>
            )}
            {occurs != null && <p className="mt-4 text-sm text-ink-3">{t("occurs", { count: num(occurs, ctx.locale === "my") })}</p>}
          </div>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-ink-2">{t("howBibles")}</h3>
            {!ctx.signedIn ? (
              <SignInPrompt reason={t("signInForAi")} returnTo={returnTo} />
            ) : !render ? (
              <Button variant="outline" onClick={loadRenderings} className="w-full border-gold/40 text-gold">
                <Sparkles aria-hidden />
                {t("showRenderings")}
              </Button>
            ) : render.loading ? (
              <AiLoading />
            ) : render.error ? (
              <AiError error={render.error} onRetry={loadRenderings} />
            ) : (
              <div className="space-y-2 rounded-2xl bg-gold-tint/50 p-4">
                <AiBadge />
                <ul className="space-y-1.5">
                  {Object.entries(render.data!.content.phrases).map(([code, phrase]) => (
                    <li key={code} className="text-sm">
                      <span className="mr-2 rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-bold uppercase">{codeOf.get(code) ?? code}</span>
                      {phrase || "—"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      )}

      <p className="text-xs text-ink-3">
        <a href="https://www.stepbible.org" target="_blank" rel="noopener noreferrer" className="underline">
          {t("stepCredit")}
        </a>
      </p>
    </div>
  );
}
