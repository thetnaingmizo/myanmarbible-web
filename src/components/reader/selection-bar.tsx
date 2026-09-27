"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Ban, Bookmark, Columns3, Copy, Flag, Languages, MessageCircleQuestion, Share2, Sparkles, StickyNote, X } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { cleanVerseText } from "@/lib/bible/reader-text";
import type { Verse } from "@/lib/bible/data";
import type { Marker, StudyMode } from "./study/context";

export const HIGHLIGHTS = ["promise", "prayer", "teaching", "warning", "remember"] as const;
export type HighlightName = (typeof HIGHLIGHTS)[number];

type Props = {
  picked: Verse[];
  reference: string;
  onClear: () => void;
  onAction: (mode: StudyMode) => void;
  bookmarked: Set<string>;
  markers: Record<string, Marker>;
  signedIn: boolean;
  returnTo: string;
};

/** Actions for the selected verses, laid out like the app's verse action sheet. */
export function SelectionBar({ picked, reference, onClear, onAction, bookmarked, markers, signedIn, returnTo }: Props) {
  const t = useTranslations("Bible");
  const s = useTranslations("Study");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  if (picked.length === 0) return null;

  const loginHref = `/login?next=${encodeURIComponent(`/${locale}${returnTo}`)}`;
  const text = picked.map((v) => cleanVerseText(v.text, true)).join(" ");
  const allSaved = picked.every((v) => bookmarked.has(v.id));
  const current = picked.map((v) => markers[v.id]?.highlight ?? null);
  const shared = current.every((h) => h === current[0]) ? current[0] : null;

  function withUser(fn: (userId: string) => Promise<unknown>) {
    startTransition(async () => {
      const { data } = await createClient().auth.getUser();
      if (!data.user) return;
      await fn(data.user.id);
      router.refresh();
    });
  }

  function save() {
    withUser(async (uid) => {
      const supabase = createClient();
      const ids = picked.map((v) => v.id);
      if (allSaved) await supabase.from("bookmarks").delete().eq("user_id", uid).in("verse_id", ids);
      else
        await supabase
          .from("bookmarks")
          .insert(ids.filter((id) => !bookmarked.has(id)).map((verse_id) => ({ user_id: uid, verse_id })));
    });
  }

  function highlight(name: HighlightName | null) {
    withUser(async (uid) => {
      const supabase = createClient();
      if (name) {
        await supabase
          .from("web_markers")
          .upsert(picked.map((v) => ({ user_id: uid, verse_id: v.id, highlight: name })), { onConflict: "user_id,verse_id" });
        return;
      }
      // Clearing: keep rows that still hold a note, drop the rest.
      const withNote = picked.filter((v) => markers[v.id]?.note).map((v) => v.id);
      const bare = picked.filter((v) => markers[v.id] && !markers[v.id].note).map((v) => v.id);
      if (withNote.length) await supabase.from("web_markers").update({ highlight: null }).eq("user_id", uid).in("verse_id", withNote);
      if (bare.length) await supabase.from("web_markers").delete().eq("user_id", uid).in("verse_id", bare);
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${text}\n— ${reference}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  async function share() {
    const body = `${text}\n— ${reference}\n\n${t("shareFooter")}`;
    if (navigator.share) {
      try {
        return void (await navigator.share({ title: reference, text: body }));
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }
    await copy();
  }

  const tool = (label: string, Icon: typeof Copy, onClick: () => void, opts: { active?: boolean; ai?: boolean } = {}) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={opts.active}
      className={cn(
        "flex min-w-[4.25rem] flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold hover:bg-sunk",
        opts.active ? "text-maroon" : opts.ai ? "text-gold" : "text-ink-2"
      )}
    >
      <Icon className={cn("size-5", opts.active && "fill-current")} aria-hidden />
      {label}
    </button>
  );

  return (
    <div
      role="region"
      aria-label={t("selectedCount", { count: picked.length })}
      aria-busy={pending}
      className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-2xl rounded-2xl border border-line bg-surface p-3 text-ink shadow-lg md:bottom-6"
    >
      {/* Phones: reference + close on top, colours on their own row. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-1">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{reference}</p>
        {signedIn ? (
          <div className="order-last flex w-full items-center gap-2 sm:order-none sm:w-auto sm:gap-1.5" role="group" aria-label={s("highlight")}>
            {HIGHLIGHTS.map((h) => (
              <button
                key={h}
                type="button"
                title={s(`hl.${h}`)}
                aria-label={s(`hl.${h}`)}
                aria-pressed={shared === h}
                onClick={() => highlight(shared === h ? null : h)}
                style={{ background: `var(--hl-${h})` }}
                className={cn("size-7 rounded-full border border-black/10", shared === h && "ring-2 ring-maroon ring-offset-2 ring-offset-surface")}
              />
            ))}
            {current.some(Boolean) && (
              <button type="button" onClick={() => highlight(null)} aria-label={s("removeHighlight")} title={s("removeHighlight")} className="grid size-7 place-items-center rounded-full text-ink-3 hover:bg-sunk">
                <Ban className="size-4" aria-hidden />
              </button>
            )}
          </div>
        ) : (
          <Link href={loginHref} className="order-last w-full text-xs font-semibold text-maroon underline sm:order-none sm:w-auto">
            {s("highlight")}
          </Link>
        )}
        <button type="button" onClick={onClear} aria-label={t("clearSelection")} className="grid size-9 place-items-center rounded-full text-ink-3 hover:bg-sunk">
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-2 flex gap-1 overflow-x-auto [scrollbar-width:none]">
        {tool(s("explain"), Sparkles, () => onAction("explain"), { ai: true })}
        {tool(s("original"), Languages, () => onAction("original"))}
        {tool(s("compare"), Columns3, () => onAction("compare"))}
        {tool(s("ask"), MessageCircleQuestion, () => router.push(`/chat?about=${encodeURIComponent(reference)}`), { ai: true })}
        <span className="mx-1 w-px shrink-0 self-stretch bg-hairline" aria-hidden />
        {signedIn
          ? tool(allSaved ? t("saved") : t("save"), Bookmark, save, { active: allSaved })
          : tool(t("save"), Bookmark, () => router.push(loginHref))}
        {tool(s("note"), StickyNote, () => onAction("note"), { active: !!markers[picked[0].id]?.note })}
        {tool(copied ? t("copied") : t("copy"), Copy, copy)}
        {tool(t("share"), Share2, share)}
        {tool(s("report"), Flag, () => onAction("report"))}
      </div>
    </div>
  );
}

