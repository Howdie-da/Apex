import { io, Socket } from "socket.io-client";

import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "../types/socket-events";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  SOCKET_URL,
  {
    // We enforce autoConnect: false to prevent the socket from hammering the server before the JWT is loaded into memory.
    autoConnect: false,
    transports: ["websocket"],
  },
);
