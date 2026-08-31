import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import knex from 'knex';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(ROOT, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'database.json');

let dbInstance = null;
let dbConfig = null;

export const DEFAULT_SETTINGS = {
  id: 1,
  business_name: '',
  abn: '',
  tfn: '',
  contact_name: '',
  email: '',
  phone: '',
  address: '',
  logo: null,
  bsb: '',
  account_number: '',
  account_name: '',
  payment_details: '',
  payment_terms: 'Payment is due within 14 days of the invoice date.',
  default_rate: 0,
  currency: 'AUD',
  gst_enabled: 1,
  gst_rate: 10,
  tax_label: 'GST',
  invoice_prefix: 'INV-',
  next_number: 1,
  date_format: 'DD/MM/YYYY',
  footer_note: '',
};

export function readDbConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return { type: 'sqlite', filename: path.join(DATA_DIR, 'invoice.db') };
  }
}

export function writeDbConfig(cfg) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

export function getDb() {
  if (!dbInstance) throw new Error('Database not initialised');
  return dbInstance;
}

export function currentDbConfig() {
  return { ...dbConfig };
}

function buildKnex(cfg) {
  if (cfg.type === 'postgres') {
    return knex({
      client: 'pg',
      connection: {
        host: cfg.host || 'localhost',
        port: Number(cfg.port || 5432),
        user: cfg.user || '',
        password: cfg.password || '',
        database: cfg.database || '',
      },
    });
  }
  if (cfg.type === 'mysql') {
    return knex({
      client: 'mysql2',
      connection: {
        host: cfg.host || 'localhost',
        port: Number(cfg.port || 3306),
        user: cfg.user || '',
        password: cfg.password || '',
        database: cfg.database || '',
      },
    });
  }
  const filename = cfg.filename || path.join(DATA_DIR, 'invoice.db');
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  return knex({
    client: 'better-sqlite3',
    connection: { filename },
    useNullAsDefault: true,
  });
}

async function ensureSchema(db) {
  const has = (t) => db.schema.hasTable(t);

  if (!(await has('clients'))) {
    await db.schema.createTable('clients', (t) => {
      t.increments('id').primary();
      t.string('name', 200).notNullable();
      t.string('contact_name', 200);
      t.string('email', 200);
      t.string('phone', 100);
      t.text('address');
      t.string('abn', 50);
      t.text('notes');
      t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
    });
  }

  if (!(await has('time_entries'))) {
    await db.schema.createTable('time_entries', (t) => {
      t.increments('id').primary();
      t.integer('client_id').notNullable().index();
      t.string('entry_date', 10).notNullable();
      t.float('hours').notNullable().defaultTo(0);
      t.integer('break_minutes').notNullable().defaultTo(0);
      t.float('rate').notNullable().defaultTo(0);
      t.text('description');
      t.integer('invoice_id').nullable().index();
      t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
    });
  }

  if (!(await has('invoices'))) {
    await db.schema.createTable('invoices', (t) => {
      t.increments('id').primary();
      t.string('number', 50).notNullable().unique();
      t.integer('client_id').notNullable().index();
      t.string('issue_date', 10).notNullable();
      t.string('due_date', 10);
      t.string('status', 20).notNullable().defaultTo('draft');
      t.float('subtotal').notNullable().defaultTo(0);
      t.float('discount').notNullable().defaultTo(0);
      t.integer('gst_enabled').notNullable().defaultTo(0);
      t.float('gst_rate').notNullable().defaultTo(0);
      t.float('gst_amount').notNullable().defaultTo(0);
      t.float('total').notNullable().defaultTo(0);
      t.text('notes');
      t.text('terms');
      t.string('paid_at', 40);
      t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
    });
  }

  if (!(await has('invoice_items'))) {
    await db.schema.createTable('invoice_items', (t) => {
      t.increments('id').primary();
      t.integer('invoice_id').notNullable().index();
      t.text('description');
      t.string('entry_date', 10);
      t.float('quantity').notNullable().defaultTo(0);
      t.float('unit_price').notNullable().defaultTo(0);
      t.float('amount').notNullable().defaultTo(0);
      t.integer('time_entry_id').nullable().index();
      t.integer('sort_order').notNullable().defaultTo(0);
    });
  }

  if (!(await has('email_verifications'))) {
    await db.schema.createTable('email_verifications', (t) => {
      t.string('token', 128).primary();
      t.integer('user_id').notNullable().index();
      t.string('expires_at', 40).notNullable();
      t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
    });
  }

  if (!(await has('users'))) {
    await db.schema.createTable('users', (t) => {
      t.increments('id').primary();
      t.string('name', 200).notNullable();
      t.string('email', 200).notNullable().unique();
      t.text('password_hash').notNullable();
      t.integer('email_verified').notNullable().defaultTo(0);
      t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
    });
  }

  if (!(await has('sessions'))) {
    await db.schema.createTable('sessions', (t) => {
      t.string('token', 128).primary();
      t.integer('user_id').notNullable().index();
      t.string('expires_at', 40).notNullable();
      t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
    });
  }

  if (!(await has('settings'))) {
    await db.schema.createTable('settings', (t) => {
      t.integer('id').primary();
      t.string('business_name', 200).defaultTo('');
      t.string('abn', 50).defaultTo('');
      t.string('tfn', 50).defaultTo('');
      t.string('contact_name', 200).defaultTo('');
      t.string('email', 200).defaultTo('');
      t.string('phone', 100).defaultTo('');
      t.text('address');
      t.text('logo');
      t.string('bsb', 50).defaultTo('');
      t.string('account_number', 50).defaultTo('');
      t.string('account_name', 200).defaultTo('');
      t.text('payment_details');
      t.text('payment_terms');
      t.float('default_rate').notNullable().defaultTo(0);
      t.string('currency', 10).notNullable().defaultTo('AUD');
      t.integer('gst_enabled').notNullable().defaultTo(1);
      t.float('gst_rate').notNullable().defaultTo(10);
      t.string('tax_label', 20).notNullable().defaultTo('GST');
      t.string('invoice_prefix', 30).notNullable().defaultTo('INV-');
      t.integer('next_number').notNullable().defaultTo(1);
      t.string('date_format', 20).notNullable().defaultTo('DD/MM/YYYY');
      t.text('footer_note');
      t.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
    });
    await db('settings').insert({ ...DEFAULT_SETTINGS });
  }
}

export async function initDb(cfg = readDbConfig()) {
  if (dbInstance) {
    await dbInstance.destroy();
    dbInstance = null;
  }
  const k = buildKnex(cfg);
  await ensureSchema(k);
  dbInstance = k;
  dbConfig = { ...cfg };
  return k;
}

export async function fixSequences(db) {
  // Only PostgreSQL needs sequence re-alignment after explicit-id inserts.
  if (!db || db.client.config.client !== 'pg') return;
  const tables = ['clients', 'time_entries', 'invoices', 'invoice_items', 'users'];
  for (const t of tables) {
    await db.raw(
      `select setval(pg_get_serial_sequence('${t}', 'id'), coalesce((select max(id) from ${t}), 1))`
    );
  }
}
