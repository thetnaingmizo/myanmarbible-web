import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getBlogPostBySlug } from "@/lib/blog/queries";
import { BlogPostDetail } from "./blog-post-detail";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const post = await getBlogPostBySlug(slug);
  if (!post) notFound();

  return <BlogPostDetail post={post} />;
}
