import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../auth.js';
import { query } from '../db.js';
import { handleError, json } from '../utils.js';

export async function handleExpenseById(req: VercelRequest, res: VercelResponse) {
  try {
    const authUser = requireAuth(req);
    const expenseId = Number(req.query.id);

    if (!expenseId || Number.isNaN(expenseId)) {
      return json(res, 400, { error: 'Valid expense id is required' });
    }

    const existing = await query<{
      id: number;
      user_id: number;
      room_id: number;
    }>('SELECT id, user_id, room_id FROM expenses WHERE id = $1', [expenseId]);

    if (existing.rows.length === 0) {
      return json(res, 404, { error: 'Expense not found' });
    }

    const expense = existing.rows[0];

    const memberCheck = await query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL',
      [expense.room_id, authUser.userId]
    );

    if (memberCheck.rows.length === 0) {
      return json(res, 403, { error: 'You are not a member of this room' });
    }

    if (expense.user_id !== authUser.userId) {
      return json(res, 403, { error: 'You can only edit or delete your own expenses' });
    }

    if (req.method === 'DELETE') {
      await query('DELETE FROM expenses WHERE id = $1', [expenseId]);
      return json(res, 200, { success: true });
    }

    if (req.method === 'PUT') {
      const { amount, purpose, expenseDate } = req.body || {};

      if (amount === undefined || !purpose?.trim()) {
        return json(res, 400, { error: 'Amount and purpose are required' });
      }

      const parsedAmount = Number(amount);
      if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        return json(res, 400, { error: 'Amount must be a positive number' });
      }

      const date = expenseDate || new Date().toISOString().split('T')[0];

      const result = await query(
        `UPDATE expenses
         SET amount = $1, purpose = $2, expense_date = $3
         WHERE id = $4
         RETURNING id, amount::float AS amount, purpose, expense_date, created_at, user_id`,
        [parsedAmount, purpose.trim(), date, expenseId]
      );

      return json(res, 200, { expense: result.rows[0] });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return handleError(res, error);
  }
}
