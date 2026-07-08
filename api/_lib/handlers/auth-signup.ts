import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { signToken } from '../auth.js';
import { query } from '../db.js';
import { handleError, json } from '../utils.js';

const BCRYPT_ROUNDS = 8;

export async function handleAuthSignup(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const { name, email, password } = req.body || {};

    if (!name?.trim() || !email?.trim() || !password) {
      return json(res, 400, { error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return json(res, 400, { error: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);

    if (existing.rows.length > 0) {
      return json(res, 409, { error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name.trim(), normalizedEmail, passwordHash]
    );

    const user = result.rows[0] as { id: number; name: string; email: string };
    const token = signToken(user.id, user.email);

    return json(res, 201, { token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    return handleError(res, error);
  }
}
