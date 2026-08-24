import pool from "../config/db";
import { logger } from "../config/logger";
import { MessageRow, Message, toMessage } from "../types/index";

const log = logger.child({ module: "model:message" });

export async function createMessage(
  senderId: string,
  roomId: string,
  content: string,
  type: string = "text",
  replyTo?: string | null,
): Promise<Message> {

  // We fetch the newly inserted message and its reply_to context in a single CTE transaction.
  // Separating these into two queries costs more DB latency than the extra CTE execution plan.
  const { rows } = await pool.query<MessageRow>(
    `
    WITH new_msg AS (
      INSERT INTO messages (sender_id, room_id, content, type, reply_to)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    ),
    reply_info AS (
      SELECT m.id, m.content AS reply_content, u.display_name AS reply_sender
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = $5
    )
    SELECT 
      new_msg.*,
      u.username,
      u.display_name,
      u.avatar_url,
      ri.reply_content AS reply_to_content,
      ri.reply_sender  AS reply_to_sender_name
    FROM new_msg
    JOIN users u ON new_msg.sender_id = u.id
    LEFT JOIN reply_info ri ON true
    `,
    [senderId, roomId, content, type, replyTo || null],
  );

  // Update the room's activity timestamp to bubble it up in the UI's conversation list
  await pool.query(
    `UPDATE rooms SET last_activity_at = NOW() WHERE id = $1`, 
    [roomId]
  );

  log.debug({ messageId: rows[0].id, roomId, senderId }, "Message created");
  
  return toMessage(rows[0]);
}

export async function getMessages(
  roomId: string,
  limit: number = 50,
  before?: string | null,
): Promise<Message[]> {

  // Using cursor-based pagination (created_at < $2) rather than OFFSET to prevent O(N) scan 
  // degradation on deep chat histories. We buffer the client by strictly capping the limit.
  const { rows } = await pool.query<MessageRow>(
    `
    SELECT 
      m.*,
      u.username,
      u.display_name,
      u.avatar_url,
      rm.content       AS reply_to_content,
      ru.display_name  AS reply_to_sender_name
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    LEFT JOIN messages rm ON m.reply_to = rm.id
    LEFT JOIN users ru ON rm.sender_id = ru.id
    WHERE m.room_id = $1
      AND ($2::timestamptz IS NULL OR m.created_at < $2)
    ORDER BY m.created_at DESC
    LIMIT $3
    `,
    [roomId, before || null, limit],
  );
  
  return rows.map(toMessage);
}
