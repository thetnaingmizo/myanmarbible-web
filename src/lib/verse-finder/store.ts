import { create } from "zustand";

export type ResponseLanguage = "auto" | "en" | "my";

export interface VerseResult {
  verseId: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  isBookmarked: boolean;
}

interface VerseFinderState {
  query: string;
  results: VerseResult[];
  explanation: string;
  isSearching: boolean;
  error: string | null;
  responseLanguage: ResponseLanguage;

  setQuery: (q: string) => void;
  setResults: (results: VerseResult[]) => void;
  appendExplanation: (chunk: string) => void;
  setIsSearching: (s: boolean) => void;
  setError: (e: string | null) => void;
  setResponseLanguage: (lang: ResponseLanguage) => void;
  toggleBookmark: (verseId: string) => void;
  clearResults: () => void;
}

export const useVerseFinderStore = create<VerseFinderState>((set) => ({
  query: "",
  results: [],
  explanation: "",
  isSearching: false,
  error: null,
  responseLanguage: "auto",

  setQuery: (q) => set({ query: q }),
  setResults: (results) => set({ results }),
  appendExplanation: (chunk) =>
    set((state) => ({ explanation: state.explanation + chunk })),
  setIsSearching: (s) => set({ isSearching: s }),
  setError: (e) => set({ error: e }),
  setResponseLanguage: (lang) => set({ responseLanguage: lang }),
  toggleBookmark: (verseId) =>
    set((state) => ({
      results: state.results.map((r) =>
        r.verseId === verseId ? { ...r, isBookmarked: !r.isBookmarked } : r
      ),
    })),
  clearResults: () => set({ results: [], explanation: "", error: null }),
}));
