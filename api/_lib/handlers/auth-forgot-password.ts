import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { query } from '../db.js';
import { handleError, json } from '../utils.js';

const TOKEN_EXPIRY_HOURS = 1;

async function sendResetEmail(
  email: string,
  resetUrl: string
): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[RoomSplit] RESEND_API_KEY is not set. Password reset link:', resetUrl);
    }
    return { sent: false, error: 'Email service not configured' };
  }

  const from = process.env.RESEND_FROM || 'RoomSplit <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: 'Reset your RoomSplit password',
      html: `
        <p>You requested a password reset for RoomSplit.</p>
        <p><a href="${resetUrl}">Click here to reset your password</a></p>
        <p>This link expires in ${TOKEN_EXPIRY_HOURS} hour. If you did not request this, ignore this email.</p>
      `,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('[RoomSplit] Resend email failed:', res.status, errorBody);
    return { sent: false, error: 'Failed to send reset email' };
  }

  return { sent: true };
}

export async function handleAuthForgotPassword(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const { email } = req.body || {};
    if (!email?.trim()) {
      return json(res, 400, { error: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userResult = await query<{ id: number; email: string }>(
      'SELECT id, email FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      await query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt.toISOString()]
      );

      const origin =
        process.env.APP_URL ||
        (req.headers.origin as string) ||
        (req.headers.referer as string)?.replace(/\/[^/]*$/, '') ||
        'http://localhost:3000';
      const resetUrl = `${origin.replace(/\/$/, '')}/reset-password?token=${rawToken}`;
      const emailResult = await sendResetEmail(user.email, resetUrl);
      const isDev = process.env.NODE_ENV !== 'production';

      return json(res, 200, {
        message:
          'If an account exists with that email, a password reset link has been sent.',
        emailSent: emailResult.sent,
        ...(isDev && !emailResult.sent
          ? {
              devNote:
                'Email was not sent. Add RESEND_API_KEY to .env.local, or use the dev reset link below / check the server terminal.',
              devResetUrl: resetUrl,
            }
          : {}),
      });
    }

    return json(res, 200, {
      message:
        'If an account exists with that email, a password reset link has been sent.',
    });
  } catch (error) {
    return handleError(res, error);
  }
}
