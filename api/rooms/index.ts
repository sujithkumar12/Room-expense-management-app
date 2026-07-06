import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { requireAuth } from '../_lib/auth.js';
import { ensureSchema } from '../_lib/db.js';
import { generateInviteCode, handleError, json } from '../_lib/utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await ensureSchema();
    const authUser = requireAuth(req);

    if (req.method === 'GET') {
      const result = await sql`
        SELECT r.id, r.name, r.invite_code, r.created_at,
               (SELECT COUNT(*)::int FROM room_members rm WHERE rm.room_id = r.id) AS member_count
        FROM rooms r
        INNER JOIN room_members rm ON rm.room_id = r.id
        WHERE rm.user_id = ${authUser.userId}
        ORDER BY r.created_at DESC
      `;

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
        const existing = await sql`SELECT id FROM rooms WHERE invite_code = ${inviteCode}`;
        if (existing.rows.length === 0) break;
        inviteCode = generateInviteCode();
        attempts++;
      }

      const roomResult = await sql`
        INSERT INTO rooms (name, invite_code, created_by)
        VALUES (${name.trim()}, ${inviteCode}, ${authUser.userId})
        RETURNING id, name, invite_code, created_at
      `;

      const room = roomResult.rows[0] as { id: number };

      await sql`
        INSERT INTO room_members (room_id, user_id)
        VALUES (${room.id}, ${authUser.userId})
      `;

      return json(res, 201, { room: roomResult.rows[0] });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return handleError(res, error);
  }
}
