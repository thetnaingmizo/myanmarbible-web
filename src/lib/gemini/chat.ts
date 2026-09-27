import { ThinkingLevel } from "@google/genai";
import { genai, CHAT_MODEL } from "./client";
import {
  retrieveVerses,
  formatVersesAsContext,
  type RetrievedVerse,
} from "@/lib/rag/retriever";

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT_BASE = `You are a knowledgeable and compassionate Bible study assistant for MyanmarBible AI.
Your role is to help users understand the Bible, answer questions about Scripture, and provide spiritual guidance.

Guidelines:
- Always ground your answers in Scripture. Cite specific Bible verses when relevant.
- Be respectful of all Christian denominations and traditions.
- When you're unsure, say so honestly rather than speculating.
- Keep responses concise but thorough. Use bullet points or numbered lists for clarity when appropriate.
- When Bible verses are provided as context, use them to inform your answer and cite them.
- Do not make up or fabricate Bible verses. Only reference verses you are confident exist.
- Be warm, encouraging, and pastoral in tone.

You will be provided with relevant Bible verse context from a vector search. Use these verses to ground your response.`;

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  auto: "You can respond in both English and Myanmar (Burmese). Match the language the user writes in.",
  en: "IMPORTANT: Always respond in English, regardless of the input language.",
  my: "IMPORTANT: Always respond in Myanmar (Burmese), regardless of the input language.",
};

function buildSystemPrompt(responseLanguage: string): string {
  const langInstruction = LANGUAGE_INSTRUCTIONS[responseLanguage] || LANGUAGE_INSTRUCTIONS.auto;
  return `${SYSTEM_PROMPT_BASE}\n\n${langInstruction}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatCompletionResult {
  stream: AsyncGenerator<string>;
  verses: RetrievedVerse[];
}

// ---------------------------------------------------------------------------
// Chat completion with RAG
// ---------------------------------------------------------------------------

/**
 * Generate a streaming chat response with RAG-augmented context.
 */
export async function chatWithRAG(
  userMessage: string,
  history: ChatMessage[] = [],
  options: { translationId?: string; responseLanguage?: "auto" | "en" | "my" } = {}
): Promise<ChatCompletionResult> {
  const responseLanguage = options.responseLanguage || "auto";

  // 1. Retrieve relevant verses (filter by language when not "auto")
  const ragLanguage = responseLanguage !== "auto" ? responseLanguage : undefined;
  const verses = await retrieveVerses(userMessage, {
    matchCount: 8,
    matchThreshold: 0.3,
    translationId: options.translationId,
    language: ragLanguage,
  });

  // 2. Build context-augmented prompt
  const verseContext = formatVersesAsContext(verses);
  const contextBlock = verseContext
    ? `\n\nRelevant Bible verses for reference:\n${verseContext}`
    : "";

  // 3. Build conversation history for Gemini
  const geminiHistory = history.map((msg) => ({
    role: msg.role === "user" ? ("user" as const) : ("model" as const),
    parts: [{ text: msg.content }],
  }));

  // 4. Create chat session
  const chat = genai.chats.create({
    model: CHAT_MODEL,
    config: {
      systemInstruction: buildSystemPrompt(responseLanguage) + contextBlock,
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 2048,
      // Matches the tested setup; default thinking on 3.x adds cost and latency.
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
    history: geminiHistory,
  });

  // 5. Stream the response
  const streamResult = await chat.sendMessageStream({
    message: userMessage,
  });

  // 6. Create async generator from the stream
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
