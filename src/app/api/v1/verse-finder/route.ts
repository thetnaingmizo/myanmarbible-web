import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findVersesWithExplanation } from "@/lib/gemini/verse-finder";
import { apiError } from "@/lib/api-response";

// ---------------------------------------------------------------------------
// Rate limiting (in-memory, per-user) — shared window with chat
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 30; // searches per hour

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// ---------------------------------------------------------------------------
// POST /api/v1/verse-finder
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError("unauthorized", "You must be logged in to search verses", 401);
  }

  // 2. Rate limit
  if (!checkRateLimit(user.id)) {
    return apiError(
      "rate_limited",
      "You have exceeded the search limit (30 per hour). Please try again later.",
      429
    );
  }

  // 3. Parse request body
  let query: string;
  let responseLanguage: "auto" | "en" | "my" | undefined;

  try {
    const body = await request.json();
    query = body.query;
    responseLanguage = body.responseLanguage;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return apiError("invalid_input", "Search query is required", 400);
    }

    if (query.length > 500) {
      return apiError("invalid_input", "Query must be under 500 characters", 400);
    }
  } catch {
    return apiError("invalid_json", "Invalid JSON body", 400);
  }

  // 4. Find verses and generate explanation
  try {
    const { stream, verses } = await findVersesWithExplanation(query, {
      responseLanguage,
    });

    // 5. Create SSE stream
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send verse IDs (client fetches full details from Supabase)
          const verseRefs = verses.map((v) => ({ verseId: v.verseId }));
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "meta", verses: verseRefs })}\n\n`
            )
          );

          // Stream explanation text chunks
          for await (const chunk of stream) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "text", content: chunk })}\n\n`
              )
            );
          }

          // Send done signal
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
          );
        } catch (err) {
          const errorMsg =
            err instanceof Error ? err.message : "Stream error";
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", message: errorMsg })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Search error";
    console.error("Verse finder error:", errorMsg);
    return apiError("search_error", errorMsg, 500);
  }
}
