import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../auth.js';
import { query } from '../db.js';
import { handleError, json } from '../utils.js';

function previousPeriod(year: number, month: number) {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

export async function handleDashboardMonthly(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const authUser = requireAuth(req);
    const roomId = Number(req.query.roomId);
    const year = Number(req.query.year) || new Date().getFullYear();

    if (!roomId || Number.isNaN(roomId)) {
      return json(res, 400, { error: 'Valid roomId is required' });
    }

    const memberCheck = await query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
      [roomId, authUser.userId]
    );

    if (memberCheck.rows.length === 0) {
      return json(res, 403, { error: 'You are not a member of this room' });
    }

    const now = new Date();
    const currentCalendarYear = now.getFullYear();
    const currentCalendarMonth = now.getMonth() + 1;
    const prev = previousPeriod(currentCalendarYear, currentCalendarMonth);

    const [monthlyResult, byMemberResult, yearsResult, prevYearResult, currentMonthResult, prevMonthResult, weeklyResult, roomResult] = await Promise.all([
      query(
        `SELECT
           EXTRACT(MONTH FROM expense_date)::int AS month,
           SUM(amount)::float AS total
         FROM expenses
         WHERE room_id = $1
           AND EXTRACT(YEAR FROM expense_date) = $2
         GROUP BY EXTRACT(MONTH FROM expense_date)
         ORDER BY month`,
        [roomId, year]
      ),
      query(
        `SELECT u.name,
                SUM(e.amount)::float AS total
         FROM expenses e
         INNER JOIN users u ON u.id = e.user_id
         WHERE e.room_id = $1
           AND EXTRACT(YEAR FROM e.expense_date) = $2
         GROUP BY u.id, u.name
         ORDER BY total DESC`,
        [roomId, year]
      ),
      query<{ year: number }>(
        `SELECT DISTINCT EXTRACT(YEAR FROM expense_date)::int AS year
         FROM expenses
         WHERE room_id = $1
         ORDER BY year DESC`,
        [roomId]
      ),
      query<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0)::float AS total
         FROM expenses
         WHERE room_id = $1
           AND EXTRACT(YEAR FROM expense_date) = $2`,
        [roomId, year - 1]
      ),
      query<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0)::float AS total
         FROM expenses
         WHERE room_id = $1
           AND EXTRACT(YEAR FROM expense_date) = $2
           AND EXTRACT(MONTH FROM expense_date) = $3`,
        [roomId, currentCalendarYear, currentCalendarMonth]
      ),
      query<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0)::float AS total
         FROM expenses
         WHERE room_id = $1
           AND EXTRACT(YEAR FROM expense_date) = $2
           AND EXTRACT(MONTH FROM expense_date) = $3`,
        [roomId, prev.year, prev.month]
      ),
      query<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0)::float AS total
         FROM expenses
         WHERE room_id = $1
           AND expense_date >= date_trunc('week', CURRENT_DATE)::date
           AND expense_date < (date_trunc('week', CURRENT_DATE) + interval '7 days')::date`,
        [roomId]
      ),
      query<{ weekly_limit: number | null }>(
        `SELECT weekly_limit::float AS weekly_limit FROM rooms WHERE id = $1`,
        [roomId]
      ),
    ]);

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
    const previousYearTotal = prevYearResult.rows[0]?.total ?? 0;

    const currentYear = new Date().getFullYear();
    const yearSet = new Set(yearsResult.rows.map((r) => r.year));
    yearSet.add(currentYear);
    const availableYears = Array.from(yearSet).sort((a, b) => b - a);

    let yearChangePercent: number | null = null;
    if (previousYearTotal > 0) {
      yearChangePercent = ((yearTotal - previousYearTotal) / previousYearTotal) * 100;
    } else if (yearTotal > 0) {
      yearChangePercent = 100;
    }

    const currentMonthTotal = currentMonthResult.rows[0]?.total ?? 0;
    const previousMonthTotal = prevMonthResult.rows[0]?.total ?? 0;
    const currentWeekTotal = weeklyResult.rows[0]?.total ?? 0;
    const weeklyLimit = roomResult.rows[0]?.weekly_limit ?? null;

    let monthChangePercent: number | null = null;
    if (previousMonthTotal > 0) {
      monthChangePercent =
        ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100;
    } else if (currentMonthTotal > 0) {
      monthChangePercent = 100;
    }

    return json(res, 200, {
      year,
      monthly,
      byMember: byMemberResult.rows,
      yearTotal,
      previousYearTotal,
      yearChangePercent,
      availableYears,
      currentMonthTotal,
      currentMonthLabel: monthLabel(currentCalendarYear, currentCalendarMonth),
      currentMonthNum: currentCalendarMonth,
      currentMonthYear: currentCalendarYear,
      previousMonthTotal,
      previousMonthLabel: monthLabel(prev.year, prev.month),
      monthChangePercent,
      currentWeekTotal,
      weeklyLimit,
    });
  } catch (error) {
    return handleError(res, error);
  }
}
