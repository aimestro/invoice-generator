import { Router } from 'express';
import path from 'node:path';
import { getDb, currentDbConfig, writeDbConfig, initDb } from '../db.js';
import knex from 'knex';

const router = Router();

function publicConfig(cfg) {
  return {
    type: cfg.type || 'sqlite',
    host: cfg.host || '',
    port: cfg.port || '',
    user: cfg.user || '',
    database: cfg.database || '',
    filename: cfg.filename ? path.basename(cfg.filename) : 'invoice.db',
  };
}

function normalise(body) {
  const type = ['sqlite', 'postgres', 'mysql'].includes(body.type) ? body.type : 'sqlite';
  if (type === 'sqlite') {
    return { type, filename: body.filename || 'invoice.db' };
  }
  return {
    type,
    host: String(body.host || '').trim(),
    port: Number(body.port) || (type === 'postgres' ? 5432 : 3306),
    user: String(body.user || '').trim(),
    password: String(body.password || ''),
    database: String(body.database || '').trim(),
  };
}

async function probe(cfg) {
  const k = build(cfg);
  try {
    await k.raw('select 1');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    await k.destroy();
  }
}

function build(cfg) {
  if (cfg.type === 'postgres') {
    return knex({ client: 'pg', connection: { host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, database: cfg.database } });
  }
  if (cfg.type === 'mysql') {
    return knex({ client: 'mysql2', connection: { host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, database: cfg.database } });
  }
  return knex({ client: 'better-sqlite3', connection: { filename: cfg.filename }, useNullAsDefault: true });
}

router.get('/', (req, res) => {
  res.json(publicConfig(currentDbConfig()));
});

router.post('/test', async (req, res) => {
  const cfg = normalise(req.body);
  const result = await probe(cfg);
  res.json(result);
});

router.put('/', async (req, res) => {
  const cfg = normalise(req.body);
  if (cfg.type !== 'sqlite') {
    if (!cfg.host || !cfg.database) return res.status(400).json({ error: 'Host and database name are required' });
    const result = await probe(cfg);
    if (!result.ok) return res.status(400).json({ error: `Connection failed: ${result.error}` });
  }
  // Apply + run schema setup against the new database, then persist the choice.
  try {
    await initDb(cfg);
    writeDbConfig(cfg);
    res.json({ ok: true, ...publicConfig(cfg) });
  } catch (err) {
    // Roll back to the previous working connection
    await initDb().catch(() => {});
    res.status(400).json({ error: `Could not switch database: ${err.message}` });
  }
});

export default router;
