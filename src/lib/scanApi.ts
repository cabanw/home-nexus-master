import { supabase } from "@/integrations/supabase/client";
import type { ScanResult } from "@/types/device";

export const SCAN_QUERY_KEY = ["network-scan"] as const;

export async function fetchScan(): Promise<ScanResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch("/api/scan", {
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Scan failed: ${res.status}`);
  }
  return res.json();
}
