export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  publicKey: string | null;
  encryptedPrivateKey?: string | null;
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
  encrypted_private_key?: string | null;
  is_online: boolean;
  last_seen: Date;
  created_at: Date;
}

export interface Reaction {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface Message {
  id: string;
  senderId: string;
  roomId: string;
  content: string;
  type: "text" | "image" | "system" | "encrypted";
  replyTo: string | null;
  replyToMessage: ReplyPreview | null;
  reactions: Reaction[];
  createdAt: Date;
  isRead?: boolean;
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface ReplyPreview {
  id: string;
  content: string;
  senderDisplayName: string;
}

export interface MessageRow {
  id: string;
  sender_id: string;
  room_id: string;
  content: string;
  type: string;
  reply_to: string | null;
  is_read: boolean;
  created_at: Date;
  username: string;
  display_name: string;
  avatar_url: string | null;
  reply_to_content: string | null;
  reply_to_sender_name: string | null;
  reactions_json: string | null;
}

export interface Room {
  id: string;
  name: string;
  type: "direct" | "group";
  isEncrypted: boolean;
  createdBy: string | null;
  createdAt: Date;
  lastActivityAt?: Date | null;
  unreadCount?: number;
  dmUser?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isOnline?: boolean;
    lastSeen?: Date;
  } | null;
}

export interface RoomRow {
  id: string;
  name: string;
  type: string;
  is_encrypted: boolean;
  created_by: string | null;
  created_at: Date;
  last_activity_at?: Date | null;
  unread_count?: string | number;
  dm_user_id?: string | null;
  dm_username?: string | null;
  dm_display_name?: string | null;
  dm_avatar_url?: string | null;
  dm_is_online?: boolean;
  dm_last_seen?: Date;
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
    encryptedPrivateKey: row.encrypted_private_key || null,
    isOnline: row.is_online,
    lastSeen: row.last_seen,
    createdAt: row.created_at,
  };
}

export function toMessage(row: MessageRow): Message {
  let reactions: Reaction[] = [];

  if (row.reactions_json) {
    try {
      reactions = JSON.parse(row.reactions_json);
    } catch {
      reactions = [];
    }
  }

  return {
    id: row.id,
    senderId: row.sender_id,
    roomId: row.room_id,
    content: row.content,
    type: row.type as Message["type"],
    replyTo: row.reply_to || null,
    replyToMessage:
      row.reply_to && row.reply_to_content
        ? {
            id: row.reply_to,
            content: row.reply_to_content,
            senderDisplayName: row.reply_to_sender_name || "User",
          }
        : null,
    reactions,
    createdAt: row.created_at,
    isRead: row.is_read,
    sender: {
      id: row.sender_id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
    },
  };
}

export function toRoom(row: RoomRow): Room {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Room["type"],
    isEncrypted: row.is_encrypted,
    createdBy: row.created_by,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at || row.created_at,
    unreadCount: row.unread_count ? parseInt(String(row.unread_count), 10) : 0,
    dmUser: row.dm_user_id
      ? {
          id: row.dm_user_id,
          username: row.dm_username || "",
          displayName: row.dm_display_name || "",
          avatarUrl: row.dm_avatar_url || null,
          isOnline: row.dm_is_online,
          lastSeen: row.dm_last_seen,
        }
      : null,
  };
}