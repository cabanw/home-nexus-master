import type { KasaDevice, KasaDiscoveryResult, KasaStateChange } from "@/types/kasa";
import { authHeaders, readApiError } from "@/lib/apiAuth";

export const KASA_QUERY_KEY = ["kasa-devices"] as const;

export async function fetchKasaDevices(): Promise<KasaDiscoveryResult> {
  const res = await fetch("/api/kasa/devices", { headers: await authHeaders() });
  if (!res.ok) throw await readApiError(res, "Kasa discovery failed");
  return res.json();
}

export async function setKasaDeviceState(ip: string, change: KasaStateChange): Promise<KasaDevice> {
  const res = await fetch(`/api/kasa/devices/${encodeURIComponent(ip)}/state`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify(change),
  });
  if (!res.ok) throw await readApiError(res, "Kasa command failed");
  return res.json();
}
