/**
 * One-off content transfer: copies generated content tables from the LOCAL
 * Supabase stack to a remote project, remapping verse-id references
 * (verse UUIDs differ between environments; the stable key is
 * translation code + book number + chapter + verse).
 *
 * Usage:
 *   SOURCE_URL=http://127.0.0.1:54321 SOURCE_KEY=<local secret> \
 *   TARGET_URL=https://<ref>.supabase.co TARGET_KEY=<sb_secret_...> \
 *   npx tsx scripts/transfer-content.ts
 */

import { createClient } from "@supabase/supabase-js";

const src = createClient(process.env.SOURCE_URL!, process.env.SOURCE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const dst = createClient(process.env.TARGET_URL!, process.env.TARGET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** verse id -> canonical ref string, and back, per environment */
async function verseRefMaps(sb: typeof src) {
  const { data: translations } = await sb.from("translations").select("id, code");
  const tCode = new Map((translations ?? []).map((t) => [t.id, t.code]));
  const { data: books } = await sb
    .from("books")
    .select("id, translation_id, book_number");
  const bookRef = new Map(
    (books ?? []).map((b) => [b.id, `${tCode.get(b.translation_id)}:${b.book_number}`])
  );

  const idToRef = new Map<string, string>();
  const refToId = new Map<string, string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data: verses, error } = await sb
      .from("verses")
      .select("id, book_id, chapter_number, verse_number")
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    for (const v of verses ?? []) {
      const ref = `${bookRef.get(v.book_id)}:${v.chapter_number}:${v.verse_number}`;
      idToRef.set(v.id, ref);
      refToId.set(ref, v.id);
    }
    if (!verses || verses.length < pageSize) break;
  }
  return { idToRef, refToId };
}

async function main() {
  console.log("Building verse reference maps…");
  const [srcMaps, dstMaps] = await Promise.all([verseRefMaps(src), verseRefMaps(dst)]);
  console.log(`  source verses: ${srcMaps.idToRef.size}, target verses: ${dstMaps.refToId.size}`);

  const remapIds = (ids: string[] | null): string[] => {
    if (!ids) return [];
    const out: string[] = [];
    for (const id of ids) {
      const ref = srcMaps.idToRef.get(id);
      const mapped = ref ? dstMaps.refToId.get(ref) : undefined;
      if (mapped) out.push(mapped);
    }
    return out;
  };

  // table -> columns holding uuid[] verse refs
  const tables: { name: string; verseArrayCols: string[]; conflict: string }[] = [
    { name: "characters", verseArrayCols: ["key_verse_ids"], conflict: "slug" },
    { name: "lessons", verseArrayCols: ["key_verse_ids"], conflict: "slug" },
    { name: "blog_posts", verseArrayCols: [], conflict: "slug" },
    { name: "podcast_episodes", verseArrayCols: [], conflict: "slug" },
    { name: "questions", verseArrayCols: [], conflict: "slug" },
  ];

  for (const t of tables) {
    const { data: rows, error } = await src.from(t.name).select("*");
    if (error) throw error;
    if (!rows?.length) {
      console.log(`${t.name}: nothing to copy`);
      continue;
    }
    const prepared = rows.map((r) => {
      const row: Record<string, unknown> = { ...r };
      delete row.id; // let target mint its own ids
      // author/user references don't exist on the target project
      delete row.author_id;
      delete row.user_id;
      delete row.answered_by;
      for (const col of t.verseArrayCols) {
        row[col] = remapIds(r[col] as string[] | null);
      }
      return row;
    });
    const { error: upErr } = await dst
      .from(t.name)
      .upsert(prepared, { onConflict: t.conflict });
    if (upErr) throw new Error(`${t.name}: ${upErr.message}`);
    console.log(`${t.name}: copied ${prepared.length} rows`);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error("Transfer failed:", e);
  process.exit(1);
});
