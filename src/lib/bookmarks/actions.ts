import { createClient } from "@/lib/supabase/client";

export async function toggleBookmark(
  userId: string,
  verseId: string,
  isBookmarked: boolean
) {
  const supabase = createClient();

  if (isBookmarked) {
    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("user_id", userId)
      .eq("verse_id", verseId);
    return { error };
  } else {
    const { error } = await supabase
      .from("bookmarks")
      .insert({ user_id: userId, verse_id: verseId });
    return { error };
  }
}
