"use client";

import { useTranslations } from "next-intl";
import { useTriviaStore } from "@/lib/trivia/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Difficulty, Category, QuizLanguage } from "@/lib/trivia/types";

const DIFFICULTY_OPTIONS: { value: Difficulty; colorClass: string }[] = [
  { value: "easy", colorClass: "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400" },
  { value: "medium", colorClass: "border-yellow-500 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" },
  { value: "hard", colorClass: "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400" },
];

const CATEGORY_OPTIONS: { value: Category; labelKey: string }[] = [
  { value: "all", labelKey: "categoryAll" },
  { value: "old-testament", labelKey: "categoryOT" },
  { value: "new-testament", labelKey: "categoryNT" },
  { value: "gospels", labelKey: "categoryGospels" },
  { value: "genesis", labelKey: "categoryGenesis" },
  { value: "psalms-proverbs", labelKey: "categoryPsalmsProverbs" },
  { value: "prophets", labelKey: "categoryProphets" },
  { value: "acts-epistles", labelKey: "categoryActsEpistles" },
];

type Props = {
  onStart: () => void;
  language: QuizLanguage;
  onLanguageChange: (lang: QuizLanguage) => void;
};

export function QuizSetup({ onStart, language, onLanguageChange }: Props) {
  const t = useTranslations("Trivia");
  const { difficulty, category, setDifficulty, setCategory, error } =
    useTriviaStore();

  const descKeys: Record<Difficulty, string> = {
    easy: "easyDesc",
    medium: "mediumDesc",
    hard: "hardDesc",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("setupTitle")}</CardTitle>
        <CardDescription>{t("setupDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Language toggle */}
        <div className="flex items-center gap-2">
          {(["auto", "en", "my"] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => onLanguageChange(lang)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                language === lang
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`language${lang.charAt(0).toUpperCase() + lang.slice(1)}` as "languageAuto" | "languageEn" | "languageMy")}
            </button>
          ))}
        </div>

        {/* Difficulty */}
        <div>
          <h3 className="mb-3 text-sm font-medium">{t("difficulty")}</h3>
          <div className="grid grid-cols-3 gap-3">
            {DIFFICULTY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDifficulty(opt.value)}
                className={`rounded-lg border-2 p-3 text-center transition-all ${
                  difficulty === opt.value
                    ? opt.colorClass
                    : "border-border hover:border-muted-foreground/50"
                }`}
              >
                <div className="font-medium">{t(opt.value)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t(descKeys[opt.value])}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div>
          <h3 className="mb-3 text-sm font-medium">{t("category")}</h3>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((opt) => (
              <Badge
                key={opt.value}
                variant={category === opt.value ? "default" : "outline"}
                className="cursor-pointer text-sm"
                onClick={() => setCategory(opt.value)}
              >
                {t(opt.labelKey as "categoryAll")}
              </Badge>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Start button */}
        <Button onClick={onStart} className="w-full" size="lg">
          {t("startQuiz")}
        </Button>
      </CardContent>
    </Card>
  );
}
