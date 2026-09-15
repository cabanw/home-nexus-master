import type { ScanResult } from "@/types/device";
import { authHeaders, readApiError } from "@/lib/apiAuth";

export const SCAN_QUERY_KEY = ["network-scan"] as const;

export async function fetchScan(): Promise<ScanResult> {
  const res = await fetch("/api/scan", { headers: await authHeaders() });
  if (!res.ok) throw await readApiError(res, "Scan failed");
  return res.json();
}
