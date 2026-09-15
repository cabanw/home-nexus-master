import { request } from "http";
import { randomBytes } from "crypto";
import { KlapCipher, handshake1Hash, handshake2Payload, klapAuthHash, parseCookies } from "./klapCrypto";

export interface KasaCredentials {
  username: string;
  password: string;
}

interface KlapSession {
  cookie: string;
  cipher: KlapCipher;
  expiresAt: number;
}

interface HttpReply {
  status: number;
  body: Buffer;
  cookies: Record<string, string>;
}

const HTTP_TIMEOUT_MS = 5000;
const DEFAULT_SESSION_SECONDS = 86400;
const SESSION_MARGIN_MS = 60_000;

const sessions = new Map<string, KlapSession>();

function post(ip: string, port: number, path: string, body: Buffer, cookie?: string): Promise<HttpReply> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: ip,
        port,
        path,
        method: "POST",
        timeout: HTTP_TIMEOUT_MS,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": body.length,
          ...(cookie ? { Cookie: cookie } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks), cookies: parseCookies(res.headers["set-cookie"]) }),
        );
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error(`Kasa device ${ip} did not answer within ${HTTP_TIMEOUT_MS / 1000}s.`)));
    req.on("error", (err) => reject(new Error(`Kasa device ${ip}: ${err.message}`)));
    req.end(body);
  });
}

async function handshake(ip: string, port: number, credentials: KasaCredentials): Promise<KlapSession> {
  const authHash = klapAuthHash(credentials.username, credentials.password);
  const localSeed = randomBytes(16);

  const first = await post(ip, port, "/app/handshake1", localSeed);
  if (first.status !== 200 || first.body.length !== 48) {
    throw new Error(`KLAP handshake with ${ip} failed (HTTP ${first.status}).`);
  }
  const remoteSeed = first.body.subarray(0, 16);
  if (!handshake1Hash(localSeed, remoteSeed, authHash).equals(first.body.subarray(16))) {
    throw new Error(`${ip} rejected the TP-Link credentials. Check KASA_USERNAME and KASA_PASSWORD in .env.`);
  }

  const sessionId = first.cookies.TP_SESSIONID;
  if (!sessionId) throw new Error(`KLAP handshake with ${ip} returned no session.`);
  const cookie = `TP_SESSIONID=${sessionId}`;

  const second = await post(ip, port, "/app/handshake2", handshake2Payload(localSeed, remoteSeed, authHash), cookie);
  if (second.status !== 200) throw new Error(`KLAP handshake with ${ip} failed at step 2 (HTTP ${second.status}).`);

  const lifetimeSeconds = Number(first.cookies.TIMEOUT) || DEFAULT_SESSION_SECONDS;
  return {
    cookie,
    cipher: new KlapCipher(localSeed, remoteSeed, authHash),
    expiresAt: Date.now() + lifetimeSeconds * 1000 - SESSION_MARGIN_MS,
  };
}

/** Sends one JSON command over KLAP, reusing the device's session and handshaking again once if it expired. */
export async function sendKlapCommand(
  ip: string,
  port: number,
  credentials: KasaCredentials,
  command: object,
): Promise<unknown> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    let session = sessions.get(ip);
    if (!session || session.expiresAt <= Date.now()) {
      session = await handshake(ip, port, credentials);
      sessions.set(ip, session);
    }

    const { body, seq } = session.cipher.encrypt(JSON.stringify(command));
    const reply = await post(ip, port, `/app/request?seq=${seq}`, body, session.cookie);
    if (reply.status === 200) return JSON.parse(session.cipher.decrypt(reply.body, seq));

    sessions.delete(ip);
    if (reply.status !== 403 || attempt === 2) {
      throw new Error(`KLAP request to ${ip} failed (HTTP ${reply.status}).`);
    }
  }
  throw new Error(`KLAP request to ${ip} failed.`);
}
