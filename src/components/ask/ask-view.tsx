"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUp, History, MessageSquarePlus, Sparkles, Trash2 } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Bible, Book } from "@/lib/bible/data";
import { cleanVerseText, num, shortBurmeseBookName } from "@/lib/bible/reader-text";
import { ReferenceParser } from "@/lib/bible/reference";
import { versesForRefs, type RefText } from "@/lib/bible/study-data";
import { askStream, citedOrder, topicSearch, type AskError } from "@/lib/ask/stream";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AnswerTurn, type CitedVerse, type Turn } from "./answer";

export type Conversation = { id: string; title: string | null; updated_at: string };

type Props = {
  bible: Bible;
  books: Book[];
  signedIn: boolean;
  remaining: number | null;
  conversations: Conversation[];
  locale: string;
  about?: string;
  conversationId?: string;
};

/**
 * Ask, like the app's: one box for a reference (opens the reader), a topic
 * (free search by meaning) or a question (AI answer citing real verses).
 * Everything goes through the shared ai-chat edge function.
 */
export function AskView(props: Props) {
  const t = useTranslations("Ask");
  const router = useRouter();
  const { bible, books, signedIn, locale } = props;
  const lang: "my" | "en" = locale === "en" ? "en" : "my";
  const burmese = bible.language === "my";
  const [input, setInput] = useState(props.about ? `${props.about} ` : "");
  const [conversationId, setConversationId] = useState<string | null>(props.conversationId ?? null);
  const [conversations, setConversations] = useState(props.conversations);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [remaining, setRemaining] = useState(props.remaining);
  const [topic, setTopic] = useState<{ query: string; loading: boolean; verses: RefText[]; error?: AskError } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(!!props.conversationId);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
  const bookByNumber = useMemo(() => new Map(books.map((b) => [b.book_number, b])), [books]);
  const hrefOf = (book: number, chapter: number, verse?: number) => {
    const b = bookByNumber.get(book);
    return b ? `/bible/${b.id}/${chapter}${verse ? `?v=${verse}` : ""}` : null;
  };
  const labelOf = (book: number, chapter: number, verse: number) => {
    const b = bookByNumber.get(book);
    if (!b) return `${book} ${chapter}:${verse}`;
    const name = (burmese && b.name_my ? shortBurmeseBookName(b.name_my) : b.name_en).replace(/​/g, "");
    return `${name} ${num(`${chapter}:${verse}`, burmese)}`;
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  // Open a saved conversation (?c=…): its questions, answers and cited verses.
  useEffect(() => {
    if (!props.conversationId) return;
    let live = true;
    (async () => {
      const { data } = await createClient()
        .from("chat_messages")
        .select("role, content, verse_references, created_at")
        .eq("conversation_id", props.conversationId!)
        .order("created_at");
      const rows = data ?? [];
      const loaded: Turn[] = [];
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].role !== "user") continue;
        const a = rows[i + 1]?.role === "assistant" ? rows[i + 1] : null;
        const refs = ((a?.verse_references ?? []) as { book: number; chapter: number; verse: number }[]) ?? [];
        const texts = refs.length ? await versesForRefs(bible.id, refs) : [];
        // Stored refs follow first-seen citation order in the text.
        const order = a ? citedOrder(a.content) : [];
        const verses: CitedVerse[] = refs.map((r, k) => {
          const found = texts.find((x) => x.book === r.book && x.chapter === r.chapter && x.verse === r.verse);
          return { n: order[k] ?? k + 1, label: found?.label ?? labelOf(r.book, r.chapter, r.verse), text: found?.text ?? "", href: hrefOf(r.book, r.chapter, r.verse) };
        });
        loaded.push({ key: `h${i}`, question: rows[i].content, answer: a?.content ?? "", verses, status: a ? "done" : "error", error: a ? undefined : "generation_failed" });
      }
      if (live) {
        setTurns(loaded);
        setLoadingHistory(false);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.conversationId, bible.id]);

  function ask(question: string) {
    const key = `t${Date.now()}`;
    setTopic(null);
    setInput("");
    setTurns((ts) => [...ts, { key, question, answer: "", verses: [], status: "streaming" }]);
    const update = (fn: (t: Turn) => Turn) => setTurns((ts) => ts.map((x) => (x.key === key ? fn(x) : x)));
    abort.current = new AbortController();
    void askStream(
      { message: question, translationId: bible.id, lang, conversationId },
      {
        onMeta: (m) => {
          if (m.remaining != null) setRemaining(m.remaining);
          if (!conversationId && m.conversationId) {
            setConversationId(m.conversationId);
            setConversations((cs) => [{ id: m.conversationId, title: question.slice(0, 60), updated_at: new Date().toISOString() }, ...cs]);
            window.history.replaceState(null, "", `?c=${m.conversationId}`);
          }
          update((x) => ({
            ...x,
            verses: m.verses.map((v) => ({ n: v.n, label: labelOf(v.book, v.chapter, v.verse), text: v.text, href: hrefOf(v.book, v.chapter, v.verse) })),
          }));
        },
        onDelta: (d) => update((x) => ({ ...x, answer: x.answer + d })),
        onDone: (d) => update((x) => ({ ...x, answer: d.text, status: "done", stopped: d.stopped })),
        onReference: (r) => router.push(hrefOf(r.book, r.chapter, r.verse) ?? "/bible"),
        onCrisis: (message) => update((x) => ({ ...x, status: "crisis", crisis: message })),
        onError: (code) => update((x) => ({ ...x, status: "error", error: code })),
      },
      abort.current.signal
    );
  }

  async function submit() {
    const q = input.trim();
    if (!q) return;
    // 1. A typed reference opens the reader (works signed out, no AI).
    const ref = parser.parse(q);
    // Needs a chapter number (ASCII or Myanmar digits) so "John" alone stays a topic.
    if (ref && /[0-9၀-၉]/.test(q)) {
      router.push(hrefOf(ref.book.number, ref.chapter, ref.verse) ?? "/bible");
      return;
    }
    if (!signedIn) {
      setTopic({ query: q, loading: false, verses: [], error: "unauthorized" });
      return;
    }
    // 2. In a conversation, a follow-up goes straight to the AI.
    if (turns.length) return ask(q);
    // 3. Otherwise: verses about it (free), with "Ask AI" underneath.
    setTopic({ query: q, loading: true, verses: [] });
    const r = await topicSearch(q, bible.id, lang);
    if ("event" in r && r.event === "reference" && r.data) return router.push(hrefOf(r.data.book, r.data.chapter, r.data.verse) ?? "/bible");
    if ("event" in r && r.event === "crisis") {
      setTopic(null);
      setInput("");
      setTurns([{ key: `c${Date.now()}`, question: q, answer: "", verses: [], status: "crisis", crisis: r.data?.message }]);
      return;
    }
    if ("error" in r && r.error) return setTopic({ query: q, loading: false, verses: [], error: r.error });
    const texts = await versesForRefs(bible.id, r.verses.slice(0, 12));
    setTopic({ query: q, loading: false, verses: texts });
  }

  function newChat() {
    abort.current?.abort();
    setTurns([]);
    setTopic(null);
    setConversationId(null);
    setInput("");
    window.history.replaceState(null, "", window.location.pathname);
    inputRef.current?.focus();
  }

  async function remove(id: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    await createClient().from("chat_conversations").delete().eq("id", id);
    setConversations((cs) => cs.filter((c) => c.id !== id));
    if (id === conversationId) newChat();
  }

  const historyList = (
    <nav aria-label={t("history")} className="space-y-1">
      <Button variant="outline" className="mb-3 w-full" onClick={() => (setHistoryOpen(false), newChat())}>
        <MessageSquarePlus aria-hidden />
        {t("newChat")}
      </Button>
      {conversations.length === 0 ? (
        <p className="px-2 text-sm text-ink-3">{t("noHistory")}</p>
      ) : (
        conversations.map((c) => (
          <div key={c.id} className={cn("group flex items-center rounded-xl", c.id === conversationId ? "bg-maroon-tint" : "hover:bg-sunk")}>
            <Link
              href={`/ask?c=${c.id}`}
              onClick={() => setHistoryOpen(false)}
              className={cn("min-w-0 flex-1 truncate px-3 py-2 text-sm", c.id === conversationId ? "font-semibold text-maroon" : "text-ink-2")}
            >
              {c.title || "…"}
            </Link>
            <button
              type="button"
              onClick={() => remove(c.id)}
              aria-label={`${t("deleteChat")}: ${c.title ?? ""}`}
              className="mr-1 grid size-8 place-items-center rounded-full text-ink-3 opacity-0 hover:bg-surface hover:text-maroon focus:opacity-100 group-hover:opacity-100"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        ))
      )}
    </nav>
  );

  const box = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex items-end gap-2 rounded-3xl border border-line bg-surface p-2 shadow-sm focus-within:border-maroon/50"
    >
      <textarea
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
        rows={1}
        maxLength={1000}
        autoFocus={!props.conversationId}
        placeholder={turns.length ? t("followUp") : t("placeholder")}
        aria-label={t("placeholder")}
        className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 outline-none [field-sizing:content]"
      />
      <Button type="submit" size="icon" aria-label={t("send")} disabled={!input.trim() || turns.some((x) => x.status === "streaming")}>
        <ArrowUp aria-hidden />
      </Button>
    </form>
  );

  return (
    <div className="mx-auto flex max-w-6xl gap-8 px-4 py-6 sm:px-6">
      {signedIn && <aside className="sticky top-24 hidden h-[calc(100vh-8rem)] w-64 shrink-0 overflow-y-auto lg:block">{historyList}</aside>}

      <div className="flex min-h-[calc(100vh-10rem)] min-w-0 flex-1 flex-col">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="font-serif text-3xl font-semibold">{t("title")}</h1>
          {signedIn && (
            <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setHistoryOpen(true)}>
              <History aria-hidden />
              {t("history")}
            </Button>
          )}
        </div>

        {loadingHistory ? (
          <div role="status" aria-busy="true" className="space-y-4">
            <Skeleton className="ml-auto h-11 w-1/2 rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        ) : turns.length ? (
          <div className="flex-1 space-y-8 pb-6">
            {turns.map((turn) => (
              <AnswerTurn key={turn.key} turn={turn} lang={lang} />
            ))}
            <div ref={endRef} />
          </div>
        ) : (
          <div className="flex-1 space-y-6">
            <p className="text-ink-2">{t("lead")}</p>
            {box}
            {!topic && (
              <div className="flex flex-wrap gap-2">
                {(["suggest1", "suggest2", "suggest3"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => (signedIn ? ask(t(k)) : setTopic({ query: t(k), loading: false, verses: [], error: "unauthorized" }))}
                    className="rounded-full border border-line bg-surface px-4 py-2 text-left text-sm text-ink-2 hover:border-maroon/40 hover:text-ink"
                  >
                    {t(k)}
                  </button>
                ))}
              </div>
            )}

            {topic && (
              <section className="space-y-4" aria-busy={topic.loading}>
                {topic.error === "unauthorized" ? (
                  <div className="rounded-2xl border border-line bg-sunk p-5 text-center">
                    <p className="text-ink-2">{t("signInToAsk")}</p>
                    <Link
                      href={`/login?next=${encodeURIComponent(`/${locale}/ask?about=${encodeURIComponent(topic.query)}`)}`}
                      className="mt-4 inline-flex h-10 items-center rounded-full bg-maroon-button px-5 text-sm font-semibold text-white"
                    >
                      {t("signIn")}
                    </Link>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => ask(topic.query)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-gold/40 bg-gold-tint/60 p-4 text-left hover:bg-gold-tint"
                    >
                      <Sparkles className="size-5 shrink-0 text-gold" aria-hidden />
                      <span className="flex-1">
                        <span className="block font-semibold text-ink">{t("askAi", { question: topic.query })}</span>
                        <span className="block text-xs text-ink-3">{t("usesOne")}</span>
                      </span>
                    </button>
                    <h2 className="text-sm font-semibold text-ink-3">{t("topicTitle")}</h2>
                    {topic.loading ? (
                      <div className="space-y-3">
                        {[0, 1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-16 w-full rounded-xl" />
                        ))}
                      </div>
                    ) : topic.error ? (
                      <p role="alert" className="rounded-2xl bg-maroon-tint p-4 text-sm text-maroon">
                        {t(`err.${topic.error}`)}
                      </p>
                    ) : topic.verses.length === 0 ? (
                      <p className="text-sm text-ink-3">{t("topicNone")}</p>
                    ) : (
                      <ul className="space-y-2" lang={burmese ? "my" : undefined}>
                        {topic.verses.map((v) => (
                          <li key={`${v.book}-${v.chapter}-${v.verse}`}>
                            <Link href={`/bible/${v.bookId}/${v.chapter}?v=${v.verse}`} className="block rounded-xl border border-line bg-surface p-3 hover:border-maroon/40">
                              <span className="text-sm font-semibold text-maroon">{v.label}</span>
                              <span className="mt-1 line-clamp-3 block text-sm leading-relaxed text-ink-2">{cleanVerseText(v.text, true)}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </section>
            )}
          </div>
        )}

        {turns.length > 0 && <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] bg-paper pb-2 pt-2 md:bottom-4">{box}</div>}
        {signedIn && remaining != null && (
          <p className="mt-3 text-center text-xs text-ink-3">
            {t("quotaLeft", { count: num(remaining, locale === "my") })} · {t("quotaFoot")}
          </p>
        )}
      </div>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent aria-describedby={undefined} side="left" className="w-80 bg-paper p-4">
          <SheetHeader className="px-0">
            <SheetTitle>{t("history")}</SheetTitle>
          </SheetHeader>
          {historyList}
        </SheetContent>
      </Sheet>
    </div>
  );
}
