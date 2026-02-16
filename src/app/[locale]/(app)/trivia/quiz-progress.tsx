"use client";

import { useTriviaStore } from "@/lib/trivia/store";

export function QuizProgress() {
  const { questions, currentQuestionIndex, selectedAnswers, goToQuestion } =
    useTriviaStore();

  const answered = selectedAnswers.filter((a) => a !== null).length;
  const progress = (answered / questions.length) * 100;

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question dots */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {questions.map((_, i) => {
          const isAnswered = selectedAnswers[i] !== null;
          const isCurrent = i === currentQuestionIndex;

          return (
            <button
              key={i}
              onClick={() => goToQuestion(i)}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all ${
                isCurrent
                  ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : isAnswered
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
