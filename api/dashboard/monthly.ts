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
    const roomId = Number(req.query.roomId);
    const year = Number(req.query.year) || new Date().getFullYear();

    if (!roomId || Number.isNaN(roomId)) {
      return json(res, 400, { error: 'Valid roomId is required' });
    }

    const memberCheck = await sql`
      SELECT 1 FROM room_members WHERE room_id = ${roomId} AND user_id = ${authUser.userId}
    `;

    if (memberCheck.rows.length === 0) {
      return json(res, 403, { error: 'You are not a member of this room' });
    }

    const monthlyResult = await sql`
      SELECT
        EXTRACT(MONTH FROM expense_date)::int AS month,
        SUM(amount)::float AS total
      FROM expenses
      WHERE room_id = ${roomId}
        AND EXTRACT(YEAR FROM expense_date) = ${year}
      GROUP BY EXTRACT(MONTH FROM expense_date)
      ORDER BY month
    `;

    const byMemberResult = await sql`
      SELECT u.name,
             SUM(e.amount)::float AS total
      FROM expenses e
      INNER JOIN users u ON u.id = e.user_id
      WHERE e.room_id = ${roomId}
        AND EXTRACT(YEAR FROM e.expense_date) = ${year}
      GROUP BY u.id, u.name
      ORDER BY total DESC
    `;

    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];

    const monthlyMap = new Map(
      monthlyResult.rows.map((r) => {
        const row = r as { month: number; total: number };
        return [row.month, row.total];
      })
    );

    const monthly = monthNames.map((name, index) => ({
      month: name,
      monthNum: index + 1,
      total: monthlyMap.get(index + 1) || 0,
    }));

    const yearTotal = monthly.reduce((sum, m) => sum + m.total, 0);

    return json(res, 200, {
      year,
      monthly,
      byMember: byMemberResult.rows,
      yearTotal,
    });
  } catch (error) {
    return handleError(res, error);
  }
}
