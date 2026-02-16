import { createClient } from "@/lib/supabase/server";

export async function getTranslations() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("translations")
    .select("id, code, name_en, name_my, language, is_default")
    .order("is_default", { ascending: false });
  return data ?? [];
}

export async function getDefaultTranslation(locale: string) {
  const supabase = await createClient();
  const language = locale === "my" ? "my" : "en";
  const { data } = await supabase
    .from("translations")
    .select("id, code, name_en, name_my, language")
    .eq("language", language)
    .limit(1)
    .single();
  return data;
}

export async function getBooks(translationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("books")
    .select("id, book_number, name_en, name_my, abbreviation_en, abbreviation_my, testament, chapter_count")
    .eq("translation_id", translationId)
    .order("book_number");
  return data ?? [];
}

export async function getBook(bookId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("books")
    .select("id, book_number, name_en, name_my, abbreviation_en, abbreviation_my, testament, chapter_count, translation_id")
    .eq("id", bookId)
    .single();
  return data;
}

export async function getBookByNumber(translationId: string, bookNumber: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("books")
    .select("id, book_number, name_en, name_my, abbreviation_en, abbreviation_my, testament, chapter_count, translation_id")
    .eq("translation_id", translationId)
    .eq("book_number", bookNumber)
    .single();
  return data;
}

export async function getVerses(bookId: string, chapterNumber: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("verses")
    .select("id, verse_number, text")
    .eq("book_id", bookId)
    .eq("chapter_number", chapterNumber)
    .order("verse_number");
  return data ?? [];
}
