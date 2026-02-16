import { setRequestLocale } from "next-intl/server";
import { getBlogPosts } from "@/lib/blog/queries";
import { BlogList } from "./blog-list";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function BlogPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const posts = await getBlogPosts();

  // Extract unique tags from all posts
  const allTags = Array.from(
    new Set(posts.flatMap((p) => p.tags ?? []))
  ).sort();

  return <BlogList posts={posts} allTags={allTags} />;
}
