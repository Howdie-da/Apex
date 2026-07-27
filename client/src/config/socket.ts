// ============================================
// client/src/config/socket.ts
// ============================================

import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '../types/socket-events';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

/**
 * Socket.io client instance singleton.
 * 
 * Configured with autoConnect: false.
 * We connect manually inside SocketContext once we have a valid JWT.
 */
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket'], // Force WebSocket transport directly (faster handshake)
});
