// ============================================
// client/src/features/chat/hooks/useChat.ts
// Proxy hook exporting useChatStore for backwards compatibility
// ============================================

import { useChatStore } from '../../../store/useChatStore';

export function useChat(roomId: string) {
  const store = useChatStore();
  
  // Return the store bounded to the active room context if needed
  // Since useChatStore manages the active room natively, we can just return the store functions.
  return {
    messages: store.messages,
    typingUsers: store.typingUsers.map(u => u.username),
    loadingHistory: store.loadingHistory,
    hasMoreHistory: store.hasMoreHistory,
    sendMessage: (content: string, type: any = 'text') => store.sendMessage(roomId, content, type),
    emitTyping: () => store.emitTyping(roomId),
    emitStopTyping: () => store.emitStopTyping(roomId),
    loadMoreHistory: store.loadMoreHistory,
    isConnected: store.isConnected,
  };
}
