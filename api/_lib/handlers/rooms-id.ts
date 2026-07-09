import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logRoomActivity } from '../activity.js';
import { requireAuth } from '../auth.js';
import { query } from '../db.js';
import { handleError, json } from '../utils.js';

function parsePeriod(req: VercelRequest): { year: number; month: number } {
  const now = new Date();
  let year = Number(req.query.year) || now.getFullYear();
  let month = Number(req.query.month) || now.getMonth() + 1;

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    year = now.getFullYear();
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    month = now.getMonth() + 1;
  }

  return { year, month };
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

function previousPeriod(year: number, month: number) {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

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

export async function handleRoomById(req: VercelRequest, res: VercelResponse) {
  try {
    const authUser = requireAuth(req);
    const roomId = Number(req.query.id);

    if (!roomId || Number.isNaN(roomId)) {
      return json(res, 400, { error: 'Valid room id is required' });
    }

    if (req.method === 'PATCH') {
      const { weeklyLimit, name, transferAdminTo } = req.body || {};
      const roomResult = await getRoomAccess(roomId, authUser.userId);

      if (roomResult.rows.length === 0) {
        return json(res, 403, { error: 'You are not a member of this room' });
      }

      const room = roomResult.rows[0];
      const isAdmin = room.created_by === authUser.userId;

      if (name !== undefined) {
        if (!isAdmin) {
          return json(res, 403, { error: 'Only the room admin can rename the room' });
        }
        if (!name?.trim()) {
          return json(res, 400, { error: 'Room name is required' });
        }
        const updated = await query(
          `UPDATE rooms SET name = $1 WHERE id = $2
           RETURNING id, name, invite_code, created_at, created_by, weekly_limit::float AS weekly_limit`,
          [name.trim(), roomId]
        );
        const actor = await query<{ name: string }>('SELECT name FROM users WHERE id = $1', [
          authUser.userId,
        ]);
        await logRoomActivity(
          roomId,
          authUser.userId,
          'room_renamed',
          `${actor.rows[0]?.name ?? 'Someone'} renamed the room to "${name.trim()}"`
        );
        return json(res, 200, { room: { ...updated.rows[0], is_admin: true } });
      }

      if (transferAdminTo !== undefined) {
        if (!isAdmin) {
          return json(res, 403, { error: 'Only the room admin can transfer admin role' });
        }
        const newAdminId = Number(transferAdminTo);
        if (!newAdminId || Number.isNaN(newAdminId)) {
          return json(res, 400, { error: 'Valid member id is required' });
        }
        if (newAdminId === authUser.userId) {
          return json(res, 400, { error: 'You are already the admin' });
        }
        const memberCheck = await query(
          'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
          [roomId, newAdminId]
        );
        if (memberCheck.rows.length === 0) {
          return json(res, 400, { error: 'That user is not a member of this room' });
        }
        const newAdmin = await query<{ name: string }>(
          'SELECT name FROM users WHERE id = $1',
          [newAdminId]
        );
        const updated = await query(
          `UPDATE rooms SET created_by = $1 WHERE id = $2
           RETURNING id, name, invite_code, created_at, created_by, weekly_limit::float AS weekly_limit`,
          [newAdminId, roomId]
        );
        const actor = await query<{ name: string }>('SELECT name FROM users WHERE id = $1', [
          authUser.userId,
        ]);
        await logRoomActivity(
          roomId,
          authUser.userId,
          'admin_transferred',
          `${actor.rows[0]?.name ?? 'Admin'} transferred admin to ${newAdmin.rows[0]?.name ?? 'a member'}`
        );
        return json(res, 200, { room: { ...updated.rows[0], is_admin: false } });
      }

      if (weeklyLimit === undefined) {
        return json(res, 400, { error: 'No valid fields to update' });
      }

      if (!isAdmin) {
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

    if (req.method === 'DELETE') {
      const roomResult = await getRoomAccess(roomId, authUser.userId);

      if (roomResult.rows.length === 0) {
        return json(res, 403, { error: 'You are not a member of this room' });
      }

      const room = roomResult.rows[0];
      if (room.created_by !== authUser.userId) {
        return json(res, 403, { error: 'Only the room admin can delete the room' });
      }

      await query('DELETE FROM rooms WHERE id = $1', [roomId]);
      return json(res, 200, { success: true });
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
    const { year, month } = parsePeriod(req);
    const prev = previousPeriod(year, month);
    const now = new Date();
    const isCurrentMonth =
      year === now.getFullYear() && month === now.getMonth() + 1;

    const [
      membersResult,
      expensesResult,
      weeklyResult,
      historyResult,
      settlementsResult,
      settlementTotalsResult,
      prevMonthResult,
      paymentRequestsResult,
    ] = await Promise.all([
      query<{
        id: number;
        name: string;
        email: string;
        upi_id: string | null;
        total_paid: number;
      }>(
        `SELECT u.id, u.name, u.email, u.upi_id,
                COALESCE(SUM(e.amount), 0)::float AS total_paid
         FROM room_members rm
         INNER JOIN users u ON u.id = rm.user_id
         LEFT JOIN expenses e ON e.user_id = u.id AND e.room_id = $1
           AND EXTRACT(YEAR FROM e.expense_date) = $2
           AND EXTRACT(MONTH FROM e.expense_date) = $3
         WHERE rm.room_id = $1
         GROUP BY u.id, u.name, u.email, u.upi_id
         ORDER BY u.name`,
        [roomId, year, month]
      ),
      query(
        `SELECT e.id, e.amount::float AS amount, e.purpose, e.expense_date, e.created_at,
                u.id AS user_id, u.name AS user_name
         FROM expenses e
         INNER JOIN users u ON u.id = e.user_id
         WHERE e.room_id = $1
           AND EXTRACT(YEAR FROM e.expense_date) = $2
           AND EXTRACT(MONTH FROM e.expense_date) = $3
         ORDER BY e.expense_date DESC, e.created_at DESC`,
        [roomId, year, month]
      ),
      isCurrentMonth
        ? query<{ total: number }>(
            `SELECT COALESCE(SUM(amount), 0)::float AS total
             FROM expenses e
             WHERE e.room_id = $1
               AND e.expense_date >= date_trunc('week', CURRENT_DATE)::date
               AND e.expense_date < (date_trunc('week', CURRENT_DATE) + interval '7 days')::date`,
            [roomId]
          )
        : Promise.resolve({ rows: [{ total: 0 }] }),
      query<{ year: number; month: number }>(
        `SELECT DISTINCT
           EXTRACT(YEAR FROM expense_date)::int AS year,
           EXTRACT(MONTH FROM expense_date)::int AS month
         FROM expenses
         WHERE room_id = $1
         ORDER BY year DESC, month DESC`,
        [roomId]
      ),
      query(
        `SELECT s.id, s.amount::float AS amount, s.note, s.created_at,
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
      ),
      query<{
        user_id: number;
        paid_out: number;
        received_in: number;
      }>(
        `SELECT u.id AS user_id,
                COALESCE(SUM(CASE WHEN s.payer_id = u.id THEN s.amount ELSE 0 END), 0)::float AS paid_out,
                COALESCE(SUM(CASE WHEN s.payee_id = u.id THEN s.amount ELSE 0 END), 0)::float AS received_in
         FROM room_members rm
         INNER JOIN users u ON u.id = rm.user_id
         LEFT JOIN settlements s ON s.room_id = rm.room_id
           AND s.settlement_year = $2
           AND s.settlement_month = $3
           AND (s.payer_id = u.id OR s.payee_id = u.id)
         WHERE rm.room_id = $1
         GROUP BY u.id`,
        [roomId, year, month]
      ),
      query<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0)::float AS total
         FROM expenses
         WHERE room_id = $1
           AND EXTRACT(YEAR FROM expense_date) = $2
           AND EXTRACT(MONTH FROM expense_date) = $3`,
        [roomId, prev.year, prev.month]
      ),
      query(
        `SELECT pr.id, pr.amount::float AS amount, pr.status, pr.created_at,
                pr.settlement_year, pr.settlement_month,
                payer.id AS payer_id, payer.name AS payer_name,
                payee.id AS payee_id, payee.name AS payee_name
         FROM payment_requests pr
         INNER JOIN users payer ON payer.id = pr.payer_id
         INNER JOIN users payee ON payee.id = pr.payee_id
         WHERE pr.room_id = $1
           AND pr.settlement_year = $2
           AND pr.settlement_month = $3
           AND pr.status = 'pending'
           AND (pr.payer_id = $4 OR pr.payee_id = $4)
         ORDER BY pr.created_at DESC`,
        [roomId, year, month, authUser.userId]
      ),
    ]);

    const memberCount = membersResult.rows.length;
    const monthlyExpense = membersResult.rows.reduce(
      (sum, row) => sum + row.total_paid,
      0
    );
    const equalShare = memberCount > 0 ? monthlyExpense / memberCount : 0;
    const weeklyExpense = weeklyResult.rows[0]?.total ?? 0;
    const previousMonthExpense = prevMonthResult.rows[0]?.total ?? 0;

    const settlementMap = new Map(
      settlementTotalsResult.rows.map((row) => [
        row.user_id,
        { paidOut: row.paid_out, receivedIn: row.received_in },
      ])
    );

    const members = membersResult.rows.map((row) => {
      const expenseBalance = row.total_paid - equalShare;
      const settlements = settlementMap.get(row.id) ?? { paidOut: 0, receivedIn: 0 };
      const balance =
        expenseBalance + settlements.paidOut - settlements.receivedIn;
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        upiId: row.upi_id,
        totalPaid: row.total_paid,
        balance,
        expenseBalance,
        settledPaid: settlements.paidOut,
        settledReceived: settlements.receivedIn,
      };
    });

    const historySet = new Set(
      historyResult.rows.map((row) => `${row.year}-${row.month}`)
    );
    historySet.add(`${now.getFullYear()}-${now.getMonth() + 1}`);

    const availableMonths = Array.from(historySet)
      .map((key) => {
        const [y, m] = key.split('-').map(Number);
        return { year: y, month: m, label: monthLabel(y, m) };
      })
      .sort((a, b) => b.year - a.year || b.month - a.month);

    let monthChangePercent: number | null = null;
    if (previousMonthExpense > 0) {
      monthChangePercent =
        ((monthlyExpense - previousMonthExpense) / previousMonthExpense) * 100;
    } else if (monthlyExpense > 0) {
      monthChangePercent = 100;
    }

    return json(res, 200, {
      room: {
        ...room,
        is_admin: room.created_by === authUser.userId,
      },
      members,
      expenses: expensesResult.rows,
      settlements: settlementsResult.rows,
      paymentRequests: paymentRequestsResult.rows,
      availableMonths,
      summary: {
        monthlyExpense,
        previousMonthExpense,
        monthChangePercent,
        weeklyExpense,
        weeklyLimit: room.weekly_limit,
        memberCount,
        equalShare,
        monthLabel: monthLabel(year, month),
        previousMonthLabel: monthLabel(prev.year, prev.month),
        selectedYear: year,
        selectedMonth: month,
        isCurrentMonth,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
}
