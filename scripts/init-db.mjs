import pg from 'pg';
import { readFileSync } from 'fs';

const { Pool } = pg;

function withSupabaseSsl(connectionString) {
  if (connectionString.includes('uselibpqcompat=')) {
    return connectionString;
  }
  const separator = connectionString.includes('?') ? '&' : '?';
  return `${connectionString}${separator}uselibpqcompat=true`;
}

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq);
  let value = trimmed.slice(eq + 1);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

const connectionString =
  process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('Missing POSTGRES_URL_NON_POOLING or POSTGRES_URL in .env.local');
  process.exit(1);
}

const pool = new Pool({
  connectionString: withSupabaseSsl(connectionString),
  ssl: { rejectUnauthorized: false },
});

try {
  const ping = await pool.query('SELECT 1 AS ok');
  console.log('Connected to Supabase Postgres:', ping.rows[0]);

  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS rooms (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      invite_code VARCHAR(8) UNIQUE NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS room_members (
      room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (room_id, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
      purpose VARCHAR(500) NOT NULL,
      expense_date DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  ];

  for (const statement of statements) {
    await pool.query(statement);
  }

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_expenses_room_date ON expenses(room_id, expense_date)',
    'CREATE INDEX IF NOT EXISTS idx_expenses_room_user ON expenses(room_id, user_id)',
    'CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members(room_id)',
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
  ];

  for (const statement of indexes) {
    await pool.query(statement);
  }

  console.log('All tables ready.');
} catch (error) {
  console.error('Database setup failed:', error.message);
  process.exit(1);
} finally {
  await pool.end();
}
