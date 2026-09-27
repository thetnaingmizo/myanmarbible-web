// Run: npm test  (Node's built-in runner; Node strips the types)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanVerseText,
  foldJoinedVerses,
  formatVerseRanges,
  groupParagraphs,
  shortBurmeseBookName,
  toAsciiDigits,
  verseLabel,
} from "./reader-text.ts";
import { ReferenceParser, type BookRef } from "./reference.ts";

test("verse labels: merged, joined and Myanmar digits", () => {
  assert.equal(verseLabel(6, { nextNumber: 8, burmese: false }), "6–7");
  assert.equal(verseLabel(6, { nextNumber: 8, burmese: true }), "၆–၇");
  assert.equal(verseLabel(3, { nextNumber: 4, burmese: true }), "၃");
  assert.equal(verseLabel(35, { through: 36, burmese: true }), "၃၅–၃၆");
});

test("joined verses fold into the verse before", () => {
  const r = foldJoinedVerses([[34, "a"], [35, "b"], [36, ""]] as [number, string][], (v) => v[1], (v) => v[0]);
  assert.deepEqual(r.shown.map((v) => v[0]), [34, 35]);
  assert.deepEqual([...r.through], [[35, 36]]);
});

test("paragraphs follow Burmese dashes and KJV pilcrows", () => {
  assert.deepEqual(groupParagraphs(["a၊-", "b။", "c၊-", "d။"], true), [[0, 1], [2, 3]]);
  assert.deepEqual(groupParagraphs(["¶ a.", "b.", "¶ c."], true), [[0, 1], [2]]);
  assert.deepEqual(groupParagraphs(["a", "b"], false), [[0], [1]]);
});

test("text helpers", () => {
  assert.equal(cleanVerseText("¶ And God said", false), "And God said");
  assert.equal(cleanVerseText("…အခါ၊-", true), "…အခါ၊");
  assert.equal(formatVerseRanges([3, 4, 5, 7], false), "3–5, 7");
  assert.equal(toAsciiDigits("၃:၁၆"), "3:16");
  assert.equal(shortBurmeseBookName("ရှင်ယောဟန်ခရစ်ဝင်ကျမ်း"), "ယောဟန်ခရစ်ဝင်");
});

const books: BookRef[] = [
  { number: 19, chapterCount: 150, names: ["Psalms", "ဆာလံကျမ်း", "Ps"] },
  { number: 43, chapterCount: 21, names: ["John", "ရှင်ယောဟန်ခရစ်ဝင်", "Jn"] },
  { number: 46, chapterCount: 16, names: ["1 Corinthians", "ကောရိန္သုဩဝါဒစာပထမစောင်", "1 Cor"] },
  { number: 62, chapterCount: 5, names: ["1 John", "ယောဟန်ဩဝါဒစာပထမစောင်", "1 Jn"] },
];
const parser = new ReferenceParser(books);

test("references in English and Burmese", () => {
  const p = (s: string) => {
    const r = parser.parse(s);
    return r ? `${r.book.number} ${r.chapter}:${r.verse ?? "-"}` : null;
  };
  assert.equal(p("John 3:16"), "43 3:16");
  assert.equal(p("jn3.16"), "43 3:16");
  assert.equal(p("ယော ၃:၁၆"), "43 3:16");
  assert.equal(p("ဆာလံ ၂၃"), "19 23:-");
  assert.equal(p("1 cor 13"), "46 13:-");
  assert.equal(p("1jn 1:9"), "62 1:9");
  assert.equal(p("john 30"), null);
  assert.equal(p("psalms"), "19 1:-");
});
