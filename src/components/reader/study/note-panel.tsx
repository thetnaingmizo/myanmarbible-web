"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { StudyContext } from "./context";

/** A private note on the first selected verse, saved with the account (web_markers). */
export function NotePanel({ ctx, onDone }: { ctx: StudyContext; onDone: () => void }) {
  const t = useTranslations("Study");
  const router = useRouter();
  const verse = ctx.verses[0];
  const existing = ctx.markers[verse.id];
  const [text, setText] = useState(existing?.note ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function save(value: string) {
    setError(false);
    startTransition(async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const note = value.trim() ? value.trim().slice(0, 5000) : null;
      let failed = false;
      if (note) {
        const r = await supabase
          .from("web_markers")
          .upsert({ user_id: data.user.id, verse_id: verse.id, note }, { onConflict: "user_id,verse_id" });
        failed = !!r.error;
      } else if (existing?.highlight) {
        failed = !!(await supabase.from("web_markers").update({ note: null }).eq("user_id", data.user.id).eq("verse_id", verse.id)).error;
      } else if (existing) {
        failed = !!(await supabase.from("web_markers").delete().eq("user_id", data.user.id).eq("verse_id", verse.id)).error;
      }
      if (failed) return setError(true);
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="space-y-4">
      <p className="font-semibold text-ink">{ctx.reference}</p>
      <Textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("noteHint")}
        maxLength={5000}
        className="min-h-48 leading-relaxed"
        lang={ctx.locale}
      />
      <p className="flex items-center gap-1.5 text-xs text-ink-3">
        <Lock className="size-3.5" aria-hidden />
        {t("notePrivate")}
      </p>
      {error && (
        <p role="alert" className="text-sm text-maroon">
          {t("err.server_error")}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={() => save(text)} disabled={pending} aria-busy={pending} className="flex-1">
          {t("noteSave")}
        </Button>
        {existing?.note && (
          <Button variant="outline" onClick={() => save("")} disabled={pending}>
            {t("noteDelete")}
          </Button>
        )}
      </div>
    </div>
  );
}
