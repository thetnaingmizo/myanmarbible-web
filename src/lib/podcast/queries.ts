import { createClient } from "@/lib/supabase/server";

export async function getPodcastEpisodes(tag?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("podcast_episodes")
    .select(
      "id, slug, title_en, title_my, description_en, description_my, audio_url, duration_seconds, image_url, tags, published_at"
    )
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (tag) {
    query = query.contains("tags", [tag]);
  }

  const { data } = await query;
  return data ?? [];
}

export async function getPodcastEpisodeBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("podcast_episodes")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  return data;
}
