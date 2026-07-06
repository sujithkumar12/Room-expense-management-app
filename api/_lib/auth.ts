import type { VercelRequest } from '@vercel/node';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export interface AuthUser {
  userId: number;
  email: string;
}

export function signToken(userId: number, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
}

export function getAuthUser(req: VercelRequest): AuthUser | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser;
    return payload;
  } catch {
    return null;
  }
}

export function requireAuth(req: VercelRequest): AuthUser {
  const user = getAuthUser(req);
  if (!user) {
    const error = new Error('Unauthorized');
    (error as Error & { status: number }).status = 401;
    throw error;
  }
  return user;
}
