import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../auth.js';
import { query } from '../db.js';
import { handleError, json } from '../utils.js';

function normalizeUpiId(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const upi = String(value).trim().toLowerCase();
  if (!upi) return null;
  if (!/^[a-z0-9._-]+@[a-z0-9]+$/.test(upi)) {
    return null;
  }
  return upi;
}

export async function handleProfile(req: VercelRequest, res: VercelResponse) {
  try {
    const authUser = requireAuth(req);

    if (req.method === 'GET') {
      const result = await query<{
        id: number;
        name: string;
        email: string;
        upi_id: string | null;
        created_at: string;
      }>(
        `SELECT id, name, email, upi_id, created_at
         FROM users WHERE id = $1`,
        [authUser.userId]
      );

      if (result.rows.length === 0) {
        return json(res, 404, { error: 'User not found' });
      }

      const user = result.rows[0];
      return json(res, 200, {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          upiId: user.upi_id,
          createdAt: user.created_at,
        },
      });
    }

    if (req.method === 'PATCH') {
      const { name, upiId } = req.body || {};
      const updates: string[] = [];
      const values: unknown[] = [];
      let index = 1;

      if (name !== undefined) {
        if (!name?.trim()) {
          return json(res, 400, { error: 'Name is required' });
        }
        updates.push(`name = $${index++}`);
        values.push(name.trim());
      }

      if (upiId !== undefined) {
        const normalized = upiId === null || upiId === '' ? null : normalizeUpiId(upiId);
        if (upiId && !normalized) {
          return json(res, 400, {
            error: 'Enter a valid UPI ID (e.g. yourname@upi or yourname@okaxis)',
          });
        }
        updates.push(`upi_id = $${index++}`);
        values.push(normalized);
      }

      if (updates.length === 0) {
        return json(res, 400, { error: 'No valid fields to update' });
      }

      values.push(authUser.userId);
      const result = await query<{
        id: number;
        name: string;
        email: string;
        upi_id: string | null;
        created_at: string;
      }>(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${index}
         RETURNING id, name, email, upi_id, created_at`,
        values
      );

      const user = result.rows[0];
      return json(res, 200, {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          upiId: user.upi_id,
          createdAt: user.created_at,
        },
      });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return handleError(res, error);
  }
}
