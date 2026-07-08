import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { query } from '../_lib/db.js';
import { handleError, json } from '../_lib/utils.js';

async function verifyMembership(roomId: number, userId: number) {
  const result = await query(
    'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
    [roomId, userId]
  );
  return result.rows.length > 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const authUser = requireAuth(req);

    if (req.method === 'GET') {
      const roomId = Number(req.query.roomId);
      const year = Number(req.query.year);
      const month = Number(req.query.month);

      if (!roomId || !year || !month) {
        return json(res, 400, { error: 'roomId, year, and month are required' });
      }

      if (!(await verifyMembership(roomId, authUser.userId))) {
        return json(res, 403, { error: 'You are not a member of this room' });
      }

      const result = await query(
        `SELECT s.id, s.amount::float AS amount, s.note,
                s.settlement_year, s.settlement_month, s.created_at,
                payer.id AS payer_id, payer.name AS payer_name,
                payee.id AS payee_id, payee.name AS payee_name
         FROM settlements s
         INNER JOIN users payer ON payer.id = s.payer_id
         INNER JOIN users payee ON payee.id = s.payee_id
         WHERE s.room_id = $1
           AND s.settlement_year = $2
           AND s.settlement_month = $3
         ORDER BY s.created_at DESC`,
        [roomId, year, month]
      );

      return json(res, 200, { settlements: result.rows });
    }

    if (req.method === 'POST') {
      const { roomId, payeeId, amount, note, year, month } = req.body || {};
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
        'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
        [roomIdNum, payeeIdNum]
      );
      if (payeeCheck.rows.length === 0) {
        return json(res, 400, { error: 'Payee is not a member of this room' });
      }

      const result = await query(
        `INSERT INTO settlements (room_id, payer_id, payee_id, amount, note, settlement_year, settlement_month)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, amount::float AS amount, note, settlement_year, settlement_month, created_at`,
        [
          roomIdNum,
          authUser.userId,
          payeeIdNum,
          amountNum,
          note?.trim() || null,
          yearNum,
          monthNum,
        ]
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
        settlement: {
          ...result.rows[0],
          payer_id: authUser.userId,
          payer_name: payer.rows[0]?.name,
          payee_id: payeeIdNum,
          payee_name: payee.rows[0]?.name,
        },
      });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return handleError(res, error);
  }
}
