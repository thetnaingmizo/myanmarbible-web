"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QuestionCard } from "./question-card";
import { AskQuestionForm } from "./ask-question-form";

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
  questions: Question[];
  userId: string | null;
  votedQuestionIds: string[];
};

export function QuestionsList({ questions, userId, votedQuestionIds }: Props) {
  const t = useTranslations("Questions");
  const [search, setSearch] = useState("");
  const [showAskForm, setShowAskForm] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return questions;
    const q = search.toLowerCase();
    return questions.filter(
      (item) =>
        item.title_en.toLowerCase().includes(q) ||
        (item.title_my && item.title_my.includes(search.trim())) ||
        (item.body_en && item.body_en.toLowerCase().includes(q)) ||
        (item.body_my && item.body_my.includes(search.trim()))
    );
  }, [questions, search]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("description")}</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Input
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-80"
        />
        <Button
          variant="outline"
          onClick={() => setShowAskForm(!showAskForm)}
        >
          {t("askQuestion")}
        </Button>
      </div>

      {showAskForm && (
        <div className="mb-6">
          <AskQuestionForm
            userId={userId}
            onClose={() => setShowAskForm(false)}
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          {t("noQuestionsFound")}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              userId={userId}
              hasVoted={votedQuestionIds.includes(question.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
