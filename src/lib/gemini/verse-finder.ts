import { genai, CHAT_MODEL } from "./client";
import {
  retrieveVerses,
  formatVersesAsContext,
  type RetrievedVerse,
} from "@/lib/rag/retriever";

const SYSTEM_PROMPT_BASE = `You are a Bible verse finder for MyanmarBible AI.
Given the user's topic or query and the retrieved Bible verses below, write a concise explanation that connects these verses to the query.

Guidelines:
- Group related verses together if appropriate.
- Use markdown formatting: **bold** for verse references, bullet points for grouping.
- Keep explanations brief and focused — 2-4 short paragraphs maximum.
- Be warm, encouraging, and pastoral in tone.
- Do not make up or fabricate Bible verses. Only reference the verses provided.
- Highlight key themes and how they relate to the user's search topic.`;

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  auto: "You can respond in both English and Myanmar (Burmese). Match the language the user writes in.",
  en: "IMPORTANT: Always respond in English, regardless of the input language.",
  my: "IMPORTANT: Always respond in Myanmar (Burmese), regardless of the input language.",
};

function buildSystemPrompt(
  responseLanguage: string,
  verseContext: string
): string {
  const langInstruction =
    LANGUAGE_INSTRUCTIONS[responseLanguage] || LANGUAGE_INSTRUCTIONS.auto;
  const contextBlock = verseContext
    ? `\n\nRelevant Bible verses:\n${verseContext}`
    : "";
  return `${SYSTEM_PROMPT_BASE}\n\n${langInstruction}${contextBlock}`;
}

export interface VerseFinderResult {
  stream: AsyncGenerator<string>;
  verses: RetrievedVerse[];
}

/**
 * Find Bible verses relevant to a query and generate a streaming explanation.
 * Uses single-turn generation (not chat history).
 */
export async function findVersesWithExplanation(
  query: string,
  options: { responseLanguage?: "auto" | "en" | "my" } = {}
): Promise<VerseFinderResult> {
  const responseLanguage = options.responseLanguage || "auto";

  // 1. Retrieve relevant verses (more than chat — 12 results)
  const ragLanguage = responseLanguage !== "auto" ? responseLanguage : undefined;
  const verses = await retrieveVerses(query, {
    matchCount: 12,
    matchThreshold: 0.3,
    language: ragLanguage,
  });

  // 2. Build context
  const verseContext = formatVersesAsContext(verses);
  const systemPrompt = buildSystemPrompt(responseLanguage, verseContext);

  // 3. Single-turn streaming generation
  const streamResult = await genai.models.generateContentStream({
    model: CHAT_MODEL,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 1536,
    },
    contents: query,
  });

  // 4. Create async generator
  async function* textStream(): AsyncGenerator<string> {
    for await (const chunk of streamResult) {
      const text = chunk.text;
      if (text) {
        yield text;
      }
    }
  }

  return {
    stream: textStream(),
    verses,
  };
}
