import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { requireAuth } from '../_lib/auth.js';
import { ensureSchema } from '../_lib/db.js';
import { handleError, json } from '../_lib/utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    await ensureSchema();
    const authUser = requireAuth(req);
    const roomId = Number(req.query.id);

    if (!roomId || Number.isNaN(roomId)) {
      return json(res, 400, { error: 'Valid room id is required' });
    }

    const memberCheck = await sql`
      SELECT 1 FROM room_members WHERE room_id = ${roomId} AND user_id = ${authUser.userId}
    `;

    if (memberCheck.rows.length === 0) {
      return json(res, 403, { error: 'You are not a member of this room' });
    }

    const roomResult = await sql`
      SELECT id, name, invite_code, created_at FROM rooms WHERE id = ${roomId}
    `;

    if (roomResult.rows.length === 0) {
      return json(res, 404, { error: 'Room not found' });
    }

    const membersResult = await sql`
      SELECT u.id, u.name, u.email,
             COALESCE(SUM(e.amount), 0)::float AS total_paid
      FROM room_members rm
      INNER JOIN users u ON u.id = rm.user_id
      LEFT JOIN expenses e ON e.user_id = u.id AND e.room_id = ${roomId}
      WHERE rm.room_id = ${roomId}
      GROUP BY u.id, u.name, u.email
      ORDER BY u.name
    `;

    const totalResult = await sql`
      SELECT COALESCE(SUM(amount), 0)::float AS total FROM expenses WHERE room_id = ${roomId}
    `;

    const memberCount = membersResult.rows.length;
    const totalExpense = (totalResult.rows[0] as { total: number }).total;
    const equalShare = memberCount > 0 ? totalExpense / memberCount : 0;

    const expensesResult = await sql`
      SELECT e.id, e.amount::float AS amount, e.purpose, e.expense_date, e.created_at,
             u.id AS user_id, u.name AS user_name
      FROM expenses e
      INNER JOIN users u ON u.id = e.user_id
      WHERE e.room_id = ${roomId}
      ORDER BY e.expense_date DESC, e.created_at DESC
    `;

    const members = membersResult.rows.map((m) => {
      const row = m as { id: number; name: string; email: string; total_paid: number };
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        totalPaid: row.total_paid,
        balance: row.total_paid - equalShare,
      };
    });

    return json(res, 200, {
      room: roomResult.rows[0],
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
