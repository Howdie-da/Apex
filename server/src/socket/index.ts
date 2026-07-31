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


      // Join all rooms the user is a member of
      const { rows: userRooms } = await pool.query(
        "SELECT room_id FROM room_members WHERE user_id = $1",
        [user.userId]
      );
      userRooms.forEach((r) => socket.join(r.room_id));

      // Join a personal room for direct events or forced joins
      socket.join(user.userId);

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
