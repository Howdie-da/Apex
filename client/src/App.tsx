import React, { useEffect, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import { useChatStore } from "./store/useChatStore";
import { socket } from "./config/socket";
import AuthPage from "./features/auth/AuthPage";
import ChatApp from "./components/ChatApp";
const AuthGuard: React.FC<{ children: ReactNode; requireAuth: boolean }> = ({
  children,
  requireAuth,
}) => {
  const { user, isLoading } = useAuthStore();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center select-none bg-background text-foreground">
        <span className="font-mono text-xs tracking-wider text-muted-foreground">
          [ Initializing Apex... ]
        </span>
      </div>
    );
  }
  if (requireAuth && !user) {
    return <Navigate to="/auth" replace />;
  }
  if (!requireAuth && user) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};
const ApexMainApp: React.FC = () => {
  const { accessToken, logout } = useAuthStore();
  const {
    addMessage,
    addTypingUser,
    removeTypingUser,
    setConnected,
    updateMessageReactions,
    addRoom,
    updateUserStatus,
    handleReadReceipt,
    updateUserDisplayName,
    updateRoomName,
  } = useChatStore();
  useEffect(() => {
    if (!accessToken) {
      socket.disconnect();
      return;
    }
    socket.auth = { token: accessToken };
    socket.connect();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onConnectError = (err: Error) => {
      console.error("Socket connection error:", err.message);
      setConnected(false);
      if (err.message.includes("Authentication error")) {
        logout();
      }
    };
    const onMessage = (message: any) => addMessage(message);
    const onTyping = (data: any) =>
      addTypingUser(data.roomId, data.userId, data.username);
    const onStopTyping = (data: any) =>
      removeTypingUser(data.roomId, data.userId);
    const onReaction = (data: any) =>
      updateMessageReactions(data.messageId, data.reactions);
    const onRoomCreated = (room: any) => {
      addRoom(room);
      socket.emit("chat:join", { roomId: room.id });
    };
    const onUserOnline = (data: { userId: string; username: string }) =>
      updateUserStatus(data.userId, true);
    const onUserOffline = (data: { userId: string; username: string }) =>
      updateUserStatus(data.userId, false);
    const onReadReceipt = (data: {
      roomId: string;
      readerId: string;
      messageIds: string[];
    }) => handleReadReceipt(data.messageIds);
    const onUserDisplayNameChanged = (data: {
      userId: string;
      newDisplayName: string;
    }) => updateUserDisplayName(data.userId, data.newDisplayName);
    const onRoomNameChanged = (data: { roomId: string; newName: string }) =>
      updateRoomName(data.roomId, data.newName);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("chat:message", onMessage);
    socket.on("chat:typing", onTyping);
    socket.on("chat:stop-typing", onStopTyping);
    socket.on("chat:reaction", onReaction);
    socket.on("room:created", onRoomCreated);
    socket.on("user:online", onUserOnline);
    socket.on("user:offline", onUserOffline);
    socket.on("chat:read-receipt", onReadReceipt);
    socket.on("user:display-name-changed", onUserDisplayNameChanged);
    socket.on("room:name-changed", onRoomNameChanged);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("chat:message", onMessage);
      socket.off("chat:typing", onTyping);
      socket.off("chat:stop-typing", onStopTyping);
      socket.off("chat:reaction", onReaction);
      socket.off("room:created", onRoomCreated);
      socket.off("user:online", onUserOnline);
      socket.off("user:offline", onUserOffline);
      socket.off("chat:read-receipt", onReadReceipt);
      socket.off("user:display-name-changed", onUserDisplayNameChanged);
      socket.off("room:name-changed", onRoomNameChanged);
    };
  }, [
    accessToken,
    logout,
    addMessage,
    addTypingUser,
    removeTypingUser,
    setConnected,
    updateMessageReactions,
    addRoom,
    updateUserStatus,
    handleReadReceipt,
    updateUserDisplayName,
    updateRoomName,
  ]);
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/auth"
          element={
            <AuthGuard requireAuth={false}>
              <AuthPage />
            </AuthGuard>
          }
        />
        <Route
          path="/"
          element={
            <AuthGuard requireAuth={true}>
              <ChatApp />
            </AuthGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};
export const App: React.FC = () => {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);
  return <ApexMainApp />;
};
export default App;
