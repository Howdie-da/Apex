import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { logger } from "../config/logger";

import type { JwtPayload } from "../types/index";
import type { Socket } from "socket.io";

const log = logger.child({ module: "auth:socket" });

// Prevents unauthenticated socket connections from holding open TCP connections on the server.
export function authSocketMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
): void {
  const token = socket.handshake.auth?.token;

  if (!token) {
    log.warn({ socketId: socket.id }, "Socket connection rejected: no token");
    return next(new Error("Authentication error: Token required"));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    
    // Extend the socket instance to persist the user identity across this stateful TCP connection.
    socket.data.user = decoded;
    
    log.debug(
      { socketId: socket.id, userId: decoded.userId },
      "Socket authenticated",
    );
    
    next();
  } catch (err) {
    log.warn(
      { socketId: socket.id },
      "Socket connection rejected: invalid token",
    );
    
    next(new Error("Authentication error: Invalid token"));
  }
}