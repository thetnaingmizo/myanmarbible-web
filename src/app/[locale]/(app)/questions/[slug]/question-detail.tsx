"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThumbsUp } from "lucide-react";
import { MarkdownContent } from "@/components/markdown-content";
import { createClient } from "@/lib/supabase/client";

type Question = {
  id: string;
  slug: string;
  title_en: string;
  title_my: string | null;
  body_en: string | null;
  body_my: string | null;
  answer_en: string | null;
  answer_my: string | null;
  upvote_count: number;
  status: string;
  created_at: string;
};

type Props = {
  question: Question;
  userId: string | null;
  hasVoted: boolean;
};

export function QuestionDetail({ question, userId, hasVoted: initialHasVoted }: Props) {
  const locale = useLocale();
  const t = useTranslations("Questions");
  const [hasVoted, setHasVoted] = useState(initialHasVoted);
  const [voteCount, setVoteCount] = useState(question.upvote_count);
  const [isVoting, setIsVoting] = useState(false);

  const title = locale === "my" && question.title_my ? question.title_my : question.title_en;
  const secondaryTitle = locale === "my" ? question.title_en : question.title_my;
  const body = locale === "my" && question.body_my ? question.body_my : question.body_en;
  const answer = locale === "my" && question.answer_my ? question.answer_my : question.answer_en;

  async function handleVote() {
    if (!userId || isVoting) return;

    setIsVoting(true);
    try {
      const supabase = createClient();
      if (hasVoted) {
        await supabase
          .from("question_votes")
          .delete()
          .eq("user_id", userId)
          .eq("question_id", question.id);
        setHasVoted(false);
        setVoteCount((c) => c - 1);
      } else {
        await supabase
          .from("question_votes")
          .insert({ user_id: userId, question_id: question.id });
        setHasVoted(true);
        setVoteCount((c) => c + 1);
      }
    } catch {
      // Silently fail
    } finally {
      setIsVoting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back link */}
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/questions">&larr; {t("backToQuestions")}</Link>
      </Button>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        {secondaryTitle && (
          <p className="mt-1 text-muted-foreground">{secondaryTitle}</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {t("askedOn")} {new Date(question.created_at).toLocaleDateString()}
        </p>
      </div>

      {/* Body */}
      {body && (
        <section className="mb-6">
          <p className="leading-relaxed text-muted-foreground">{body}</p>
        </section>
      )}

      {/* Upvote */}
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant={hasVoted ? "default" : "outline"}
          size="sm"
          onClick={handleVote}
          disabled={isVoting || !userId}
          className="gap-1.5"
        >
          <ThumbsUp className={`h-4 w-4 ${hasVoted ? "fill-current" : ""}`} />
          {hasVoted ? t("upvoted") : t("upvote")}
        </Button>
        <span className="text-sm text-muted-foreground">
          {t("upvotes", { count: voteCount })}
        </span>
        {!userId && (
          <span className="text-xs text-muted-foreground">
            ({t("loginToVote")})
          </span>
        )}
      </div>

      {/* Answer */}
      {answer ? (
        <section className="rounded-lg border bg-muted/30 p-6">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-lg font-semibold">{t("answer")}</h2>
            <Badge variant="secondary">{t("answered")}</Badge>
          </div>
          <div className="leading-relaxed text-muted-foreground">
            <MarkdownContent content={answer} />
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-dashed p-6 text-center">
          <Badge variant="outline">{t("pendingApproval")}</Badge>
          <p className="mt-2 text-sm text-muted-foreground">
            This question is awaiting an answer.
          </p>
        </section>
      )}
    </div>
  );
}
