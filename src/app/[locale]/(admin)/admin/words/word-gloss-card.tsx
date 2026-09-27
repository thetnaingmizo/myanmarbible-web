"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { reviewWordGloss } from "../actions";

type Item = {
  strong: string;
  lemma: string;
  translit: string | null;
  pos: string | null;
  gloss: string | null;
  definition: string | null;
  gloss_my: string | null;
  gloss_my_status: string | null;
};

export function WordGlossCard({ item }: { item: Item }) {
  const [gloss, setGloss] = useState(item.gloss_my ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    startTransition(async () => {
      try {
        await reviewWordGloss({ strong: item.strong, glossMy: gloss });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <CardTitle className="text-base font-semibold">
          <span className="text-xl">{item.lemma}</span> <span className="text-muted-foreground">{item.translit}</span>
        </CardTitle>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline">{item.strong}</Badge>
          {item.pos && <Badge variant="secondary">{item.pos}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          <span className="font-medium">English:</span> {item.gloss}
        </p>
        {item.definition && <p className="line-clamp-3 text-xs text-muted-foreground">{item.definition}</p>}
        <div className="flex gap-2">
          <Input value={gloss} onChange={(e) => setGloss(e.target.value)} placeholder="Burmese gloss" />
          <Button size="sm" disabled={isPending || !gloss.trim()} onClick={save}>
            {item.gloss_my_status === "reviewed" && gloss === item.gloss_my ? "Saved" : "Save as reviewed"}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
