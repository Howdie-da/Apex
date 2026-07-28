import { Router, Request, Response } from 'express';
import pool from '../config/db';
import * as MessageModel from '../models/message';
import { authMiddleware } from '../middleware/authHttp';
import { logger } from '../config/logger';
import { toRoom } from '../types/index';
import type { RoomRow } from '../types/index';

const router = Router();
const log = logger.child({ module: 'routes:rooms' });

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const callerId = (req as any).user?.userId as string;
    const { rows } = await pool.query<RoomRow>(
      `SELECT 
         r.*,
         u.id AS dm_user_id,
         u.username AS dm_username,
         u.display_name AS dm_display_name,
         u.avatar_url AS dm_avatar_url,
         u.is_online AS dm_is_online,
         u.last_seen AS dm_last_seen,
         (SELECT COUNT(*) FROM messages m WHERE m.room_id = r.id AND m.sender_id != $1 AND m.is_read = FALSE) AS unread_count
       FROM rooms r
       JOIN room_members caller_rm ON caller_rm.room_id = r.id AND caller_rm.user_id = $1
       LEFT JOIN room_members other_rm ON other_rm.room_id = r.id AND r.type = 'direct' AND other_rm.user_id != $1
       LEFT JOIN users u ON u.id = other_rm.user_id
       ORDER BY r.last_activity_at DESC NULLS LAST, r.name ASC`,
       [callerId]
    );
    res.json(rows.map(toRoom));
  } catch (err) {
    log.error({ err }, 'Failed to fetch rooms');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/rooms/dm
 * Get or create a DM room between the caller and the specified target user.
 * Idempotent — returns the existing room if it already exists.
 * Body: { targetUserId: string }
 */
router.post('/dm', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const callerId = (req as any).user?.userId as string;
    const { targetUserId } = req.body;

    if (!targetUserId || typeof targetUserId !== 'string') {
      res.status(400).json({ error: 'targetUserId is required.' });
      return;
    }

    if (targetUserId === callerId) {
      res.status(400).json({ error: 'Cannot create a DM with yourself.' });
      return;
    }

    // Derive a deterministic room name so the lookup is stable regardless of call order
    const dmRoomName = [callerId, targetUserId].sort().join(':');

    // Check if the DM room already exists
    const { rows: existing } = await pool.query<RoomRow>(
      `SELECT 
         r.*,
         u.id AS dm_user_id,
         u.username AS dm_username,
         u.display_name AS dm_display_name,
         u.avatar_url AS dm_avatar_url,
         u.is_online AS dm_is_online,
         u.last_seen AS dm_last_seen,
         (SELECT COUNT(*) FROM messages m WHERE m.room_id = r.id AND m.sender_id != $3 AND m.is_read = FALSE) AS unread_count
       FROM rooms r
       LEFT JOIN users u ON u.id = $2
       WHERE r.name = $1 AND r.type = 'direct' LIMIT 1`,
      [dmRoomName, targetUserId, callerId]
    );

    if (existing.length > 0) {
      // Ensure both users are members (in case one was removed)
      await pool.query(
        `INSERT INTO room_members (room_id, user_id)
         VALUES ($1, $2), ($1, $3)
         ON CONFLICT DO NOTHING`,
        [existing[0].id, callerId, targetUserId]
      );
      res.json(toRoom(existing[0]));
      return;
    }

    // Create new DM room
    const { rows: created } = await pool.query<RoomRow>(
      `INSERT INTO rooms (name, type, created_by, is_encrypted)
       VALUES ($1, 'direct', $2, true)
       RETURNING *`,
      [dmRoomName, callerId]
    );

    const newRoom = created[0];

    // Add both users as members
    await pool.query(
      `INSERT INTO room_members (room_id, user_id)
       VALUES ($1, $2), ($1, $3)
       ON CONFLICT DO NOTHING`,
      [newRoom.id, callerId, targetUserId]
    );

    // Attach target user info so the frontend can display their name immediately
    const { rows: targetUsers } = await pool.query(
      `SELECT id, username, display_name, avatar_url, is_online, last_seen FROM users WHERE id = $1`,
      [targetUserId]
    );
    
    if (targetUsers.length > 0) {
      newRoom.dm_user_id = targetUsers[0].id;
      newRoom.dm_username = targetUsers[0].username;
      newRoom.dm_display_name = targetUsers[0].display_name;
      newRoom.dm_avatar_url = targetUsers[0].avatar_url;
      newRoom.dm_is_online = targetUsers[0].is_online;
      newRoom.dm_last_seen = targetUsers[0].last_seen;
    }

    // Emit the new room via socket to the target user
    const io = req.app.get('io');
    if (io) {
      const { rows: callers } = await pool.query(
        `SELECT id, username, display_name, avatar_url, is_online, last_seen FROM users WHERE id = $1`,
        [callerId]
      );
      if (callers.length > 0) {
        const roomForTarget = { ...newRoom };
        roomForTarget.dm_user_id = callers[0].id;
        roomForTarget.dm_username = callers[0].username;
        roomForTarget.dm_display_name = callers[0].display_name;
        roomForTarget.dm_avatar_url = callers[0].avatar_url;
        roomForTarget.dm_is_online = callers[0].is_online;
        roomForTarget.dm_last_seen = callers[0].last_seen;
        io.to(targetUserId).emit('room:created', toRoom(roomForTarget));
      }
    }

    log.info({ roomId: newRoom.id, callerId, targetUserId }, 'DM room created');
    res.status(201).json(toRoom(newRoom));
  } catch (err) {
    log.error({ err }, 'Failed to create DM room');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.get('/:roomId/messages', authMiddleware, async (req: Request, res: Response) => {
  try {
    const roomId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50;

    const messages = await MessageModel.getMessages(roomId, limit, before);
    res.json(messages);
  } catch (err) {
    log.error({ err, roomId: req.params.roomId }, 'Failed to fetch room messages');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:roomId/read', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const callerId = (req as any).user?.userId as string;
    const roomId = req.params.roomId;

    // Verify membership
    const { rows: mems } = await pool.query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
      [roomId, callerId]
    );
    if (mems.length === 0) {
      res.status(403).json({ error: 'Not a member of this room' });
      return;
    }

    // Mark messages as read where sender is NOT the caller
    const { rows: updated } = await pool.query(
      `UPDATE messages 
       SET is_read = TRUE 
       WHERE room_id = $1 AND sender_id != $2 AND is_read = FALSE
       RETURNING id`,
      [roomId, callerId]
    );

    if (updated.length > 0) {
      const io = req.app.get('io');
      if (io) {
        io.to(roomId).emit('chat:read-receipt', {
          roomId,
          readerId: callerId,
          messageIds: updated.map(u => u.id),
        });
      }
    }

    res.json({ success: true, count: updated.length });
  } catch (err) {
    log.error({ err, roomId: req.params.roomId }, 'Failed to mark messages as read');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
export { router as roomsRouter };
