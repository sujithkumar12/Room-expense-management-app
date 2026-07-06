import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { requireAuth } from '../_lib/auth.js';
import { ensureSchema } from '../_lib/db.js';
import { handleError, json } from '../_lib/utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    await ensureSchema();
    const authUser = requireAuth(req);

    const { inviteCode } = req.body || {};

    if (!inviteCode?.trim()) {
      return json(res, 400, { error: 'Invite code is required' });
    }

    const code = inviteCode.trim().toUpperCase();
    const roomResult = await sql`
      SELECT id, name, invite_code, created_at FROM rooms WHERE invite_code = ${code}
    `;

    if (roomResult.rows.length === 0) {
      return json(res, 404, { error: 'Room not found with that invite code' });
    }

    const room = roomResult.rows[0] as { id: number };

    const memberCheck = await sql`
      SELECT 1 FROM room_members WHERE room_id = ${room.id} AND user_id = ${authUser.userId}
    `;

    if (memberCheck.rows.length === 0) {
      await sql`
        INSERT INTO room_members (room_id, user_id)
        VALUES (${room.id}, ${authUser.userId})
      `;
    }

    return json(res, 200, { room: roomResult.rows[0] });
  } catch (error) {
    return handleError(res, error);
  }
}
