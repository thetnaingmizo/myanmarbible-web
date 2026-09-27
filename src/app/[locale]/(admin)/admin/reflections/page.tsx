import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ReflectionCard, type Reflection } from "./reflection-card";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
};

const STATUSES = [
  { value: "waiting", label: "Waiting for review" },
  { value: "approved", label: "Approved" },
] as const;

export default async function AdminReflectionsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { status: statusParam } = await searchParams;
  const status = STATUSES.find((s) => s.value === statusParam)?.value ?? "waiting";

  const supabase = await createClient();
  const counts: Record<string, number> = {};
  for (const s of STATUSES) {
    const q = supabase.from("daily_reflections").select("*", { count: "exact", head: true });
    const { count } = await (s.value === "waiting" ? q.is("reviewed_at", null) : q.not("reviewed_at", "is", null));
    counts[s.value] = count ?? 0;
  }
  const base = supabase
    .from("daily_reflections")
    .select("id, book_number, chapter_number, verse_number, lang, content, model, reviewed_at, created_at");
  const { data: rows } = await (status === "waiting" ? base.is("reviewed_at", null) : base.not("reviewed_at", "is", null))
    .order("created_at", { ascending: true })
    .limit(100);

  // The verse in the reflection's language: Judson (Burmese) or KJV (English).
  const { data: translations } = await supabase.from("translations").select("id, code").in("code", ["judson", "kjv"]);
  const idFor = (lang: string) => translations?.find((t) => t.code === (lang === "my" ? "judson" : "kjv"))?.id;
  const items: Reflection[] = [];
  for (const r of rows ?? []) {
    const { data: book } = await supabase
      .from("books")
      .select("id, name_en, name_my")
      .eq("translation_id", idFor(r.lang) ?? "")
      .eq("book_number", r.book_number)
      .maybeSingle();
    const { data: verse } = book
      ? await supabase
          .from("verses")
          .select("text")
          .eq("book_id", book.id)
          .eq("chapter_number", r.chapter_number)
          .eq("verse_number", r.verse_number)
          .maybeSingle()
      : { data: null };
    const name = ((r.lang === "my" ? book?.name_my : null) ?? book?.name_en ?? `Book ${r.book_number}`).replace(/​/g, "");
    items.push({
      id: r.id,
      reference: `${name} ${r.chapter_number}:${r.verse_number}`,
      verseText: (verse?.text ?? "").replace(/​/g, ""),
      lang: r.lang,
      content: r.content as Reflection["content"],
      model: r.model,
      reviewed: r.reviewed_at !== null,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">AI Reflections</h1>
        <a href={`/${locale}/admin`} className="text-sm text-muted-foreground hover:underline">
          ← Admin home
        </a>
      </div>
      <p className="text-sm text-muted-foreground">
        Short reflections under the Verse of the Day, drafted by AI (scripts/generate-reflections.ts). The app shows a
        reflection only after it is approved here. Fix the wording if needed, then approve. Delete one to have the script
        write a new draft.
      </p>
      <div className="flex gap-2">
        {STATUSES.map((s) => (
          <a
            key={s.value}
            href={`/${locale}/admin/reflections?status=${s.value}`}
            className={`rounded-full border px-3 py-1 text-sm ${
              s.value === status ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            {s.label} <Badge variant="secondary" className="ml-1">{counts[s.value]}</Badge>
          </a>
        ))}
      </div>
      {items.length === 0 && (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Nothing here.</p>
      )}
      <div className="space-y-4">
        {items.map((item) => (
          <ReflectionCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
