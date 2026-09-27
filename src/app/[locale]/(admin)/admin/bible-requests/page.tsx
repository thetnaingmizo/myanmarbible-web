import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type Props = { params: Promise<{ locale: string }> };

export default async function AdminBibleRequestsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const supabase = await createClient();
  const { data: catalog } = await supabase
    .from("translation_catalog")
    .select("code, name_en, name_local, language_group, scope, license, source, status, note")
    .order("sort_order");
  const { data: requests } = await supabase.from("translation_requests").select("source_code");
  const counts = new Map<string, number>();
  for (const r of requests ?? []) counts.set(r.source_code, (counts.get(r.source_code) ?? 0) + 1);
  const rows = [...(catalog ?? [])].sort((a, b) => (counts.get(b.code!) ?? 0) - (counts.get(a.code!) ?? 0));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Bible catalogue &amp; requests</h1>
        <a href={`/${locale}/admin`} className="text-sm text-muted-foreground hover:underline">
          ← Admin home
        </a>
      </div>
      <p className="text-sm text-muted-foreground">
        The Bibles the app offers (curated — people can request, never add). &ldquo;Ready&rdquo; ones download in the app;
        the rest need ingesting (eBible sources) or the publisher&apos;s permission (Bible Society of Myanmar). Most
        requested first.
      </p>
      <Card>
        <CardContent className="divide-y p-0">
          {rows.map((r) => (
            <div key={r.code} className="flex items-center gap-3 px-4 py-3">
              <Badge variant="outline" className="w-24 justify-center">{r.code}</Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.name_en}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.name_local} · {r.language_group} · {r.scope} · {r.license ?? "licence to confirm"} · {r.source}
                  {r.note ? ` · ${r.note}` : ""}
                </p>
              </div>
              <Badge variant={r.status === "ready" ? "default" : "secondary"}>{r.status?.replace("_", " ")}</Badge>
              <span className="w-24 text-right text-sm">{counts.get(r.code!) ?? 0} requests</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
