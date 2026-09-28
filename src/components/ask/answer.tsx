"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { BookOpen, Copy, Flag, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { cleanVerseText, num } from "@/lib/bible/reader-text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { AskError } from "@/lib/ask/stream";

export type CitedVerse = { n: number; label: string; text: string; href: string | null };

export type Turn = {
  key: string;
  question: string;
  answer: string;
  verses: CitedVerse[];
  status: "streaming" | "done" | "error" | "crisis";
  error?: AskError;
  crisis?: string;
  stopped?: boolean;
};

const REASONS = ["wrong_citation", "unbiblical", "church_differs", "unnatural_burmese", "not_useful", "other"] as const;

/** One question + AI answer; "[V2]" citations link to the verse list under the answer. */
export function AnswerTurn({ turn, lang }: { turn: Turn; lang: string }) {
  const t = useTranslations("Ask");
  const [copied, setCopied] = useState(false);
  const [reporting, setReporting] = useState(false);
  const byN = new Map(turn.verses.map((v) => [v.n, v]));
  const cited = turn.verses.filter((v) => turn.answer.includes(`[V${v.n}]`));

  const renderText = (text: string) =>
    text.split(/\n{2,}/).map((para, i) => (
      <p key={i} className="leading-relaxed">
        {para.split(/(\[V\d{1,2}\])/).map((part, j) => {
          const m = /^\[V(\d{1,2})\]$/.exec(part);
          if (!m) return part;
          const v = byN.get(Number(m[1]));
          return v ? (
            <a
              key={j}
              href={`#cite-${turn.key}-${v.n}`}
              className="mx-0.5 rounded bg-surface px-1 align-super text-[0.7em] font-semibold text-maroon hover:underline"
            >
              {v.label}
            </a>
          ) : null;
        })}
      </p>
    ));

  async function copy() {
    const plain = turn.answer.replace(/\[V(\d{1,2})\]/g, (_, n) => (byN.get(Number(n)) ? ` (${byN.get(Number(n))!.label})` : ""));
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="space-y-3">
      <div className="ml-auto max-w-[85%] w-fit rounded-2xl rounded-br-md bg-maroon-button px-4 py-2.5 text-white">{turn.question}</div>

      {turn.status === "crisis" ? (
        <div role="alert" className="space-y-2 rounded-2xl border border-maroon/30 bg-maroon-tint p-5">
          <p className="font-serif text-lg font-semibold text-maroon">{t("crisisTitle")}</p>
          <p className="leading-relaxed">{turn.crisis}</p>
          <p className="text-sm text-ink-2">{t("crisisTrusted")}</p>
          <p className="text-xs text-ink-3">{t("crisisPrivate")}</p>
        </div>
      ) : turn.status === "error" ? (
        <p role="alert" className="rounded-2xl bg-maroon-tint p-4 text-sm text-maroon">
          {t(`err.${turn.error ?? "server_error"}`)}
        </p>
      ) : (
        <div className="space-y-3 rounded-2xl bg-gold-tint/50 p-4" lang={lang} aria-live="polite" aria-busy={turn.status === "streaming"}>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gold">
            <Sparkles className="size-4" aria-hidden />
            {turn.verses.length ? t("basedOn", { count: num(turn.verses.length, lang === "my") }) : t("thinking")}
          </p>
          {turn.answer ? renderText(turn.answer) : <p className="animate-pulse text-ink-3">{t("thinking")}</p>}
          {turn.stopped && <p className="text-xs text-ink-3">{t("stopped")}</p>}

          {turn.status === "done" && cited.length > 0 && (
            <details open className="rounded-xl bg-surface/80 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-ink-2">{t("versesCited", { count: num(cited.length, lang === "my") })}</summary>
              <ol className="mt-2 space-y-2">
                {cited.map((v) => (
                  <li key={v.n} id={`cite-${turn.key}-${v.n}`} className="scroll-mt-40 rounded-lg p-2 target:bg-gold-tint">
                    <p className="flex items-center justify-between gap-2 text-sm font-semibold text-maroon">
                      {v.label}
                      {v.href && (
                        <Link href={v.href} className="inline-flex items-center gap-1 text-xs font-medium text-ink-3 hover:text-maroon">
                          <BookOpen className="size-3.5" aria-hidden />
                        </Link>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-ink-2">{cleanVerseText(v.text, true)}</p>
                  </li>
                ))}
              </ol>
            </details>
          )}

          {turn.status === "done" && (
            <div className="flex items-center gap-1 pt-1">
              <Button variant="ghost" size="sm" onClick={copy}>
                <Copy aria-hidden />
                {copied ? t("copied") : t("copy")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setReporting(true)}>
                <Flag aria-hidden />
                {t("report")}
              </Button>
            </div>
          )}
          <p className="text-xs text-ink-3">{t("disclaimer")}</p>
        </div>
      )}
      <ReportDialog open={reporting} onClose={() => setReporting(false)} turn={turn} />
    </div>
  );
}

function ReportDialog({ open, onClose, turn }: { open: boolean; onClose: () => void; turn: Turn }) {
  const t = useTranslations("Ask");
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "failed">("idle");
  const [pending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user || !reason) return setState("failed");
      const { error } = await supabase.from("ai_answer_reports").insert({
        user_id: data.user.id,
        question: turn.question,
        answer: turn.answer,
        reason,
        comment: comment.trim() || null,
        cited: turn.verses.map((v) => ({ n: v.n, label: v.label })),
        model: "gemini-3.1-flash-lite",
      });
      setState(error ? "failed" : "sent");
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="rounded-3xl">
        <DialogTitle className="font-serif text-xl">{t("reportTitle")}</DialogTitle>
        {state === "sent" ? (
          <p role="status" className="rounded-2xl bg-sunk p-4 text-center">
            {t("reportThanks")}
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-ink-2">{t("reportSub")}</p>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={reason === r}
                  onClick={() => setReason(r)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm",
                    reason === r ? "border-maroon bg-maroon-tint text-maroon" : "border-line bg-surface text-ink-2"
                  )}
                >
                  {t(`reason.${r}`)}
                </button>
              ))}
            </div>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("reportComment")} maxLength={1000} />
            {state === "failed" && (
              <p role="alert" className="text-sm text-maroon">
                {t("reportFailed")}
              </p>
            )}
            <Button onClick={send} disabled={!reason || pending} aria-busy={pending} className="w-full">
              {t("reportSend")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
