"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "./redirect";

// Sign-in is Google or a 6-digit email code only (founder rule: no
// passwords, no magic links, no phone).

type Result = { error: "invalidEmail" | "tooMany" | "failed" | "invalidCode" } | { ok: true };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function appUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/** Emails a 6-digit code (the templates contain only the code, no link). */
export async function sendEmailCode(email: string): Promise<Result> {
  const address = email.trim().toLowerCase();
  if (!EMAIL.test(address)) return { error: "invalidEmail" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: address,
    options: { shouldCreateUser: true },
  });
  if (error) return { error: error.status === 429 ? "tooMany" : "failed" };
  return { ok: true };
}

/** Checks the code; on success the session cookie is set and we redirect. */
export async function verifyEmailCode(email: string, code: string, next: string, locale: string): Promise<Result> {
  const token = code.replace(/\D/g, "");
  if (token.length !== 6) return { error: "invalidCode" };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token,
    type: "email",
  });
  if (error) return { error: error.status === 429 ? "tooMany" : "invalidCode" };
  redirect(safeNext(next, locale));
}

export async function signInWithGoogle(next: string, locale: string): Promise<Result> {
  const supabase = await createClient();
  const target = encodeURIComponent(safeNext(next, locale));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await appUrl()}/api/auth/callback?next=${target}` },
  });
  if (error) return { error: "failed" };
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
