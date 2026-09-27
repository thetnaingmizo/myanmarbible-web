"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Bookmark, ChevronDown, ChevronLeft, ChevronRight, Columns2, StickyNote } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Bible, Book, Verse } from "@/lib/bible/data";
import {
  cleanVerseText,
  foldJoinedVerses,
  groupParagraphs,
  num,
  shortBurmeseBookName,
  verseLabel,
} from "@/lib/bible/reader-text";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { PassagePicker } from "./passage-picker";
import { DisplaySettings } from "./display-settings";
import { SelectionBar } from "./selection-bar";
import { StudySheet } from "./study/study-sheet";
import type { Marker, StudyContext, StudyMode } from "./study/context";
import { formatVerseRanges } from "@/lib/bible/reader-text";
import { saveLastRead, textMetrics, useReaderSettings } from "./settings";

export type ReaderData = {
  bible: Bible;
  bibles: Bible[];
  book: Book;
  books: Book[];
  chapter: number;
  verses: Verse[];
  prev: { bookId: string; chapter: number } | null;
  next: { bookId: string; chapter: number } | null;
  /** The same book in each Bible (translation id → book id). */
  switchTo: Record<string, string>;
  parallel: { bible: Bible; book: Book | null; verses: Verse[] } | null;
  bookmarkedIds: string[];
  /** The reader's highlights and notes in this chapter (web_markers), by verse id. */
  markers: Record<string, Marker>;
  signedIn: boolean;
  targetVerse: number | null;
};

export function nameOf(book: Pick<Book, "name_en" | "name_my">, language: string) {
  return (language === "my" && book.name_my ? book.name_my : book.name_en).replace(/​/g, "");
}

/** Scripture face: Noto Sans Myanmar for Burmese, Literata for Latin-script Bibles (as in the app). */
function scriptFont(burmese: boolean) {
  return burmese ? "font-myanmar" : "font-serif";
}

function displayName(b: Bible) {
  return b.language === "my" && b.name_my ? b.name_my : b.name_en;
}

export function Reader({ data }: { data: ReaderData }) {
  const t = useTranslations("Bible");
  const ts = useTranslations("Study");
  const router = useRouter();
  const search = useSearchParams();
  const settings = useReaderSettings();
  const { bible, book, chapter, parallel } = data;
  const burmese = bible.language === "my";
  const name = nameOf(book, bible.language);
  const [selected, setSelected] = useState<number[]>([]);
  const [flash, setFlash] = useState<number | null>(data.targetVerse);
  const [study, setStudy] = useState<StudyMode | null>(null);
  const locale = useLocale();

  const href = useCallback(
    (bookId: string, ch: number, extra?: { p?: string | null }) => {
      const p = extra && "p" in extra ? extra.p : parallel?.bible.id;
      return `/bible/${bookId}/${ch}${p ? `?p=${p}` : ""}`;
    },
    [parallel]
  );

  // Joined verses (empty text) fold into the verse before: "35–36".
  const { shown, through } = useMemo(
    () => foldJoinedVerses(data.verses, (v) => v.text, (v) => v.verse_number),
    [data.verses]
  );
  const paragraphMode = settings.paragraphs && !parallel;
  const groups = useMemo(
    () => groupParagraphs(shown.map((v) => v.text), paragraphMode),
    [shown, paragraphMode]
  );
  const labelOf = (i: number) =>
    verseLabel(shown[i].verse_number, {
      nextNumber: shown[i + 1]?.verse_number,
      through: through.get(shown[i].verse_number),
      burmese,
    });

  const bookmarked = useMemo(() => new Set(data.bookmarkedIds), [data.bookmarkedIds]);
  const metrics = textMetrics(settings, burmese);

  // Remember where we are (the page remounts the reader per chapter, which
  // also resets the selection).
  useEffect(() => {
    saveLastRead({
      bookId: book.id,
      chapter,
      label: `${burmese ? shortBurmeseBookName(name) : name} ${num(chapter, burmese)}`,
      at: Date.now(),
    });
  }, [book.id, chapter, burmese, name]);

  // Jump to ?v= and flash it once.
  useEffect(() => {
    if (!data.targetVerse) return;
    document.getElementById(`v${data.targetVerse}`)?.scrollIntoView({ block: "center" });
    const id = setTimeout(() => setFlash(null), 2200);
    return () => clearTimeout(id);
  }, [data.targetVerse]);

  // ← / → change chapter (not while typing or with modifiers).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable], [role=dialog], [role=menu]")) return;
      // While a panel or menu is open, keys belong to it (Escape closes it, not the selection).
      if (document.querySelector("[role=dialog][data-state=open], [role=menu][data-state=open]")) return;
      if (e.key === "ArrowLeft" && data.prev) router.push(href(data.prev.bookId, data.prev.chapter));
      if (e.key === "ArrowRight" && data.next) router.push(href(data.next.bookId, data.next.chapter));
      if (e.key === "Escape") setSelected([]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data.prev, data.next, router, href]);

  const toggle = (n: number) =>
    setSelected((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n].sort((a, b) => a - b)));

  const verseSpan = (i: number, paragraph: boolean) => {
    const v = shown[i];
    const n = v.verse_number;
    const isSelected = selected.includes(n);
    const label = labelOf(i);
    const marker = data.markers[v.id];
    return (
      <span
        key={v.id}
        id={`v${n}`}
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        onClick={() => toggle(n)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle(n);
          }
        }}
        className={cn(
          "cursor-pointer rounded-[3px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-maroon/40",
          isSelected && "bg-maroon-tint underline decoration-maroon decoration-dotted underline-offset-[6px]",
          !isSelected && flash === n && "bg-gold-tint"
        )}
        style={!isSelected && flash !== n && marker?.highlight ? { background: `var(--hl-${marker.highlight})` } : undefined}
      >
        {settings.numbers && (
          <span className="verse-num" data-latin={burmese ? undefined : ""} aria-label={`${label} `}>
            {label}
            {" "}
          </span>
        )}
        {cleanVerseText(v.text, paragraph)}
        {marker?.note && (
          <button
            type="button"
            aria-label={`${ts("note")}: ${marker.note.slice(0, 40)}`}
            onClick={(e) => {
              e.stopPropagation();
              setSelected([n]);
              setStudy("note");
            }}
            className="ml-1 inline-grid size-[1.1em] place-items-center align-[-0.15em] text-gold"
          >
            <StickyNote className="size-[0.85em]" aria-hidden />
          </button>
        )}
        {bookmarked.has(v.id) && (
          <Bookmark className="ml-1 inline size-[0.8em] fill-current align-baseline text-maroon" aria-label={t("saved")} />
        )}{" "}
      </span>
    );
  };

  // Parallel: the second Bible's verses for each shown verse (covering joins).
  const parallelFor = useMemo(() => {
    if (!parallel) return null;
    const byNumber = new Map(parallel.verses.map((v) => [v.verse_number, v]));
    return (n: number) => {
      const end = through.get(n) ?? n;
      const out: Verse[] = [];
      for (let k = n; k <= end; k++) {
        const pv = byNumber.get(k);
        if (pv && pv.text.trim()) out.push(pv);
      }
      return out;
    };
  }, [parallel, through]);

  // The selection as the action bar and study panels see it.
  const picked = useMemo(() => shown.filter((v) => selected.includes(v.verse_number)), [shown, selected]);
  const numbers = useMemo(
    () =>
      picked.flatMap((v) => {
        const end = through.get(v.verse_number) ?? v.verse_number;
        return Array.from({ length: end - v.verse_number + 1 }, (_, k) => v.verse_number + k);
      }),
    [picked, through]
  );
  const shortName = burmese ? shortBurmeseBookName(name) : name;
  const reference = `${shortName} ${num(chapter, burmese)}:${formatVerseRanges(numbers, burmese)}`;
  const returnTo = `/bible/${book.id}/${chapter}${search.size ? `?${search.toString()}` : ""}`;
  const studyCtx: StudyContext | null = useMemo(
    () =>
      picked.length
        ? {
            bible,
            bibles: data.bibles,
            book,
            books: data.books,
            chapter,
            numbers,
            verses: picked.map((v) => ({ id: v.id, n: v.verse_number, text: v.text })),
            reference,
            signedIn: data.signedIn,
            locale,
            markers: data.markers,
          }
        : null,
    [picked, numbers, reference, bible, book, chapter, data.bibles, data.books, data.signedIn, data.markers, locale]
  );

  const pBurmese = parallel?.bible.language === "my";
  const pMetrics = textMetrics(settings, !!pBurmese);

  return (
    <div className="reader min-h-[calc(100vh-4rem)]" data-theme={settings.theme === "auto" ? undefined : settings.theme}>
      {/* Toolbar */}
      <div className="sticky top-16 z-40 border-b border-[var(--r-line)] bg-[var(--r-bg)]/92 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2 sm:px-6">
          <PassagePicker
            bible={bible}
            books={data.books}
            current={{ bookNumber: book.book_number, chapter }}
            onGo={(bookId, ch, verse) => router.push(`${href(bookId, ch)}${verse ? `${parallel ? "&" : "?"}v=${verse}` : ""}`)}
            label={`${burmese ? shortBurmeseBookName(name) : name} ${num(chapter, burmese)}`}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 border-[var(--r-line)] bg-transparent font-bold uppercase tracking-wide text-maroon">
                {bible.code}
                <ChevronDown className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuLabel>{t("chooseBible")}</DropdownMenuLabel>
              {data.bibles.map((b) => (
                <DropdownMenuItem
                  key={b.id}
                  disabled={!data.switchTo[b.id]}
                  onSelect={() => data.switchTo[b.id] && router.push(href(data.switchTo[b.id], chapter, { p: parallel?.bible.id === b.id ? null : parallel?.bible.id }))}
                  className={cn("flex items-start gap-3 py-2", b.id === bible.id && "bg-maroon-tint")}
                >
                  <span className="mt-0.5 min-w-14 rounded-full bg-sunk px-2 py-0.5 text-center text-xs font-bold uppercase">{b.code}</span>
                  <span className="text-sm font-medium">{displayName(b)}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="ml-auto flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={t("parallel")} className={cn(parallel && "bg-maroon-tint text-maroon")}>
                  <Columns2 className="size-5" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>{t("parallelWith")}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => router.push(href(book.id, chapter, { p: null }))} className={cn(!parallel && "bg-maroon-tint")}>
                  {t("parallelOff")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {data.bibles
                  .filter((b) => b.id !== bible.id)
                  .map((b) => (
                    <DropdownMenuItem
                      key={b.id}
                      onSelect={() => router.push(href(book.id, chapter, { p: b.id }))}
                      className={cn("flex items-start gap-3 py-2", parallel?.bible.id === b.id && "bg-maroon-tint")}
                    >
                      <span className="mt-0.5 min-w-14 rounded-full bg-sunk px-2 py-0.5 text-center text-xs font-bold uppercase">{b.code}</span>
                      <span className="text-sm font-medium">{displayName(b)}</span>
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DisplaySettings />
          </div>
        </div>
      </div>

      <article className={cn("mx-auto px-5 pb-40 pt-8 sm:px-6", parallel ? "max-w-5xl" : "max-w-[680px]")} lang={burmese ? "my" : bible.language === "lus" ? "lus" : "en"}>
        <header className="mb-6">
          <p className="text-sm text-[var(--r-muted)]">{name}</p>
          <h1 className="mt-1 font-serif text-4xl font-semibold text-maroon">
            {t("chapterHeading", { n: num(chapter, burmese) })}
          </h1>
          {parallel && (
            <p className="mt-2 text-sm text-[var(--r-muted)]">
              {displayName(bible)} · {displayName(parallel.bible)}
            </p>
          )}
        </header>

        {parallel && parallelFor ? (
          <div className="divide-y divide-[var(--r-line)]">
            {shown.map((v, i) => {
              const under = parallelFor(v.verse_number);
              return (
                <div key={v.id} className="grid gap-x-8 gap-y-1.5 py-3 md:grid-cols-2">
                  <p style={metrics} className={scriptFont(burmese)}>{verseSpan(i, false)}</p>
                  <p style={pMetrics} lang={pBurmese ? "my" : undefined} className={cn(scriptFont(!!pBurmese), "text-[var(--r-ink)]/80 md:text-[var(--r-ink)]")}>
                    <span className="mr-2 rounded-full bg-[var(--r-line)] px-1.5 py-0.5 align-middle font-sans text-[10px] font-bold uppercase md:hidden">
                      {parallel.bible.code}
                    </span>
                    {under.length ? (
                      under.map((pv) => (
                        <span key={pv.id}>
                          {settings.numbers && under.length > 1 && (
                            <span className="verse-num" data-latin={pBurmese ? undefined : ""}>
                              {num(pv.verse_number, !!pBurmese)}
                              {" "}
                            </span>
                          )}
                          {cleanVerseText(pv.text, false)}{" "}
                        </span>
                      ))
                    ) : (
                      <span className="text-[var(--r-muted)]">{t("notInThisBible")}</span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={metrics} className={scriptFont(burmese)}>
            {groups.map((g) =>
              paragraphMode ? (
                <p key={shown[g[0]].id} className="mb-[0.9em]">
                  {g.map((i) => verseSpan(i, true))}
                </p>
              ) : (
                <p key={shown[g[0]].id} className="mb-2">
                  {verseSpan(g[0], false)}
                </p>
              )
            )}
          </div>
        )}

        <nav className="mt-12 flex items-center justify-between gap-3" aria-label={t("chapters")}>
          {data.prev ? (
            <Button asChild variant="outline" className="border-[var(--r-line)] bg-transparent">
              <Link href={href(data.prev.bookId, data.prev.chapter)} rel="prev">
                <ChevronLeft className="size-4" aria-hidden />
                {t("previousChapter")}
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {data.next && (
            <Button asChild variant="outline" className="border-[var(--r-line)] bg-transparent">
              <Link href={href(data.next.bookId, data.next.chapter)} rel="next">
                {t("nextChapter")}
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </Button>
          )}
        </nav>
      </article>

      {/* Side arrows on wide screens, like the app's chapter arrows. */}
      {data.prev && (
        <Link
          href={href(data.prev.bookId, data.prev.chapter)}
          aria-label={t("previousChapter")}
          className="fixed left-4 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full border border-[var(--r-line)] bg-[var(--r-bg)] text-[var(--r-ink)] shadow-sm hover:text-maroon xl:grid"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
      )}
      {data.next && (
        <Link
          href={href(data.next.bookId, data.next.chapter)}
          aria-label={t("nextChapter")}
          className="fixed right-4 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full border border-[var(--r-line)] bg-[var(--r-bg)] text-[var(--r-ink)] shadow-sm hover:text-maroon xl:grid"
        >
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      )}

      <SelectionBar
        picked={picked}
        reference={reference}
        onClear={() => setSelected([])}
        onAction={setStudy}
        bookmarked={bookmarked}
        markers={data.markers}
        signedIn={data.signedIn}
        returnTo={returnTo}
      />
      <StudySheet mode={study} ctx={studyCtx} returnTo={`/${locale}${returnTo}`} onClose={() => setStudy(null)} />
    </div>
  );
}
