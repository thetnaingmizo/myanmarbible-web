import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { FeedbackCard } from "./feedback-card";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
};

const STATUSES = ["pending", "applied", "rejected"] as const;

export default async function AdminFeedbackPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { status: statusParam } = await searchParams;
  const status = (STATUSES as readonly string[]).includes(statusParam ?? "")
    ? (statusParam as (typeof STATUSES)[number])
    : "pending";

  const supabase = await createClient();

  const counts: Record<string, number> = {};
  for (const s of STATUSES) {
    const { count } = await supabase
      .from("verse_feedback")
      .select("*", { count: "exact", head: true })
      .eq("status", s);
    counts[s] = count ?? 0;
  }

  const { data: items } = await supabase
    .from("verse_feedback")
    .select(
      "id, verse_id, translation_code, book_name, book_number, chapter_number, verse_number, original_text, suggested_text, comment, status, admin_note, created_at"
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);

  // Current verse text for each referenced verse (to show drift since report)
  const verseIds = (items ?? []).map((i) => i.verse_id).filter(Boolean) as string[];
  const { data: verses } = verseIds.length
    ? await supabase.from("verses").select("id, text").in("id", verseIds)
    : { data: [] };
  const currentTextById = new Map((verses ?? []).map((v) => [v.id, v.text]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Verse Feedback</h1>
        <a href={`/${locale}/admin`} className="text-sm text-muted-foreground hover:underline">
          ← Admin home
        </a>
      </div>

      <div className="flex gap-2">
        {STATUSES.map((s) => (
          <a
            key={s}
            href={`/${locale}/admin/feedback?status=${s}`}
            className={`rounded-full border px-3 py-1 text-sm capitalize ${
              s === status
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
          >
            {s} <Badge variant="secondary" className="ml-1">{counts[s]}</Badge>
          </a>
        ))}
      </div>

      {(items ?? []).length === 0 && (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No {status} feedback.
        </p>
      )}

      <div className="space-y-4">
        {items?.map((item) => (
          <FeedbackCard
            key={item.id}
            item={item}
            currentVerseText={
              item.verse_id ? currentTextById.get(item.verse_id) ?? null : null
            }
          />
        ))}
      </div>
    </div>
  );
}
