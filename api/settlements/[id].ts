import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { query } from '../_lib/db.js';
import { handleError, json } from '../_lib/utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const authUser = requireAuth(req);
    const settlementId = Number(req.query.id);

    if (!settlementId || Number.isNaN(settlementId)) {
      return json(res, 400, { error: 'Valid settlement id is required' });
    }

    const existing = await query<{ payer_id: number }>(
      'SELECT payer_id FROM settlements WHERE id = $1',
      [settlementId]
    );

    if (existing.rows.length === 0) {
      return json(res, 404, { error: 'Settlement not found' });
    }

    if (existing.rows[0].payer_id !== authUser.userId) {
      return json(res, 403, { error: 'You can only delete payments you recorded' });
    }

    await query('DELETE FROM settlements WHERE id = $1', [settlementId]);
    return json(res, 200, { success: true });
  } catch (error) {
    return handleError(res, error);
  }
}
