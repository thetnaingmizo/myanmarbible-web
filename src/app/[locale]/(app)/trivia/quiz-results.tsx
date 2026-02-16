"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useTriviaStore } from "@/lib/trivia/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react";

type Props = {
  onPlayAgain: () => void;
};

export function QuizResults({ onPlayAgain }: Props) {
  const t = useTranslations("Trivia");
  const { score, results, questions, resetQuiz } = useTriviaStore();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (score === null) return null;

  const total = results.length;
  const percentage = Math.round((score / total) * 100);

  let message: string;
  let colorClass: string;
  if (percentage === 100) {
    message = t("perfect");
    colorClass = "text-green-600 dark:text-green-400";
  } else if (percentage >= 70) {
    message = t("great");
    colorClass = "text-blue-600 dark:text-blue-400";
  } else if (percentage >= 50) {
    message = t("good");
    colorClass = "text-yellow-600 dark:text-yellow-400";
  } else {
    message = t("keepTrying");
    colorClass = "text-red-600 dark:text-red-400";
  }

  const handlePlayAgain = () => {
    resetQuiz();
    onPlayAgain();
  };

  return (
    <div className="space-y-4">
      {/* Score card */}
      <Card>
        <CardContent className="py-8 text-center">
          <h2 className="text-xl font-bold">{t("resultsTitle")}</h2>
          <div className={`mt-4 text-5xl font-bold ${colorClass}`}>
            {score}/{total}
          </div>
          <p className={`mt-2 text-lg font-medium ${colorClass}`}>{message}</p>
          <div className="mt-1 text-sm text-muted-foreground">
            {percentage}%
          </div>
        </CardContent>
      </Card>

      {/* Per-question review */}
      <div className="space-y-2">
        {results.map((result, i) => {
          const question = questions[i];
          const isExpanded = expandedIndex === i;

          return (
            <Card key={i}>
              <button
                onClick={() =>
                  setExpandedIndex(isExpanded ? null : i)
                }
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  {result.correct ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
                  )}
                  <span className="text-sm font-medium">
                    {t("question")} {i + 1}
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {isExpanded && question && (
                <CardContent className="space-y-3 border-t pt-4">
                  <p className="text-sm font-medium">{question.question}</p>

                  <div className="space-y-1">
                    {question.options.map((option, optIdx) => {
                      const isCorrect = optIdx === result.correctAnswer;
                      const isSelected = optIdx === result.selectedAnswer;

                      let optClass = "border-border text-muted-foreground";
                      if (isCorrect) {
                        optClass =
                          "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400";
                      } else if (isSelected && !isCorrect) {
                        optClass =
                          "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400 line-through";
                      }

                      return (
                        <div
                          key={optIdx}
                          className={`rounded-md border p-2 text-sm ${optClass}`}
                        >
                          <span className="mr-2 font-medium">
                            {String.fromCharCode(65 + optIdx)}.
                          </span>
                          {option}
                          {isCorrect && (
                            <span className="ml-2 text-xs font-medium">
                              ({t("correctAnswer")})
                            </span>
                          )}
                          {isSelected && !isCorrect && (
                            <span className="ml-2 text-xs font-medium">
                              ({t("yourAnswer")})
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-md bg-muted p-3 text-sm">
                    <p className="font-medium">{t("explanation")}</p>
                    <p className="mt-1 text-muted-foreground">
                      {result.explanation}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("verseRef")}: {result.verseReference}
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Play again */}
      <Button onClick={handlePlayAgain} className="w-full" size="lg">
        {t("playAgain")}
      </Button>
    </div>
  );
}
