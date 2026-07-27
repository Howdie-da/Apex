// ============================================
// client/src/types/socket-events.ts
// ============================================

import type { Message, User } from './index';

export interface ServerToClientEvents {
  'chat:message': (message: Message) => void;
  'chat:history': (messages: Message[]) => void;
  'chat:typing': (data: { userId: string; username: string; roomId: string }) => void;
  'chat:stop-typing': (data: { userId: string; roomId: string }) => void;
  'chat:user-joined': (data: { user: User; roomId: string }) => void;
  'chat:user-left': (data: { user: User; roomId: string }) => void;
  'user:online': (data: { userId: string; username: string }) => void;
  'user:offline': (data: { userId: string; username: string }) => void;
  'error': (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  'chat:join': (data: { roomId: string }) => void;
  'chat:message': (data: { roomId: string; content: string; type?: string }) => void;
  'chat:typing': (data: { roomId: string }) => void;
  'chat:stop-typing': (data: { roomId: string }) => void;
  'chat:history': (data: { roomId: string; before?: string }) => void;
}
