import React, { useEffect, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { CategoryId } from "../types";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useUIStore } from "../store/useUIStore";
import PlatformRail from "./PlatformRail";
import ConversationList from "./ConversationList";
import MessageThread from "./MessageThread";
import UserInfoModal from "./UserInfoModal";

export const ChatApp: React.FC = () => {
  const { user, logout } = useAuthStore();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [userInfoOpen, setUserInfoOpen] = useState<boolean>(false);
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
    emitStopTyping,
  } = useChatStore();
  const {
    category,
    setCategory,
    searchQuery,
    setSearchQuery,
    detailsOpen,
    setDetailsOpen,
    mobileThread,
    setMobileThread,
    railCollapsed,
    toggleRailCollapsed,
  } = useUIStore();

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const activeRoom = rooms.find((r) => r.id === activeRoomId) || null;
  const getUnreadCount = (_cat: CategoryId): number => 0;

  // Bypasses React's standard re-render cascade by extracting complex DOM reflows to react-resizable-panels natively.
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground select-none">
      {}
      <div className="hidden md:flex w-full h-full">
        {}
        <div
          className={`transition-[width,opacity] duration-200 ease-in-out shrink-0 overflow-hidden ${
            railCollapsed
              ? "w-0 opacity-0 pointer-events-none"
              : "w-16 opacity-100"
          }`}
        >
          <PlatformRail
            active={category}
            onSelect={setCategory}
            getUnreadCount={getUnreadCount}
            onLogout={logout}
            onToggleCollapse={toggleRailCollapsed}
            onSettingsClick={() => setUserInfoOpen(true)}
          />
        </div>
        {}
        <div className="flex-1 h-full min-w-0 flex">
          <Group orientation="horizontal" className="flex-1 h-full w-full">
            {}
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
                railCollapsed={railCollapsed}
                onToggleRailCollapse={toggleRailCollapsed}
                category={category}
                rooms={rooms}
                activeRoomId={activeRoom?.id || ""}
                onSelectRoom={(id) => {
                  setActiveRoomId(id);
                  setMobileThread(true);
                }}
                searchQuery={searchQuery}
                onSearch={setSearchQuery}
                currentUser={user}
              />
            </Panel>
            {}
            <Separator className="w-1.5 bg-border hover:bg-foreground active:bg-foreground transition-colors cursor-col-resize select-none shrink-0" />
            {}
            <Panel defaultSize="80" minSize="30">
              <MessageThread
                room={activeRoom}
                messages={messages}
                currentUser={user}
                typingUsers={typingUsers.map((u) => u.username)}
                loadingHistory={loadingHistory}
                onSendMessage={(content, replyTo) =>
                  sendMessage(activeRoom?.id || "", content, "text", replyTo)
                }
                onTyping={() => emitTyping(activeRoom?.id || "")}
                onStopTyping={() => emitStopTyping(activeRoom?.id || "")}
                detailsOpen={detailsOpen}
                onToggleDetails={() => setDetailsOpen(!detailsOpen)}
              />
            </Panel>
          </Group>
        </div>
      </div>
      {}
      <div className="flex md:hidden w-full h-full">
        {mobileThread ? (
          <div className="w-full h-full flex flex-col animate-slide-in">
            <MessageThread
              room={activeRoom}
              messages={messages}
              currentUser={user}
              typingUsers={typingUsers.map((u) => u.username)}
              loadingHistory={loadingHistory}
              onSendMessage={(content, replyTo) =>
                sendMessage(activeRoom?.id || "", content, "text", replyTo)
              }
              onTyping={() => emitTyping(activeRoom?.id || "")}
              onStopTyping={() => emitStopTyping(activeRoom?.id || "")}
              detailsOpen={detailsOpen}
              onToggleDetails={() => setDetailsOpen(!detailsOpen)}
              onBack={() => setMobileThread(false)}
            />
          </div>
        ) : (
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
                activeRoomId={activeRoom?.id || ""}
                onSelectRoom={(id) => {
                  setActiveRoomId(id);
                  setMobileThread(true);
                }}
                searchQuery={searchQuery}
                onSearch={setSearchQuery}
                currentUser={user}
              />
            </div>
          </div>
        )}
      </div>
      {user && (
        <UserInfoModal
          user={user}
          isOpen={userInfoOpen}
          onClose={() => setUserInfoOpen(false)}
        />
      )}
    </div>
  );
};
export default ChatApp;
