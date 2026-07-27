import pool from '../config/db';
import { MessageRow, Message, toMessage } from '../types/index';
import { logger } from '../config/logger';

const log = logger.child({ module: 'model:message' });

export async function createMessage(
  senderId: string,
  roomId: string,
  content: string,
  type: string = 'text'
): Promise<Message> {
  const { rows } = await pool.query<MessageRow>(
    `WITH new_msg AS (
       INSERT INTO messages (sender_id, room_id, content, type)
       VALUES ($1, $2, $3, $4)
       RETURNING *
     )
     SELECT 
       new_msg.*,
       u.username,
       u.display_name,
       u.avatar_url
     FROM new_msg
     JOIN users u ON new_msg.sender_id = u.id`,
    [senderId, roomId, content, type]
  );

  log.debug({ messageId: rows[0].id, roomId, senderId }, 'Message created');
  return toMessage(rows[0]);
}

export async function getMessages(
  roomId: string,
  limit: number = 50,
  before?: string | null
): Promise<Message[]> {
  const { rows } = await pool.query<MessageRow>(
    `SELECT 
       m.*,
       u.username,
       u.display_name,
       u.avatar_url
     FROM messages m
     JOIN users u ON m.sender_id = u.id
     WHERE m.room_id = $1
       AND ($2::timestamptz IS NULL OR m.created_at < $2)
     ORDER BY m.created_at DESC
     LIMIT $3`,
    [roomId, before || null, limit]
  );

  return rows.map(toMessage);
}
