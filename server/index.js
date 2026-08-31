import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initDb, currentDbConfig } from './db.js';
import { requireAuth } from './auth.js';
import authRouter from './routes/auth.js';
import settingsRouter from './routes/settings.js';
import clientsRouter from './routes/clients.js';
import entriesRouter from './routes/entries.js';
import invoicesRouter from './routes/invoices.js';
import dashboardRouter from './routes/dashboard.js';
import databaseRouter from './routes/database.js';
import backupRouter from './routes/backup.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 5175;

// Express 5 forwards rejected async handlers to the error middleware; this is a
// last-resort net so a stray async bug can never kill a running local app.
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));

await initDb();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const api = express.Router();
api.use('/auth', authRouter); // public: signup, login, logout, me
api.get('/health', (req, res) => res.json({ ok: true, db: currentDbConfig().type }));
api.use(requireAuth); // everything below needs a signed-in session
api.use('/settings', settingsRouter);
api.use('/clients', clientsRouter);
api.use('/time-entries', entriesRouter);
api.use('/invoices', invoicesRouter);
api.use('/dashboard', dashboardRouter);
api.use('/database', databaseRouter);
api.use('/backup', backupRouter);
app.use('/api', api);

// JSON error handler — keeps API responses consistent
app.use('/api', (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Unexpected server error' });
});

// Serve the built frontend (single-process production mode)
const DIST = path.join(ROOT, 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

app.listen(PORT, () => {
  const cfg = currentDbConfig();
  console.log(`Invoice Studio running at http://localhost:${PORT}`);
  console.log(`Database: ${cfg.type}${cfg.type === 'sqlite' ? ` (${cfg.filename})` : ` → ${cfg.host}/${cfg.database}`}`);
});
