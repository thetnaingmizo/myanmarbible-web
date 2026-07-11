"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateVerseText } from "../actions";

type Props = {
  id: string;
  verseNumber: number;
  text: string;
  updatedAt: string;
};

export function VerseRow({ id, verseNumber, text, updatedAt }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    startTransition(async () => {
      try {
        await updateVerseText(id, draft.trim());
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  };

  if (editing) {
    return (
      <div className="space-y-2 border-b px-4 py-3 last:border-b-0" data-verse-editing>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-muted-foreground">{verseNumber}</span>
          <span className="text-xs text-muted-foreground">
            last updated {new Date(updatedAt).toLocaleString()}
          </span>
        </div>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          className="font-serif"
          autoFocus
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={isPending || !draft.trim()}>
            {isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(text);
              setEditing(false);
              setError(null);
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="flex w-full items-start gap-3 border-b px-4 py-2 text-left last:border-b-0 hover:bg-muted/50"
    >
      <span className="mt-0.5 w-6 shrink-0 text-right text-sm font-semibold text-muted-foreground">
        {verseNumber}
      </span>
      <span className="font-serif leading-relaxed">{text}</span>
    </button>
  );
}
