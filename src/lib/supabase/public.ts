import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Cookie-free client for public, shared data (Bible text, catalogue). It
// never sees a user session, so its results can be cached for everyone.
let client: ReturnType<typeof createClient<Database>> | null = null;

export function publicClient() {
  client ??= createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  return client;
}
