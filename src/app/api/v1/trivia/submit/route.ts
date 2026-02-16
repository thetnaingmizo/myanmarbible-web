import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import {
  getSession,
  deleteSession,
} from "@/lib/trivia/quiz-sessions";
import type { Difficulty } from "@/lib/trivia/types";

// ---------------------------------------------------------------------------
// POST /api/v1/trivia/submit
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

  // 2. Parse request body
  let quizId: string;
  let answers: (number | null)[];

  try {
    const body = await request.json();
    quizId = body.quizId;
    answers = body.answers;

    if (!quizId || typeof quizId !== "string") {
      return apiError("invalid_input", "quizId is required", 400);
    }

    if (!Array.isArray(answers)) {
      return apiError("invalid_input", "answers must be an array", 400);
    }
  } catch {
    return apiError("invalid_json", "Invalid JSON body", 400);
  }

  // 3. Look up session
  const session = getSession(quizId);
  if (!session) {
    return apiError(
      "quiz_expired",
      "This quiz has expired or does not exist. Please start a new one.",
      404
    );
  }

  // 4. Verify ownership
  if (session.userId !== user.id) {
    return apiError("forbidden", "This quiz does not belong to you", 403);
  }

  // 5. Compare answers and compute score
  const totalQuestions = session.correctAnswers.length;
  let score = 0;

  const results = session.correctAnswers.map((correctAnswer, i) => {
    const selectedAnswer = i < answers.length ? answers[i] : null;
    const correct = selectedAnswer === correctAnswer;
    if (correct) score++;

    return {
      questionIndex: i,
      correct,
      selectedAnswer: selectedAnswer ?? -1,
      correctAnswer,
      explanation: session.explanations[i],
      verseReference: session.verseReferences[i],
    };
  });

  // 6. Save score to database
  const { error: dbError } = await supabase.from("trivia_scores").insert({
    user_id: user.id,
    score,
    total_questions: totalQuestions,
    difficulty: session.difficulty as Difficulty,
    category: session.category,
  });

  if (dbError) {
    console.error("Failed to save trivia score:", dbError);
    // Don't fail the request — still return results
  }

  // 7. Delete session (one-time use)
  deleteSession(quizId);

  // 8. Return results
  return apiSuccess({
    score,
    totalQuestions,
    results,
  });
}
