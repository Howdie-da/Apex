export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  publicKey: string | null;
  isOnline: boolean;
  lastSeen: Date;
  createdAt: Date;
}

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  avatar_url: string | null;
  public_key: string | null;
  is_online: boolean;
  last_seen: Date;
  created_at: Date;
}

export interface Message {
  id: string;
  senderId: string;
  roomId: string;
  content: string;
  type: 'text' | 'image' | 'system' | 'encrypted';
  createdAt: Date;
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface MessageRow {
  id: string;
  sender_id: string;
  room_id: string;
  content: string;
  type: string;
  created_at: Date;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

export interface Room {
  id: string;
  name: string;
  type: 'direct' | 'group';
  createdBy: string | null;
  createdAt: Date;
}

export interface JwtPayload {
  userId: string;
  username: string;
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    publicKey: row.public_key,
    isOnline: row.is_online,
    lastSeen: row.last_seen,
    createdAt: row.created_at,
  };
}

export function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    senderId: row.sender_id,
    roomId: row.room_id,
    content: row.content,
    type: row.type as Message['type'],
    createdAt: row.created_at,
    sender: {
      id: row.sender_id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
    },
  };
}
