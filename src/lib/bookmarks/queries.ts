import { createClient } from "@/lib/supabase/server";

export async function getUserBookmarks(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookmarks")
    .select("id, verse_id, note, created_at, verses(id, verse_number, chapter_number, text, book_id, books(id, name_en, name_my))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getUserBookmarkedVerseIds(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookmarks")
    .select("verse_id")
    .eq("user_id", userId);

  return new Set((data ?? []).map((b) => b.verse_id));
}
