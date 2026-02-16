import { createClient } from "@/lib/supabase/server";

export async function getCharacters(testament?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("characters")
    .select("id, name_en, name_my, slug, description_en, description_my, testament, image_url")
    .eq("status", "published")
    .order("name_en");

  if (testament === "OT" || testament === "NT") {
    query = query.eq("testament", testament);
  }

  const { data } = await query;
  return data ?? [];
}

export async function getCharacterBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("characters")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  return data;
}

export async function getCharacterVerses(verseIds: string[]) {
  if (verseIds.length === 0) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("verses")
    .select("id, verse_number, chapter_number, text, book_id, books(name_en, name_my)")
    .in("id", verseIds);
  return data ?? [];
}
