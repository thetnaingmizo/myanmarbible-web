"use client";

import { FunctionsHttpError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// Calls the shared `ai-study` edge function (same caps, quota and caches as
// the app). Returns the function's error code on failure.
export type StudyError =
  | "unauthorized"
  | "daily_limit"
  | "global_cap"
  | "ai_disabled"
  | "not_found"
  | "generation_failed"
  | "server_error"
  | "bad_request";

const KNOWN: StudyError[] = ["unauthorized", "daily_limit", "global_cap", "ai_disabled", "not_found", "generation_failed", "server_error", "bad_request"];

export async function studyCall<T>(body: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; error: StudyError }> {
  const { data, error } = await createClient().functions.invoke("ai-study", { body });
  if (!error) return { ok: true, data: data as T };
  let code: string | undefined;
  if (error instanceof FunctionsHttpError) {
    try {
      code = (await error.context.json())?.error;
    } catch {}
  }
  if (code === "not_signed_in") code = "unauthorized";
  return { ok: false, error: KNOWN.includes(code as StudyError) ? (code as StudyError) : "server_error" };
}
