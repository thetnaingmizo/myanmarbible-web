"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useTriviaStore } from "@/lib/trivia/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Difficulty } from "@/lib/trivia/types";

const DIFFICULTY_FILTER: (Difficulty | "all")[] = [
  "all",
  "easy",
  "medium",
  "hard",
];

export function Leaderboard() {
  const t = useTranslations("Trivia");
  const { leaderboard } = useTriviaStore();
  const [filter, setFilter] = useState<Difficulty | "all">("all");

  const filtered =
    filter === "all"
      ? leaderboard
      : leaderboard.filter((e) => e.difficulty === filter);

  // Re-rank after filtering
  const ranked = filtered.map((e, i) => ({ ...e, rank: i + 1 }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("leaderboard")}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Difficulty filter */}
        <div className="mb-4 flex gap-2">
          {DIFFICULTY_FILTER.map((d) => (
            <button
              key={d}
              onClick={() => setFilter(d)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filter === d
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {d === "all" ? t("categoryAll") : t(d)}
            </button>
          ))}
        </div>

        {ranked.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("noLeaderboard")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">{t("rank")}</th>
                  <th className="pb-2 pr-4">{t("player")}</th>
                  <th className="pb-2 pr-4">{t("scoreCol")}</th>
                  <th className="pb-2 pr-4">{t("difficultyCol")}</th>
                  <th className="pb-2">{t("date")}</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((entry) => (
                  <tr key={`${entry.rank}-${entry.completedAt}`} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{entry.rank}</td>
                    <td className="py-2 pr-4">{entry.displayName}</td>
                    <td className="py-2 pr-4">
                      {entry.score}/{entry.totalQuestions}
                    </td>
                    <td className="py-2 pr-4">
                      <DifficultyBadge difficulty={entry.difficulty} />
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {new Date(entry.completedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
