import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../_lib/db.js';
import { handleError, json } from '../_lib/utils.js';

const BCRYPT_ROUNDS = 8;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const { token, password } = req.body || {};

    if (!token?.trim() || !password) {
      return json(res, 400, { error: 'Token and new password are required' });
    }

    if (password.length < 6) {
      return json(res, 400, { error: 'Password must be at least 6 characters' });
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const tokenResult = await query<{
      id: number;
      user_id: number;
      expires_at: string;
      used_at: string | null;
    }>(
      `SELECT id, user_id, expires_at, used_at
       FROM password_reset_tokens
       WHERE token_hash = $1`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      return json(res, 400, { error: 'Invalid or expired reset link' });
    }

    const resetToken = tokenResult.rows[0];
    if (resetToken.used_at) {
      return json(res, 400, { error: 'This reset link has already been used' });
    }

    if (new Date(resetToken.expires_at) < new Date()) {
      return json(res, 400, { error: 'Reset link has expired. Please request a new one.' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      passwordHash,
      resetToken.user_id,
    ]);
    await query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
      [resetToken.id]
    );

    return json(res, 200, { message: 'Password updated successfully. You can sign in now.' });
  } catch (error) {
    return handleError(res, error);
  }
}
