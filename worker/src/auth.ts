// Native Web Crypto PBKDF2 Authentication and D1 Session Management
// Zero third-party dependencies, 100% standard Web Cryptography API

import type { User, Session } from './types';

const PBKDF2_ITERATIONS = 100_000;
const KEY_LEN_BYTES = 32;
const SALT_LEN_BYTES = 16;

/**
 * Hash a plain text password using PBKDF2-HMAC-SHA256
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN_BYTES));
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    KEY_LEN_BYTES * 8
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');

  return `pbkdf2$${PBKDF2_ITERATIONS}$${saltHex}$${hashHex}`;
}

/**
 * Verify a plain text password against a stored PBKDF2 hash
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash.startsWith('pbkdf2$')) {
    return false;
  }

  const parts = storedHash.split('$');
  if (parts.length !== 4) return false;

  const iterations = parseInt(parts[1], 10);
  const saltHex = parts[2];
  const expectedHashHex = parts[3];

  const salt = new Uint8Array(
    saltHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
  );

  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    KEY_LEN_BYTES * 8
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return hashHex === expectedHashHex;
}

/**
 * Generate a cryptographically random session token (hex)
 */
export function generateToken(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a new session in D1 (30 days expiry)
 */
export async function createSession(db: D1Database, userId: string): Promise<string> {
  const sessionId = generateToken(32);
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z');

  await db
    .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(sessionId, userId, expiresAt)
    .run();

  return sessionId;
}

/**
 * Validate a session token from cookie and fetch current user
 */
export async function validateSession(
  db: D1Database,
  sessionId: string | undefined
): Promise<User | null> {
  if (!sessionId || sessionId.length < 32) return null;

  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const user = await db
    .prepare(
      `SELECT u.* FROM users u
       JOIN sessions s ON s.user_id = u.id
       WHERE s.id = ? AND s.expires_at > ? AND u.enabled = 1`
    )
    .bind(sessionId, now)
    .first<User>();

  return user || null;
}

/**
 * Delete a session on logout
 */
export async function destroySession(db: D1Database, sessionId: string): Promise<void> {
  if (!sessionId) return;
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}
