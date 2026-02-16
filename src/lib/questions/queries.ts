import { createClient } from "@/lib/supabase/server";

export async function getQuestions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("questions")
    .select("id, slug, title_en, title_my, body_en, body_my, answer_en, answer_my, upvote_count, status, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getQuestionBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("questions")
    .select("*")
    .eq("slug", slug)
    .eq("status", "approved")
    .single();
  return data;
}

export async function getUserVotes(userId: string, questionIds: string[]) {
  if (questionIds.length === 0) return new Set<string>();

  const supabase = await createClient();
  const { data } = await supabase
    .from("question_votes")
    .select("question_id")
    .eq("user_id", userId)
    .in("question_id", questionIds);

  return new Set((data ?? []).map((v) => v.question_id));
}
