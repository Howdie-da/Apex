// ============================================
// client/src/types/index.ts
// ============================================

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  publicKey: string | null; // Phase 2: E2EE ECDH P-256 SPKI Base64
  encryptedPrivateKey?: string | null; // Phase 2: Zero-knowledge PBKDF2 encrypted private key backup
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
  content: string;        // Plaintext after decryption (for 'encrypted' type, raw ciphertext until decrypted)
  decrypted?: string;     // Resolved plaintext when type === 'encrypted'
  type: 'text' | 'image' | 'system' | 'encrypted';
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
  type: 'direct' | 'group';
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
