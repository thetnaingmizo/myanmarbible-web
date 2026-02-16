import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { generateTriviaQuestions } from "@/lib/gemini/trivia";
import { storeSession } from "@/lib/trivia/quiz-sessions";
import type { Category, Difficulty } from "@/lib/trivia/types";
import { CATEGORIES } from "@/lib/trivia/types";

// ---------------------------------------------------------------------------
// Rate limiting (in-memory, per-user) — 10 quizzes / hour
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 10;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// ---------------------------------------------------------------------------
// POST /api/v1/trivia/generate
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError("unauthorized", "You must be logged in", 401);
  }

  // 2. Rate limit
  if (!checkRateLimit(user.id)) {
    return apiError(
      "rate_limited",
      "You have exceeded the quiz limit (10 per hour). Please try again later.",
      429
    );
  }

  // 3. Parse request body
  let difficulty: Difficulty;
  let category: Category;
  let language: string;

  try {
    const body = await request.json();
    difficulty = body.difficulty;
    category = body.category || "all";
    language = body.language || "auto";

    if (!["easy", "medium", "hard"].includes(difficulty)) {
      return apiError("invalid_input", "Invalid difficulty level", 400);
    }

    if (!CATEGORIES.includes(category)) {
      return apiError("invalid_input", "Invalid category", 400);
    }

    if (!["auto", "en", "my"].includes(language)) {
      return apiError("invalid_input", "Invalid language", 400);
    }
  } catch {
    return apiError("invalid_json", "Invalid JSON body", 400);
  }

  // 4. Generate questions via Gemini
  try {
    const questions = await generateTriviaQuestions({
      difficulty,
      category,
      language,
    });

    // 5. Generate quiz ID
    const quizId = crypto.randomUUID();

    // 6. Store session with correct answers (server-side only)
    storeSession(quizId, {
      userId: user.id,
      difficulty,
      category: category === "all" ? null : category,
      correctAnswers: questions.map((q) => q.correctIndex),
      explanations: questions.map((q) => q.explanation),
      verseReferences: questions.map((q) => q.verseReference),
      createdAt: Date.now(),
    });

    // 7. Return questions WITHOUT correct answers or explanations
    return apiSuccess({
      quizId,
      questions: questions.map((q, i) => ({
        id: i,
        question: q.question,
        options: q.options,
        verseReference: q.verseReference,
      })),
    });
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Failed to generate quiz";
    console.error("Trivia generate error:", errorMsg);
    return apiError("generation_error", errorMsg, 500);
  }
}
