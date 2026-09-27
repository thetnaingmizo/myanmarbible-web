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

  // Bibles people had in v2.1 that 3.0 couldn't carry over (filed by the upgrade screen).
  const { data: legacy } = await supabase.from("legacy_version_requests").select("short_name, long_name, preset_name");
  const legacyCounts = new Map<string, { name: string; preset: string | null; n: number }>();
  for (const l of legacy ?? []) {
    const k = l.short_name.toUpperCase();
    const e = legacyCounts.get(k) ?? { name: l.long_name ?? l.short_name, preset: l.preset_name, n: 0 };
    e.n += 1;
    legacyCounts.set(k, e);
  }
  const legacyRows = [...legacyCounts.entries()].sort((a, b) => b[1].n - a[1].n);

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
              <span className="w-24 text-right text-sm">{counts.get(r.code!) ?? 0} {(counts.get(r.code!) ?? 0) === 1 ? "request" : "requests"}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <h2 className="pt-4 text-xl font-semibold">Missing after the v2.1 upgrade</h2>
      <p className="text-sm text-muted-foreground">
        Bibles people had downloaded in the old app that 3.0 couldn&apos;t carry over. Match them to a source above (or
        add one), then ingest.
      </p>
      <Card>
        <CardContent className="divide-y p-0">
          {legacyRows.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">None yet.</p>}
          {legacyRows.map(([code, e]) => (
            <div key={code} className="flex items-center gap-3 px-4 py-3">
              <Badge variant="outline" className="w-24 justify-center">{code}</Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{e.name}</p>
                {e.preset && <p className="truncate text-xs text-muted-foreground">v2.1 catalogue: {e.preset}</p>}
              </div>
              <span className="w-24 text-right text-sm">{e.n} {e.n === 1 ? "person" : "people"}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
