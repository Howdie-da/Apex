// ============================================
// client/src/App.tsx
// Apex Root Entry Point — Real Auth & Socket Wiring (Zustand)
// ============================================

import React, { useEffect } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { useChatStore } from './store/useChatStore';
import { socket } from './config/socket';
import AuthPage from './features/auth/AuthPage';
import ChatApp from './components/ChatApp';

const ApexMainApp: React.FC = () => {
  const { user, isLoading, accessToken, logout } = useAuthStore();
  const { addMessage, addTypingUser, removeTypingUser, setConnected } = useChatStore();

  // Socket Connection and Global Listeners
  useEffect(() => {
    if (!accessToken) {
      socket.disconnect();
      return;
    }

    // Connect socket with auth token
    socket.auth = { token: accessToken };
    socket.connect();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onConnectError = (err: Error) => {
      console.error('Socket connection error:', err.message);
      setConnected(false);
      if (err.message.includes('Authentication error')) {
        logout();
      }
    };

    const onMessage = (message: any) => addMessage(message);
    const onTyping = (data: any) => addTypingUser(data.roomId, data.userId, data.username);
    const onStopTyping = (data: any) => removeTypingUser(data.roomId, data.userId);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('chat:message', onMessage);
    socket.on('chat:typing', onTyping);
    socket.on('chat:stop-typing', onStopTyping);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('chat:message', onMessage);
      socket.off('chat:typing', onTyping);
      socket.off('chat:stop-typing', onStopTyping);
    };
  }, [accessToken, logout, addMessage, addTypingUser, removeTypingUser, setConnected]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center select-none bg-background text-foreground">
        <span className="font-mono text-xs tracking-wider text-muted-foreground">
          [ Initializing Apex... ]
        </span>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <ChatApp />;
};

export const App: React.FC = () => {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return <ApexMainApp />;
};

export default App;
