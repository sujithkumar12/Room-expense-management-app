import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../auth.js';
import { query } from '../db.js';
import { handleError, json } from '../utils.js';

const BCRYPT_ROUNDS = 8;

export async function handleProfileChangePassword(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const authUser = requireAuth(req);
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return json(res, 400, { error: 'Current and new password are required' });
    }

    if (newPassword.length < 6) {
      return json(res, 400, { error: 'New password must be at least 6 characters' });
    }

    if (currentPassword === newPassword) {
      return json(res, 400, { error: 'New password must be different from current password' });
    }

    const result = await query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [authUser.userId]
    );

    if (result.rows.length === 0) {
      return json(res, 404, { error: 'User not found' });
    }

    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) {
      return json(res, 401, { error: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      passwordHash,
      authUser.userId,
    ]);

    return json(res, 200, { message: 'Password changed successfully' });
  } catch (error) {
    return handleError(res, error);
  }
}
