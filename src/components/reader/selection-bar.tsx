"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bookmark, Copy, Share2, X } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { cleanVerseText, formatVerseRanges } from "@/lib/bible/reader-text";
import type { Verse } from "@/lib/bible/data";
import { Button } from "@/components/ui/button";

type Props = {
  selected: number[];
  onClear: () => void;
  verses: Verse[];
  through: Map<number, number>;
  bookmarked: Set<string>;
  signedIn: boolean;
  reference: (verseNumbers: string) => string;
  burmese: boolean;
  returnTo: string;
};

/** Actions for the selected verses. W3 adds Explain · Original · Compare · Ask. */
export function SelectionBar({ selected, onClear, verses, through, bookmarked, signedIn, reference, burmese, returnTo }: Props) {
  const t = useTranslations("Bible");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<"copied" | null>(null);

  if (selected.length === 0) return null;

  const picked = verses.filter((v) => selected.includes(v.verse_number));
  // A joined verse covers several numbers ("35–36").
  const numbers = picked.flatMap((v) => {
    const end = through.get(v.verse_number) ?? v.verse_number;
    return Array.from({ length: end - v.verse_number + 1 }, (_, k) => v.verse_number + k);
  });
  const ref = reference(formatVerseRanges(numbers, burmese));
  const text = picked.map((v) => cleanVerseText(v.text, true)).join(" ");
  const allSaved = picked.every((v) => bookmarked.has(v.id));

  function save() {
    startTransition(async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const ids = picked.map((v) => v.id);
      if (allSaved) {
        await supabase.from("bookmarks").delete().eq("user_id", data.user.id).in("verse_id", ids);
      } else {
        const missing = ids.filter((id) => !bookmarked.has(id));
        await supabase.from("bookmarks").insert(missing.map((verse_id) => ({ user_id: data.user!.id, verse_id })));
      }
      router.refresh();
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${text}\n— ${ref}`);
      setDone("copied");
      setTimeout(() => setDone(null), 1800);
    } catch {}
  }

  async function share() {
    const body = `${text}\n— ${ref}\n\n${t("shareFooter")}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: ref, text: body });
        return;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }
    await copy();
  }

  return (
    <div
      role="region"
      aria-label={t("selectedCount", { count: picked.length })}
      className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-xl rounded-2xl border border-line bg-surface p-3 text-ink shadow-lg md:bottom-6"
    >
      <div className="flex items-center gap-2 px-1">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{ref}</p>
        <button type="button" onClick={onClear} aria-label={t("clearSelection")} className="grid size-9 place-items-center rounded-full text-ink-3 hover:bg-sunk">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {signedIn ? (
          <Button variant={allSaved ? "default" : "outline"} onClick={save} disabled={pending} aria-busy={pending} aria-pressed={allSaved}>
            <Bookmark className={allSaved ? "fill-current" : ""} aria-hidden />
            {allSaved ? t("saved") : t("save")}
          </Button>
        ) : (
          <Button asChild variant="outline" title={t("signInToSave")}>
            <Link href={`/login?next=${encodeURIComponent(`/${locale}${returnTo}`)}`}>
              <Bookmark aria-hidden />
              {t("save")}
            </Link>
          </Button>
        )}
        <Button variant="outline" onClick={copy}>
          <Copy aria-hidden />
          {done === "copied" ? t("copied") : t("copy")}
        </Button>
        <Button variant="outline" onClick={share}>
          <Share2 aria-hidden />
          {t("share")}
        </Button>
      </div>
    </div>
  );
}
