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
      ri.reply_sender  AS reply_to_sender_name,
      '[]'::text       AS reactions_json
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
  // TODO(perf): The correlated subquery for reactions mitigates the N+1 problem, but if 
  // batch sizes scale up, we should evaluate fetching reactions in a parallel query.
  const { rows } = await pool.query<MessageRow>(
    `
    SELECT 
      m.*,
      u.username,
      u.display_name,
      u.avatar_url,
      rm.content       AS reply_to_content,
      ru.display_name  AS reply_to_sender_name,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'emoji',   r.emoji,
              'count',   r.cnt,
              'userIds', r.user_ids
            )
          )
          FROM (
            SELECT
              emoji,
              COUNT(*)::int AS cnt,
              json_agg(user_id::text) AS user_ids
            FROM message_reactions
            WHERE message_id = m.id
            GROUP BY emoji
          ) r
        ),
        '[]'
      )::text AS reactions_json
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

export async function addReaction(
  messageId: string,
  userId: string,
  emoji: string,
): Promise<void> {

  // ON CONFLICT DO NOTHING, handles duplicate rapid-fire clicks from the client idempotently.
  await pool.query(
    `
    INSERT INTO message_reactions (message_id, user_id, emoji)
    VALUES ($1, $2, $3)
    ON CONFLICT DO NOTHING
    `,
    [messageId, userId, emoji],
  );
  
  log.debug({ messageId, userId, emoji }, "Reaction added");
}

export async function removeReaction(
  messageId: string,
  userId: string,
  emoji: string,
): Promise<void> {

  await pool.query(
    `
    DELETE FROM message_reactions
    WHERE message_id = $1 AND user_id = $2 AND emoji = $3
    `,
    [messageId, userId, emoji],
  );
  
  log.debug({ messageId, userId, emoji }, "Reaction removed");
}

export async function getReactions(
  messageId: string,
): Promise<{ emoji: string; count: number; userIds: string[] }[]> {

  const { rows } = await pool.query(
    `
    SELECT 
      emoji, 
      COUNT(*)::int AS count, 
      json_agg(user_id::text) AS user_ids
    FROM message_reactions
    WHERE message_id = $1
    GROUP BY emoji
    `,
    [messageId],
  );
  
  return rows.map((r) => ({
    emoji: r.emoji,
    count: r.count,
    userIds: r.user_ids,
  }));
}