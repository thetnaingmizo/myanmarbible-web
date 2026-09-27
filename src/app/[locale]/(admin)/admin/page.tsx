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
    table: "profiles" | "verses" | "translations" | "verse_feedback" | "ai_answer_reports",
    filter?: { column: string; value: string }
  ) {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (filter) q = q.eq(filter.column, filter.value);
    const { count: n } = await q;
    return n ?? 0;
  }

  const [users, verses, translations, pendingFeedback, pendingAiReports] = await Promise.all([
    count("profiles"),
    count("verses"),
    count("translations"),
    count("verse_feedback", { column: "status", value: "pending" }),
    count("ai_answer_reports", { column: "status", value: "pending" }),
  ]);
  const { count: waitingReflections } = await supabase
    .from("daily_reflections")
    .select("*", { count: "exact", head: true })
    .is("reviewed_at", null);

  // Today's AI spend against the global daily cap. "Today" is Myanmar time,
  // defined once in the database (ai_today) so it matches the quota.
  const { data: today } = await supabase.rpc("ai_today");
  const [{ data: usage }, { data: settings }] = await Promise.all([
    supabase.from("ai_usage").select("cost_usd").gte("created_at", `${today}T00:00:00+06:30`),
    supabase.from("ai_settings").select("daily_cap_usd").maybeSingle(),
  ]);
  const spentToday = (usage ?? []).reduce((sum, u) => sum + Number(u.cost_usd), 0);

  const stats = [
    { label: "Users", value: users },
    { label: "Translations", value: translations },
    { label: "Verses", value: verses },
    { label: "Pending feedback", value: pendingFeedback },
  ];
  const aiLine = `$${spentToday.toFixed(2)} of $${Number(settings?.daily_cap_usd ?? 0).toFixed(2)} daily cap used today · ${pendingAiReports} report${pendingAiReports === 1 ? "" : "s"} pending`;

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
    {
      title: "AI Reflections",
      description: `Daily reflections under the Verse of the Day, drafted by AI. The app shows one only after it is approved. ${waitingReflections} waiting for review.`,
      href: `/${locale}/admin/reflections`,
    },
    {
      title: "Word meanings",
      description: "Burmese glosses for Greek and Hebrew words in word study — AI drafts to review.",
      href: `/${locale}/admin/words`,
    },
    {
      title: "Bible catalogue & requests",
      description: "Which Bibles are ready, which need ingesting or permission, and how many people asked for each.",
      href: `/${locale}/admin/bible-requests`,
    },
    {
      title: "AI Answer Reports",
      description: `Answers from the Bible assistant flagged by users. ${aiLine}.`,
      href: `/${locale}/admin/ai-reports`,
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
