import pg from 'pg';
import { readFileSync } from 'fs';

const { Pool } = pg;

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  let value = trimmed.slice(eq + 1);
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  process.env[trimmed.slice(0, eq)] = value;
}

const connectionString =
  process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('No database URL in .env.local');
  process.exit(1);
}

const separator = connectionString.includes('?') ? '&' : '?';
const url = connectionString.includes('uselibpqcompat')
  ? connectionString
  : `${connectionString}${separator}uselibpqcompat=true`;

const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  const [users, rooms, members, expenses] = await Promise.all([
    pool.query('SELECT id, name, email FROM users ORDER BY id'),
    pool.query('SELECT id, name, invite_code, created_by FROM rooms ORDER BY id'),
    pool.query('SELECT room_id, user_id FROM room_members ORDER BY room_id, user_id'),
    pool.query('SELECT COUNT(*)::int AS count FROM expenses'),
  ]);

  console.log('=== USERS ===');
  console.table(users.rows);
  console.log('=== ROOMS ===');
  console.table(rooms.rows);
  console.log('=== ROOM MEMBERS ===');
  console.table(members.rows);
  console.log('Expenses count:', expenses.rows[0].count);
} catch (error) {
  console.error('DB error:', error.message);
  process.exit(1);
} finally {
  await pool.end();
}
