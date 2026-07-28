// ============================================
// client/src/components/DetailsPanel.tsx
// Details Panel — Top Popup inside MessageThread (Room Overview & Security)
// ============================================

import React from 'react';
import { X, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import type { Room } from '../types/index';

interface DetailsPanelProps {
  room: Room | null;
  onClose: () => void;
}

function getAvatarInitials(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, '');
  return cleaned.slice(0, 2).toUpperCase() || 'AP';
}

export const DetailsPanel: React.FC<DetailsPanelProps> = ({ room, onClose }) => {
  if (!room) return null;

  const initials = getAvatarInitials(room.name);
  const isChannel = room.type === 'group';
  const handle = isChannel ? `#${room.name}` : `@${room.name.toLowerCase().replace(/\s+/g, '')}`;
  const tag = isChannel ? (room.name === 'General' ? 'AP' : 'CH') : 'DM';

  return (
    <div className="border-b border-border bg-card p-3 sm:p-4 shrink-0 select-none animate-slide-down w-full">
      {/* Top Bar: Title & Close Button */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/60">
        <span className="font-mono text-[11px] font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-foreground inline-block" />
          Channel Details & Security
        </span>
        <button
          onClick={onClose}
          aria-label="Close Details Panel"
          title="Close Details"
          className="p-1 border border-border text-muted-foreground hover:border-foreground hover:bg-foreground hover:text-background transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Content: Responsive layout (Column on tiny screens, Row on normal screens) */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Profile Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 border border-border bg-background text-foreground font-mono font-bold text-sm flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-foreground truncate">
              {isChannel ? `#${room.name}` : room.name}
            </h3>
            <p className="font-mono text-xs text-muted-foreground truncate">
              {handle}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-[9px] font-bold tracking-wider px-1.5 py-0.5 border border-border bg-background text-foreground">
                {tag} · Apex
              </span>
              <span className="font-mono text-[9px] font-bold tracking-wider px-1.5 py-0.5 border border-border bg-foreground text-background">
                Online
              </span>
            </div>
          </div>
        </div>

        {/* Security & Protocol Badges */}
        <div className="w-full md:w-auto p-2.5 border border-border bg-background space-y-1.5">
          <div className="flex items-center justify-between gap-4 text-xs font-mono">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-foreground shrink-0" /> E2EE (libsodium)
            </span>
            <span className="font-bold text-foreground">Active</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-xs font-mono">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-foreground shrink-0" /> Signal Protocol
            </span>
            <span className="text-foreground font-bold">Verified</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-xs font-mono">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-foreground shrink-0" /> Key Fingerprint
            </span>
            <span className="text-foreground font-bold">Matched</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailsPanel;
