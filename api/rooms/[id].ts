import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { query } from '../_lib/db.js';
import { handleError, json } from '../_lib/utils.js';

const MONTH_FILTER = `
  EXTRACT(YEAR FROM e.expense_date) = EXTRACT(YEAR FROM CURRENT_DATE)
  AND EXTRACT(MONTH FROM e.expense_date) = EXTRACT(MONTH FROM CURRENT_DATE)
`;

const WEEK_FILTER = `
  e.expense_date >= date_trunc('week', CURRENT_DATE)::date
  AND e.expense_date < (date_trunc('week', CURRENT_DATE) + interval '7 days')::date
`;

async function getRoomAccess(roomId: number, userId: number) {
  return query<{
    id: number;
    name: string;
    invite_code: string;
    created_at: string;
    created_by: number;
    weekly_limit: number | null;
  }>(
    `SELECT r.id, r.name, r.invite_code, r.created_at, r.created_by,
            r.weekly_limit::float AS weekly_limit
     FROM rooms r
     INNER JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = $2
     WHERE r.id = $1`,
    [roomId, userId]
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const authUser = requireAuth(req);
    const roomId = Number(req.query.id);

    if (!roomId || Number.isNaN(roomId)) {
      return json(res, 400, { error: 'Valid room id is required' });
    }

    if (req.method === 'PATCH') {
      const { weeklyLimit } = req.body || {};
      const roomResult = await getRoomAccess(roomId, authUser.userId);

      if (roomResult.rows.length === 0) {
        return json(res, 403, { error: 'You are not a member of this room' });
      }

      const room = roomResult.rows[0];
      if (room.created_by !== authUser.userId) {
        return json(res, 403, { error: 'Only the room admin can set the weekly limit' });
      }

      const limit =
        weeklyLimit === null || weeklyLimit === ''
          ? null
          : Number(weeklyLimit);

      if (limit !== null && (Number.isNaN(limit) || limit <= 0)) {
        return json(res, 400, { error: 'Weekly limit must be a positive number' });
      }

      const updated = await query(
        `UPDATE rooms SET weekly_limit = $1 WHERE id = $2
         RETURNING id, name, invite_code, created_at, created_by, weekly_limit::float AS weekly_limit`,
        [limit, roomId]
      );

      return json(res, 200, { room: updated.rows[0] });
    }

    if (req.method !== 'GET') {
      return json(res, 405, { error: 'Method not allowed' });
    }

    const accessResult = await getRoomAccess(roomId, authUser.userId);

    if (accessResult.rows.length === 0) {
      const exists = await query('SELECT 1 FROM rooms WHERE id = $1', [roomId]);
      if (exists.rows.length === 0) {
        return json(res, 404, { error: 'Room not found' });
      }
      return json(res, 403, { error: 'You are not a member of this room' });
    }

    const room = accessResult.rows[0];

    const [membersResult, expensesResult, weeklyResult] = await Promise.all([
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
           AND ${MONTH_FILTER.replace(/e\./g, 'e.')}
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
           AND ${MONTH_FILTER}
         ORDER BY e.expense_date DESC, e.created_at DESC
         LIMIT 100`,
        [roomId]
      ),
      query<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0)::float AS total
         FROM expenses e
         WHERE e.room_id = $1 AND ${WEEK_FILTER}`,
        [roomId]
      ),
    ]);

    const memberCount = membersResult.rows.length;
    const monthlyExpense = membersResult.rows.reduce(
      (sum, row) => sum + row.total_paid,
      0
    );
    const equalShare = memberCount > 0 ? monthlyExpense / memberCount : 0;
    const weeklyExpense = weeklyResult.rows[0]?.total ?? 0;

    const members = membersResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      totalPaid: row.total_paid,
      balance: row.total_paid - equalShare,
    }));

    const now = new Date();
    const monthLabel = now.toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    });

    return json(res, 200, {
      room: {
        ...room,
        is_admin: room.created_by === authUser.userId,
      },
      members,
      expenses: expensesResult.rows,
      summary: {
        monthlyExpense,
        weeklyExpense,
        weeklyLimit: room.weekly_limit,
        memberCount,
        equalShare,
        monthLabel,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
}
