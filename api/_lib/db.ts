import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import pg from 'pg';
import { createPgPool } from './pg-config.js';

let envLoaded = false;

function loadEnvOnce() {
  if (envLoaded || process.env.POSTGRES_URL) {
    envLoaded = true;
    return;
  }
  const envLocal = resolve(process.cwd(), '.env.local');
  if (existsSync(envLocal)) {
    config({ path: envLocal });
  }
  envLoaded = true;
}

let pool: pg.Pool | null = null;

function getPool() {
  loadEnvOnce();

  if (!pool) {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error('POSTGRES_URL is not configured');
    }
    pool = createPgPool(connectionString);
  }

  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  return getPool().query<T>(text, params);
}
