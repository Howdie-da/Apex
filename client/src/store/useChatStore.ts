// ============================================
// client/src/store/useChatStore.ts
// Zustand store for Real-time Chat & Socket Sync
// ============================================

import { create } from 'zustand';
import type { Room, Message } from '../types/index';
import { fetchAPI } from '../lib/api';
import { socket } from '../config/socket';

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

  setRooms: (rooms: Room[]) => void;
  setActiveRoomId: (id: string) => void;
  setConnected: (connected: boolean) => void;

  loadRooms: () => Promise<void>;
  loadRoomMessages: (roomId: string) => Promise<void>;
  loadMoreHistory: () => Promise<void>;

  addMessage: (message: Message) => void;
  addTypingUser: (roomId: string, userId: string, username: string) => void;
  removeTypingUser: (roomId: string, userId: string) => void;

  sendMessage: (roomId: string, content: string, type?: Message['type']) => void;
  emitTyping: (roomId: string) => void;
  emitStopTyping: (roomId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  rooms: [],
  activeRoomId: '',
  messages: [],
  typingUsers: [],
  loadingHistory: false,
  hasMoreHistory: true,
  isConnected: socket.connected,

  setRooms: (rooms) => set({ rooms }),
  
  setActiveRoomId: (roomId) => {
    const prevRoomId = get().activeRoomId;
    if (prevRoomId === roomId) return;
    
    set({ activeRoomId: roomId, messages: [], typingUsers: [], hasMoreHistory: true });
    
    if (roomId) {
      if (socket.connected) socket.emit('chat:join', { roomId });
      get().loadRoomMessages(roomId);
    }
  },

  setConnected: (connected) => set({ isConnected: connected }),

  loadRooms: async () => {
    try {
      const roomList = await fetchAPI<Room[]>('/rooms');
      set({ rooms: roomList });
      
      const currentActive = get().activeRoomId;
      if (roomList.length > 0 && !currentActive) {
        const general = roomList.find((r) => r.name.toLowerCase() === 'general') || roomList[0];
        get().setActiveRoomId(general.id);
      }
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    }
  },

  loadRoomMessages: async (roomId) => {
    if (!roomId) return;
    set({ loadingHistory: true, hasMoreHistory: true });
    
    try {
      const data = await fetchAPI<Message[]>(`/rooms/${roomId}/messages`);
      if (Array.isArray(data)) {
        // REST returns newest-first, reverse to display oldest-first
        set({ messages: [...data].reverse(), hasMoreHistory: data.length >= 50 });
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
        set((state) => {
          const existingIds = new Set(state.messages.map((m) => m.id));
          const filtered = olderData.filter((m) => !existingIds.has(m.id)).reverse();
          return {
            messages: [...filtered, ...state.messages],
            hasMoreHistory: olderData.length >= 50
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

  addMessage: (message) => set((state) => {
    if (message.roomId !== state.activeRoomId) return state; // Only add to active room for now
    if (state.messages.some((m) => m.id === message.id)) return state;
    return { messages: [...state.messages, message] };
  }),

  addTypingUser: (roomId, userId, username) => set((state) => {
    if (roomId !== state.activeRoomId) return state;
    if (state.typingUsers.some((u) => u.userId === userId)) return state;
    return { typingUsers: [...state.typingUsers, { userId, username }] };
  }),

  removeTypingUser: (roomId, userId) => set((state) => {
    if (roomId !== state.activeRoomId) return state;
    return { typingUsers: state.typingUsers.filter((u) => u.userId !== userId) };
  }),

  sendMessage: (roomId, content, type = 'text') => {
    if (!roomId || !content.trim()) return;
    socket.emit('chat:message', { roomId, content: content.trim(), type });
  },

  emitTyping: (roomId) => {
    if (!roomId) return;
    socket.emit('chat:typing', { roomId });
  },

  emitStopTyping: (roomId) => {
    if (!roomId) return;
    socket.emit('chat:stop-typing', { roomId });
  }
}));
