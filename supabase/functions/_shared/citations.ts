// The model cites retrieved verses as [V1]..[Vn]; it never quotes or
// invents Scripture. Anything it cites that we didn't give it is removed.

const CITE = /\[V(\d{1,2})\]/g;

/** Verse numbers (1-based) cited in [text] that exist in 1..available, in first-seen order. */
export function citedIndexes(text: string, available: number): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(CITE)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= available && !out.includes(n)) out.push(n);
  }
  return out;
}

/** Removes citations to verses that were not provided (e.g. [V9] of 8). */
export function stripInvalidCitations(text: string, available: number): string {
  return text.replace(CITE, (all, n) => (Number(n) >= 1 && Number(n) <= available ? all : "")).replace(/ {2,}/g, " ");
}

/** True once generated text starts looping (the same chunk 4+ times). */
export function isRunaway(text: string, chunk = 40, times = 4): boolean {
  if (text.length < chunk * times) return false;
  const tail = text.slice(-chunk);
  let count = 0;
  let from = 0;
  while ((from = text.indexOf(tail, from)) !== -1) {
    count++;
    from += chunk;
    if (count >= times) return true;
  }
  return false;
}
