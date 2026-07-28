// ============================================
// client/src/store/useChatStore.ts
// Zustand store for Real-time Chat & Socket Sync
// Phase 2: E2EE encrypt/decrypt for DM rooms, reactions, replies
// ============================================

import { create } from 'zustand';
import type { Room, Message, Reaction } from '../types/index';
import { fetchAPI } from '../lib/api';
import { socket } from '../config/socket';
import { deriveSharedKey, decryptMessage } from '../lib/crypto';
import { useAuthStore } from './useAuthStore';

// Helper to extract the other user's ID from a DM room name (format: "uuid1:uuid2")
function getOtherUserIdFromRoomName(roomName: string, myUserId: string): string | null {
  const parts = roomName.split(':');
  if (parts.length === 2) {
    return parts[0] === myUserId ? parts[1] : parts[0];
  }
  return null;
}

interface TypingUser {
  userId: string;
  username: string;
}

interface ChatState {
  rooms: Room[];
  activeRoomId: string;
  messages: Message[];
  typingUsers: TypingUser[];
  loadingHistory: boolean;
  hasMoreHistory: boolean;
  isConnected: boolean;

  /** Cache: userId → SPKI Base64 public key (to avoid repeated API calls) */
  publicKeyCache: Record<string, string>;

  /** Cache: recipientUserId → AES-GCM CryptoKey (derived shared keys) */
  sharedKeyCache: Record<string, CryptoKey>;

  /** Current reply target */
  replyTo: Message | null;

  setRooms: (rooms: Room[]) => void;
  setActiveRoomId: (id: string) => void;
  setConnected: (connected: boolean) => void;
  setReplyTo: (message: Message | null) => void;

  loadRooms: () => Promise<void>;
  addRoom: (room: Room) => void;
  updateUserStatus: (userId: string, isOnline: boolean) => void;
  loadRoomMessages: (roomId: string) => Promise<void>;
  loadMoreHistory: () => Promise<void>;

  addMessage: (message: Message) => void;
  updateMessageReactions: (messageId: string, reactions: Reaction[]) => void;
  addTypingUser: (roomId: string, userId: string, username: string) => void;
  removeTypingUser: (roomId: string, userId: string) => void;

  sendMessage: (roomId: string, content: string, type?: Message['type'], replyTo?: string) => Promise<void>;
  reactToMessage: (messageId: string, emoji: string, roomId: string) => void;
  removeReaction: (messageId: string, emoji: string, roomId: string) => void;
  markRoomRead: (roomId: string) => Promise<void>;
  handleReadReceipt: (messageIds: string[]) => void;
  emitTyping: (roomId: string) => void;
  emitStopTyping: (roomId: string) => void;

  /** Internal: get or derive the shared key for a given userId's public key */
  _getSharedKey: (recipientUserId: string) => Promise<CryptoKey | null>;
  /** Internal: try to decrypt an incoming encrypted message */
  _decryptIncoming: (message: Message, senderUserId: string) => Promise<Message>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  rooms: [],
  activeRoomId: '',
  messages: [],
  typingUsers: [],
  loadingHistory: false,
  hasMoreHistory: true,
  isConnected: socket.connected,
  publicKeyCache: {},
  sharedKeyCache: {},
  replyTo: null,

  setRooms: (rooms) => set({ rooms }),

  setActiveRoomId: (roomId) => {
    const prevRoomId = get().activeRoomId;
    if (prevRoomId === roomId) return;

    set({ activeRoomId: roomId, messages: [], typingUsers: [], hasMoreHistory: true, replyTo: null });

    if (roomId) {
      if (socket.connected) socket.emit('chat:join', { roomId });
      get().loadRoomMessages(roomId);
    }
  },

  setConnected: (connected) => set({ isConnected: connected }),
  setReplyTo: (message) => set({ replyTo: message }),

  loadRooms: async () => {
    try {
      const roomList = await fetchAPI<Room[]>('/rooms');
      set({ rooms: roomList });

      // We no longer automatically select #General or the first room,
      // leaving it empty until the user explicitly selects a chat.
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    }
  },

  addRoom: (room) => {
    set((state) => {
      if (state.rooms.some((r) => r.id === room.id)) return state;
      return { rooms: [...state.rooms, room] };
    });
  },

  updateUserStatus: (userId, isOnline) => {
    set((state) => ({
      rooms: state.rooms.map((r) => {
        if (r.dmUser && r.dmUser.id === userId) {
          return { ...r, dmUser: { ...r.dmUser, isOnline } };
        }
        return r;
      }),
    }));
  },

  loadRoomMessages: async (roomId) => {
    if (!roomId) return;
    set({ loadingHistory: true, hasMoreHistory: true });

    try {
      const data = await fetchAPI<Message[]>(`/rooms/${roomId}/messages`);
      if (Array.isArray(data)) {
        const reversed = [...data].reverse();
        const room = get().rooms.find((r) => r.id === roomId);

        // Decrypt if it's an encrypted DM room
        const authUser = useAuthStore.getState().user;
        const otherUserId = room?.type === 'direct' ? getOtherUserIdFromRoomName(room.name, authUser?.id || '') : null;
        const processed = room?.isEncrypted
          ? await Promise.all(reversed.map((m) => get()._decryptIncoming(m, otherUserId || m.senderId)))
          : reversed;

        set({ messages: processed, hasMoreHistory: data.length >= 50 });
      } else {
        set({ messages: [], hasMoreHistory: false });
      }
    } catch (err) {
      console.error('Failed to load room messages:', err);
      set({ messages: [], hasMoreHistory: false });
    } finally {
      set({ loadingHistory: false });
    }
  },

  loadMoreHistory: async () => {
    const { activeRoomId, messages, loadingHistory, hasMoreHistory } = get();
    if (loadingHistory || !hasMoreHistory || messages.length === 0 || !activeRoomId) return;

    set({ loadingHistory: true });
    const oldestMessage = messages[0];

    try {
      const olderData = await fetchAPI<Message[]>(
        `/rooms/${activeRoomId}/messages?before=${encodeURIComponent(oldestMessage.createdAt.toString())}`
      );

      if (Array.isArray(olderData) && olderData.length > 0) {
        const room = get().rooms.find((r) => r.id === activeRoomId);
        const authUser = useAuthStore.getState().user;
        const otherUserId = room?.type === 'direct' ? getOtherUserIdFromRoomName(room.name, authUser?.id || '') : null;
        const reversed = [...olderData].reverse();
        const processed = room?.isEncrypted
          ? await Promise.all(reversed.map((m) => get()._decryptIncoming(m, otherUserId || m.senderId)))
          : reversed;

        set((state) => {
          const existingIds = new Set(state.messages.map((m) => m.id));
          const filtered = processed.filter((m) => !existingIds.has(m.id));
          return {
            messages: [...filtered, ...state.messages],
            hasMoreHistory: olderData.length >= 50,
          };
        });
      } else {
        set({ hasMoreHistory: false });
      }
    } catch (err) {
      console.error('Failed to load more history:', err);
    } finally {
      set({ loadingHistory: false });
    }
  },

  addMessage: async (message) => {
    const { activeRoomId, rooms } = get();
    
    set((state) => ({
      rooms: state.rooms.map((r) => {
        if (r.id === message.roomId) {
          const isBackgroundDM = message.roomId !== activeRoomId && message.senderId !== useAuthStore.getState().user?.id;
          return { 
            ...r, 
            lastActivityAt: message.createdAt,
            unreadCount: isBackgroundDM ? (r.unreadCount || 0) + 1 : r.unreadCount
          };
        }
        return r;
      }),
    }));

    if (message.roomId !== activeRoomId) return;
    if (get().messages.some((m) => m.id === message.id)) return;

    const room = rooms.find((r) => r.id === message.roomId);
    const authUser = useAuthStore.getState().user;
    const otherUserId = room?.type === 'direct' ? getOtherUserIdFromRoomName(room.name, authUser?.id || '') : null;
    const processed =
      room?.isEncrypted && message.type === 'encrypted'
        ? await get()._decryptIncoming(message, otherUserId || message.senderId)
        : message;

    set((state) => ({ messages: [...state.messages, processed] }));

    // If the message is from someone else, automatically mark the room as read to trigger read receipts!
    if (message.senderId !== authUser?.id) {
      get().markRoomRead(message.roomId);
    }
  },

  updateMessageReactions: (messageId, reactions) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, reactions } : m
      ),
    }));
  },

  addTypingUser: (roomId, userId, username) =>
    set((state) => {
      if (roomId !== state.activeRoomId) return state;
      if (state.typingUsers.some((u) => u.userId === userId)) return state;
      return { typingUsers: [...state.typingUsers, { userId, username }] };
    }),

  removeTypingUser: (roomId, userId) =>
    set((state) => {
      if (roomId !== state.activeRoomId) return state;
      return { typingUsers: state.typingUsers.filter((u) => u.userId !== userId) };
    }),

  sendMessage: async (roomId, content, type = 'text', replyTo) => {
    if (!roomId || !content.trim()) return;

    let finalContent = content.trim();
    let finalType: Message['type'] = type;

    // E2EE: Disabled per user request. New messages will be sent as plain text.
    // This resolves the fragility of key rotation in dev environments while keeping existing messages encrypted.

    socket.emit('chat:message', { roomId, content: finalContent, type: finalType, replyTo });
    set({ replyTo: null });
  },

  reactToMessage: (messageId, emoji, roomId) => {
    socket.emit('chat:react', { messageId, emoji, roomId });
  },

  removeReaction: (messageId, emoji, roomId) => {
    socket.emit('chat:unreact', { messageId, emoji, roomId });
  },

  markRoomRead: async (roomId) => {
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId ? { ...r, unreadCount: 0 } : r
      ),
    }));
    try {
      await fetchAPI(`/rooms/${roomId}/read`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to mark room as read', err);
    }
  },

  handleReadReceipt: (messageIds) => {
    const idSet = new Set(messageIds);
    set((state) => ({
      messages: state.messages.map((m) =>
        idSet.has(m.id) ? { ...m, isRead: true } : m
      )
    }));
  },

  emitTyping: (roomId) => {
    if (!roomId) return;
    socket.emit('chat:typing', { roomId });
  },

  emitStopTyping: (roomId) => {
    if (!roomId) return;
    socket.emit('chat:stop-typing', { roomId });
  },

  _getSharedKey: async (recipientUserId) => {
    const { sharedKeyCache, publicKeyCache } = get();

    // Already derived
    if (sharedKeyCache[recipientUserId]) return sharedKeyCache[recipientUserId];

    const privateKey = useAuthStore.getState().privateKey;
    if (!privateKey) return null;

    try {
      // Get recipient public key (from cache or API)
      let recipientPublicKeyB64 = publicKeyCache[recipientUserId];
      if (!recipientPublicKeyB64) {
        const data = await fetchAPI<{ userId: string; publicKey: string }>(`/keys/${recipientUserId}`);
        recipientPublicKeyB64 = data.publicKey;
        set((state) => ({
          publicKeyCache: { ...state.publicKeyCache, [recipientUserId]: recipientPublicKeyB64 },
        }));
      }

      const sharedKey = await deriveSharedKey(privateKey, recipientPublicKeyB64);
      set((state) => ({
        sharedKeyCache: { ...state.sharedKeyCache, [recipientUserId]: sharedKey },
      }));
      return sharedKey;
    } catch (err) {
      console.error('[E2EE] Failed to derive shared key for', recipientUserId, err);
      return null;
    }
  },

  _decryptIncoming: async (message, otherUserId) => {
    if (message.type !== 'encrypted') return message;

    try {
      const sharedKey = await get()._getSharedKey(otherUserId);
      if (!sharedKey) return message;
      const plaintext = await decryptMessage(message.content, sharedKey);
      return { ...message, decrypted: plaintext };
    } catch (err) {
      console.warn('[E2EE] Decryption failed for message', message.id, err);
      return { ...message, decrypted: '[Encrypted Message]' };
    }
  },
}));
