import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logRoomActivity } from '../activity.js';
import { requireAuth } from '../auth.js';
import { query } from '../db.js';
import { handleError, json } from '../utils.js';

export async function handlePaymentRequestById(req: VercelRequest, res: VercelResponse) {
  try {
    const authUser = requireAuth(req);
    const requestId = Number(req.query.id);

    if (!requestId || Number.isNaN(requestId)) {
      return json(res, 400, { error: 'Valid payment request id is required' });
    }

    const existing = await query<{
      id: number;
      room_id: number;
      payer_id: number;
      payee_id: number;
      amount: number;
      status: string;
      settlement_year: number;
      settlement_month: number;
    }>(
      `SELECT id, room_id, payer_id, payee_id, amount::float AS amount,
              status, settlement_year, settlement_month
       FROM payment_requests WHERE id = $1`,
      [requestId]
    );

    if (existing.rows.length === 0) {
      return json(res, 404, { error: 'Payment request not found' });
    }

    const paymentRequest = existing.rows[0];

    if (req.method === 'DELETE') {
      if (paymentRequest.payer_id !== authUser.userId) {
        return json(res, 403, { error: 'Only the payer can cancel this request' });
      }
      if (paymentRequest.status !== 'pending') {
        return json(res, 400, { error: 'Only pending requests can be cancelled' });
      }

      await query(
        `UPDATE payment_requests SET status = 'cancelled', responded_at = NOW() WHERE id = $1`,
        [requestId]
      );

      return json(res, 200, { success: true });
    }

    if (req.method !== 'PATCH') {
      return json(res, 405, { error: 'Method not allowed' });
    }

    const { action } = req.body || {};

    if (action !== 'confirm' && action !== 'reject') {
      return json(res, 400, { error: 'action must be "confirm" or "reject"' });
    }

    if (paymentRequest.payee_id !== authUser.userId) {
      return json(res, 403, { error: 'Only the recipient can confirm or decline this payment' });
    }

    if (paymentRequest.status !== 'pending') {
      return json(res, 400, { error: 'This payment request has already been handled' });
    }

    const payer = await query<{ name: string }>(
      'SELECT name FROM users WHERE id = $1',
      [paymentRequest.payer_id]
    );
    const payee = await query<{ name: string }>(
      'SELECT name FROM users WHERE id = $1',
      [paymentRequest.payee_id]
    );
    const payerName = payer.rows[0]?.name ?? 'Someone';
    const payeeName = payee.rows[0]?.name ?? 'Someone';

    if (action === 'reject') {
      await query(
        `UPDATE payment_requests SET status = 'rejected', responded_at = NOW() WHERE id = $1`,
        [requestId]
      );

      await logRoomActivity(
        paymentRequest.room_id,
        authUser.userId,
        'payment_rejected',
        `${payeeName} declined ₹${paymentRequest.amount.toFixed(2)} payment from ${payerName}`
      );

      return json(res, 200, { success: true, status: 'rejected' });
    }

    const settlementResult = await query<{ id: number }>(
      `INSERT INTO settlements
         (room_id, payer_id, payee_id, amount, note, settlement_year, settlement_month)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        paymentRequest.room_id,
        paymentRequest.payer_id,
        paymentRequest.payee_id,
        paymentRequest.amount,
        'UPI payment confirmed',
        paymentRequest.settlement_year,
        paymentRequest.settlement_month,
      ]
    );

    const settlementId = settlementResult.rows[0].id;

    await query(
      `UPDATE payment_requests
       SET status = 'confirmed', responded_at = NOW(), settlement_id = $2
       WHERE id = $1`,
      [requestId, settlementId]
    );

    await logRoomActivity(
      paymentRequest.room_id,
      authUser.userId,
      'payment_confirmed',
      `${payeeName} confirmed ₹${paymentRequest.amount.toFixed(2)} from ${payerName}`
    );

    return json(res, 200, { success: true, status: 'confirmed', settlementId });
  } catch (error) {
    return handleError(res, error);
  }
}
