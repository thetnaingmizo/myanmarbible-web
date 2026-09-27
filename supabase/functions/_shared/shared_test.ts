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

Deno.test("differences keep only phrases found in the verse text", async () => {
  const { validDifferences } = await import("./differ.ts");
  const texts = { kjv: "For God so loved the world, that he gave his only begotten Son", bcl: "ဘုရားသခင်သည်လောကသားတို့ကို" };
  const out = validDifferences(
    [
      { phrases: [{ code: "KJV", phrase: "The World" }, { code: "bcl", phrase: "လော​က​သား​တို့" }], note: "people vs world" },
      { phrases: [{ code: "kjv", phrase: "only begotten" }, { code: "bcl", phrase: "made up" }], note: "one side only" },
      { phrases: [{ code: "kjv", phrase: "loved" }, { code: "bcl", phrase: "ဘုရားသခင်" }], note: "" },
    ],
    texts,
  );
  assertEquals(out, [{ phrases: { kjv: "the world", bcl: "လောကသားတို့" }, note: "people vs world" }]);
  assertEquals(validDifferences("nope", texts), []);
});

Deno.test("phrases match across stray spaces in Burmese sources", async () => {
  const { locate } = await import("./differ.ts");
  const text = "ကြံဆနားလည် ရန်မ စွမ်းနိုင်သော ဘုရားသခင်";
  assertEquals(locate(text, "ရန်မစွမ်းနိုင်သော"), "ရန်မ စွမ်းနိုင်သော");
  assertEquals(locate("For God so loved", "SO  LOVED"), "so loved");
  assertEquals(locate(text, "မရှိ"), null);
});

Deno.test("study guide minutes add up to the meeting length", async () => {
  const { fitMinutes } = await import("./guide.ts");
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  assertEquals(sum(fitMinutes([5, 5, 10, 15, 5, 5], 45)), 45);
  assertEquals(sum(fitMinutes([10, 10, 10, 10, 10, 10], 30)), 30);
  assertEquals(fitMinutes([0, NaN, 3], 12).every((m) => m >= 2), true);
  assertEquals(sum(fitMinutes([1, 1, 1, 1, 1, 50], 60)), 60);
});
