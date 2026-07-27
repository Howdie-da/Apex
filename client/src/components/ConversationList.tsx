// ============================================
// client/src/components/ConversationList.tsx
// Column 2: Conversation List — Real Backend Rooms (80% compact ratio)
// ============================================

import React from 'react';
import { Search } from 'lucide-react';
import type { Room } from '../types/index';
import type { CategoryId } from '../lib/chatData';
import { CATEGORY_NAMES } from '../lib/chatData';

interface ConversationListProps {
  category: CategoryId;
  rooms: Room[];
  activeRoomId: string;
  onSelectRoom: (roomId: string) => void;
  searchQuery: string;
  onSearch: (q: string) => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  category,
  rooms,
  activeRoomId,
  onSelectRoom,
  searchQuery,
  onSearch,
}) => {
  const categoryTitle = CATEGORY_NAMES[category] || 'Channels';

  // Filter rooms
  const filteredRooms = rooms.filter((r) => {
    let matchCat = true;
    if (category === 'channels') matchCat = r.type === 'group';
    if (category === 'direct') matchCat = r.type === 'direct';

    const q = searchQuery.trim();
    const matchQuery = !q || r.name.includes(q) || r.name.toLowerCase().includes(q.toLowerCase());

    return matchCat && matchQuery;
  });

  return (
    <aside
      className="flex flex-col w-full h-full bg-sidebar select-none min-w-0"
      aria-label="Conversation List"
    >
      {/* Header */}
      <div className="px-4 pt-3.5 pb-2.5 border-b border-border shrink-0">
        <div className="mb-0.5">
          <span className="font-mono text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
            Apex Messenger
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight leading-none text-foreground">
          {categoryTitle}
        </h2>
      </div>

      {/* Search Bar */}
      <div className="px-3 py-2 border-b border-border shrink-0 flex gap-2">
        <div className="flex-1 border border-border focus-within:border-foreground bg-card flex items-center px-2.5 py-1.5 gap-2 transition-colors">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            type="search"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className="flex-1 bg-transparent text-xs font-mono focus:outline-none placeholder:text-muted-foreground placeholder:tracking-wider text-foreground"
            aria-label="Search conversations"
          />
        </div>
      </div>

      {/* Room List — SEPARATE bordered cards with gap-2 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredRooms.length === 0 ? (
          <div className="p-5 text-center text-muted-foreground font-mono text-xs tracking-wider">
            No channels found
          </div>
        ) : (
          filteredRooms.map((r) => {
            const isActive = activeRoomId === r.id;
            const tag = r.type === 'direct' ? 'DM' : r.name === 'General' ? 'AP' : 'CH';

            return (
              <button
                key={r.id}
                onClick={() => onSelectRoom(r.id)}
                className={`w-full text-left p-3 border transition-colors block select-none ${
                  isActive
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-card text-foreground hover:border-foreground'
                }`}
                aria-pressed={isActive}
              >
                <div className="flex items-center gap-2.5">
                  {/* Square tag tile */}
                  <span
                    className={`font-mono text-xs font-bold tracking-wider uppercase w-9 h-9 flex items-center justify-center shrink-0 border ${
                      isActive
                        ? 'border-background bg-background text-foreground'
                        : 'border-border bg-background text-foreground'
                    }`}
                  >
                    {tag}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm truncate leading-tight">
                        {r.type === 'group' ? `#${r.name}` : r.name}
                      </span>
                    </div>

                    <p
                      className={`text-[11px] font-mono truncate mt-0.5 ${
                        isActive ? 'text-background/80' : 'text-muted-foreground'
                      }`}
                    >
                      {r.type === 'group' ? 'public channel' : 'direct chat'}
                    </p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};

export default ConversationList;
