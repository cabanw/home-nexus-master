import type { ResideoDiscoveryResult, ResideoStateChange, ResideoStatus, ResideoThermostat } from "@/types/resideo";
import { authHeaders, readApiError } from "@/lib/apiAuth";

export const RESIDEO_QUERY_KEY = ["resideo-devices"] as const;
export const RESIDEO_STATUS_QUERY_KEY = ["resideo-status"] as const;

export async function fetchResideoStatus(): Promise<ResideoStatus> {
  const res = await fetch("/api/resideo/status", { headers: await authHeaders() });
  if (!res.ok) throw await readApiError(res, "Resideo status check failed");
  return res.json();
}

export async function fetchResideoDevices(): Promise<ResideoDiscoveryResult> {
  const res = await fetch("/api/resideo/devices", { headers: await authHeaders() });
  if (!res.ok) throw await readApiError(res, "Resideo discovery failed");
  return res.json();
}

export async function setResideoDeviceState(
  locationId: number,
  deviceId: string,
  change: ResideoStateChange,
): Promise<ResideoThermostat> {
  const res = await fetch(`/api/resideo/devices/${encodeURIComponent(deviceId)}/state`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ locationId, ...change }),
  });
  if (!res.ok) throw await readApiError(res, "Resideo command failed");
  return res.json();
}

/**
 * Navigates the browser into the OAuth flow. This is a full-page navigation (not a fetch), so it
 * can't carry an Authorization header — /api/resideo/connect and /callback are intentionally not
 * gated by isSignedIn for that reason. Only /devices and /devices/:id/state require a session.
 */
export function connectResideo(): void {
  window.location.href = "/api/resideo/connect";
}
