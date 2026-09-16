const API_BASE = "https://api-v3.voicemonkey.io";
const ANNOUNCE_URL = `${API_BASE}/announce`;
const TRIGGER_URL = `${API_BASE}/trigger`;

export interface VoiceMonkeyConfig {
  token: string;
  /** Default Speaker device to announce on when a call doesn't specify one. */
  deviceId: string;
}

/** Speaks `text` on the configured Echo device(s) via the Voice Monkey Alexa skill (API v3). */
export async function announce(config: VoiceMonkeyConfig, text: string, deviceId?: string): Promise<void> {
  const res = await fetch(ANNOUNCE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: config.token, device: deviceId ?? config.deviceId, speech: text }),
  });
  if (!res.ok) throw new Error(`Voice Monkey announcement failed (${res.status}): ${await res.text()}`);
}

/** Fires a Voice Monkey "Routine trigger" device, which runs whatever Alexa Routine it's wired to. */
export async function triggerRoutine(config: VoiceMonkeyConfig, deviceId: string): Promise<void> {
  const res = await fetch(TRIGGER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: config.token, device: deviceId }),
  });
  if (!res.ok) throw new Error(`Voice Monkey trigger failed (${res.status}): ${await res.text()}`);
}
