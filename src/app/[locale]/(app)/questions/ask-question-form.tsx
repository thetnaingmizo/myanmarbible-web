"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userId: string | null;
  onClose: () => void;
};

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function AskQuestionForm({ userId, onClose }: Props) {
  const t = useTranslations("Questions");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!userId) {
    return (
      <div className="rounded-lg border bg-muted/50 p-4 text-center">
        <p className="mb-2 text-sm text-muted-foreground">{t("loginToAsk")}</p>
        <Button asChild size="sm">
          <Link href="/login">{t("loginButton")}</Link>
        </Button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="rounded-lg border bg-muted/50 p-4 text-center">
        <p className="text-sm text-muted-foreground">{t("submitted")}</p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const slug = toSlug(title) + "-" + Date.now().toString(36);

      const { error } = await supabase.from("questions").insert({
        user_id: userId,
        title_en: title.trim(),
        body_en: body.trim() || null,
        slug,
        status: "pending",
      });

      if (error) throw error;

      setSubmitted(true);
      router.refresh();
    } catch {
      // Silently fail
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-4">
      <Input
        placeholder={t("titlePlaceholder")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <textarea
        placeholder={t("bodyPlaceholder")}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isSubmitting || !title.trim()}>
          {isSubmitting ? t("submitting") : t("submitQuestion")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
