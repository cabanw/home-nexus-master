// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createCipheriv, createHash } from 'crypto';
import { KlapCipher, handshake1Hash, handshake2Payload, klapAuthHash, parseCookies } from './klapCrypto';

const hash = (algorithm: string, ...parts: Buffer[]) => createHash(algorithm).update(Buffer.concat(parts)).digest();

const localSeed = Buffer.alloc(16, 0x11);
const remoteSeed = Buffer.alloc(16, 0x22);
const authHash = klapAuthHash('user@example.com', 'correct horse');
const seeds = Buffer.concat([localSeed, remoteSeed, authHash]);

const int32 = (value: number) => {
  const out = Buffer.alloc(4);
  out.writeInt32BE(value);
  return out;
};

describe('klapAuthHash', () => {
  it('is sha256(sha1(username) + sha1(password))', () => {
    expect(authHash).toEqual(
      hash('sha256', hash('sha1', Buffer.from('user@example.com')), hash('sha1', Buffer.from('correct horse'))),
    );
  });
});

describe('handshake hashes', () => {
  it('handshake1 hashes client seed, device seed, auth hash', () => {
    expect(handshake1Hash(localSeed, remoteSeed, authHash)).toEqual(hash('sha256', localSeed, remoteSeed, authHash));
  });

  it('handshake2 hashes device seed, client seed, auth hash', () => {
    expect(handshake2Payload(localSeed, remoteSeed, authHash)).toEqual(hash('sha256', remoteSeed, localSeed, authHash));
  });
});

describe('KlapCipher', () => {
  const key = hash('sha256', Buffer.from('lsk'), seeds).subarray(0, 16);
  const ivFull = hash('sha256', Buffer.from('iv'), seeds);
  const ivPrefix = ivFull.subarray(0, 12);
  const initialSeq = ivFull.readInt32BE(28);
  const signingKey = hash('sha256', Buffer.from('ldk'), seeds).subarray(0, 28);

  it('signs and encrypts a request with the next sequence number', () => {
    const plaintext = '{"system":{"get_sysinfo":{}}}';
    const { body, seq } = new KlapCipher(localSeed, remoteSeed, authHash).encrypt(plaintext);

    expect(seq).toBe(initialSeq + 1);
    const cipher = createCipheriv('aes-128-cbc', key, Buffer.concat([ivPrefix, int32(seq)]));
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    expect(body.subarray(32)).toEqual(ciphertext);
    expect(body.subarray(0, 32)).toEqual(hash('sha256', signingKey, int32(seq), ciphertext));
  });

  it('uses a new sequence number for every request', () => {
    const cipher = new KlapCipher(localSeed, remoteSeed, authHash);
    const first = cipher.encrypt('a').seq;
    expect(cipher.encrypt('b').seq).toBe(first + 1);
  });

  it('decrypts a device reply for the same sequence number', () => {
    const cipher = new KlapCipher(localSeed, remoteSeed, authHash);
    const { seq } = cipher.encrypt('{}');
    const reply = '{"system":{"get_sysinfo":{"relay_state":1,"err_code":0}}}';
    const deviceCipher = createCipheriv('aes-128-cbc', key, Buffer.concat([ivPrefix, int32(seq)]));
    const encryptedReply = Buffer.concat([Buffer.alloc(32), deviceCipher.update(reply, 'utf8'), deviceCipher.final()]);

    expect(cipher.decrypt(encryptedReply, seq)).toBe(reply);
  });
});

describe('parseCookies', () => {
  it('reads every name=value pair from Set-Cookie headers', () => {
    expect(parseCookies(['TP_SESSIONID=ABC123;TIMEOUT=86400'])).toEqual({ TP_SESSIONID: 'ABC123', TIMEOUT: '86400' });
  });

  it('handles missing headers', () => {
    expect(parseCookies(undefined)).toEqual({});
  });
});
