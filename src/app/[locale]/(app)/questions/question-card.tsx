"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThumbsUp } from "lucide-react";
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

export function QuestionCard({ question, userId, hasVoted: initialHasVoted }: Props) {
  const locale = useLocale();
  const t = useTranslations("Questions");
  const [hasVoted, setHasVoted] = useState(initialHasVoted);
  const [voteCount, setVoteCount] = useState(question.upvote_count);
  const [isVoting, setIsVoting] = useState(false);

  const title = locale === "my" && question.title_my ? question.title_my : question.title_en;
  const body = locale === "my" && question.body_my ? question.body_my : question.body_en;
  const hasAnswer = !!(question.answer_en || question.answer_my);

  async function handleVote(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
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
    <Link
      href={`/questions/${question.slug}`}
      className="group flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-accent"
    >
      {/* Vote button */}
      <div className="flex flex-col items-center gap-1 pt-0.5">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${hasVoted ? "text-primary" : "text-muted-foreground"}`}
          onClick={handleVote}
          disabled={isVoting || !userId}
          title={!userId ? t("loginToVote") : hasVoted ? t("upvoted") : t("upvote")}
        >
          <ThumbsUp className={`h-4 w-4 ${hasVoted ? "fill-current" : ""}`} />
        </Button>
        <span className="text-xs font-medium text-muted-foreground">{voteCount}</span>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h3 className="font-semibold leading-tight group-hover:text-primary">
            {title}
          </h3>
          {hasAnswer && (
            <Badge variant="secondary" className="shrink-0">
              {t("answered")}
            </Badge>
          )}
        </div>
        {locale !== "my" && question.title_my && (
          <p className="mt-0.5 text-sm text-muted-foreground">{question.title_my}</p>
        )}
        {body && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {body}
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {t("askedOn")} {new Date(question.created_at).toLocaleDateString()}
        </p>
      </div>
    </Link>
  );
}
