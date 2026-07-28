// ============================================
// client/src/components/ChatApp.tsx
// Root Unified Chat Shell — Live Backend & Socket Integration (Zustand)
// Resizable Panels via react-resizable-panels
// ============================================

import React, { useEffect, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import type { CategoryId } from '../lib/chatData';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { useUIStore } from '../store/useUIStore';

import PlatformRail from './PlatformRail';
import ConversationList from './ConversationList';
import MessageThread from './MessageThread';

export const ChatApp: React.FC = () => {
  const { user, logout } = useAuthStore();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  
  const { 
    rooms, 
    activeRoomId, 
    messages, 
    typingUsers, 
    loadingHistory, 
    loadRooms, 
    setActiveRoomId, 
    sendMessage, 
    emitTyping, 
    emitStopTyping 
  } = useChatStore();

  const {
    category,
    setCategory,
    searchQuery,
    setSearchQuery,
    detailsOpen,
    setDetailsOpen,
    mobileThread,
    setMobileThread
  } = useUIStore();

  // Load real rooms from backend on mount
  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const activeRoom = rooms.find((r) => r.id === activeRoomId) || rooms[0] || null;

  // Unread count per category
  const getUnreadCount = (_cat: CategoryId): number => 0;

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground select-none">
      {/* ── DESKTOP & TABLET LAYOUT (>= md) ── */}
      <div className="hidden md:flex w-full h-full">
        {/* Column 1: Navigation Rail (Fixed) */}
        <PlatformRail
          active={category}
          onSelect={setCategory}
          getUnreadCount={getUnreadCount}
          onLogout={logout}
        />

        {/* Resizable Section: ConversationList | MessageThread */}
        <div className="flex-1 h-full min-w-0 flex">
          <Group orientation="horizontal" className="flex-1 h-full w-full">
            {/* Panel 1: Conversation List — Collapsible when resized < minSize */}
            <Panel 
              defaultSize="20" 
              minSize="15" 
              maxSize="50"
              collapsible={true}
              collapsedSize="5"
              onResize={(size) => {
                const collapsed = size.inPixels < 140 || size.asPercentage <= 7;
                if (collapsed !== isCollapsed) {
                  setIsCollapsed(collapsed);
                }
              }}
            >
              <ConversationList
                isCollapsed={isCollapsed}
                category={category}
                rooms={rooms}
                activeRoomId={activeRoom?.id || ''}
                onSelectRoom={(id) => {
                  setActiveRoomId(id);
                  setMobileThread(true);
                }}
                searchQuery={searchQuery}
                onSearch={setSearchQuery}
              />
            </Panel>

            {/* Resize Handle */}
            <Separator className="w-1.5 bg-border hover:bg-foreground active:bg-foreground transition-colors cursor-col-resize select-none shrink-0" />

            {/* Panel 2: Message Thread */}
            <Panel defaultSize="80" minSize="30">
              <MessageThread
                room={activeRoom}
                messages={messages}
                currentUser={user}
                typingUsers={typingUsers.map(u => u.username)}
                loadingHistory={loadingHistory}
                onSendMessage={(content) => sendMessage(activeRoom?.id || '', content)}
                onTyping={() => emitTyping(activeRoom?.id || '')}
                onStopTyping={() => emitStopTyping(activeRoom?.id || '')}
                detailsOpen={detailsOpen}
                onToggleDetails={() => setDetailsOpen(!detailsOpen)}
              />
            </Panel>
          </Group>
        </div>
      </div>

      {/* ── MOBILE LAYOUT (< md) ── */}
      <div className="flex md:hidden w-full h-full">
        {mobileThread ? (
          // Mobile Thread View
          <div className="w-full h-full flex flex-col animate-slide-in">
            <MessageThread
              room={activeRoom}
              messages={messages}
              currentUser={user}
              typingUsers={typingUsers.map(u => u.username)}
              loadingHistory={loadingHistory}
              onSendMessage={(content) => sendMessage(activeRoom?.id || '', content)}
              onTyping={() => emitTyping(activeRoom?.id || '')}
              onStopTyping={() => emitStopTyping(activeRoom?.id || '')}
              detailsOpen={detailsOpen}
              onToggleDetails={() => setDetailsOpen(!detailsOpen)}
              onBack={() => setMobileThread(false)}
            />
          </div>
        ) : (
          // Mobile Rail + Conversation List View
          <div className="flex w-full h-full">
            <PlatformRail
              active={category}
              onSelect={setCategory}
              getUnreadCount={getUnreadCount}
              onLogout={logout}
            />
            <div className="flex-1 h-full min-w-0">
              <ConversationList
                category={category}
                rooms={rooms}
                activeRoomId={activeRoom?.id || ''}
                onSelectRoom={(id) => {
                  setActiveRoomId(id);
                  setMobileThread(true);
                }}
                searchQuery={searchQuery}
                onSearch={setSearchQuery}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatApp;
