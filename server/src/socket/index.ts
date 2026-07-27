import { logger } from '../config/logger';
import * as UserModel from '../models/user';
import pool from '../config/db';
import { chatHandler } from './chatHandler';
import type { TypedServer, AuthenticatedSocket } from '../types/socket';

const log = logger.child({ module: 'socket' });

export function registerSocketHandlers(io: TypedServer): void {
  io.on('connection', async (socket) => {
    const authenticatedSocket = socket as AuthenticatedSocket;
    const user = authenticatedSocket.data.user;

    log.info({ socketId: socket.id, userId: user.userId, username: user.username }, 'User connected');

    try {
      await UserModel.setOnlineStatus(user.userId, true);

      socket.broadcast.emit('user:online', {
        userId: user.userId,
        username: user.username,
      });

      const { rows: generalRooms } = await pool.query(
        "SELECT id FROM rooms WHERE name = 'General' LIMIT 1"
      );
      if (generalRooms.length > 0) {
        const generalRoomId = generalRooms[0].id;
        socket.join(generalRoomId);

        await pool.query(
          `INSERT INTO room_members (room_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [generalRoomId, user.userId]
        );
      }

      chatHandler(io, authenticatedSocket);

    } catch (err) {
      log.error({ err, userId: user.userId }, 'Error during connection setup');
    }

    socket.on('disconnect', async (reason) => {
      log.info({ socketId: socket.id, userId: user.userId, reason }, 'User disconnected');

      try {
        await UserModel.setOnlineStatus(user.userId, false);

        socket.broadcast.emit('user:offline', {
          userId: user.userId,
          username: user.username,
        });
      } catch (err) {
        log.error({ err, userId: user.userId }, 'Error during disconnect cleanup');
      }
    });
  });
}
