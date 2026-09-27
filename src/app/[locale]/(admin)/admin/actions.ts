"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getAdminClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("Not an admin");

  return { supabase, userId: user.id };
}

/** Update a verse's text. RLS ("Only admins can manage verses") + the
 *  updated_at trigger take care of authorization and versioning. */
export async function updateVerseText(verseId: string, text: string) {
  const { supabase } = await getAdminClient();
  const { error } = await supabase
    .from("verses")
    .update({ text })
    .eq("id", verseId);
  if (error) throw new Error(error.message);
  revalidatePath("/[locale]/(admin)/admin/bible", "page");
  revalidatePath("/[locale]/(admin)/admin/feedback", "page");
}

/** Resolve a feedback item. When `applyText` is provided, the referenced
 *  verse is updated first (which bumps its content version). */
export async function resolveFeedback(opts: {
  feedbackId: string;
  status: "applied" | "rejected";
  applyText?: string;
  verseId?: string | null;
  adminNote?: string;
}) {
  const { supabase, userId } = await getAdminClient();

  if (opts.status === "applied" && opts.applyText && opts.verseId) {
    const { error } = await supabase
      .from("verses")
      .update({ text: opts.applyText })
      .eq("id", opts.verseId);
    if (error) throw new Error(error.message);
  }

  const { error } = await supabase
    .from("verse_feedback")
    .update({
      status: opts.status,
      admin_note: opts.adminNote || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
    })
    .eq("id", opts.feedbackId);
  if (error) throw new Error(error.message);

  revalidatePath("/[locale]/(admin)/admin/feedback", "page");
}

/** Marks a report on an AI answer as handled or dismissed. */
export async function resolveAiReport(opts: { reportId: string; status: "applied" | "rejected"; adminNote?: string }) {
  const { supabase } = await getAdminClient();
  const { error } = await supabase
    .from("ai_answer_reports")
    .update({ status: opts.status, admin_note: opts.adminNote || null })
    .eq("id", opts.reportId);
  if (error) throw new Error(error.message);
  revalidatePath("/[locale]/(admin)/admin/ai-reports", "page");
}
