"use client";

import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

type Props = {
  onSelect: (topic: string) => void;
};

export function SuggestedTopics({ onSelect }: Props) {
  const t = useTranslations("VerseFinder");

  const topics = [
    t("topic1"),
    t("topic2"),
    t("topic3"),
    t("topic4"),
  ];

  return (
    <div>
      <p className="mb-3 text-center text-sm text-muted-foreground">
        {t("suggestedTopics")}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {topics.map((topic, i) => (
          <button
            key={i}
            onClick={() => onSelect(topic)}
            className="flex items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent"
          >
            <Search className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{topic}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
