import React, { useState } from "react";
import { Search, PanelLeftOpen, SquarePen, Users } from "lucide-react";
import type { Room } from "../types/index";
import type { User } from "../types/index";
import type { CategoryId } from "../types";
import { CATEGORY_NAMES } from "../types";
import NewDMModal from "./NewDMModal";
import CreateGroupModal from "./CreateGroupModal";

interface ConversationListProps {
  category: CategoryId;
  rooms: Room[];
  activeRoomId: string;
  onSelectRoom: (roomId: string) => void;
  searchQuery: string;
  onSearch: (q: string) => void;
  isCollapsed?: boolean;
  railCollapsed?: boolean;
  onToggleRailCollapse?: () => void;
  currentUser?: User | null;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  category,
  rooms,
  activeRoomId,
  onSelectRoom,
  searchQuery,
  onSearch,
  isCollapsed = false,
  railCollapsed = false,
  onToggleRailCollapse,
  currentUser,
}) => {
  const [dmModalOpen, setDMModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const categoryTitle = CATEGORY_NAMES[category] || "Groups";

  // Note: We compute filtering and sorting inline because N (rooms) is strictly capped by the backend at 100 per user.
  // If N scales, this should be moved to a Web Worker or memoized heavily.
  const filteredRooms = rooms
    .filter((r) => {
      let matchCat = true;
      if (category === "groups") matchCat = r.type === "group";
      if (category === "direct") matchCat = r.type === "direct";
      const q = searchQuery.trim().toLowerCase();
      let matchQuery = !q;
      if (!matchQuery) {
        const searchName =
          r.type === "direct" && r.dmUser
            ? r.dmUser.displayName || r.dmUser.username || ""
            : r.name;
        matchQuery = searchName.toLowerCase().includes(q);
      }
      return matchCat && matchQuery;
    })
    .sort((a, b) => {
      const timeA = new Date(a.lastActivityAt || a.createdAt).getTime();
      const timeB = new Date(b.lastActivityAt || b.createdAt).getTime();
      if (timeA !== timeB) return timeB - timeA;
      return a.name.localeCompare(b.name);
    });

  return (
    <>
      <aside
        className="flex flex-col w-full h-full bg-sidebar select-none min-w-0"
        aria-label="Conversation List"
      >
        {}
        <div
          className={`px-3 sm:px-4 pt-3.5 pb-2.5 border-b border-border shrink-0 ${isCollapsed ? "text-center px-1" : ""}`}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-mono text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              {isCollapsed ? "Apex" : "Apex Messenger"}
            </span>
            <div className="flex items-center gap-1">
              {}
              {!isCollapsed && category === "direct" && currentUser && (
                <button
                  onClick={() => setDMModalOpen(true)}
                  className="p-1.5 rounded-none border border-border/50 text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-all shrink-0"
                  title="New Direct Message"
                  aria-label="New Direct Message"
                >
                  <SquarePen className="w-3.5 h-3.5" />
                </button>
              )}
              {}
              {!isCollapsed && category === "groups" && currentUser && (
                <button
                  onClick={() => setGroupModalOpen(true)}
                  className="p-1.5 rounded-none border border-border/50 text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-all shrink-0"
                  title="Create Group"
                  aria-label="Create Group"
                >
                  <SquarePen className="w-3.5 h-3.5" />
                </button>
              )}
              {}
              {railCollapsed && onToggleRailCollapse && (
                <button
                  onClick={onToggleRailCollapse}
                  className="p-1.5 rounded-none border border-border/50 text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-all shrink-0"
                  title="Expand Navigation Rail"
                  aria-label="Expand Navigation Rail"
                >
                  <PanelLeftOpen className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          {!isCollapsed && (
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight leading-none text-foreground truncate">
              {categoryTitle}
            </h2>
          )}
        </div>
        {}
        {!isCollapsed && (
          <div className="px-3 py-2 border-b border-border/50 shrink-0 flex gap-2">
            <div className="flex-1 border border-border/50 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 bg-background/50 flex items-center px-2.5 py-1.5 gap-2 transition-all rounded-none">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                type="search"
                placeholder={`Search ${categoryTitle.toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => onSearch(e.target.value)}
                className="flex-1 bg-transparent text-xs font-mono focus:outline-none placeholder:text-muted-foreground placeholder:tracking-wider text-foreground"
                aria-label="Search conversations"
              />
            </div>
          </div>
        )}
        {}
        <div
          className={`flex-1 overflow-y-auto ${isCollapsed ? "p-1.5 space-y-1.5" : "p-2 space-y-2"}`}
        >
          {}
          {!isCollapsed &&
            category === "direct" &&
            filteredRooms.length === 0 &&
            !searchQuery && (
              <div className="flex flex-col items-center justify-center py-8 px-3 text-center gap-3">
                <p className="font-mono text-xs text-muted-foreground tracking-wider">
                  No direct messages yet.
                </p>
                {currentUser && (
                  <button
                    onClick={() => setDMModalOpen(true)}
                    className="font-mono text-[10px] tracking-widest px-3 py-1.5 border border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                  >
                    <SquarePen className="w-3 h-3" />
                    Start a DM
                  </button>
                )}
              </div>
            )}
          {}
          {!isCollapsed &&
            category === "groups" &&
            filteredRooms.length === 0 &&
            !searchQuery && (
              <div className="flex flex-col items-center justify-center py-8 px-3 text-center gap-3">
                <p className="font-mono text-xs text-muted-foreground tracking-wider">
                  No groups yet.
                </p>
                {currentUser && (
                  <button
                    onClick={() => setGroupModalOpen(true)}
                    className="font-mono text-[10px] tracking-widest px-3 py-1.5 border border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                  >
                    <Users className="w-3 h-3" />
                    Create a Group
                  </button>
                )}
              </div>
            )}
          {filteredRooms.length === 0 &&
          (searchQuery || (category !== "direct" && category !== "groups")) ? (
            !isCollapsed ? (
              <div className="py-6 text-center select-none">
                <p className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">
                  No rooms found
                </p>
              </div>
            ) : null
          ) : (
            filteredRooms.map((r) => {
              const isActive = activeRoomId === r.id;
              let tag = "GP";
              let displayName = `#${r.name}`;
              if (r.type === "direct") {
                tag = r.dmUser
                  ? r.dmUser.displayName.slice(0, 2).toUpperCase()
                  : "DM";
                displayName = r.dmUser
                  ? r.dmUser.displayName || r.dmUser.username
                  : "Direct Message";
              }
              return (
                <button
                  key={r.id}
                  onClick={() => onSelectRoom(r.id)}
                  title={r.name}
                  className={`w-full text-left transition-all block select-none rounded-none overflow-hidden border-b-1 ${
                    isCollapsed ? "p-1.5" : "p-3"
                  } ${
                    isActive
                      ? "bg-primary/15 text-foreground shadow-sm border-zinc-100"
                      : "bg-transparent text-muted-foreground hover:bg-card hover:text-foreground border-zinc-400/30"
                  }`}
                  aria-pressed={isActive}
                >
                  <div
                    className={`flex items-center ${isCollapsed ? "justify-center" : "gap-2.5"}`}
                  >
                    {}
                    <span
                      className={`font-mono text-xs font-bold tracking-wider uppercase w-9 h-9 flex items-center justify-center shrink-0 rounded-none transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                          : "bg-card text-muted-foreground"
                      }`}
                    >
                      {tag}
                    </span>
                    {!isCollapsed && (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm truncate leading-tight flex items-center gap-2">
                            {displayName}
                            {r.type === "direct" && r.dmUser?.isOnline && (
                              <span
                                className="w-2 h-2 rounded-none bg-foreground shrink-0"
                                title="Online"
                              />
                            )}
                          </span>
                          {(r.unreadCount || 0) > 0 && (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-none bg-foreground px-1.5 text-[10px] font-bold text-background font-mono shrink-0">
                              {r.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>
      {}
      {dmModalOpen && currentUser && (
        <NewDMModal
          onClose={() => setDMModalOpen(false)}
          onRoomReady={(room) => onSelectRoom(room.id)}
        />
      )}
      {}
      {groupModalOpen && currentUser && (
        <CreateGroupModal
          currentUserId={currentUser.id}
          onClose={() => setGroupModalOpen(false)}
          onRoomReady={(room) => onSelectRoom(room.id)}
        />
      )}
    </>
  );
};
export default ConversationList;
