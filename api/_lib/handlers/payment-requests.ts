import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../auth.js';
import { query } from '../db.js';
import { handleError, json } from '../utils.js';

async function verifyMembership(roomId: number, userId: number) {
  const result = await query(
    'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL',
    [roomId, userId]
  );
  return result.rows.length > 0;
}

export async function handlePaymentRequests(req: VercelRequest, res: VercelResponse) {
  try {
    const authUser = requireAuth(req);

    if (req.method !== 'POST') {
      return json(res, 405, { error: 'Method not allowed' });
    }

    const { roomId, payeeId, amount, year, month } = req.body || {};
    const roomIdNum = Number(roomId);
    const payeeIdNum = Number(payeeId);
    const amountNum = Number(amount);
    const yearNum = Number(year);
    const monthNum = Number(month);

    if (!roomIdNum || !payeeIdNum || !amountNum || !yearNum || !monthNum) {
      return json(res, 400, { error: 'roomId, payeeId, amount, year, and month are required' });
    }

    if (payeeIdNum === authUser.userId) {
      return json(res, 400, { error: 'You cannot pay yourself' });
    }

    if (Number.isNaN(amountNum) || amountNum <= 0) {
      return json(res, 400, { error: 'Amount must be a positive number' });
    }

    if (monthNum < 1 || monthNum > 12) {
      return json(res, 400, { error: 'Invalid month' });
    }

    if (!(await verifyMembership(roomIdNum, authUser.userId))) {
      return json(res, 403, { error: 'You are not a member of this room' });
    }

    const payeeCheck = await query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL',
      [roomIdNum, payeeIdNum]
    );
    if (payeeCheck.rows.length === 0) {
      return json(res, 400, { error: 'Payee is not a member of this room' });
    }

    const existing = await query(
      `SELECT id FROM payment_requests
       WHERE room_id = $1 AND payer_id = $2 AND payee_id = $3
         AND settlement_year = $4 AND settlement_month = $5
         AND status = 'pending'`,
      [roomIdNum, authUser.userId, payeeIdNum, yearNum, monthNum]
    );
    if (existing.rows.length > 0) {
      return json(res, 409, {
        error: 'You already have a pending payment request to this roommate',
        paymentRequestId: (existing.rows[0] as { id: number }).id,
      });
    }

    const result = await query(
      `INSERT INTO payment_requests
         (room_id, payer_id, payee_id, amount, settlement_year, settlement_month, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING id, amount::float AS amount, status, settlement_year, settlement_month, created_at`,
      [roomIdNum, authUser.userId, payeeIdNum, amountNum, yearNum, monthNum]
    );

    const payer = await query<{ name: string }>(
      'SELECT name FROM users WHERE id = $1',
      [authUser.userId]
    );
    const payee = await query<{ name: string }>(
      'SELECT name FROM users WHERE id = $1',
      [payeeIdNum]
    );

    return json(res, 201, {
      paymentRequest: {
        ...result.rows[0],
        payer_id: authUser.userId,
        payer_name: payer.rows[0]?.name,
        payee_id: payeeIdNum,
        payee_name: payee.rows[0]?.name,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
}
