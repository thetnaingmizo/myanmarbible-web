import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";

type BlogPost = {
  id: string;
  slug: string;
  title_en: string;
  title_my: string | null;
  excerpt_en: string | null;
  excerpt_my: string | null;
  image_url: string | null;
  tags: string[] | null;
  published_at: string | null;
};

type Props = {
  post: BlogPost;
};

export function BlogCard({ post }: Props) {
  const locale = useLocale();
  const t = useTranslations("Blog");

  const title = locale === "my" && post.title_my ? post.title_my : post.title_en;
  const excerpt =
    locale === "my" && post.excerpt_my ? post.excerpt_my : post.excerpt_en;

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString(
        locale === "my" ? "my-MM" : "en-US",
        { year: "numeric", month: "short", day: "numeric" }
      )
    : null;

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col rounded-lg border p-4 transition-colors hover:bg-accent"
    >
      {/* Title */}
      <h3 className="font-semibold leading-tight group-hover:text-primary">
        {title}
      </h3>
      {locale !== "my" && post.title_my && (
        <p className="mt-0.5 text-sm text-muted-foreground">{post.title_my}</p>
      )}

      {/* Excerpt */}
      {excerpt && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {excerpt}
        </p>
      )}

      {/* Tags + Date */}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
        {post.tags?.map((tag) => (
          <Badge key={tag} variant="secondary" className="text-xs">
            {tag}
          </Badge>
        ))}
        {formattedDate && (
          <span className="ml-auto text-xs text-muted-foreground">
            {formattedDate}
          </span>
        )}
      </div>
    </Link>
  );
}
