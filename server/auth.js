import crypto from 'node:crypto';
import { getDb } from './db.js';


export const COOKIE = 'invoice_session';
const SESSION_DAYS = 30;
const VERIFICATION_DAYS = 7;

// scrypt from Node's built-in crypto — no extra dependency, solid KDF.
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, salt, hash] = String(stored || '').split(':');
    if (scheme !== 'scrypt' || !salt || !hash) return false;
    const test = crypto.scryptSync(String(password), salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return test.length === expected.length && crypto.timingSafeEqual(test, expected);
  } catch {
    return false;
  }
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

export async function createSession(res, userId) {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await db('sessions').insert({ token, user_id: userId, expires_at: expires });
  await db('sessions').where('expires_at', '<', new Date().toISOString()).del();
  setSessionCookie(res, token);
}

export async function destroySession(req) {
  const token = parseCookies(req)[COOKIE];
  if (token) await getDb()('sessions').where({ token }).del();
}

export async function getSessionUser(req) {
  const token = parseCookies(req)[COOKIE];
  if (!token) return null;
  const db = getDb();
  const row = await db('sessions')
    .join('users', 'users.id', 'sessions.user_id')
    .select('users.id', 'users.name', 'users.email', 'users.email_verified', 'sessions.token', 'sessions.expires_at')
    .where({ token })
    .first();
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    await db('sessions').where({ token }).del();
    return null;
  }
  return { id: row.id, name: row.name, email: row.email, emailVerified: Boolean(row.email_verified) };
}

export async function requireAuth(req, res, next) {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Not signed in' });
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Email verification helpers
export async function createVerificationToken(userId) {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + VERIFICATION_DAYS * 86400000).toISOString();
  await db('email_verifications').insert({ token, user_id: userId, expires_at: expires });
  return token;
}

export async function verifyEmailToken(token) {
  const db = getDb();
  const row = await db('email_verifications').where({ token }).first();
  if (!row) return { ok: false, error: 'Invalid or expired verification link' };
  if (new Date(row.expires_at) < new Date()) {
    await db('email_verifications').where({ token }).del();
    return { ok: false, error: 'Verification link has expired' };
  }
  await db('users').where({ id: row.user_id }).update({ email_verified: 1 });
  await db('email_verifications').where({ token }).del();
  return { ok: true };
}

export async function sendVerificationEmail(email, token, baseUrl) {
  // In production, integrate with a real email service (SendGrid, Mailgun, etc.)
  // For now, log the verification URL to console (dev mode)
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
  console.log('\n========================================');
  console.log('EMAIL VERIFICATION LINK (dev mode):');
  console.log(`To: ${email}`);
  console.log(`Verify: ${verifyUrl}`);
  console.log('========================================\n');
  // Return the URL for testing purposes
  return verifyUrl;
}

// Check if we should require email verification (can be disabled for testing)
export function isEmailVerificationRequired() {
  return process.env.REQUIRE_EMAIL_VERIFICATION !== 'false';
}
