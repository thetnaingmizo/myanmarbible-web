"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { deleteReflection, reviewReflection } from "../actions";

export type Reflection = {
  id: string;
  reference: string;
  verseText: string;
  lang: string;
  content: { title: string; body: string; reflect: string; prayer: string };
  model: string;
  reviewed: boolean;
};

const FIELDS = [
  { key: "title", label: "Title", rows: 1 },
  { key: "body", label: "Reflection ([V1] = today's verse)", rows: 4 },
  { key: "reflect", label: "Question to think about", rows: 2 },
  { key: "prayer", label: "Prayer (the reader prays it)", rows: 2 },
] as const;

export function ReflectionCard({ item }: { item: Reflection }) {
  const [fields, setFields] = useState({ ...item.content });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const edited = FIELDS.some((f) => fields[f.key] !== item.content[f.key]);

  const run = (work: () => Promise<void>) => {
    setError(null);
    startTransition(async () => {
      try {
        await work();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <CardTitle className="text-base font-semibold">{item.reference}</CardTitle>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline">{item.lang === "my" ? "Burmese" : "English"}</Badge>
          {item.reviewed && <Badge>Approved</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="rounded-md bg-muted p-3 text-sm">{item.verseText}</p>
        {FIELDS.map((f) => (
          <label key={f.key} className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
            <Textarea
              value={fields[f.key]}
              rows={f.rows}
              onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
            />
          </label>
        ))}
        <p className="text-xs text-muted-foreground">Model: {item.model}</p>
        <div className="flex flex-wrap gap-2">
          {!item.reviewed || edited ? (
            <Button size="sm" disabled={isPending} onClick={() => run(() => reviewReflection({ id: item.id, approve: true, fields: edited ? fields : undefined }))}>
              {edited ? "Save and approve" : "Approve"}
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => reviewReflection({ id: item.id, approve: false }))}>
              Withdraw approval
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={isPending} onClick={() => run(() => deleteReflection(item.id))}>
            Delete (write a new draft)
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
