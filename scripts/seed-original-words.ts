#!/usr/bin/env npx tsx
/**
 * Seed original-language word study data (3.0 M17, A04)
 * ======================================================
 *
 * Source: STEPBible Data (https://github.com/STEPBible/STEPBible-Data), CC BY 4.0:
 *   TAGNT  — Translators Amalgamated Greek NT (tagged words)
 *   TAHOT  — Translators Amalgamated Hebrew OT (tagged words)
 *   TBESG / TBESH — brief lexicons keyed by extended Strong's numbers
 * Attribution shown in the app: "STEPBible.org (CC BY 4.0) · Strong's (public domain)".
 *
 * The raw files are large and not in git: put them in data/stepbible/ as
 *   TAGNT_Mat-Jhn.txt TAGNT_Act-Rev.txt TAHOT_Gen-Deu.txt TAHOT_Jos-Est.txt
 *   TAHOT_Job-Sng.txt TAHOT_Isa-Mal.txt TBESG_-.txt TBESH_-.txt
 * (raw.githubusercontent.com/STEPBible/STEPBible-Data/master/…).
 *
 * Replaces the rows in `lexicon` and `original_words` (keeps Burmese glosses
 * already drafted or reviewed). Loads with psql \copy.
 *
 * Usage:
 *   npx tsx scripts/seed-original-words.ts                 # local stack (supabase status)
 *   npx tsx scripts/seed-original-words.ts --db-url <url>  # another database
 *   npx tsx scripts/seed-original-words.ts --parse-only    # write CSVs, don't load
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(root, "data/stepbible");
const outDir = resolve(dataDir, "out");

// STEPBible book abbreviations in canonical order → book_number 1..66.
const BOOKS = (
  "Gen Exo Lev Num Deu Jos Jdg Rut 1Sa 2Sa 1Ki 2Ki 1Ch 2Ch Ezr Neh Est Job Psa Pro Ecc Sng Isa Jer Lam Ezk Dan " +
  "Hos Jol Amo Oba Jon Mic Nam Hab Zep Hag Zec Mal Mat Mrk Luk Jhn Act Rom 1Co 2Co Gal Eph Php Col 1Th 2Th 1Ti " +
  "2Ti Tit Phm Heb Jas 1Pe 2Pe 1Jn 2Jn 3Jn Jud Rev"
).split(" ");
const bookNumber = new Map(BOOKS.map((b, i) => [b, i + 1]));

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const csv = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Lexicon HTML → short plain text. */
function plain(html: string, max = 700): string {
  const text = html
    .replace(/<br\s*\/?>/gi, "; ")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .replace(/(;\s*)+/g, "; ")
    .replace(/^[;\s]+|[;\s]+$/g, "");
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

type Lex = { strong: string; lemma: string; translit: string; pos: string; gloss: string; definition: string };

function parseLexicon(file: string): Lex[] {
  const out: Lex[] = [];
  for (const line of readFileSync(resolve(dataDir, file), "utf-8").split("\n")) {
    if (!/^[GH]\d/.test(line)) continue;
    const c = line.split("\t");
    const strong = c[1]?.trim().split(/\s+/)[0];
    if (!strong || !/^[GH]\d{4}[A-Za-z]?$/.test(strong)) continue;
    out.push({
      strong,
      // A few name entries have no lemma; show the transliteration instead.
      lemma: (c[3] ?? "").trim() || (c[4] ?? "").trim() || strong,
      translit: (c[4] ?? "").trim(),
      pos: (c[5] ?? "").trim(),
      gloss: (c[6] ?? "").trim(),
      definition: plain(c[7] ?? ""),
    });
  }
  return out;
}

type Word = {
  book: number;
  chapter: number;
  verse: number;
  position: number;
  word: string;
  translit: string;
  gloss: string;
  strong: string | null;
  morph: string;
};

// "Jhn.3.16#13=NKO" or "Gen.31.55(32.1)#01=L" — English versification first.
const REF = /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)(?:\([^)]*\))?#(\d+)/;
const unknownBooks = new Set<string>();

function ref(col: string) {
  const m = REF.exec(col);
  if (!m) return null;
  const book = bookNumber.get(m[1]);
  if (!book) {
    unknownBooks.add(m[1]);
    return null;
  }
  return { book, chapter: +m[2], verse: +m[3], position: +m[4] };
}

function parseGreek(file: string): Word[] {
  const out: Word[] = [];
  for (const line of readFileSync(resolve(dataDir, file), "utf-8").split("\n")) {
    const c = line.split("\t");
    const r = ref(c[0] ?? "");
    if (!r) continue;
    // "μονογενῆ (monogenē)"
    const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec((c[1] ?? "").trim());
    const [strongPart, morph = ""] = (c[3] ?? "").split("=");
    out.push({
      ...r,
      word: (m ? m[1] : c[1] ?? "").trim(),
      translit: m ? m[2].trim() : "",
      gloss: (c[2] ?? "").trim(),
      strong: /^G\d{4}[A-Za-z]?$/.test(strongPart.trim()) ? strongPart.trim() : null,
      morph: morph.trim(),
    });
  }
  return out;
}

function parseHebrew(file: string): Word[] {
  const out: Word[] = [];
  for (const line of readFileSync(resolve(dataDir, file), "utf-8").split("\n")) {
    const c = line.split("\t");
    const r = ref(c[0] ?? "");
    if (!r) continue;
    // Main word inside braces: "H9003/{H7225G}"; prefixes/suffixes around it.
    const main = /\{(H\d{4}[A-Za-z]?)\}/.exec(c[4] ?? "");
    // Empty placeholders mark words read but not written (qere without ketiv).
    if (!(c[1] ?? "").replace(/[/\s]/g, "")) continue;
    out.push({
      ...r,
      word: (c[1] ?? "").replace(/[/\\]/g, "").trim(), // "/" splits morphemes, "\" precedes sof pasuq
      translit: (c[2] ?? "").replace(/\//g, "").trim(),
      gloss: (c[3] ?? "").replace(/\/\s*/g, " ").replace(/\s+/g, " ").trim(),
      strong: main ? main[1] : null,
      morph: (c[5] ?? "").trim(),
    });
  }
  return out;
}

function main() {
  mkdirSync(outDir, { recursive: true });
  const lexicon = new Map<string, Lex>();
  for (const f of ["TBESG_-.txt", "TBESH_-.txt"]) {
    for (const l of parseLexicon(f)) if (!lexicon.has(l.strong)) lexicon.set(l.strong, l);
  }

  const words = new Map<string, Word>(); // one row per verse position (first reading wins)
  for (const f of ["TAGNT_Mat-Jhn.txt", "TAGNT_Act-Rev.txt"]) {
    for (const w of parseGreek(f)) words.set(`${w.book}.${w.chapter}.${w.verse}.${w.position}`, words.get(`${w.book}.${w.chapter}.${w.verse}.${w.position}`) ?? w);
  }
  for (const f of ["TAHOT_Gen-Deu.txt", "TAHOT_Jos-Est.txt", "TAHOT_Job-Sng.txt", "TAHOT_Isa-Mal.txt"]) {
    for (const w of parseHebrew(f)) words.set(`${w.book}.${w.chapter}.${w.verse}.${w.position}`, words.get(`${w.book}.${w.chapter}.${w.verse}.${w.position}`) ?? w);
  }
  if (unknownBooks.size) throw new Error(`Unknown book abbreviations: ${[...unknownBooks].join(", ")}`);

  const books = new Set([...words.values()].map((w) => w.book));
  const unlinked = [...words.values()].filter((w) => w.strong && !lexicon.has(w.strong)).length;
  console.log(`Lexicon: ${lexicon.size} entries · words: ${words.size} in ${books.size} books · ${unlinked} words without a lexicon entry`);

  writeFileSync(
    resolve(outDir, "lexicon.csv"),
    [...lexicon.values()].map((l) => [l.strong, l.lemma, l.translit, l.pos, l.gloss, l.definition].map(csv).join(",")).join("\n") + "\n",
  );
  writeFileSync(
    resolve(outDir, "words.csv"),
    [...words.values()]
      .map((w) => [w.book, w.chapter, w.verse, w.position, w.word, w.translit, w.gloss, w.strong, w.morph].map(csv).join(","))
      .join("\n") + "\n",
  );
  if (process.argv.includes("--parse-only")) return;

  let dbUrl = arg("db-url") ?? process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    const env = execFileSync("npx", ["supabase", "status", "-o", "env"], { cwd: root, encoding: "utf-8" });
    dbUrl = /^DB_URL="?([^"\n]+)"?/m.exec(env)?.[1];
  }
  if (!dbUrl) throw new Error("No database URL (pass --db-url or run the local stack)");
  if (!/127\.0\.0\.1|localhost/.test(dbUrl) && !process.argv.includes("--remote")) {
    throw new Error("Refusing to load into a non-local database without --remote");
  }

  const sql = `
begin;
create temp table lex_in (strong text, lemma text, translit text, pos text, gloss text, definition text);
\\copy lex_in from '${resolve(outDir, "lexicon.csv")}' with (format csv)
insert into public.lexicon (strong, lemma, translit, pos, gloss, definition)
  select strong, lemma, translit, pos, gloss, definition from lex_in
  on conflict (strong) do update set lemma = excluded.lemma, translit = excluded.translit, pos = excluded.pos,
    gloss = excluded.gloss, definition = excluded.definition;
truncate public.original_words;
\\copy public.original_words (book_number, chapter_number, verse_number, position, word, translit, gloss, strong, morph) from '${resolve(outDir, "words.csv")}' with (format csv)
commit;
select (select count(*) from public.lexicon) as lexicon, (select count(*) from public.original_words) as words;
`;
  const out = execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-q", "-A", "-t"], { input: sql, encoding: "utf-8" });
  console.log(`Loaded: ${out.trim()}`);
}

main();
