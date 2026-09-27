"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { cleanVerseText } from "@/lib/bible/reader-text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { StudyContext } from "./context";

/** Report a problem in the verse text → verse_feedback (the admin feedback queue). */
export function ReportPanel({ ctx }: { ctx: StudyContext }) {
  const t = useTranslations("Study");
  const verse = ctx.verses[0];
  const [comment, setComment] = useState("");
  const [suggested, setSuggested] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "failed">("idle");
  const [pending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return setState("failed");
      const { error } = await supabase.from("verse_feedback").insert({
        verse_id: verse.id,
        user_id: data.user.id,
        translation_code: ctx.bible.code,
        book_name: ctx.book.name_en,
        book_number: ctx.book.book_number,
        chapter_number: ctx.chapter,
        verse_number: verse.n,
        original_text: verse.text,
        suggested_text: suggested.trim() || null,
        comment: comment.trim().slice(0, 2000),
      });
      setState(error ? "failed" : "sent");
    });
  }

  if (state === "sent") {
    return (
      <p role="status" className="rounded-2xl bg-sunk p-5 text-center font-medium">
        {t("reportThanks")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="font-semibold text-ink">{ctx.reference}</p>
      <p className="text-sm text-ink-2">{t("reportSub")}</p>
      <blockquote className="rounded-2xl bg-sunk p-4 leading-relaxed" lang={ctx.bible.language === "my" ? "my" : undefined}>
        {cleanVerseText(verse.text, true)}
      </blockquote>
      <div className="space-y-2">
        <Label htmlFor="report-comment">{t("reportComment")}</Label>
        <Textarea id="report-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="report-suggested">{t("reportSuggested")}</Label>
        <Textarea id="report-suggested" value={suggested} onChange={(e) => setSuggested(e.target.value)} maxLength={5000} />
      </div>
      {state === "failed" && (
        <p role="alert" className="text-sm text-maroon">
          {t("reportFailed")}
        </p>
      )}
      <Button onClick={send} disabled={pending || !comment.trim()} aria-busy={pending} className="w-full">
        {t("reportSend")}
      </Button>
    </div>
  );
}
