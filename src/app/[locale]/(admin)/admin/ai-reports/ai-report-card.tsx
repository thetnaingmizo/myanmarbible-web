"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { resolveAiReport } from "../actions";

type Item = {
  id: string;
  question: string;
  answer: string;
  reason: string;
  comment: string | null;
  model: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
};

export function AiReportCard({ item }: { item: Item }) {
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const resolve = (status: "applied" | "rejected") => {
    setError(null);
    startTransition(async () => {
      try {
        await resolveAiReport({ reportId: item.id, status, adminNote: note || undefined });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <CardTitle className="text-base font-semibold">{item.question}</CardTitle>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="destructive">{item.reason.replace("_", " ")}</Badge>
          <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{item.answer}</div>
        {item.comment && <p className="text-sm"><span className="font-medium">Their comment:</span> {item.comment}</p>}
        {item.model && <p className="text-xs text-muted-foreground">Model: {item.model}</p>}
        {item.admin_note && <p className="text-sm text-muted-foreground">Note: {item.admin_note}</p>}
        {item.status === "pending" && (
          <div className="space-y-2">
            <Textarea placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            <div className="flex gap-2">
              <Button size="sm" disabled={isPending} onClick={() => resolve("applied")}>
                Mark handled
              </Button>
              <Button size="sm" variant="outline" disabled={isPending} onClick={() => resolve("rejected")}>
                Dismiss
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
