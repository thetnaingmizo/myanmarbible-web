"use client";

import { useSyncExternalStore } from "react";

// Reader display settings, kept in this browser (like the app keeps them on
// the phone). Server render uses the defaults.

export type ReaderTheme = "auto" | "paper" | "sepia" | "night" | "black" | "contrast";
export type Spacing = "compact" | "normal" | "relaxed";

export type ReaderSettings = {
  theme: ReaderTheme;
  /** Steps from the default size, -3..+5 (2px each). */
  size: number;
  spacing: Spacing;
  paragraphs: boolean;
  numbers: boolean;
};

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: "auto",
  size: 0,
  spacing: "normal",
  paragraphs: true,
  numbers: true,
};

const KEY = "mb.reader";
const listeners = new Set<() => void>();
let current: ReaderSettings | null = null;

function read(): ReaderSettings {
  if (current) return current;
  try {
    const raw = localStorage.getItem(KEY);
    current = { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    current = DEFAULT_SETTINGS;
  }
  return current!;
}

export function updateReaderSettings(patch: Partial<ReaderSettings>) {
  current = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Private mode or blocked storage: keep the change for this visit only.
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useReaderSettings(): ReaderSettings {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_SETTINGS);
}

/** Font size and line height for a script: the app's defaults are Burmese 18/1.9, Latin 18/1.65. */
export function textMetrics(s: ReaderSettings, burmese: boolean) {
  const size = 18 + s.size * 2;
  const base = burmese ? 1.9 : 1.65;
  const lineHeight = base + (s.spacing === "compact" ? -0.25 : s.spacing === "relaxed" ? 0.3 : 0);
  return { fontSize: `${size}px`, lineHeight };
}

// --- Last place read (shown as "Continue reading"; Today uses it too). ---

export type LastRead = { bookId: string; chapter: number; label: string; at: number };
const LAST = "mb.lastRead";

export function saveLastRead(v: LastRead) {
  try {
    localStorage.setItem(LAST, JSON.stringify(v));
  } catch {}
}

let lastRaw: string | null = null;
let lastParsed: LastRead | null = null;

/** Stable snapshot for useSyncExternalStore (same object while unchanged). */
export function lastReadSnapshot(): LastRead | null {
  try {
    const raw = localStorage.getItem(LAST);
    if (raw !== lastRaw) {
      lastRaw = raw;
      lastParsed = raw ? (JSON.parse(raw) as LastRead) : null;
    }
    return lastParsed;
  } catch {
    return null;
  }
}
