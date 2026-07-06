import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { sql } from '@vercel/postgres';
import { signToken } from '../_lib/auth.js';
import { ensureSchema } from '../_lib/db.js';
import { handleError, json } from '../_lib/utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    await ensureSchema();

    const { email, password } = req.body || {};

    if (!email?.trim() || !password) {
      return json(res, 400, { error: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const result = await sql`
      SELECT id, name, email, password_hash FROM users WHERE email = ${normalizedEmail}
    `;

    if (result.rows.length === 0) {
      return json(res, 401, { error: 'Invalid email or password' });
    }

    const user = result.rows[0] as {
      id: number;
      name: string;
      email: string;
      password_hash: string;
    };

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return json(res, 401, { error: 'Invalid email or password' });
    }

    const token = signToken(user.id, user.email);

    return json(res, 200, {
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    return handleError(res, error);
  }
}
