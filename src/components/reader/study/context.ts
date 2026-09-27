import type { Bible, Book } from "@/lib/bible/data";

export type Marker = { verse_id: string; highlight: string | null; note: string | null };

/** Everything a study panel needs about the current selection. */
export type StudyContext = {
  bible: Bible;
  bibles: Bible[];
  book: Book;
  /** This Bible's books, for turning cited references into links. */
  books: Book[];
  chapter: number;
  /** Selected verse numbers, expanded over joined verses ("35–36" → 35, 36). */
  numbers: number[];
  /** The selected verses as shown (holders of joined text). */
  verses: { id: string; n: number; text: string }[];
  reference: string;
  signedIn: boolean;
  locale: string;
  markers: Record<string, Marker>;
};

export type StudyMode = "explain" | "compare" | "original" | "note" | "report";
