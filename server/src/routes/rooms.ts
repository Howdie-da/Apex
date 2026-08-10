import { Router, Request, Response } from "express";

import pool from "../config/db";
import * as MessageModel from "../models/message";
import { authMiddleware } from "../middleware/authHttp";
import { logger } from "../config/logger";

import { toRoom } from "../types/index";
import type { RoomRow } from "../types/index";

const router = Router();
const log = logger.child({ module: "routes:rooms" });

router.get("/", authMiddleware, 
  async (req: Request, res: Response) => {
    try {
      const callerId = (req as any).user?.userId as string;

      // We intentionally LEFT JOIN the other DM participant so the client doesn't have to fan-out queries to render the sidebar.
      // Unread count is calculated inline to bypass an N+1 query problem on initial load.
      const { rows } = await pool.query<RoomRow>(
        `
        SELECT 
          r.*,
          u.id             AS dm_user_id,
          u.username       AS dm_username,
          u.display_name   AS dm_display_name,
          u.avatar_url     AS dm_avatar_url,
          u.is_online      AS dm_is_online,
          u.last_seen      AS dm_last_seen,
          (
            SELECT COUNT(*) 
            FROM messages m 
            WHERE m.room_id = r.id AND m.sender_id != $1 AND m.is_read = FALSE
          ) AS unread_count
        FROM rooms r
        JOIN room_members caller_rm ON caller_rm.room_id = r.id AND caller_rm.user_id = $1
        LEFT JOIN room_members other_rm ON other_rm.room_id = r.id AND r.type = 'direct' AND other_rm.user_id != $1
        LEFT JOIN users u ON u.id = other_rm.user_id
        ORDER BY r.last_activity_at DESC NULLS LAST, r.name ASC
        `,
        [callerId],
      );

      res.json(rows.map(toRoom));

    } catch (err) {
      log.error({ err }, "Failed to fetch rooms");
      res.status(500).json({ error: "Internal server error" });
    }
});

router.post("/dm", authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const callerId = (req as any).user?.userId as string;
      const { targetUserId } = req.body;

      if (!targetUserId || typeof targetUserId !== "string") {
        res.status(400).json({ error: "targetUserId is required." });
        return;
      }

      if (targetUserId === callerId) {
        res.status(400).json({ error: "Cannot create a DM with yourself." });
        return;
      }

      // Sort guarantees a deterministic room name regardless of who initiates.
      const dmRoomName = [callerId, targetUserId].sort().join(":");

      const { rows: existing } = await pool.query<RoomRow>(
        `
        SELECT 
          r.*,
          u.id             AS dm_user_id,
          u.username       AS dm_username,
          u.display_name   AS dm_display_name,
          u.avatar_url     AS dm_avatar_url,
          u.is_online      AS dm_is_online,
          u.last_seen      AS dm_last_seen,
          (
            SELECT COUNT(*) 
            FROM messages m 
            WHERE m.room_id = r.id AND m.sender_id != $3 AND m.is_read = FALSE
          ) AS unread_count
        FROM rooms r
        LEFT JOIN users u ON u.id = $2
        WHERE r.name = $1 AND r.type = 'direct' 
        LIMIT 1
        `,
        [dmRoomName, targetUserId, callerId],
      );

      if (existing.length > 0) {
        await pool.query(
          `
          INSERT INTO room_members (room_id, user_id)
          VALUES ($1, $2), ($1, $3)
          ON CONFLICT DO NOTHING
          `,
          [existing[0].id, callerId, targetUserId],
        );
        
        res.json(toRoom(existing[0]));
        return;
      }

      const { rows: created } = await pool.query<RoomRow>(
        `
        INSERT INTO rooms (name, type, created_by, is_encrypted)
        VALUES ($1, 'direct', $2, true)
        RETURNING *
        `,
        [dmRoomName, callerId],
      );
      
      const newRoom = created[0];

      await pool.query(
        `
        INSERT INTO room_members (room_id, user_id)
        VALUES ($1, $2), ($1, $3)
        ON CONFLICT DO NOTHING
        `,
        [newRoom.id, callerId, targetUserId],
      );

      const { rows: targetUsers } = await pool.query(
        `SELECT id, username, display_name, avatar_url, is_online, last_seen FROM users WHERE id = $1`,
        [targetUserId],
      );

      if (targetUsers.length > 0) {
        newRoom.dm_user_id = targetUsers[0].id;
        newRoom.dm_username = targetUsers[0].username;
        newRoom.dm_display_name = targetUsers[0].display_name;
        newRoom.dm_avatar_url = targetUsers[0].avatar_url;
        newRoom.dm_is_online = targetUsers[0].is_online;
        newRoom.dm_last_seen = targetUsers[0].last_seen;
      }

      const io = req.app.get("io");
      
      if (io) {
        const { rows: callers } = await pool.query(
          `SELECT id, username, display_name, avatar_url, is_online, last_seen FROM users WHERE id = $1`,
          [callerId],
        );

        if (callers.length > 0) {
          const roomForTarget = { ...newRoom };
          roomForTarget.dm_user_id = callers[0].id;
          roomForTarget.dm_username = callers[0].username;
          roomForTarget.dm_display_name = callers[0].display_name;
          roomForTarget.dm_avatar_url = callers[0].avatar_url;
          roomForTarget.dm_is_online = callers[0].is_online;
          roomForTarget.dm_last_seen = callers[0].last_seen;
          
          io.to(targetUserId).emit("room:created", toRoom(roomForTarget));
        }
      }

      log.info({ roomId: newRoom.id, callerId, targetUserId }, "DM room created");
      res.status(201).json(toRoom(newRoom));

    } catch (err) {
      log.error({ err }, "Failed to create DM room");
      res.status(500).json({ error: "Internal server error." });
    }
  },
);

router.get("/:roomId/messages", authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const roomId = Array.isArray(req.params.roomId)
        ? req.params.roomId[0]
        : req.params.roomId;
        
      const before =
        typeof req.query.before === "string" ? req.query.before : undefined;
        
      const limit =
        typeof req.query.limit === "string"
          ? parseInt(req.query.limit, 10)
          : 50;

      const messages = await MessageModel.getMessages(roomId, limit, before);
      
      res.json(messages);

    } catch (err) {
      log.error(
        { err, roomId: req.params.roomId },
        "Failed to fetch room messages",
      );
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.post("/:roomId/read", authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const callerId = (req as any).user?.userId as string;
      const roomId = req.params.roomId;

      // Security: We force a membership check before marking anything read.
      // This mitigates unauthorized users brute-forcing roomId payloads to alter chat states.
      const { rows: mems } = await pool.query(
        "SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2",
        [roomId, callerId],
      );

      if (mems.length === 0) {
        res.status(403).json({ error: "Not a member of this room" });
        return;
      }

      const { rows: updated } = await pool.query(
        `
        UPDATE messages 
        SET is_read = TRUE 
        WHERE room_id = $1 AND sender_id != $2 AND is_read = FALSE
        RETURNING id
        `,
        [roomId, callerId],
      );

      if (updated.length > 0) {
        const io = req.app.get("io");
        if (io) {
          io.to(roomId).emit("chat:read-receipt", {
            roomId,
            readerId: callerId,
            messageIds: updated.map((u) => u.id),
          });
        }
      }

      res.json({ success: true, count: updated.length });

    } catch (err) {
      log.error(
        { err, roomId: req.params.roomId },
        "Failed to mark messages as read",
      );
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.post("/group", authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const callerId = (req as any).user?.userId as string;
      const { name, targetUserIds } = req.body;

      if (!name || typeof name !== "string" || name.trim() === "") {
        res.status(400).json({ error: "Valid group name is required." });
        return;
      }

      if (!Array.isArray(targetUserIds) || targetUserIds.length < 1) {
        res
          .status(400)
          .json({ error: "At least one target user must be specified." });
        return;
      }

      const { rows: created } = await pool.query<RoomRow>(
        `
        INSERT INTO rooms (name, type, created_by, is_encrypted)
        VALUES ($1, 'group', $2, false)
        RETURNING *
        `,
        [name.trim(), callerId],
      );

      const newRoom = created[0];
      const allMembers = Array.from(new Set([callerId, ...targetUserIds]));
      
      // Dynamically constructs the parameter bindings for a bulk insert (e.g., "($1, $2), ($1, $3)").
      // This prevents N+1 network roundtrips to the DB when adding massive groups.
      const insertValues = allMembers
        .map((_, idx) => `($1, $${idx + 2})`)
        .join(", ");

      await pool.query(
        `
        INSERT INTO room_members (room_id, user_id)
        VALUES ${insertValues}
        ON CONFLICT DO NOTHING
        `,
        [newRoom.id, ...allMembers],
      );

      const io = req.app.get("io");
      
      if (io) {
        // Note: We emit room:created to the new members so their UI can proactively render the group.
        allMembers.forEach((memberId) => {
          io.to(memberId).emit("room:created", toRoom(newRoom));
        });
      }

      log.info({ roomId: newRoom.id, callerId, allMembers }, "Group room created");
      res.status(201).json(toRoom(newRoom));

    } catch (err) {
      log.error({ err }, "Failed to create group room");
      res.status(500).json({ error: "Internal server error." });
    }
  },
);

router.post("/:roomId/members", authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const callerId = (req as any).user?.userId as string;
      const roomId = req.params.roomId;
      const { targetUserIds } = req.body;

      if (!Array.isArray(targetUserIds) || targetUserIds.length === 0) {
        res.status(400).json({ error: "targetUserIds array is required." });
        return;
      }

      const { rows: rooms } = await pool.query<RoomRow>(
        "SELECT * FROM rooms WHERE id = $1 AND type = $2",
        [roomId, "group"],
      );

      if (rooms.length === 0) {
        res.status(404).json({ error: "Group not found" });
        return;
      }

      const { rows: mems } = await pool.query(
        "SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2",
        [roomId, callerId],
      );

      if (mems.length === 0) {
        res.status(403).json({ error: "Not a member of this group" });
        return;
      }

      const insertValues = targetUserIds
        .map((_, idx) => `($1, $${idx + 2})`)
        .join(", ");

      await pool.query(
        `
        INSERT INTO room_members (room_id, user_id)
        VALUES ${insertValues}
        ON CONFLICT DO NOTHING
        `,
        [roomId, ...targetUserIds],
      );

      const io = req.app.get("io");
      
      if (io) {
        targetUserIds.forEach((targetId) => {
          io.to(targetId).emit("room:created", toRoom(rooms[0]));
        });
      }

      res.json({ success: true, added: targetUserIds });

    } catch (err) {
      log.error({ err, roomId: req.params.roomId }, "Failed to add members");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.get("/:roomId/members", authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const callerId = (req as any).user?.userId as string;
      const roomId = req.params.roomId;

      const { rows: mems } = await pool.query(
        "SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2",
        [roomId, callerId],
      );

      if (mems.length === 0) {
        res.status(403).json({ error: "Not a member of this room" });
        return;
      }

      const { rows: members } = await pool.query(
        `
        SELECT 
          u.id, 
          u.username, 
          u.display_name AS "displayName", 
          u.avatar_url   AS "avatarUrl", 
          u.is_online    AS "isOnline", 
          u.last_seen    AS "lastSeen", 
          u.created_at   AS "createdAt"
        FROM room_members rm
        JOIN users u ON u.id = rm.user_id
        WHERE rm.room_id = $1
        `,
        [roomId],
      );
      
      res.json(members);

    } catch (err) {
      log.error({ err, roomId: req.params.roomId }, "Failed to fetch members");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.patch("/:roomId/name", authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const callerId = (req as any).user?.userId as string;
      const roomId = req.params.roomId;
      const { name } = req.body;

      if (!name || typeof name !== "string" || name.trim() === "") {
        res.status(400).json({ error: "Valid group name is required." });
        return;
      }

      const { rows: rooms } = await pool.query<RoomRow>(
        "SELECT * FROM rooms WHERE id = $1 AND type = $2",
        [roomId, "group"],
      );

      if (rooms.length === 0) {
        res.status(404).json({ error: "Group not found" });
        return;
      }

      const { rows: mems } = await pool.query(
        "SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2",
        [roomId, callerId],
      );

      if (mems.length === 0) {
        res.status(403).json({ error: "Not a member of this group" });
        return;
      }

      const trimmedName = name.trim();

      await pool.query("UPDATE rooms SET name = $1 WHERE id = $2", [
        trimmedName,
        roomId,
      ]);

      const io = req.app.get("io");
      
      if (io) {
        io.to(roomId).emit("room:name-changed", {
          roomId,
          newName: trimmedName,
        });
      }

      log.info({ roomId, callerId, newName: trimmedName }, "Group name updated");
      res.json({ success: true });

    } catch (err) {
      log.error(
        { err, roomId: req.params.roomId },
        "Failed to update group name",
      );
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
export { router as roomsRouter };