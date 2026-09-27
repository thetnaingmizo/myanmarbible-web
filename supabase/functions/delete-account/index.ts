// Deletes the calling user's account for real (Play/App Store requirement):
// their feedback rows, then the auth user — which cascades to profiles,
// bookmarks, chat history, votes and trivia scores. Questions they asked
// stay, anonymised (user_id set null by the schema).
//
// Called by the app's "Delete account" page with the user's JWT.
import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "npm:postgres@3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "unauthorized" }, 401);

  // Verify the caller ourselves (verify_jwt is off: the gateway check does
  // not understand the new asymmetric JWT signing keys).
  const url = Deno.env.get("SUPABASE_URL")!;
  const publicKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!publicKey || !dbUrl) return json({ error: "server_misconfigured" }, 500);
  const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(jwt);
  const user = data?.user;
  if (error || !user) return json({ error: "unauthorized" }, 401);

  // TODO(apple): when Sign in with Apple ships, revoke the user's Apple
  // token here (POST https://appleid.apple.com/auth/revoke with a client
  // secret) as Apple requires for account deletion.

  // One transaction: their feedback (verse_feedback → profiles is ON DELETE
  // SET NULL, so it must go explicitly), then the auth user, which cascades
  // to identities, sessions, profile, bookmarks, chats, votes, scores.
  const sql = postgres(dbUrl, { prepare: false, max: 1 });
  try {
    await sql.begin(async (tx) => {
      await tx`delete from public.verse_feedback where user_id = ${user.id}`;
      await tx`delete from auth.users where id = ${user.id}`;
    });
  } catch (e) {
    return json({ error: "delete_failed", detail: String(e) }, 500);
  } finally {
    await sql.end();
  }

  return json({ deleted: true });
});
