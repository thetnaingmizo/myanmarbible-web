import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { WordGlossCard } from "./word-gloss-card";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
};

const STATUSES = [
  { value: "ai_draft", label: "AI drafts" },
  { value: "reviewed", label: "Reviewed" },
] as const;

export default async function AdminWordsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { status: statusParam } = await searchParams;
  const status = STATUSES.find((s) => s.value === statusParam)?.value ?? "ai_draft";

  const supabase = await createClient();
  const counts: Record<string, number> = {};
  for (const s of STATUSES) {
    const { count } = await supabase.from("lexicon").select("*", { count: "exact", head: true }).eq("gloss_my_status", s.value);
    counts[s.value] = count ?? 0;
  }
  const { data: items } = await supabase
    .from("lexicon")
    .select("strong, lemma, translit, pos, gloss, definition, gloss_my, gloss_my_status")
    .eq("gloss_my_status", status)
    .order("gloss_my_updated_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Word meanings (Burmese)</h1>
        <a href={`/${locale}/admin`} className="text-sm text-muted-foreground hover:underline">
          ← Admin home
        </a>
      </div>
      <p className="text-sm text-muted-foreground">
        Burmese glosses for Greek and Hebrew words in the app&apos;s word study. The AI drafts one the first time someone
        studies a word; the app labels it &ldquo;AI draft&rdquo; until it is reviewed here. English glosses and definitions
        come from STEPBible (CC BY 4.0).
      </p>
      <div className="flex gap-2">
        {STATUSES.map((s) => (
          <a
            key={s.value}
            href={`/${locale}/admin/words?status=${s.value}`}
            className={`rounded-full border px-3 py-1 text-sm ${
              s.value === status ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            {s.label} <Badge variant="secondary" className="ml-1">{counts[s.value]}</Badge>
          </a>
        ))}
      </div>
      {(items ?? []).length === 0 && (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Nothing here.</p>
      )}
      <div className="space-y-4">
        {items?.map((item) => (
          <WordGlossCard key={item.strong} item={item} />
        ))}
      </div>
    </div>
  );
}
