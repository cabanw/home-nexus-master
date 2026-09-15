import { supabase } from "@/integrations/supabase/client";

/** Authorization header for the dev-server APIs, which require a signed-in user. */
export async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

/** Turns a failed API response into an Error, preferring the server's message. */
export async function readApiError(res: Response, fallback: string): Promise<Error> {
  const body = await res.json().catch(() => ({}));
  return new Error(body.message ?? `${fallback}: ${res.status}`);
}
