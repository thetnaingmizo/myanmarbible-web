import { createClient } from "@/lib/supabase/server";

export async function getBlogPosts(tag?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("blog_posts")
    .select(
      "id, slug, title_en, title_my, excerpt_en, excerpt_my, image_url, tags, published_at"
    )
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (tag) {
    query = query.contains("tags", [tag]);
  }

  const { data } = await query;
  return data ?? [];
}

export async function getBlogPostBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  return data;
}
