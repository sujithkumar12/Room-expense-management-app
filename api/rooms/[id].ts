import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { query } from '../_lib/db.js';
import { handleError, json } from '../_lib/utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const authUser = requireAuth(req);
    const roomId = Number(req.query.id);

    if (!roomId || Number.isNaN(roomId)) {
      return json(res, 400, { error: 'Valid room id is required' });
    }

    const accessResult = await query<{
      id: number;
      name: string;
      invite_code: string;
      created_at: string;
    }>(
      `SELECT r.id, r.name, r.invite_code, r.created_at
       FROM rooms r
       INNER JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = $2
       WHERE r.id = $1`,
      [roomId, authUser.userId]
    );

    if (accessResult.rows.length === 0) {
      const exists = await query('SELECT 1 FROM rooms WHERE id = $1', [roomId]);
      if (exists.rows.length === 0) {
        return json(res, 404, { error: 'Room not found' });
      }
      return json(res, 403, { error: 'You are not a member of this room' });
    }

    const [membersResult, expensesResult] = await Promise.all([
      query<{
        id: number;
        name: string;
        email: string;
        total_paid: number;
      }>(
        `SELECT u.id, u.name, u.email,
                COALESCE(SUM(e.amount), 0)::float AS total_paid
         FROM room_members rm
         INNER JOIN users u ON u.id = rm.user_id
         LEFT JOIN expenses e ON e.user_id = u.id AND e.room_id = $1
         WHERE rm.room_id = $1
         GROUP BY u.id, u.name, u.email
         ORDER BY u.name`,
        [roomId]
      ),
      query(
        `SELECT e.id, e.amount::float AS amount, e.purpose, e.expense_date, e.created_at,
                u.id AS user_id, u.name AS user_name
         FROM expenses e
         INNER JOIN users u ON u.id = e.user_id
         WHERE e.room_id = $1
         ORDER BY e.expense_date DESC, e.created_at DESC
         LIMIT 100`,
        [roomId]
      ),
    ]);

    const memberCount = membersResult.rows.length;
    const totalExpense = membersResult.rows.reduce(
      (sum, row) => sum + row.total_paid,
      0
    );
    const equalShare = memberCount > 0 ? totalExpense / memberCount : 0;

    const members = membersResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      totalPaid: row.total_paid,
      balance: row.total_paid - equalShare,
    }));

    return json(res, 200, {
      room: accessResult.rows[0],
      members,
      expenses: expensesResult.rows,
      summary: {
        totalExpense,
        memberCount,
        equalShare,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
}
