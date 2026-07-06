import type { VercelRequest, VercelResponse } from '@vercel/node';

export function json(res: VercelResponse, status: number, data: unknown) {
  return res.status(status).json(data);
}

export function handleError(res: VercelResponse, error: unknown) {
  const err = error as Error & { status?: number };
  const status = err.status || 500;
  const isDev = process.env.NODE_ENV !== 'production';
  const message =
    status === 500
      ? isDev && err.message
        ? err.message
        : 'Internal server error'
      : err.message;
  console.error(error);
  return json(res, status, { error: message });
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function isRoomMember(
  roomId: number,
  userId: number,
  check: (query: string, params: unknown[]) => Promise<{ rows: unknown[] }>
): Promise<boolean> {
  const result = await check(
    'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
    [roomId, userId]
  );
  return result.rows.length > 0;
}
