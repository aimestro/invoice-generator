import { Router } from 'express';
import { getDb } from '../db.js';
import { hashPassword, verifyPassword, createSession, clearSessionCookie, destroySession, getSessionUser } from '../auth.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

router.get('/status', async (req, res) => {
  const db = getDb();
  const c = await db('users').count('id as c').first();
  res.json({ hasUsers: Number(c?.c) > 0 });
});

router.post('/signup', async (req, res) => {
  const db = getDb();
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!name) return res.status(400).json({ error: 'Your name is required' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const existing = await db('users').where({ email }).first();
  if (existing) return res.status(409).json({ error: 'An account with this email already exists — log in instead' });

  const id = insertUserId(await db('users').insert({ name, email, password_hash: hashPassword(password) }));
  await createSession(res, id);
  res.status(201).json({ user: { id, name, email } });
});

router.post('/login', async (req, res) => {
  const db = getDb();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = await db('users').where({ email }).first();
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  await createSession(res, user.id);
  res.json({ user: publicUser(user) });
});

router.post('/logout', async (req, res) => {
  await destroySession(req);
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  res.json({ user: await getSessionUser(req) });
});

function insertUserId(result) {
  if (Array.isArray(result)) {
    if (result.length && typeof result[0] === 'object') return result[0].id;
    return result[0];
  }
  if (result && typeof result === 'object') return result.id;
  return result;
}

export default router;
