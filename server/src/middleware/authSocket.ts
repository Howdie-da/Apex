import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../config/logger';
import type { JwtPayload } from '../types/index';
import type { Socket } from 'socket.io';

const log = logger.child({ module: 'auth:socket' });

// 1. Extracts the token from socket.handshake.auth.token
// 2. Verifies it with JWT_SECRET
// 3. Attaches the decoded user to socket.data.user
// 4. Calls next() to allow the connection

export function authSocketMiddleware(socket: Socket, next: (err?: Error) => void): void {
  const token = socket.handshake.auth?.token;

  if (!token) {
    log.warn({ socketId: socket.id }, 'Socket connection rejected: no token');
    return next(new Error('Authentication error: Token required'));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    
    // Attach user data to socket.data — accessible in all event handlers
    socket.data.user = decoded;
    
    log.debug({ socketId: socket.id, userId: decoded.userId }, 'Socket authenticated');
    next();
  } catch (err) {
    log.warn({ socketId: socket.id }, 'Socket connection rejected: invalid token');
    next(new Error('Authentication error: Invalid token'));
  }
}

// Why a different Socket.io middleware for auth?
// ========================================================
// Express middleware runs on EVERY HTTP request:
//   app.use(authMiddleware)  → runs for GET /api/users, POST /api/messages, etc.
//
// Socket.io middleware runs ONCE during the WebSocket HANDSHAKE:
//   io.use(authSocketMiddleware)  → runs when socket.connect() is called
//
// After the handshake succeeds, the socket stays connected.
// Subsequent events (chat:message, chat:typing, etc.) don't re-run the middleware.
// The user data attached during the handshake persists for the socket's lifetime.
//
// This means:
// - If a JWT expires while a socket is connected, the connection stays alive
// - The client should reconnect when it refreshes the token
// - We don't need to verify the token on every event (huge performance win)