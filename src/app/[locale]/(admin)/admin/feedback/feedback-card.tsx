"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { resolveFeedback } from "../actions";

type Item = {
  id: string;
  verse_id: string | null;
  translation_code: string;
  book_name: string;
  book_number: number;
  chapter_number: number;
  verse_number: number;
  original_text: string;
  suggested_text: string | null;
  comment: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
};

export function FeedbackCard({
  item,
  currentVerseText,
}: {
  item: Item;
  currentVerseText: string | null;
}) {
  const [fixText, setFixText] = useState(
    item.suggested_text ?? currentVerseText ?? item.original_text
  );
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const resolve = (status: "applied" | "rejected", applyText?: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await resolveFeedback({
          feedbackId: item.id,
          status,
          applyText,
          verseId: item.verse_id,
          adminNote: note || undefined,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  const reference = `${item.book_name} ${item.chapter_number}:${item.verse_number}`;
  const isPendingStatus = item.status === "pending";

  return (
    <Card data-feedback-card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{reference}</CardTitle>
          <Badge variant="outline" className="uppercase">{item.translation_code}</Badge>
          <Badge
            variant={
              item.status === "pending"
                ? "secondary"
                : item.status === "applied"
                  ? "default"
                  : "destructive"
            }
            className="capitalize"
          >
            {item.status}
          </Badge>
          <span className="ml-auto text-xs text-muted-foreground">
            {new Date(item.created_at).toLocaleString()}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {item.comment && (
          <p className="rounded bg-muted/60 px-3 py-2 text-sm italic">“{item.comment}”</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
              Text when reported
            </p>
            <p className="rounded border px-3 py-2 font-serif text-sm">{item.original_text}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
              {item.suggested_text ? "Reporter's suggestion" : "Current text"}
            </p>
            <p className="rounded border px-3 py-2 font-serif text-sm">
              {item.suggested_text ?? currentVerseText ?? "—"}
            </p>
          </div>
        </div>

        {isPendingStatus && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Corrected text to apply
            </p>
            <Textarea
              value={fixText}
              onChange={(e) => setFixText(e.target.value)}
              rows={2}
              className="font-serif"
            />
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={1}
              placeholder="Admin note (optional)"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => resolve("applied", fixText.trim())}
                disabled={isPending || !fixText.trim() || !item.verse_id}
              >
                {isPending ? "Working…" : "Apply fix & resolve"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => resolve("rejected")}
                disabled={isPending}
              >
                Reject
              </Button>
            </div>
            {!item.verse_id && (
              <p className="text-xs text-muted-foreground">
                The referenced verse row no longer exists; you can only reject or fix it
                manually in the content browser.
              </p>
            )}
          </div>
        )}

        {item.admin_note && (
          <p className="text-xs text-muted-foreground">Note: {item.admin_note}</p>
        )}
      </CardContent>
    </Card>
  );
}
