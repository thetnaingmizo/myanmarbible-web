/**
 * Format a verse for sharing: "text — reference"
 */
function formatVerse(text: string, reference: string): string {
  return `${text.trim()} — ${reference}`;
}

/**
 * Copy verse text to clipboard.
 * Returns true if successful.
 */
export async function copyVerseToClipboard(
  text: string,
  reference: string
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(formatVerse(text, reference));
    return true;
  } catch {
    return false;
  }
}

/**
 * Share verse using Web Share API if available, otherwise copy to clipboard.
 * Returns true if successful.
 */
export async function shareVerse(
  text: string,
  reference: string
): Promise<boolean> {
  const formatted = formatVerse(text, reference);

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: reference,
        text: formatted,
      });
      return true;
    } catch (err) {
      // User cancelled or share failed — fall back to clipboard
      if (err instanceof Error && err.name === "AbortError") {
        return false;
      }
    }
  }

  return copyVerseToClipboard(text, reference);
}
