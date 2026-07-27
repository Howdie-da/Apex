// ============================================
// client/src/types/index.ts
// ============================================

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  publicKey: string | null; // Phase 2: E2EE public key
  isOnline: boolean;
  lastSeen: string; // ISO string representation
  createdAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  roomId: string;
  content: string;
  type: 'text' | 'image' | 'system' | 'encrypted';
  createdAt: string; // ISO string representation
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
  createdBy: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}
