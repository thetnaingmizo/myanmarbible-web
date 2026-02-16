"use client";

import { useTranslations } from "next-intl";
import type { Message } from "@/lib/chat/store";
import { MarkdownContent } from "@/components/markdown-content";
import { User, Bot } from "lucide-react";

type Props = {
  message: Message;
  isStreaming?: boolean;
};

export function MessageBubble({ message, isStreaming }: Props) {
  const t = useTranslations("Chat");
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Bot className="h-4 w-4" />
        </div>
      )}

      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        }`}
      >
        {/* Message content */}
        <div className="text-sm leading-relaxed">
          {!message.content && isStreaming && (
            <span className="opacity-70">{t("thinking")}</span>
          )}
          {message.content && (
            isUser ? (
              <div className="whitespace-pre-wrap">{message.content}</div>
            ) : (
              <MarkdownContent content={message.content} />
            )
          )}
          {isStreaming && message.content && (
            <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-current align-middle" />
          )}
        </div>

        {/* Verse references */}
        {message.verses && message.verses.length > 0 && !isStreaming && (
          <div className="mt-3 border-t border-border/50 pt-2">
            <p className="mb-1 text-xs font-semibold opacity-70">
              {t("relatedVerses")}
            </p>
            <div className="space-y-1">
              {message.verses.map((v, i) => (
                <div
                  key={v.verseId || i}
                  className="rounded-lg bg-background/50 px-2.5 py-1.5 text-xs"
                >
                  <span className="font-semibold">
                    {v.book} {v.chapter}:{v.verse}
                  </span>
                  <span className="ml-1 opacity-80">
                    {v.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
