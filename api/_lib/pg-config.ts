import pg from 'pg';

const { Pool } = pg;

/** Supabase + pg v8: sslmode=require needs uselibpqcompat for rejectUnauthorized: false */
export function withSupabaseSsl(connectionString: string) {
  if (connectionString.includes('uselibpqcompat=')) {
    return connectionString;
  }
  const separator = connectionString.includes('?') ? '&' : '?';
  return `${connectionString}${separator}uselibpqcompat=true`;
}

export function createPgPool(connectionString: string) {
  return new Pool({
    connectionString: withSupabaseSsl(connectionString),
    ssl: { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}
