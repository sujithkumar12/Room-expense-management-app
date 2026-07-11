import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logRoomActivity } from '../activity.js';
import { requireAuth } from '../auth.js';
import { query } from '../db.js';
import { handleError, json } from '../utils.js';

async function getRoomWithMembership(roomId: number, userId: number) {
  return query<{
    id: number;
    name: string;
    invite_code: string;
    created_at: string;
    created_by: number;
    weekly_limit: number | null;
  }>(
    `SELECT r.id, r.name, r.invite_code, r.created_at, r.created_by,
            r.weekly_limit::float AS weekly_limit
     FROM rooms r
     INNER JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = $2 AND rm.left_at IS NULL
     WHERE r.id = $1`,
    [roomId, userId]
  );
}

async function getMemberCount(roomId: number) {
  const result = await query<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM room_members WHERE room_id = $1 AND left_at IS NULL',
    [roomId]
  );
  return result.rows[0]?.count ?? 0;
}

export async function handleRoomLeave(req: VercelRequest, res: VercelResponse) {
  try {
    const authUser = requireAuth(req);
    const roomId = Number(req.query.id);

    if (!roomId || Number.isNaN(roomId)) {
      return json(res, 400, { error: 'Valid room id is required' });
    }

    if (req.method !== 'POST') {
      return json(res, 405, { error: 'Method not allowed' });
    }

    const roomResult = await getRoomWithMembership(roomId, authUser.userId);
    if (roomResult.rows.length === 0) {
      return json(res, 403, { error: 'You are not a member of this room' });
    }

    const room = roomResult.rows[0];
    const memberCount = await getMemberCount(roomId);
    const actor = await query<{ name: string }>('SELECT name FROM users WHERE id = $1', [
      authUser.userId,
    ]);
    const actorName = actor.rows[0]?.name ?? 'Someone';

    if (memberCount <= 1) {
      await query('DELETE FROM rooms WHERE id = $1', [roomId]);
      return json(res, 200, { success: true, roomDeleted: true });
    }

    if (room.created_by === authUser.userId) {
      const nextAdmin = await query<{ user_id: number }>(
        `SELECT user_id FROM room_members
         WHERE room_id = $1 AND user_id != $2 AND left_at IS NULL
         ORDER BY joined_at ASC
         LIMIT 1`,
        [roomId, authUser.userId]
      );

      if (nextAdmin.rows.length > 0) {
        await query('UPDATE rooms SET created_by = $1 WHERE id = $2', [
          nextAdmin.rows[0].user_id,
          roomId,
        ]);
      }
    }

    await query(
      'UPDATE room_members SET left_at = NOW() WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL',
      [roomId, authUser.userId]
    );

    await logRoomActivity(
      roomId,
      authUser.userId,
      'member_left',
      `${actorName} left the room`
    );

    return json(res, 200, { success: true, roomDeleted: false });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function handleRemoveMember(req: VercelRequest, res: VercelResponse) {
  try {
    const authUser = requireAuth(req);
    const roomId = Number(req.query.id);
    const memberId = Number(req.query.memberId);

    if (!roomId || Number.isNaN(roomId) || !memberId || Number.isNaN(memberId)) {
      return json(res, 400, { error: 'Valid room and member id are required' });
    }

    if (req.method !== 'DELETE') {
      return json(res, 405, { error: 'Method not allowed' });
    }

    const roomResult = await getRoomWithMembership(roomId, authUser.userId);
    if (roomResult.rows.length === 0) {
      return json(res, 403, { error: 'You are not a member of this room' });
    }

    const room = roomResult.rows[0];
    if (room.created_by !== authUser.userId) {
      return json(res, 403, { error: 'Only the room admin can remove members' });
    }

    if (memberId === authUser.userId) {
      return json(res, 400, { error: 'Use leave room to remove yourself' });
    }

    const targetMember = await query<{ name: string }>(
      `SELECT u.name FROM room_members rm
       INNER JOIN users u ON u.id = rm.user_id
       WHERE rm.room_id = $1 AND rm.user_id = $2 AND rm.left_at IS NULL`,
      [roomId, memberId]
    );

    if (targetMember.rows.length === 0) {
      return json(res, 404, { error: 'Member not found in this room' });
    }

    const actor = await query<{ name: string }>('SELECT name FROM users WHERE id = $1', [
      authUser.userId,
    ]);

    await query(
      'UPDATE room_members SET left_at = NOW() WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL',
      [roomId, memberId]
    );

    await logRoomActivity(
      roomId,
      authUser.userId,
      'member_removed',
      `${actor.rows[0]?.name ?? 'Admin'} removed ${targetMember.rows[0].name} from the room`
    );

    return json(res, 200, { success: true });
  } catch (error) {
    return handleError(res, error);
  }
}
