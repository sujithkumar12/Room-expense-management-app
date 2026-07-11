import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../auth.js';
import { query } from '../db.js';
import { handleError, json } from '../utils.js';

export async function handleRoomActivity(req: VercelRequest, res: VercelResponse) {
  try {
    const authUser = requireAuth(req);
    const roomId = Number(req.query.id);

    if (!roomId || Number.isNaN(roomId)) {
      return json(res, 400, { error: 'Valid room id is required' });
    }

    if (req.method !== 'GET') {
      return json(res, 405, { error: 'Method not allowed' });
    }

    const memberCheck = await query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL',
      [roomId, authUser.userId]
    );

    if (memberCheck.rows.length === 0) {
      return json(res, 403, { error: 'You are not a member of this room' });
    }

    const result = await query<{
      id: string;
      activity_type: string;
      message: string;
      actor_name: string;
      created_at: string;
    }>(
      `SELECT * FROM (
         SELECT
           'e-' || e.id::text AS id,
           'expense_added' AS activity_type,
           u.name || ' added ' || e.purpose || ' (₹' || ROUND(e.amount)::text || ')' AS message,
           u.name AS actor_name,
           e.created_at
         FROM expenses e
         INNER JOIN users u ON u.id = e.user_id
         WHERE e.room_id = $1

         UNION ALL

         SELECT
           's-' || s.id::text,
           'settlement_added',
           payer.name || ' paid ' || payee.name || ' ₹' || ROUND(s.amount)::text,
           payer.name,
           s.created_at
         FROM settlements s
         INNER JOIN users payer ON payer.id = s.payer_id
         INNER JOIN users payee ON payee.id = s.payee_id
         WHERE s.room_id = $1

         UNION ALL

         SELECT
           'j-' || rm.user_id::text || '-' || EXTRACT(EPOCH FROM rm.joined_at)::text,
           'member_joined',
           u.name || ' joined the room',
           u.name,
           rm.joined_at
         FROM room_members rm
         INNER JOIN users u ON u.id = rm.user_id
         WHERE rm.room_id = $1

         UNION ALL

         SELECT
           'a-' || ra.id::text,
           ra.activity_type,
           ra.message,
           u.name,
           ra.created_at
         FROM room_activities ra
         INNER JOIN users u ON u.id = ra.actor_id
         WHERE ra.room_id = $1
       ) feed
       ORDER BY created_at DESC
       LIMIT 200`,
      [roomId]
    );

    return json(res, 200, { activities: result.rows });
  } catch (error) {
    return handleError(res, error);
  }
}
