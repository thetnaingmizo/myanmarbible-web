"use client";

import { useTranslations } from "next-intl";
import { MessageSquare } from "lucide-react";

type Props = {
  onSelect: (question: string) => void;
};

export function SuggestedQuestions({ onSelect }: Props) {
  const t = useTranslations("Chat");

  const suggestions = [
    t("suggestion1"),
    t("suggestion2"),
    t("suggestion3"),
    t("suggestion4"),
  ];

  return (
    <div>
      <p className="mb-3 text-center text-sm text-muted-foreground">
        {t("suggestedQuestions")}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {suggestions.map((q, i) => (
          <button
            key={i}
            onClick={() => onSelect(q)}
            className="flex items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent"
          >
            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
