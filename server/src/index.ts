import http from "http";
import express from "express";
import cors from "cors";

import { Server } from "socket.io";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { initDB } from "./config/db";
import { authSocketMiddleware } from "./middleware/authSocket";
import { generalLimiter } from "./middleware/rateLimiter";
import { registerSocketHandlers } from "./socket/index";

import authRoutes from "./routes/auth";
import roomsRouter from "./routes/rooms";
import healthRoutes from "./routes/health";
import keysRouter from "./routes/keys";

import usersRouter from "./routes/users";

import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "./types/socket";

const log = logger.child({ module: "server" });

async function main(): Promise<void> {
  const app = express();

  app.use(express.json());
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    }),
  );

  app.use(generalLimiter);
  app.use("/api/auth", authRoutes);
  app.use("/api/rooms", roomsRouter);
  app.use("/api/keys", keysRouter);

  app.use("/api/users", usersRouter);
  app.use("/", healthRoutes);

  const httpServer = http.createServer(app);

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(
    httpServer,
    {
      cors: {
        origin: env.CLIENT_URL,
        methods: ["GET", "POST"],
        credentials: true,
      },
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
      },
    },
  );

  io.use(authSocketMiddleware);
  registerSocketHandlers(io);
  app.set("io", io);

  try {
    // FIX: Awaiting DB init before opening HTTP/Socket ports prevents race conditions
    // where clients connect and query before the connection pool is warmed up.
    await initDB();
    log.info("Database initialized");
  } catch (err) {
    // HACK: Hard exit on DB failure. We rely on Docker/PM2 to restart the process
    // rather than attempting manual reconnect logic which often masks deeper network issues.
    log.fatal({ err }, "Failed to initialize database — shutting down");
    process.exit(1);
  }
  
  httpServer.listen(env.PORT, () => {
    log.info(`
┌──────────────────────────────────────────┐
│                                          │
│       Apex Server is running             |
│                                          │
│   HTTP:   http://localhost:${env.PORT.toString().padEnd(28)} │
│   Socket: ws://localhost:${env.PORT.toString().padEnd(28)}   │
│   Mode:   ${env.NODE_ENV.padEnd(28)}   │
│                                          │
└──────────────────────────────────────────┘
    `);
  });
}

main().catch((err) => {
  log.fatal({ err }, "Failed to start server");
  process.exit(1);
});
