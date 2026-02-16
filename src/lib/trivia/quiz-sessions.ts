/**
 * Server-side in-memory quiz session store.
 * Stores correct answers so they're never sent to the client.
 */

interface QuizSession {
  userId: string;
  difficulty: string;
  category: string | null;
  correctAnswers: number[];
  explanations: string[];
  verseReferences: string[];
  createdAt: number;
}

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

const sessions = new Map<string, QuizSession>();

/** Remove expired sessions */
function cleanup() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

// Cleanup every 5 minutes
let cleanupInterval: ReturnType<typeof setInterval> | null = null;
function ensureCleanup() {
  if (!cleanupInterval) {
    cleanupInterval = setInterval(cleanup, 5 * 60 * 1000);
    // Allow process to exit without waiting for this timer
    if (typeof cleanupInterval === "object" && "unref" in cleanupInterval) {
      cleanupInterval.unref();
    }
  }
}

export function storeSession(quizId: string, session: QuizSession) {
  ensureCleanup();
  sessions.set(quizId, session);
}

export function getSession(quizId: string): QuizSession | undefined {
  const session = sessions.get(quizId);
  if (!session) return undefined;

  // Check expiry
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(quizId);
    return undefined;
  }

  return session;
}

export function deleteSession(quizId: string) {
  sessions.delete(quizId);
}
