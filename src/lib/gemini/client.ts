import { GoogleGenAI } from "@google/genai";

let _genai: GoogleGenAI | null = null;

function getGenai(): GoogleGenAI {
  if (!_genai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Thrown on first use, not at import time — a missing key must not
      // break `next build` (page-data collection imports API routes).
      throw new Error("Missing GEMINI_API_KEY environment variable");
    }
    _genai = new GoogleGenAI({ apiKey });
  }
  return _genai;
}

export const genai = new Proxy({} as GoogleGenAI, {
  get(_target, prop) {
    const client = getGenai() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value;
  },
});

export const CHAT_MODEL = "gemini-2.5-flash-lite";
export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;
