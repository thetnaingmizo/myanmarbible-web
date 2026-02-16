"use client";

import { useTranslations } from "next-intl";
import { useTriviaStore } from "@/lib/trivia/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function QuizQuestion() {
  const t = useTranslations("Trivia");
  const { questions, currentQuestionIndex, selectedAnswers, selectAnswer } =
    useTriviaStore();

  const question = questions[currentQuestionIndex];
  if (!question) return null;

  const selected = selectedAnswers[currentQuestionIndex];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {t("question")} {currentQuestionIndex + 1} {t("of")}{" "}
          {questions.length}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-base font-medium leading-relaxed">
          {question.question}
        </p>

        <div className="grid gap-2">
          {question.options.map((option, i) => (
            <button
              key={i}
              onClick={() => selectAnswer(currentQuestionIndex, i)}
              className={`rounded-lg border-2 p-3 text-left text-sm transition-all ${
                selected === i
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border hover:border-muted-foreground/50 hover:bg-muted/50"
              }`}
            >
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium">
                {String.fromCharCode(65 + i)}
              </span>
              {option}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
