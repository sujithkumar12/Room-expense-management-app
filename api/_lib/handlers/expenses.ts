import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../auth.js';
import { query } from '../db.js';
import { handleError, json } from '../utils.js';

export async function handleExpenses(req: VercelRequest, res: VercelResponse) {
  try {
    const authUser = requireAuth(req);

    if (req.method === 'GET') {
      const roomId = Number(req.query.roomId);

      if (!roomId || Number.isNaN(roomId)) {
        return json(res, 400, { error: 'Valid roomId is required' });
      }

      const memberCheck = await query(
        'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL',
        [roomId, authUser.userId]
      );

      if (memberCheck.rows.length === 0) {
        return json(res, 403, { error: 'You are not a member of this room' });
      }

      const result = await query(
        `SELECT e.id, e.amount::float AS amount, e.purpose, e.expense_date, e.created_at,
                u.id AS user_id, u.name AS user_name
         FROM expenses e
         INNER JOIN users u ON u.id = e.user_id
         WHERE e.room_id = $1
         ORDER BY e.expense_date DESC, e.created_at DESC
         LIMIT 100`,
        [roomId]
      );

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

      const result = await query(
        `INSERT INTO expenses (room_id, user_id, amount, purpose, expense_date)
         SELECT $1, $2, $3, $4, $5
         WHERE EXISTS (
           SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
         )
         RETURNING id, amount::float AS amount, purpose, expense_date, created_at`,
        [
          roomId,
          authUser.userId,
          parsedAmount,
          purpose.trim(),
          expenseDate || new Date().toISOString().split('T')[0],
        ]
      );

      if (result.rows.length === 0) {
        return json(res, 403, { error: 'You are not a member of this room' });
      }

      return json(res, 201, { expense: result.rows[0] });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return handleError(res, error);
  }
}
