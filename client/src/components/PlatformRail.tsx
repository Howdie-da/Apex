// ============================================
// client/src/components/PlatformRail.tsx
// Column 1: Navigation Rail — w-16 fixed vertical nav (80% compact ratio)
// Workspace & Chat Categories with Collapse Toggle
// ============================================

import React from 'react';
import {
  MessagesSquare,
  User,
  Users,
  Star,
  Archive,
  Settings,
  LogOut,
  PanelLeftClose,
} from 'lucide-react';
import type { CategoryId } from '../lib/chatData';

interface PlatformRailProps {
  active: CategoryId;
  onSelect: (c: CategoryId) => void;
  getUnreadCount: (c: CategoryId) => number;
  onLogout?: () => void;
  onToggleCollapse?: () => void;
  onSettingsClick?: () => void;
}

const NAV_ITEMS: { id: CategoryId; Icon: React.FC<React.SVGProps<SVGSVGElement>>; label: string }[] = [
  { id: 'all',      Icon: MessagesSquare as React.FC<React.SVGProps<SVGSVGElement>>, label: 'All Inboxes' },
  { id: 'groups',   Icon: Users as React.FC<React.SVGProps<SVGSVGElement>>,          label: 'Groups' },
  { id: 'direct',   Icon: User as React.FC<React.SVGProps<SVGSVGElement>>,           label: 'Direct Messages' },
  { id: 'starred',  Icon: Star as React.FC<React.SVGProps<SVGSVGElement>>,           label: 'Starred' },
  { id: 'archive',  Icon: Archive as React.FC<React.SVGProps<SVGSVGElement>>,        label: 'Archived' },
];

function cap(n: number): string {
  return n > 9 ? '9+' : String(n);
}

export const PlatformRail: React.FC<PlatformRailProps> = ({
  active,
  onSelect,
  getUnreadCount,
  onLogout,
  onToggleCollapse,
  onSettingsClick,
}) => {
  return (
    <nav
      className="flex flex-col items-center w-16 shrink-0 border-r border-border bg-sidebar h-full select-none"
      aria-label="Apex Navigation Rail"
    >
      {/* Top: Inverted Brand Mark "A" Tile */}
      <div
        className="w-16 h-16 shrink-0 bg-foreground text-background font-mono font-bold text-xl flex items-center justify-center border-b border-border"
        title="Apex Messenger"
      >
        A
      </div>

      {/* Center: Navigation Items */}
      <div className="flex flex-col items-center gap-2 py-3 flex-1 w-full overflow-y-auto">
        {NAV_ITEMS.map(({ id, Icon, label }) => {
          const isActive = active === id;
          const unread = getUnreadCount(id);
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              aria-label={label}
              aria-pressed={isActive}
              title={label}
              className={`relative w-11 h-11 border flex items-center justify-center transition-colors ${
                isActive
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-transparent text-muted-foreground border-transparent hover:border-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4.5 h-4.5" />
              {unread > 0 && (
                <span
                  className={`absolute -top-1 -right-1 min-w-3.5 h-3.5 px-0.5 flex items-center justify-center font-mono text-[9px] font-bold border ${
                    isActive
                      ? 'bg-background text-foreground border-foreground'
                      : 'bg-foreground text-background border-background'
                  }`}
                  aria-label={`${unread} unread messages`}
                >
                  {cap(unread)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div className="flex flex-col items-center gap-2 pb-3 pt-2 border-t border-border w-full shrink-0">
        {/* Collapse Button */}
        {onToggleCollapse && (
          <button
            aria-label="Collapse Navigation Rail"
            title="Collapse Navigation Rail"
            onClick={onToggleCollapse}
            className="w-11 h-11 border border-transparent text-muted-foreground hover:border-foreground hover:bg-foreground hover:text-background flex items-center justify-center transition-colors"
          >
            <PanelLeftClose className="w-4.5 h-4.5" />
          </button>
        )}

        <button
          aria-label="Settings"
          title="Settings"
          onClick={onSettingsClick}
          className="w-11 h-11 border border-transparent text-muted-foreground hover:border-foreground hover:bg-foreground hover:text-background flex items-center justify-center transition-colors"
        >
          <Settings className="w-4.5 h-4.5" />
        </button>
        <button
          aria-label="Log Out"
          title="Log Out"
          onClick={onLogout}
          className="w-11 h-11 border border-transparent text-muted-foreground hover:border-foreground hover:bg-foreground hover:text-background flex items-center justify-center transition-colors"
        >
          <LogOut className="w-4.5 h-4.5" />
        </button>
      </div>
    </nav>
  );
};

export default PlatformRail;
