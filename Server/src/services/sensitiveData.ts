import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { env } from '../configs/env.js';

function key(secret: string): Buffer { return createHash('sha256').update(secret).digest(); }

export function normalizedIdentifier(value: string): string { return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(); }
export function identifierFingerprint(value: string): string { return createHmac('sha256', env.sensitiveDataHmacSecret).update(normalizedIdentifier(value)).digest('hex'); }
export function identifierLastFour(value: string): string { return normalizedIdentifier(value).slice(-4); }

export function encryptPayoutValue(value: string): string {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key(env.payoutEncryptionKey), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

export function decryptPayoutValue(value: string): string {
  const payload = Buffer.from(value, 'base64url'); const iv = payload.subarray(0, 12); const authTag = payload.subarray(12, 28); const encrypted = payload.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key(env.payoutEncryptionKey), iv); decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
