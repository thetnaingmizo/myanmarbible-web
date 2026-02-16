/**
 * Parse a USFX XML file into structured book/chapter/verse data.
 *
 * USFX (Unified Scripture Format XML) structure:
 *
 *   <usfx>
 *     <book id="GEN">
 *       <c id="1"/>
 *       <p> ... <v id="1"/> verse text ... <v id="2"/> verse text ... </p>
 *       ...
 *     </book>
 *   </usfx>
 *
 * Key elements:
 *   - <book id="GEN">  : book container, id = 3-letter USFX book code
 *   - <c id="1">       : chapter milestone, id = chapter number
 *   - <v id="1">       : verse start milestone, id = verse number
 *   - <ve/>            : verse end milestone (optional, not always present)
 *   - <p>, <q>, <d>    : paragraph/poetry/description containers (contain text)
 *   - <f>, <x>         : footnotes/cross-refs (we skip these)
 *   - <wj>             : words of Jesus (we include the text inside)
 *   - <add>, <nd>, <it>: character styles (we include the text inside)
 */

import fsp from "node:fs/promises";
import { findBookByUsfxId, IGNORED_USFX_BOOK_IDS, type BookMeta } from "./config.js";

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface ParsedVerse {
  bookNumber: number;
  usfxBookId: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface ParsedBook {
  meta: BookMeta;
  /** Maximum chapter number found in the parsed data */
  maxChapter: number;
  verses: ParsedVerse[];
}

export interface ParseResult {
  books: ParsedBook[];
  totalVerses: number;
}

// ---------------------------------------------------------------------------
// Lightweight SAX-style parser using regex
// ---------------------------------------------------------------------------

/**
 * Tags whose text content we want to SKIP (footnotes, cross-refs, etc.)
 */
const SKIP_TAGS = new Set(["f", "x", "fe", "ef", "ex"]);

/**
 * Tags that are inline character styles -- we include their text content.
 */
const INLINE_TAGS = new Set([
  "wj", "add", "nd", "it", "bd", "sc", "tl", "qt", "em", "bdit",
  "no", "k", "pn", "qs", "qac", "sls", "ord", "rq",
]);

/**
 * Parse a USFX XML file and return structured verse data.
 *
 * Uses a streaming regex-based approach to avoid loading a full DOM
 * (USFX files can be 10+ MB).
 */
export async function parseUsfxFile(xmlPath: string): Promise<ParseResult> {
  console.log(`  Parsing ${xmlPath} ...`);

  const xml = await fsp.readFile(xmlPath, "utf-8");

  const books: ParsedBook[] = [];
  let currentBookId: string | null = null;
  let currentBookMeta: BookMeta | undefined;
  let currentChapter = 0;
  let currentVerse = 0;
  let currentText = "";
  let skipDepth = 0; // depth inside skip tags (footnotes etc.)
  let verses: ParsedVerse[] = [];

  // We use a simple token-based parser that processes the XML sequentially.
  // This handles the USFX format reliably without needing a full XML parser dependency.

  // Regex to match XML tokens: tags (open/close/self-closing) and text nodes
  const tokenRegex = /<\/?([a-zA-Z0-9]+)([^>]*?)(\/?)>|([^<]+)/g;
  let match: RegExpExecArray | null;

  function flushVerse(): void {
    if (currentBookMeta && currentChapter > 0 && currentVerse > 0) {
      const text = currentText.replace(/\s+/g, " ").trim();
      if (text) {
        verses.push({
          bookNumber: currentBookMeta.bookNumber,
          usfxBookId: currentBookMeta.usfxId,
          chapter: currentChapter,
          verse: currentVerse,
          text,
        });
      }
    }
    currentText = "";
  }

  function flushBook(): void {
    flushVerse();
    if (currentBookMeta && verses.length > 0) {
      const maxChapter = Math.max(...verses.map((v) => v.chapter));
      books.push({
        meta: currentBookMeta,
        maxChapter,
        verses: [...verses],
      });
      console.log(
        `    ${currentBookMeta.nameEn}: ${verses.length} verses, ${maxChapter} chapters`
      );
    }
    verses = [];
    currentChapter = 0;
    currentVerse = 0;
    currentText = "";
  }

  while ((match = tokenRegex.exec(xml)) !== null) {
    const [, tagName, attrs, selfClose, textContent] = match;

    if (textContent !== undefined) {
      // Text node
      if (skipDepth === 0 && currentBookMeta && currentChapter > 0 && currentVerse > 0) {
        currentText += textContent;
      }
      continue;
    }

    if (!tagName) continue;

    const isClose = match[0].startsWith("</");
    const isSelfClosing = selfClose === "/";
    const tag = tagName.toLowerCase();

    // Handle skip tags (footnotes, cross-references)
    if (SKIP_TAGS.has(tag)) {
      if (isClose) {
        skipDepth = Math.max(0, skipDepth - 1);
      } else if (!isSelfClosing) {
        skipDepth++;
      }
      continue;
    }

    // While inside a skip tag, ignore everything
    if (skipDepth > 0) continue;

    // Book start/end
    if (tag === "book") {
      if (isClose) {
        flushBook();
        currentBookId = null;
        currentBookMeta = undefined;
      } else {
        // Extract id attribute: id="GEN"
        const idMatch = attrs.match(/id\s*=\s*"([^"]+)"/);
        if (idMatch) {
          currentBookId = idMatch[1];
          if (IGNORED_USFX_BOOK_IDS.has(currentBookId)) {
            currentBookMeta = undefined;
          } else {
            currentBookMeta = findBookByUsfxId(currentBookId);
            if (!currentBookMeta) {
              // Try uppercase
              currentBookMeta = findBookByUsfxId(currentBookId.toUpperCase());
            }
            if (!currentBookMeta) {
              console.warn(`    [warn] Unknown USFX book id: ${currentBookId}, skipping.`);
            }
          }
        }
      }
      continue;
    }

    // Chapter milestone
    if (tag === "c" && !isClose) {
      flushVerse();
      const idMatch = attrs.match(/id\s*=\s*"(\d+)"/);
      if (idMatch) {
        currentChapter = parseInt(idMatch[1], 10);
        currentVerse = 0;
        currentText = "";
      }
      continue;
    }

    // Verse start milestone
    if (tag === "v" && !isClose) {
      flushVerse();
      const idMatch = attrs.match(/id\s*=\s*"(\d+)"/);
      if (idMatch) {
        currentVerse = parseInt(idMatch[1], 10);
        currentText = "";
      } else {
        // Some USFX files use id="1-2" for verse ranges
        const rangeMatch = attrs.match(/id\s*=\s*"(\d+)-\d+"/);
        if (rangeMatch) {
          currentVerse = parseInt(rangeMatch[1], 10);
          currentText = "";
        }
      }
      continue;
    }

    // Verse end milestone
    if (tag === "ve") {
      flushVerse();
      currentVerse = 0;
      continue;
    }
  }

  // Flush final book if still open
  flushBook();

  const totalVerses = books.reduce((sum, b) => sum + b.verses.length, 0);
  console.log(`  Parsed ${books.length} books, ${totalVerses} total verses.`);

  return { books, totalVerses };
}
