"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronLeft, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Bible, Book } from "@/lib/bible/data";
import { num, shortBurmeseBookName } from "@/lib/bible/reader-text";
import { ReferenceParser } from "@/lib/bible/reference";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Props = {
  bible: Bible;
  books: Book[];
  current: { bookNumber: number; chapter: number };
  label: string;
  onGo: (bookId: string, chapter: number, verse?: number) => void;
  /** Custom trigger (defaults to the reader's "Book 3 ▾" pill). */
  trigger?: React.ReactNode;
};

/**
 * Book → chapter picker with a typed jump ("ယော ၃:၁၆", "jn 3:16"),
 * like the app's passage picker.
 */
export function PassagePicker({ bible, books, current, label, onGo, trigger }: Props) {
  const t = useTranslations("Bible");
  const burmese = bible.language === "my";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [bookNumber, setBookNumber] = useState<number | null>(null);

  const nameOf = (b: Book) => {
    const n = (burmese && b.name_my ? b.name_my : b.name_en).replace(/​/g, "");
    return burmese ? shortBurmeseBookName(n) : n;
  };

  const parser = useMemo(
    () =>
      new ReferenceParser(
        books.map((b) => ({
          number: b.book_number,
          chapterCount: b.chapter_count,
          names: [b.name_en, b.name_my, b.abbreviation_en, b.abbreviation_my].filter((x): x is string => !!x),
        }))
      ),
    [books]
  );
  const byNumber = useMemo(() => new Map(books.map((b) => [b.book_number, b])), [books]);

  const parsed = query.trim() ? parser.parse(query) : null;
  const suggestions = query.trim() && !parsed ? parser.suggest(query.replace(/[\s\d၀-၉:.]+$/, "")) : [];

  function go(number: number, chapter: number, verse?: number) {
    const b = byNumber.get(number);
    if (!b) return;
    setOpen(false);
    setQuery("");
    setBookNumber(null);
    onGo(b.id, chapter, verse);
  }

  const chosen = bookNumber ? byNumber.get(bookNumber) : null;
  const ot = books.filter((b) => b.testament === "OT");
  const nt = books.filter((b) => b.testament === "NT");

  const bookGrid = (list: Book[]) => (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {list.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => setBookNumber(b.book_number)}
          className={cn(
            "rounded-xl border border-line px-3 py-2.5 text-left text-sm font-medium hover:bg-sunk",
            b.book_number === current.bookNumber && "border-maroon/40 bg-maroon-tint text-maroon"
          )}
        >
          {nameOf(b)}
        </button>
      ))}
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setBookNumber(null);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
        <button
          type="button"
          className="flex h-10 min-w-0 items-center gap-1.5 rounded-full bg-[var(--r-line)]/60 px-4 text-sm font-semibold text-[var(--r-ink)] hover:bg-[var(--r-line)]"
          aria-label={`${t("goToPassage")}: ${label}`}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="size-4 shrink-0" aria-hidden />
        </button>
        )}
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} className="flex max-h-[85vh] flex-col gap-4 overflow-hidden rounded-3xl p-5 sm:max-w-2xl">
        <DialogTitle className="font-serif text-xl">{t("goToPassage")}</DialogTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (parsed) go(parsed.book.number, parsed.chapter, parsed.verse);
          }}
        >
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("passageHint")}
            aria-label={t("passageHint")}
            lang={burmese ? "my" : undefined}
          />
        </form>

        {query.trim() ? (
          <div className="space-y-2 overflow-y-auto">
            {parsed ? (
              <button
                type="button"
                onClick={() => go(parsed.book.number, parsed.chapter, parsed.verse)}
                className="flex w-full items-center justify-between rounded-xl bg-maroon-tint px-4 py-3 text-left font-semibold text-maroon"
              >
                {t("goTo", {
                  ref: `${nameOf(byNumber.get(parsed.book.number)!)} ${num(parsed.chapter, burmese)}${parsed.verse ? `:${num(parsed.verse, burmese)}` : ""}`,
                })}
                <CornerDownLeft className="size-4" aria-hidden />
              </button>
            ) : suggestions.length ? (
              bookGrid(suggestions.map((s) => byNumber.get(s.number)!).filter(Boolean))
            ) : (
              <p className="px-1 text-sm text-ink-3">{t("noMatch")}</p>
            )}
          </div>
        ) : chosen ? (
          <div className="overflow-y-auto">
            <button type="button" onClick={() => setBookNumber(null)} className="mb-3 flex items-center gap-1 text-sm font-semibold text-maroon">
              <ChevronLeft className="size-4" aria-hidden />
              {nameOf(chosen)}
            </button>
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8">
              {Array.from({ length: chosen.chapter_count }, (_, i) => i + 1).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => go(chosen.book_number, ch)}
                  className={cn(
                    "h-11 rounded-xl border border-line text-sm font-semibold hover:bg-sunk",
                    chosen.book_number === current.bookNumber && ch === current.chapter && "border-maroon/40 bg-maroon-tint text-maroon"
                  )}
                >
                  {num(ch, burmese)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5 overflow-y-auto pr-1">
            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink-3">{t("oldTestament")}</h3>
              {bookGrid(ot)}
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink-3">{t("newTestament")}</h3>
              {bookGrid(nt)}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
