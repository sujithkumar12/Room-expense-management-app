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

    const { name, email, password } = req.body || {};

    if (!name?.trim() || !email?.trim() || !password) {
      return json(res, 400, { error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return json(res, 400, { error: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await sql`SELECT id FROM users WHERE email = ${normalizedEmail}`;

    if (existing.rows.length > 0) {
      return json(res, 409, { error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await sql`
      INSERT INTO users (name, email, password_hash)
      VALUES (${name.trim()}, ${normalizedEmail}, ${passwordHash})
      RETURNING id, name, email
    `;

    const user = result.rows[0] as { id: number; name: string; email: string };
    const token = signToken(user.id, user.email);

    return json(res, 201, { token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    return handleError(res, error);
  }
}
