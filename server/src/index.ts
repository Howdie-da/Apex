import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';

import { env } from './config/env';
import { logger } from './config/logger';
import { initDB } from './config/db';
import { authSocketMiddleware } from './middleware/authSocket';
import { generalLimiter } from './middleware/rateLimiter';
import { registerSocketHandlers } from './socket/index';
import authRoutes from './routes/auth';
import roomsRouter from './routes/rooms';
import healthRoutes from './routes/health';
import keysRouter from './routes/keys';
import reactionsRouter from './routes/reactions';
import usersRouter from './routes/users';
import type { ClientToServerEvents, ServerToClientEvents } from './types/socket';

const log = logger.child({ module: 'server' });

async function main(): Promise<void> {
  const app = express();

  app.use(express.json());
  app.use(cors({
    origin: env.CLIENT_URL,
    credentials: true,
  }));
  app.use(generalLimiter);

  app.use('/api/auth', authRoutes);
  app.use('/api/rooms', roomsRouter);
  app.use('/api/keys', keysRouter);
  app.use('/api/messages', reactionsRouter);
  app.use('/api/users', usersRouter);
  app.use('/', healthRoutes);

  const httpServer = http.createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
    },
  });

  io.use(authSocketMiddleware);
  registerSocketHandlers(io);
  app.set('io', io);
  
  try {
    await initDB();
    log.info('Database initialized');
  } catch (err) {
    log.fatal({ err }, 'Failed to initialize database — shutting down');
    process.exit(1);
  }

  httpServer.listen(env.PORT, () => {
    log.info(`
┌──────────────────────────────────────────┐
│                                          │
│       Apex Server is running             |
│                                          │
│   HTTP:   http://localhost:${env.PORT}          │
│   Socket: ws://localhost:${env.PORT}            │
│   Mode:   ${env.NODE_ENV.padEnd(28)}   │
│                                          │
└──────────────────────────────────────────┘
    `);
  });
}

main()
.catch((err) => {
  log.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
