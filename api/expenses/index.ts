import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { requireAuth } from '../_lib/auth.js';
import { ensureSchema } from '../_lib/db.js';
import { handleError, json } from '../_lib/utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await ensureSchema();
    const authUser = requireAuth(req);

    if (req.method === 'GET') {
      const roomId = Number(req.query.roomId);

      if (!roomId || Number.isNaN(roomId)) {
        return json(res, 400, { error: 'Valid roomId is required' });
      }

      const memberCheck = await sql`
        SELECT 1 FROM room_members WHERE room_id = ${roomId} AND user_id = ${authUser.userId}
      `;

      if (memberCheck.rows.length === 0) {
        return json(res, 403, { error: 'You are not a member of this room' });
      }

      const result = await sql`
        SELECT e.id, e.amount::float AS amount, e.purpose, e.expense_date, e.created_at,
               u.id AS user_id, u.name AS user_name
        FROM expenses e
        INNER JOIN users u ON u.id = e.user_id
        WHERE e.room_id = ${roomId}
        ORDER BY e.expense_date DESC, e.created_at DESC
      `;

      return json(res, 200, { expenses: result.rows });
    }

    if (req.method === 'POST') {
      const { roomId, amount, purpose, expenseDate } = req.body || {};

      if (!roomId || amount === undefined || !purpose?.trim()) {
        return json(res, 400, { error: 'Room, amount, and purpose are required' });
      }

      const parsedAmount = Number(amount);
      if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        return json(res, 400, { error: 'Amount must be a positive number' });
      }

      const memberCheck = await sql`
        SELECT 1 FROM room_members WHERE room_id = ${roomId} AND user_id = ${authUser.userId}
      `;

      if (memberCheck.rows.length === 0) {
        return json(res, 403, { error: 'You are not a member of this room' });
      }

      const date = expenseDate || new Date().toISOString().split('T')[0];

      const result = await sql`
        INSERT INTO expenses (room_id, user_id, amount, purpose, expense_date)
        VALUES (${roomId}, ${authUser.userId}, ${parsedAmount}, ${purpose.trim()}, ${date})
        RETURNING id, amount::float AS amount, purpose, expense_date, created_at
      `;

      return json(res, 201, { expense: result.rows[0] });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return handleError(res, error);
  }
}
