"import { Router } from 'express';
import { getDb } from '../db.js';
import { hashPassword, verifyPassword, createSession, clearSessionCookie, destroySession, getSessionUser, createVerificationToken, verifyEmailToken, sendVerificationEmail, isEmailVerificationRequired } from '../auth.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, emailVerified: u.email_verified });

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
  
  // Create email verification token
  const token = await createVerificationToken(id);
  const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5173}`;
  await sendVerificationEmail(email, token, baseUrl);
  
  // Don't create session yet - user needs to verify email first
  res.status(201).json({ user: { id, name, email, emailVerified: false }, message: 'Account created! Please check your email to verify your account.' });
});

router.post('/login', async (req, res) => {
  const db = getDb();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = await db('users').where({ email }).first();
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  
  // Check email verification if required
  if (isEmailVerificationRequired() && !user.email_verified) {
    return res.status(403).json({ error: 'Please verify your email address before signing in. Check your inbox for the verification link.' });
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

// Email verification endpoint
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).send('<h1>Invalid verification link</h1><p>No token provided.</p>');
  }
  
  const result = await verifyEmailToken(token);
  if (result.ok) {
    res.send('<h1>Email verified successfully!</h1><p>You can now <a href="/login">sign in</a> to your account.</p>');
  } else {
    res.status(400).send(`<h1>Verification failed</h1><p>${result.error}</p>`);
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }
  
  const db = getDb();
  const user = await db('users').where({ email }).first();
  if (!user) {
    // Don't reveal if email exists
    return res.json({ ok: true, message: 'If an account exists, a verification email has been sent.' });
  }
  
  if (user.email_verified) {
    return res.json({ ok: true, message: 'This email is already verified. You can sign in.' });
  }
  
  const token = await createVerificationToken(user.id);
  const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5173}`;
  await sendVerificationEmail(email, token, baseUrl);
  
  res.json({ ok: true, message: 'If an account exists, a verification email has been sent.' });
});

function insertUserId(result) {
  if (Array.isArray(result)) {
    if (result.length && typeof result[0] === 'object') return result[0].id;
    return result[0];
  }
  if (result && typeof result === 'object') return result.id;
  return result;
}

export default router;"
