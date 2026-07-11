import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../auth.js';
import { query } from '../db.js';
import { generateInviteCode, handleError, json } from '../utils.js';

export async function handleRooms(req: VercelRequest, res: VercelResponse) {
  try {
    const authUser = requireAuth(req);

    if (req.method === 'GET') {
      const result = await query(
        `SELECT r.id, r.name, r.invite_code, r.created_at,
                (SELECT COUNT(*)::int FROM room_members rm WHERE rm.room_id = r.id AND rm.left_at IS NULL) AS member_count
         FROM rooms r
         INNER JOIN room_members rm ON rm.room_id = r.id AND rm.left_at IS NULL
         WHERE rm.user_id = $1
         ORDER BY r.created_at DESC`,
        [authUser.userId]
      );

      return json(res, 200, { rooms: result.rows });
    }

    if (req.method === 'POST') {
      const { name } = req.body || {};

      if (!name?.trim()) {
        return json(res, 400, { error: 'Room name is required' });
      }

      let inviteCode = generateInviteCode();
      let attempts = 0;

      while (attempts < 5) {
        const existing = await query('SELECT id FROM rooms WHERE invite_code = $1', [inviteCode]);
        if (existing.rows.length === 0) break;
        inviteCode = generateInviteCode();
        attempts++;
      }

      const roomResult = await query(
        `WITH new_room AS (
           INSERT INTO rooms (name, invite_code, created_by)
           VALUES ($1, $2, $3)
           RETURNING id, name, invite_code, created_at
         ),
         insert_member AS (
           INSERT INTO room_members (room_id, user_id)
           SELECT id, $3 FROM new_room
         )
         SELECT id, name, invite_code, created_at FROM new_room`,
        [name.trim(), inviteCode, authUser.userId]
      );

      return json(res, 201, { room: roomResult.rows[0] });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return handleError(res, error);
  }
}
