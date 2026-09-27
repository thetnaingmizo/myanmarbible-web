import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { AiReportCard } from "./ai-report-card";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
};

const STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "applied", label: "Handled" },
  { value: "rejected", label: "Dismissed" },
] as const;

export default async function AdminAiReportsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { status: statusParam } = await searchParams;
  const status = STATUSES.find((s) => s.value === statusParam)?.value ?? "pending";

  const supabase = await createClient();
  const counts: Record<string, number> = {};
  for (const s of STATUSES) {
    const { count } = await supabase.from("ai_answer_reports").select("*", { count: "exact", head: true }).eq("status", s.value);
    counts[s.value] = count ?? 0;
  }
  const { data: items } = await supabase
    .from("ai_answer_reports")
    .select("id, question, answer, reason, comment, model, status, admin_note, created_at")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">AI Answer Reports</h1>
        <a href={`/${locale}/admin`} className="text-sm text-muted-foreground hover:underline">
          ← Admin home
        </a>
      </div>
      <p className="text-sm text-muted-foreground">
        Answers from the Bible assistant that someone flagged as wrong, harmful or not biblical. Read the answer, fix
        the prompt or data if needed, then mark it handled.
      </p>
      <div className="flex gap-2">
        {STATUSES.map((s) => (
          <a
            key={s.value}
            href={`/${locale}/admin/ai-reports?status=${s.value}`}
            className={`rounded-full border px-3 py-1 text-sm ${
              s.value === status ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            {s.label} <Badge variant="secondary" className="ml-1">{counts[s.value]}</Badge>
          </a>
        ))}
      </div>
      {(items ?? []).length === 0 && (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Nothing here.</p>
      )}
      <div className="space-y-4">
        {items?.map((item) => <AiReportCard key={item.id} item={item} />)}
      </div>
    </div>
  );
}
