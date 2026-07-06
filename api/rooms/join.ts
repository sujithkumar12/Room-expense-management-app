import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { query } from '../_lib/db.js';
import { handleError, json } from '../_lib/utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const authUser = requireAuth(req);

    const { inviteCode } = req.body || {};

    if (!inviteCode?.trim()) {
      return json(res, 400, { error: 'Invite code is required' });
    }

    const code = inviteCode.trim().toUpperCase();
    const roomResult = await query(
      'SELECT id, name, invite_code, created_at FROM rooms WHERE invite_code = $1',
      [code]
    );

    if (roomResult.rows.length === 0) {
      return json(res, 404, { error: 'Room not found with that invite code' });
    }

    const room = roomResult.rows[0] as { id: number };

    await query(
      `INSERT INTO room_members (room_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [room.id, authUser.userId]
    );

    return json(res, 200, { room: roomResult.rows[0] });
  } catch (error) {
    return handleError(res, error);
  }
}
