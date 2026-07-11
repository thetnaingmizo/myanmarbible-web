import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminDashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();

  async function count(
    table: "profiles" | "verses" | "translations" | "verse_feedback",
    filter?: { column: string; value: string }
  ) {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (filter) q = q.eq(filter.column, filter.value);
    const { count: n } = await q;
    return n ?? 0;
  }

  const [users, verses, translations, pendingFeedback] = await Promise.all([
    count("profiles"),
    count("verses"),
    count("translations"),
    count("verse_feedback", { column: "status", value: "pending" }),
  ]);

  const stats = [
    { label: "Users", value: users },
    { label: "Translations", value: translations },
    { label: "Verses", value: verses },
    { label: "Pending feedback", value: pendingFeedback },
  ];

  const sections = [
    {
      title: "Bible Content",
      description:
        "Browse every translation, book, and chapter. Edit verse text inline — each edit bumps the content version so apps sync it on next launch.",
      href: `/${locale}/admin/bible`,
    },
    {
      title: "Verse Feedback",
      description:
        "Reports from app and web users about missing or incorrect verses. Review, apply a corrected text, or reject.",
      href: `/${locale}/admin/feedback`,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{s.value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <a key={s.href} href={s.href} className="group">
            <Card className="h-full transition-colors group-hover:border-primary">
              <CardHeader>
                <CardTitle className="text-lg">{s.title} →</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{s.description}</p>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
