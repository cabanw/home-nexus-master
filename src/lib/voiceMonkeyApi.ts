import { authHeaders, readApiError } from "@/lib/apiAuth";

/** Speaks `text` on the configured Echo (Voice Monkey Speaker device) via the dev server. */
export async function announceOnAlexa(text: string, deviceId?: string): Promise<void> {
  const res = await fetch("/api/voicemonkey/announce", {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ text, deviceId }),
  });
  if (!res.ok) throw await readApiError(res, "Alexa announcement failed");
}
