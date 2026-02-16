"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/markdown-content";

type BlogPost = {
  id: string;
  slug: string;
  title_en: string;
  title_my: string | null;
  excerpt_en: string | null;
  excerpt_my: string | null;
  content_en: string | null;
  content_my: string | null;
  image_url: string | null;
  tags: string[] | null;
  published_at: string | null;
};

type Props = {
  post: BlogPost;
};

export function BlogPostDetail({ post }: Props) {
  const locale = useLocale();
  const t = useTranslations("Blog");

  const title = locale === "my" && post.title_my ? post.title_my : post.title_en;
  const secondaryTitle = locale === "my" ? post.title_en : post.title_my;
  const content =
    locale === "my" && post.content_my ? post.content_my : post.content_en;

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString(
        locale === "my" ? "my-MM" : "en-US",
        { year: "numeric", month: "long", day: "numeric" }
      )
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back link */}
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/blog">&larr; {t("backToBlog")}</Link>
      </Button>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        {secondaryTitle && (
          <p className="mt-1 text-muted-foreground">{secondaryTitle}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {formattedDate && (
            <span className="text-sm text-muted-foreground">
              {t("publishedOn")} {formattedDate}
            </span>
          )}
          {post.tags?.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Markdown Content */}
      {content && (
        <section className="leading-relaxed text-muted-foreground">
          <MarkdownContent content={content} />
        </section>
      )}
    </div>
  );
}
