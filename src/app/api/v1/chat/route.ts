import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chatWithRAG, type ChatMessage } from "@/lib/gemini/chat";
import { apiError } from "@/lib/api-response";
import type { RetrievedVerse } from "@/lib/rag/retriever";

// ---------------------------------------------------------------------------
// Rate limiting (in-memory, per-user)
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 50; // messages per hour

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
// Verse references for storage
// ---------------------------------------------------------------------------

/** Full verse data for DB storage (used when loading old conversations) */
function versesToDbReferences(verses: RetrievedVerse[]) {
  return verses.map((v) => ({
    verseId: v.verseId,
    book: v.bookNameEn || "Unknown",
    bookMy: v.bookNameMy || undefined,
    chapter: v.chapterNumber,
    verse: v.verseNumber,
    text: v.text.slice(0, 200),
  }));
}

/** Minimal verse IDs for SSE stream (client fetches details by ID) */
function versesToStreamReferences(verses: RetrievedVerse[]) {
  return verses.map((v) => ({ verseId: v.verseId }));
}

// ---------------------------------------------------------------------------
// POST /api/v1/chat
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError("unauthorized", "You must be logged in to chat", 401);
  }

  // 2. Rate limit
  if (!checkRateLimit(user.id)) {
    return apiError(
      "rate_limited",
      "You have exceeded the rate limit (50 messages per hour). Please try again later.",
      429
    );
  }

  // 3. Parse request body
  let message: string;
  let conversationId: string | undefined;
  let history: ChatMessage[];
  let translationId: string | undefined;
  let responseLanguage: "auto" | "en" | "my" | undefined;

  try {
    const body = await request.json();
    message = body.message;
    conversationId = body.conversationId;
    history = body.history || [];
    translationId = body.translationId;
    responseLanguage = body.responseLanguage;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return apiError("invalid_input", "Message is required", 400);
    }

    if (message.length > 2000) {
      return apiError("invalid_input", "Message must be under 2000 characters", 400);
    }
  } catch {
    return apiError("invalid_json", "Invalid JSON body", 400);
  }

  // 4. Create or get conversation
  if (!conversationId) {
    const title = message.slice(0, 100);
    const { data: conv, error: convError } = await supabase
      .from("chat_conversations")
      .insert({ user_id: user.id, title })
      .select("id")
      .single();

    if (convError) {
      return apiError("db_error", "Failed to create conversation", 500);
    }
    conversationId = conv.id;
  }

  // 5. Save user message
  await supabase.from("chat_messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: message,
  });

  // 6. Generate streaming response with RAG
  try {
    const { stream, verses } = await chatWithRAG(message, history, {
      translationId,
      responseLanguage,
    });

    // 7. Create SSE stream
    const encoder = new TextEncoder();
    let fullResponse = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send conversation ID and verse IDs (client fetches full details)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "meta", conversationId, verses: versesToStreamReferences(verses) })}\n\n`
            )
          );

          // Stream text chunks
          for await (const chunk of stream) {
            fullResponse += chunk;
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

          // Save assistant message to DB with full verse data (for history replay)
          await supabase.from("chat_messages").insert({
            conversation_id: conversationId,
            role: "assistant",
            content: fullResponse,
            verse_references: versesToDbReferences(verses),
          });
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
    const errorMsg = err instanceof Error ? err.message : "Chat error";
    console.error("Chat error:", errorMsg);
    return apiError("chat_error", errorMsg, 500);
  }
}
