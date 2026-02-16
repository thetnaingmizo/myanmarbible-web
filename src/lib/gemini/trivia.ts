import { genai, CHAT_MODEL } from "./client";
import { Type } from "@google/genai";
import type { Difficulty, Category } from "@/lib/trivia/types";

// ---------------------------------------------------------------------------
// Types for raw Gemini output
// ---------------------------------------------------------------------------

interface GeminiTriviaQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  verse_reference: string;
}

// ---------------------------------------------------------------------------
// Prompt building
// ---------------------------------------------------------------------------

const DIFFICULTY_GUIDELINES: Record<Difficulty, string> = {
  easy: `Generate EASY questions about well-known Bible stories, famous characters, and popular verses that most people with basic Bible knowledge would know.
Examples: Creation story, Noah's Ark, David and Goliath, the Ten Commandments, Jesus's birth, the Last Supper.`,
  medium: `Generate MEDIUM difficulty questions that require moderate Bible knowledge. Include questions about less common stories, supporting characters, and specific details from well-known passages.
Examples: Names of the 12 tribes, specific miracles of Jesus, details from Paul's journeys, specific Psalms.`,
  hard: `Generate HARD questions about obscure details, minor characters, specific numbers/dates, and deep theological concepts that only avid Bible readers would know.
Examples: Specific genealogies, minor prophets, exact quotes, chronological details, Hebrew/Greek word meanings.`,
};

const CATEGORY_INSTRUCTIONS: Record<Category, string> = {
  all: "Questions can come from any part of the Bible.",
  "old-testament":
    "All questions must come from the Old Testament (Genesis through Malachi).",
  "new-testament":
    "All questions must come from the New Testament (Matthew through Revelation).",
  gospels:
    "All questions must come from the four Gospels (Matthew, Mark, Luke, John).",
  genesis: "All questions must come from the book of Genesis.",
  "psalms-proverbs":
    "All questions must come from Psalms or Proverbs.",
  prophets:
    "All questions must come from the prophetic books (Isaiah through Malachi).",
  "acts-epistles":
    "All questions must come from Acts and the Epistles (Acts through Jude).",
};

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  auto: "Generate the questions in English.",
  en: "Generate all questions, options, and explanations in English.",
  my: "Generate all questions, options, and explanations in Myanmar (Burmese) language. Use proper Myanmar Unicode script. Verse references can remain in English format (e.g., Genesis 1:1).",
};

function buildPrompt(
  difficulty: Difficulty,
  category: Category,
  language: string
): string {
  const langInstruction =
    LANGUAGE_INSTRUCTIONS[language] || LANGUAGE_INSTRUCTIONS.auto;

  return `You are a Bible trivia question generator. Generate exactly 10 multiple-choice Bible trivia questions.

${DIFFICULTY_GUIDELINES[difficulty]}

${CATEGORY_INSTRUCTIONS[category]}

${langInstruction}

Rules:
- Each question must have exactly 4 answer options
- correct_index must be 0, 1, 2, or 3 indicating the correct option
- Include a brief explanation for the correct answer
- Include a Bible verse reference for each question
- Make questions engaging and educational
- Randomize the position of correct answers across questions
- Do NOT repeat similar questions`;
}

// ---------------------------------------------------------------------------
// JSON schema for structured output
// ---------------------------------------------------------------------------

const triviaResponseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      question: { type: Type.STRING, description: "The trivia question" },
      options: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Exactly 4 answer options",
      },
      correct_index: {
        type: Type.INTEGER,
        description: "Index (0-3) of the correct answer",
      },
      explanation: {
        type: Type.STRING,
        description: "Brief explanation of the correct answer",
      },
      verse_reference: {
        type: Type.STRING,
        description: "Bible verse reference (e.g., Genesis 1:1)",
      },
    },
    required: [
      "question",
      "options",
      "correct_index",
      "explanation",
      "verse_reference",
    ],
  },
};

// ---------------------------------------------------------------------------
// Main generation function
// ---------------------------------------------------------------------------

export interface GeneratedQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  verseReference: string;
}

export async function generateTriviaQuestions(options: {
  difficulty: Difficulty;
  category: Category;
  language: string;
}): Promise<GeneratedQuestion[]> {
  const { difficulty, category, language } = options;

  const prompt = buildPrompt(difficulty, category, language);

  const response = await genai.models.generateContent({
    model: CHAT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: triviaResponseSchema,
      temperature: 0.9,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Empty response from Gemini");
  }

  const raw: GeminiTriviaQuestion[] = JSON.parse(text);

  // Validate
  if (!Array.isArray(raw) || raw.length < 10) {
    throw new Error(
      `Expected 10 questions, got ${Array.isArray(raw) ? raw.length : 0}`
    );
  }

  // Take exactly 10 and validate each
  return raw.slice(0, 10).map((q, i) => {
    if (!q.options || q.options.length !== 4) {
      throw new Error(`Question ${i + 1} does not have exactly 4 options`);
    }
    if (q.correct_index < 0 || q.correct_index > 3) {
      throw new Error(
        `Question ${i + 1} has invalid correct_index: ${q.correct_index}`
      );
    }

    return {
      question: q.question,
      options: q.options,
      correctIndex: q.correct_index,
      explanation: q.explanation,
      verseReference: q.verse_reference,
    };
  });
}
