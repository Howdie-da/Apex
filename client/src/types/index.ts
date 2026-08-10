export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  publicKey: string | null;
  encryptedPrivateKey?: string | null;
  isOnline: boolean;
  lastSeen: string;
  createdAt: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface ReplyPreview {
  id: string;
  content: string;
  senderDisplayName: string;
}

export interface Message {
  id: string;
  senderId: string;
  roomId: string;
  content: string;
  decrypted?: string;
  type: "text" | "image" | "system" | "encrypted";
  replyTo: string | null;
  replyToMessage: ReplyPreview | null;
  reactions: Reaction[];
  createdAt: string;
  isRead?: boolean;
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface Room {
  id: string;
  name: string;
  type: "direct" | "group";
  isEncrypted: boolean;
  createdBy: string | null;
  createdAt: string | Date;
  lastActivityAt?: string | Date | null;
  unreadCount?: number;
  dmUser?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isOnline?: boolean;
    lastSeen?: Date | string;
  } | null;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export type CategoryId = "all" | "groups" | "direct" | "starred" | "archive";

export type TagCode = "CH" | "DM" | "SEC" | "AP";

export const CATEGORY_NAMES: Record<CategoryId, string> = {
  all: "All Inboxes",
  groups: "Groups",
  direct: "Direct Messages",
  starred: "Starred & Pinned",
  archive: "Archived Chats",
};
