import { createCipheriv, createDecipheriv, createHash } from "crypto";

/*
 * TP-Link KLAP v2, used by Kasa devices on newer firmware:
 * - auth hash = sha256(sha1(username) + sha1(password)) for the TP-Link account
 * - handshake1: client seed -> device seed + sha256(clientSeed + deviceSeed + authHash)
 * - handshake2: client proves the account with sha256(deviceSeed + clientSeed + authHash)
 * - requests: AES-128-CBC with a key, IV prefix and sequence number derived from both seeds,
 *   prefixed by a SHA-256 signature
 */

function sha256(...parts: Uint8Array[]): Buffer {
  return createHash("sha256").update(Buffer.concat(parts)).digest();
}

function sha1(data: Uint8Array): Buffer {
  return createHash("sha1").update(data).digest();
}

function int32(value: number): Buffer {
  const out = Buffer.alloc(4);
  out.writeInt32BE(value);
  return out;
}

export function klapAuthHash(username: string, password: string): Buffer {
  return sha256(sha1(Buffer.from(username, "utf8")), sha1(Buffer.from(password, "utf8")));
}

/** The hash the device sends back in handshake1 when it holds the same account. */
export function handshake1Hash(localSeed: Uint8Array, remoteSeed: Uint8Array, authHash: Uint8Array): Buffer {
  return sha256(localSeed, remoteSeed, authHash);
}

export function handshake2Payload(localSeed: Uint8Array, remoteSeed: Uint8Array, authHash: Uint8Array): Buffer {
  return sha256(remoteSeed, localSeed, authHash);
}

export class KlapCipher {
  private readonly key: Buffer;
  private readonly ivPrefix: Buffer;
  private readonly signingKey: Buffer;
  private seq: number;

  constructor(localSeed: Uint8Array, remoteSeed: Uint8Array, authHash: Uint8Array) {
    const seeds = Buffer.concat([localSeed, remoteSeed, authHash]);
    const iv = sha256(Buffer.from("iv"), seeds);
    this.key = sha256(Buffer.from("lsk"), seeds).subarray(0, 16);
    this.ivPrefix = iv.subarray(0, 12);
    this.seq = iv.readInt32BE(28);
    this.signingKey = sha256(Buffer.from("ldk"), seeds).subarray(0, 28);
  }

  /** Encrypts a request; the returned seq goes in the URL and is needed to decrypt the reply. */
  encrypt(text: string): { body: Buffer; seq: number } {
    this.seq = this.seq === 0x7fffffff ? -0x80000000 : this.seq + 1;
    const seqBytes = int32(this.seq);
    const cipher = createCipheriv("aes-128-cbc", this.key, Buffer.concat([this.ivPrefix, seqBytes]));
    const ciphertext = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    const signature = sha256(this.signingKey, seqBytes, ciphertext);
    return { body: Buffer.concat([signature, ciphertext]), seq: this.seq };
  }

  decrypt(body: Uint8Array, seq: number): string {
    const decipher = createDecipheriv("aes-128-cbc", this.key, Buffer.concat([this.ivPrefix, int32(seq)]));
    return Buffer.concat([decipher.update(body.subarray(32)), decipher.final()]).toString("utf8");
  }
}

/** Reads name=value pairs from Set-Cookie headers such as "TP_SESSIONID=abc;TIMEOUT=86400". */
export function parseCookies(headers: string[] | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const header of headers ?? []) {
    for (const part of header.split(";")) {
      const separator = part.indexOf("=");
      if (separator > 0) cookies[part.slice(0, separator).trim()] = part.slice(separator + 1).trim();
    }
  }
  return cookies;
}
