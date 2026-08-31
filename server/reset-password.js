import { initDb, getDb } from './db.js';
import { hashPassword } from './auth.js';

const [email, ...rest] = process.argv.slice(2);
const password = rest.join(' ');
if (!email || !password) {
  console.log('Usage: npm run reset-password -- <email> <new-password>');
  process.exit(1);
}

await initDb();
const db = getDb();
const user = await db('users').where({ email: String(email).trim().toLowerCase() }).first();
if (!user) {
  console.log(`No user found with email: ${email}`);
  process.exit(1);
}
await db('users').where({ id: user.id }).update({ password_hash: hashPassword(password) });
await db('sessions').where({ user_id: user.id }).del();
console.log(`Password updated for ${user.email}. All existing sessions were signed out.`);
process.exit(0);
