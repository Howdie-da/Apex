import { useChatStore } from "../../../store/useChatStore";

export function useChat(roomId: string) {
  const store = useChatStore();
  return {
    messages: store.messages,
    typingUsers: store.typingUsers.map((u) => u.username),
    loadingHistory: store.loadingHistory,
    hasMoreHistory: store.hasMoreHistory,
    sendMessage: (content: string, type: any = "text") =>
      store.sendMessage(roomId, content, type),
    emitTyping: () => store.emitTyping(roomId),
    emitStopTyping: () => store.emitStopTyping(roomId),
    loadMoreHistory: store.loadMoreHistory,
    isConnected: store.isConnected,
  };
}
