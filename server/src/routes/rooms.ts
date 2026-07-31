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

/**
 * POST /api/rooms/group
 * Create a new group group with multiple users.
 * Body: { name: string, targetUserIds: string[] }
 */
router.post('/group', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const callerId = (req as any).user?.userId as string;
    const { name, targetUserIds } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({ error: 'Valid group name is required.' });
      return;
    }

    if (!Array.isArray(targetUserIds) || targetUserIds.length < 1) {
      res.status(400).json({ error: 'At least one target user must be specified.' });
      return;
    }

    // Create new group room
    const { rows: created } = await pool.query<RoomRow>(
      `INSERT INTO rooms (name, type, created_by, is_encrypted)
       VALUES ($1, 'group', $2, false)
       RETURNING *`,
      [name.trim(), callerId]
    );

    const newRoom = created[0];
    const allMembers = Array.from(new Set([callerId, ...targetUserIds]));

    // Add all users as members
    const insertValues = allMembers.map((_, idx) => `($1, $${idx + 2})`).join(', ');
    await pool.query(
      `INSERT INTO room_members (room_id, user_id)
       VALUES ${insertValues}
       ON CONFLICT DO NOTHING`,
      [newRoom.id, ...allMembers]
    );

    // Emit the new room via socket to all members
    const io = req.app.get('io');
    if (io) {
      allMembers.forEach(memberId => {
        io.to(memberId).emit('room:created', toRoom(newRoom));
      });
    }

    log.info({ roomId: newRoom.id, callerId, allMembers }, 'Group room created');
    res.status(201).json(toRoom(newRoom));
  } catch (err) {
    log.error({ err }, 'Failed to create group room');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /api/rooms/:roomId/members
 * Add members to an existing group.
 * Body: { targetUserIds: string[] }
 */
router.post('/:roomId/members', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const callerId = (req as any).user?.userId as string;
    const roomId = req.params.roomId;
    const { targetUserIds } = req.body;

    if (!Array.isArray(targetUserIds) || targetUserIds.length === 0) {
      res.status(400).json({ error: 'targetUserIds array is required.' });
      return;
    }

    // Verify room exists and is a group
    const { rows: rooms } = await pool.query<RoomRow>(
      'SELECT * FROM rooms WHERE id = $1 AND type = $2',
      [roomId, 'group']
    );
    if (rooms.length === 0) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // Check if caller is a member
    const { rows: mems } = await pool.query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
      [roomId, callerId]
    );
    if (mems.length === 0) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    // Add new members
    const insertValues = targetUserIds.map((_, idx) => `($1, $${idx + 2})`).join(', ');
    await pool.query(
      `INSERT INTO room_members (room_id, user_id)
       VALUES ${insertValues}
       ON CONFLICT DO NOTHING`,
      [roomId, ...targetUserIds]
    );

    // Let the new members know they were added so the room appears for them
    const io = req.app.get('io');
    if (io) {
      targetUserIds.forEach(targetId => {
        io.to(targetId).emit('room:created', toRoom(rooms[0]));
      });
      // Optionally notify the room that members were added (not strictly required for UI right now)
    }

    res.json({ success: true, added: targetUserIds });
  } catch (err) {
    log.error({ err, roomId: req.params.roomId }, 'Failed to add members');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/rooms/:roomId/members
 * Get all members of a room.
 */
router.get('/:roomId/members', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const callerId = (req as any).user?.userId as string;
    const roomId = req.params.roomId;

    // Check if caller is a member
    const { rows: mems } = await pool.query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
      [roomId, callerId]
    );
    if (mems.length === 0) {
      res.status(403).json({ error: 'Not a member of this room' });
      return;
    }

    const { rows: members } = await pool.query(
      `SELECT u.id, u.username, u.display_name as "displayName", u.avatar_url as "avatarUrl", 
              u.is_online as "isOnline", u.last_seen as "lastSeen", u.created_at as "createdAt"
       FROM room_members rm
       JOIN users u ON u.id = rm.user_id
       WHERE rm.room_id = $1`,
      [roomId]
    );

    res.json(members);
  } catch (err) {
    log.error({ err, roomId: req.params.roomId }, 'Failed to fetch members');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/rooms/:roomId/name
 * Update the name of a group.
 * Body: { name: string }
 */
router.patch('/:roomId/name', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const callerId = (req as any).user?.userId as string;
    const roomId = req.params.roomId;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({ error: 'Valid group name is required.' });
      return;
    }

    // Verify room exists and is a group
    const { rows: rooms } = await pool.query<RoomRow>(
      'SELECT * FROM rooms WHERE id = $1 AND type = $2',
      [roomId, 'group']
    );
    if (rooms.length === 0) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // Check if caller is a member
    const { rows: mems } = await pool.query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
      [roomId, callerId]
    );
    if (mems.length === 0) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    const trimmedName = name.trim();

    // Update the room name
    await pool.query(
      'UPDATE rooms SET name = $1 WHERE id = $2',
      [trimmedName, roomId]
    );

    // Emit the new room name via socket to all room members
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('room:name-changed', {
        roomId,
        newName: trimmedName
      });
    }

    log.info({ roomId, callerId, newName: trimmedName }, 'Group name updated');
    res.json({ success: true });
  } catch (err) {
    log.error({ err, roomId: req.params.roomId }, 'Failed to update group name');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
export { router as roomsRouter };
