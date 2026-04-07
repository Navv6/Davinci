import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Creates a Supabase client scoped to a single request using a Bearer access
 * token.  Every route handler that needs to identify the caller should create
 * one of these per request — do NOT share it across requests.
 */
export function createSupabaseServerClient(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });
}
