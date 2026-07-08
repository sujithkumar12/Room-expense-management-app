import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../db.js';
import { json } from '../utils.js';

export async function handleHealth(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const hasPostgresUrl = Boolean(
    process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL
  );
  const hasJwtSecret = Boolean(process.env.JWT_SECRET);

  if (!hasPostgresUrl || !hasJwtSecret) {
    return json(res, 503, {
      ok: false,
      database: hasPostgresUrl ? 'configured' : 'missing POSTGRES_URL',
      auth: hasJwtSecret ? 'configured' : 'missing JWT_SECRET',
    });
  }

  try {
    await query('SELECT 1 AS ok');
    return json(res, 200, { ok: true, database: 'connected', auth: 'configured' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database connection failed';
    return json(res, 503, { ok: false, database: 'error', detail: message });
  }
}
