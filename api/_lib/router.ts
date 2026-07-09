import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAuthForgotPassword } from './handlers/auth-forgot-password.js';
import { handleAuthLogin } from './handlers/auth-login.js';
import { handleAuthResetPassword } from './handlers/auth-reset-password.js';
import { handleAuthSignup } from './handlers/auth-signup.js';
import { handleDashboardMonthly } from './handlers/dashboard-monthly.js';
import { handleExpenseById } from './handlers/expenses-id.js';
import { handleExpenses } from './handlers/expenses.js';
import { handleHealth } from './handlers/health.js';
import { handleRoomById } from './handlers/rooms-id.js';
import { handleRoomLeave, handleRemoveMember } from './handlers/rooms-members.js';
import { handleProfile } from './handlers/profile.js';
import { handleProfileChangePassword } from './handlers/profile-change-password.js';
import { handleRoomActivity } from './handlers/rooms-activity.js';
import { handleRoomsJoin } from './handlers/rooms-join.js';
import { handleRooms } from './handlers/rooms.js';
import { handleSettlementById } from './handlers/settlements-id.js';
import { handleSettlements } from './handlers/settlements.js';
import { json } from './utils.js';

export async function routeRequest(
  req: VercelRequest,
  res: VercelResponse,
  path: string[]
) {
  if (path.length === 0) {
    return json(res, 404, { error: 'Not found' });
  }

  const [segment0, segment1] = path;

  if (segment0 === 'health' && path.length === 1) {
    return handleHealth(req, res);
  }

  if (segment0 === 'auth' && segment1 === 'login' && path.length === 2) {
    return handleAuthLogin(req, res);
  }

  if (segment0 === 'auth' && segment1 === 'signup' && path.length === 2) {
    return handleAuthSignup(req, res);
  }

  if (segment0 === 'auth' && segment1 === 'forgot-password' && path.length === 2) {
    return handleAuthForgotPassword(req, res);
  }

  if (segment0 === 'auth' && segment1 === 'reset-password' && path.length === 2) {
    return handleAuthResetPassword(req, res);
  }

  if (segment0 === 'profile' && segment1 === 'change-password' && path.length === 2) {
    return handleProfileChangePassword(req, res);
  }

  if (segment0 === 'profile' && path.length === 1) {
    return handleProfile(req, res);
  }

  if (segment0 === 'rooms' && path.length === 1) {
    return handleRooms(req, res);
  }

  if (segment0 === 'rooms' && segment1 === 'join' && path.length === 2) {
    return handleRoomsJoin(req, res);
  }

  if (segment0 === 'rooms' && segment1 && path[2] === 'leave' && path.length === 3) {
    req.query.id = segment1;
    return handleRoomLeave(req, res);
  }

  if (
    segment0 === 'rooms' &&
    segment1 &&
    path[2] === 'members' &&
    path[3] &&
    path.length === 4
  ) {
    req.query.id = segment1;
    req.query.memberId = path[3];
    return handleRemoveMember(req, res);
  }

  if (segment0 === 'rooms' && segment1 && path[2] === 'activity' && path.length === 3) {
    req.query.id = segment1;
    return handleRoomActivity(req, res);
  }

  if (segment0 === 'rooms' && segment1 && path.length === 2) {
    req.query.id = segment1;
    return handleRoomById(req, res);
  }

  if (segment0 === 'expenses' && path.length === 1) {
    return handleExpenses(req, res);
  }

  if (segment0 === 'expenses' && segment1 && path.length === 2) {
    req.query.id = segment1;
    return handleExpenseById(req, res);
  }

  if (segment0 === 'dashboard' && segment1 === 'monthly' && path.length === 2) {
    return handleDashboardMonthly(req, res);
  }

  if (segment0 === 'settlements' && path.length === 1) {
    return handleSettlements(req, res);
  }

  if (segment0 === 'settlements' && segment1 && path.length === 2) {
    req.query.id = segment1;
    return handleSettlementById(req, res);
  }

  return json(res, 404, { error: 'Not found' });
}
