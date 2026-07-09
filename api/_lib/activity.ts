import { query } from './db.js';

export type ActivityType =
  | 'expense_added'
  | 'expense_updated'
  | 'expense_deleted'
  | 'settlement_added'
  | 'settlement_removed'
  | 'member_joined'
  | 'member_left'
  | 'member_removed'
  | 'room_renamed'
  | 'admin_transferred';

export async function logRoomActivity(
  roomId: number,
  actorId: number,
  activityType: ActivityType,
  message: string
) {
  await query(
    `INSERT INTO room_activities (room_id, actor_id, activity_type, message)
     VALUES ($1, $2, $3, $4)`,
    [roomId, actorId, activityType, message]
  );
}
