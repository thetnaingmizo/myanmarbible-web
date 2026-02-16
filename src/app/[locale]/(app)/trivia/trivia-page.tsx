"use client";

import { useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useTriviaStore } from "@/lib/trivia/store";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuizSetup } from "./quiz-setup";
import { QuizQuestion } from "./quiz-question";
import { QuizProgress } from "./quiz-progress";
import { QuizResults } from "./quiz-results";
import { Leaderboard } from "./leaderboard";
import { RecentScores } from "./recent-scores";
import { Loader2 } from "lucide-react";
import type {
  QuizLanguage,
  Difficulty,
  LeaderboardEntry,
  RecentScore,
} from "@/lib/trivia/types";

type Props = {
  userId: string;
  defaultLanguage: QuizLanguage;
};

export function TriviaPage({ userId, defaultLanguage }: Props) {
  const t = useTranslations("Trivia");

  const {
    phase,
    language,
    setLanguage,
    startLoading,
    setQuiz,
    setResults,
    setError,
    setLeaderboard,
    setRecentScores,
    setIsLoading,
    isLoading,
  } = useTriviaStore();

  // Initialize language from profile
  useEffect(() => {
    setLanguage(defaultLanguage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load leaderboard + recent scores on mount
  const loadScores = useCallback(async () => {
    const supabase = createClient();

    // Recent scores for this user
    const { data: recent } = await supabase
      .from("trivia_scores")
      .select("id, score, total_questions, difficulty, category, completed_at")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(5);

    if (recent) {
      setRecentScores(
        recent.map((r) => ({
          id: r.id,
          score: r.score,
          totalQuestions: r.total_questions,
          difficulty: r.difficulty as Difficulty,
          category: r.category,
          completedAt: r.completed_at,
        }))
      );
    }

    // Leaderboard: top 20 scores with display names
    const { data: topScores } = await supabase
      .from("trivia_scores")
      .select("score, total_questions, difficulty, completed_at, user_id")
      .order("score", { ascending: false })
      .order("completed_at", { ascending: true })
      .limit(20);

    if (topScores && topScores.length > 0) {
      // Fetch display names for those users
      const userIds = [...new Set(topScores.map((s) => s.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);

      const nameMap = new Map(
        profiles?.map((p) => [p.id, p.display_name]) ?? []
      );

      setLeaderboard(
        topScores.map((s, i) => ({
          rank: i + 1,
          displayName: nameMap.get(s.user_id) || "Anonymous",
          score: s.score,
          totalQuestions: s.total_questions,
          difficulty: s.difficulty as Difficulty,
          completedAt: s.completed_at,
        }))
      );
    }
  }, [userId, setRecentScores, setLeaderboard]);

  useEffect(() => {
    loadScores();
  }, [loadScores]);

  // Start quiz: call generate API
  const handleStartQuiz = useCallback(async () => {
    const state = useTriviaStore.getState();
    startLoading();

    try {
      const res = await fetch("/api/v1/trivia/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          difficulty: state.difficulty,
          category: state.category,
          language: state.language,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const code = json?.error?.code;
        if (code === "rate_limited") {
          setError(t("rateLimited"));
        } else {
          setError(json?.error?.message || t("errorMessage"));
        }
        return;
      }

      setQuiz(json.data.quizId, json.data.questions);
    } catch {
      setError(t("errorMessage"));
    }
  }, [startLoading, setQuiz, setError, t]);

  // Submit quiz: call submit API
  const handleSubmitQuiz = useCallback(async () => {
    const state = useTriviaStore.getState();
    setIsLoading(true);

    try {
      const res = await fetch("/api/v1/trivia/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: state.quizId,
          answers: state.selectedAnswers,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const code = json?.error?.code;
        if (code === "quiz_expired") {
          setError(t("quizExpired"));
        } else {
          setError(json?.error?.message || t("errorMessage"));
        }
        return;
      }

      setResults(json.data.score, json.data.results);
      // Reload scores
      loadScores();
    } catch {
      setError(t("errorMessage"));
    }
  }, [setIsLoading, setResults, setError, loadScores, t]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold">{t("title")}</h1>

      {phase === "setup" && (
        <Tabs defaultValue="play">
          <TabsList className="mb-4">
            <TabsTrigger value="play">{t("play")}</TabsTrigger>
            <TabsTrigger value="leaderboard">{t("leaderboard")}</TabsTrigger>
          </TabsList>
          <TabsContent value="play">
            <QuizSetup
              onStart={handleStartQuiz}
              language={language}
              onLanguageChange={setLanguage}
            />
            <RecentScores />
          </TabsContent>
          <TabsContent value="leaderboard">
            <Leaderboard />
          </TabsContent>
        </Tabs>
      )}

      {phase === "loading" && (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t("generating")}</p>
        </div>
      )}

      {phase === "playing" && (
        <div className="space-y-4">
          <QuizProgress />
          <QuizQuestion />
          <QuizActions
            onSubmit={handleSubmitQuiz}
            isLoading={isLoading}
          />
        </div>
      )}

      {phase === "results" && <QuizResults onPlayAgain={loadScores} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quiz navigation + submit actions
// ---------------------------------------------------------------------------

function QuizActions({
  onSubmit,
  isLoading,
}: {
  onSubmit: () => void;
  isLoading: boolean;
}) {
  const t = useTranslations("Trivia");
  const {
    currentQuestionIndex,
    questions,
    selectedAnswers,
    nextQuestion,
    previousQuestion,
  } = useTriviaStore();

  const isFirst = currentQuestionIndex === 0;
  const isLast = currentQuestionIndex === questions.length - 1;

  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmitClick = () => {
    const unanswered = selectedAnswers.filter((a) => a === null).length;
    if (unanswered > 0) {
      setShowConfirm(true);
    } else {
      setShowConfirm(true);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={previousQuestion}
          disabled={isFirst}
          className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          {t("previous")}
        </button>
        <div className="flex gap-2">
          {!isLast && (
            <button
              onClick={nextQuestion}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t("next")}
            </button>
          )}
          {isLast && (
            <button
              onClick={handleSubmitClick}
              disabled={isLoading}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {t("submit")}
            </button>
          )}
        </div>
      </div>

      {showConfirm && (
        <SubmitConfirmDialog
          onConfirm={() => {
            setShowConfirm(false);
            onSubmit();
          }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}

import { useState } from "react";

function SubmitConfirmDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Trivia");
  const { selectedAnswers } = useTriviaStore();
  const unanswered = selectedAnswers.filter((a) => a === null).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-lg bg-background p-6 shadow-lg">
        <p className="mb-4 text-sm">
          {unanswered > 0
            ? t("submitConfirm", { count: unanswered })
            : t("submitConfirmAll")}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {t("cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
