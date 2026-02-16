import { createClient } from "@/lib/supabase/server";

export async function getLessons() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lessons")
    .select("id, slug, title_en, title_my, summary_en, summary_my, sort_order, image_url")
    .eq("status", "published")
    .order("sort_order");

  return data ?? [];
}

export async function getLessonBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lessons")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  return data;
}

export async function getLessonVerses(verseIds: string[]) {
  if (verseIds.length === 0) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("verses")
    .select("id, verse_number, chapter_number, text, book_id, books(name_en, name_my)")
    .in("id", verseIds);
  return data ?? [];
}
