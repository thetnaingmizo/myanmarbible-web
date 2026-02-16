"use client";

import { useTranslations } from "next-intl";
import { useTriviaStore } from "@/lib/trivia/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Difficulty } from "@/lib/trivia/types";

export function RecentScores() {
  const t = useTranslations("Trivia");
  const { recentScores } = useTriviaStore();

  if (recentScores.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">{t("recentScores")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {recentScores.map((score) => (
            <div
              key={score.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold">
                  {score.score}/{score.totalQuestions}
                </span>
                <DifficultyBadge difficulty={score.difficulty} />
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(score.completedAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const t = useTranslations("Trivia");

  const variants: Record<Difficulty, string> = {
    easy: "bg-green-500/10 text-green-700 dark:text-green-400",
    medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    hard: "bg-red-500/10 text-red-700 dark:text-red-400",
  };

  return (
    <Badge variant="outline" className={variants[difficulty]}>
      {t(difficulty)}
    </Badge>
  );
}
