import type { Message, User, Reaction } from "./index";

export interface ServerToClientEvents {
  "room:created": (room: import("./index").Room) => void;
  "chat:message": (message: Message) => void;
  "chat:history": (messages: Message[]) => void;
  "chat:typing": (data: {
    userId: string;
    username: string;
    roomId: string;
  }) => void;
  "chat:stop-typing": (data: { userId: string; roomId: string }) => void;
  "chat:user-joined": (data: { user: User; roomId: string }) => void;
  "chat:user-left": (data: { user: User; roomId: string }) => void;
  "chat:reaction": (data: { messageId: string; reactions: Reaction[] }) => void;
  "chat:read-receipt": (data: {
    roomId: string;
    readerId: string;
    messageIds: string[];
  }) => void;
  "user:online": (data: { userId: string; username: string }) => void;
  "user:offline": (data: { userId: string; username: string }) => void;
  "user:display-name-changed": (data: {
    userId: string;
    newDisplayName: string;
  }) => void;
  "room:name-changed": (data: { roomId: string; newName: string }) => void;
  error: (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  "chat:join": (data: { roomId: string }) => void;
  "chat:message": (data: {
    roomId: string;
    content: string;
    type?: string;
    replyTo?: string;
  }) => void;
  "chat:typing": (data: { roomId: string }) => void;
  "chat:stop-typing": (data: { roomId: string }) => void;
  "chat:history": (data: { roomId: string; before?: string }) => void;
  "chat:react": (data: {
    messageId: string;
    emoji: string;
    roomId: string;
  }) => void;
  "chat:unreact": (data: {
    messageId: string;
    emoji: string;
    roomId: string;
  }) => void;
}
