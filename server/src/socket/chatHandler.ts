import { logger } from "../config/logger";
import * as MessageModel from "../models/message";
import pool from "../config/db";

import type { AuthenticatedSocket, TypedServer } from "../types/socket";

const log = logger.child({ module: "socket:chat" });

const ALLOWED_EMOJIS = new Set([
  "👍",
  "❤️",
  "😂",
  "😮",
  "😢",
  "🔥",
  "👎",
  "🎉",
  "🤔",
  "💯",
]);

export function chatHandler(
  io: TypedServer,
  socket: AuthenticatedSocket,
): void {
  const user = socket.data.user;

  socket.on("chat:join", async ({ roomId }) => {
    try {
      socket.join(roomId);

      await pool.query(
        `
        INSERT INTO room_members (room_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [roomId, user.userId],
      );

      socket.to(roomId).emit("chat:user-joined", {
        user: {
          id: user.userId,
          username: user.username,
          displayName: user.username,
          avatarUrl: null,
          publicKey: null,
          isOnline: true,
          lastSeen: new Date(),
          createdAt: new Date(),
        },
        roomId,
      });

      log.debug({ userId: user.userId, roomId }, "User joined room");

    } catch (err) {
      log.error({ err, userId: user.userId, roomId }, "Error joining room");
      socket.emit("error", { message: "Failed to join room" });
    }
  });

  socket.on("chat:message", async ({ roomId, content, type, replyTo }) => {
    try {
      if (!content || content.trim().length === 0) {
        socket.emit("error", { message: "Message content cannot be empty" });
        return;
      }

      // We enforce a strict 32KB payload limit for encrypted payloads to prevent OOM attacks 
      // on the socket parser, as the client encrypts the payload structure natively.
      const maxLen = type === "encrypted" ? 32768 : 5000;
      
      if (content.length > maxLen) {
        socket.emit("error", {
          message: `Message too long (max ${maxLen} characters)`,
        });
        return;
      }

      const message = await MessageModel.createMessage(
        user.userId,
        roomId,
        content.trim(),
        type || "text",
        replyTo || null,
      );

      // FIX: Ensure all room members are forced into the socket room. 
      // This mitigates the race condition where a user creates a DM but the target hasn't explicitly joined the socket room yet.
      const { rows: members } = await pool.query(
        "SELECT user_id FROM room_members WHERE room_id = $1",
        [roomId],
      );

      members.forEach((m) => {
        io.in(m.user_id).socketsJoin(roomId);
      });

      io.to(roomId).emit("chat:message", message);
      
      log.debug(
        { messageId: message.id, roomId, senderId: user.userId },
        "Message sent",
      );

    } catch (err) {
      log.error({ err, userId: user.userId, roomId }, "Error sending message");
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  socket.on("chat:typing", ({ roomId }) => {
    socket.to(roomId).emit("chat:typing", {
      userId: user.userId,
      username: user.username,
      roomId,
    });
  });

  socket.on("chat:stop-typing", ({ roomId }) => {
    socket.to(roomId).emit("chat:stop-typing", {
      userId: user.userId,
      roomId,
    });
  });

  socket.on("chat:history", async ({ roomId, before }) => {
    try {
      const messages = await MessageModel.getMessages(roomId, 50, before);
      
      socket.emit("chat:history", messages);
      
      log.debug({ roomId, count: messages.length, before }, "History sent");

    } catch (err) {
      log.error({ err, userId: user.userId, roomId }, "Error fetching history");
      socket.emit("error", { message: "Failed to load message history" });
    }
  });

  socket.on("chat:react", async ({ messageId, emoji, roomId }) => {
    try {
      // Bypasses storing arbitrary strings as emojis to prevent XSS payloads disguised as emojis.
      if (!ALLOWED_EMOJIS.has(emoji)) {
        socket.emit("error", { message: "Invalid emoji" });
        return;
      }

      await MessageModel.addReaction(messageId, user.userId, emoji);
      
      const reactions = await MessageModel.getReactions(messageId);
      
      io.to(roomId).emit("chat:reaction", { messageId, reactions });

    } catch (err) {
      log.error(
        { err, userId: user.userId, messageId },
        "Error adding reaction",
      );
    }
  });

  socket.on("chat:unreact", async ({ messageId, emoji, roomId }) => {
    try {
      await MessageModel.removeReaction(messageId, user.userId, emoji);
      
      const reactions = await MessageModel.getReactions(messageId);
      
      io.to(roomId).emit("chat:reaction", { messageId, reactions });

    } catch (err) {
      log.error(
        { err, userId: user.userId, messageId },
        "Error removing reaction",
      );
    }
  });
}