import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import pg from 'pg';
import { createPgPool } from './pg-config.js';

let envLoaded = false;

function loadEnvOnce() {
  if (envLoaded) return;
  if (!process.env.POSTGRES_URL) {
    const envLocal = resolve(process.cwd(), '.env.local');
    if (existsSync(envLocal)) {
      config({ path: envLocal });
    }
  }
  envLoaded = true;
}

function getConnectionString() {
  loadEnvOnce();
  return (
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL
  );
}

let pool: pg.Pool | null = null;

function getPool() {
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error('POSTGRES_URL is not configured');
  }

  if (!pool) {
    pool = createPgPool(connectionString);
    pool.on('error', () => {
      pool = null;
    });
  }

  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  try {
    return await getPool().query<T>(text, params);
  } catch (error) {
    pool = null;
    throw error;
  }
}
