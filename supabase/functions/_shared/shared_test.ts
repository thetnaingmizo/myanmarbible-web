/// <reference lib="deno.ns" />
import { assertEquals } from "jsr:@std/assert@1";
import { citedIndexes, isRunaway, stripInvalidCitations } from "./citations.ts";
import { ReferenceParser } from "./reference.ts";
import { isCrisis } from "./safety.ts";

const books = [
  { number: 1, chapterCount: 50, names: ["Genesis", "ကမ္ဘာ​ဦး​ကျမ်း", "Gen", "ကမ္ဘာ​ဦး"] },
  { number: 19, chapterCount: 150, names: ["Psalms", "ဆာ​လံ​ကျမ်း", "Psa", "ဆာ​လံ"] },
  { number: 43, chapterCount: 21, names: ["John", "ရှင်ယောဟန်", "Jhn", "ရှင်ယောဟန်"] },
  { number: 62, chapterCount: 5, names: ["1 John", "ယောဟန်ဩဝါဒစာပထမစောင်", "1Jn", "၁ ယော"] },
];
const p = new ReferenceParser(books);
const s = (q: string) => {
  const r = p.parse(q);
  return r ? `${r.book.number} ${r.chapter}:${r.verse ?? "-"}` : null;
};

Deno.test("references in Burmese and English", () => {
  assertEquals(s("ယော ၃:၁၆"), "43 3:16");
  assertEquals(s("John 3:16"), "43 3:16");
  assertEquals(s("jn3.16"), "43 3:16");
  assertEquals(s("ဆာလံ ၂၃"), "19 23:-");
  assertEquals(s("၁ယော ၄:၈"), "62 4:8");
  assertEquals(s("ps 151"), null);
  assertEquals(s("What does John 3:16 mean?"), null);
  assertEquals(s("Genesis"), null);
});

Deno.test("citations: only provided verses survive", () => {
  const text = "God loves the world [V1] and gives life [V3][V9].";
  assertEquals(citedIndexes(text, 8), [1, 3]);
  assertEquals(stripInvalidCitations(text, 8), "God loves the world [V1] and gives life [V3].");
});

Deno.test("runaway output is detected", () => {
  assertEquals(isRunaway("a normal answer that ends well."), false);
  assertEquals(isRunaway("x".repeat(20) + "The same sentence again. ".repeat(10)), true);
});

Deno.test("crisis messages are caught in both languages, ordinary ones are not", () => {
  assertEquals(isCrisis("I want to die"), true);
  assertEquals(isCrisis("I keep thinking about suicide"), true);
  assertEquals(isCrisis("ကျွန်တော် သေ​ချင်တယ်"), true);
  assertEquals(isCrisis("ကိုယ့်ကိုယ်ကို သတ်ချင်တယ်"), true);
  assertEquals(isCrisis("What did Jesus say about dying to self?"), false);
  assertEquals(isCrisis("ဘုရားသခင်သည် ချစ်ခြင်းမေတ္တာ ဖြစ်သည်"), false);
});
