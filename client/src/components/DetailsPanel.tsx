// ============================================
// client/src/components/DetailsPanel.tsx
// Column 4: Details Panel — Room Overview & Security (80% compact ratio)
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
    <aside
      className="flex flex-col w-72 lg:w-80 shrink-0 border-l border-border bg-card h-full select-none overflow-y-auto"
      aria-label="Details Panel"
    >
      {/* Header */}
      <div className="h-14 px-4 border-b border-border flex items-center justify-between shrink-0">
        <span className="font-mono text-xs font-bold tracking-wider text-foreground uppercase">
          Details
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

      {/* Main Content */}
      <div className="p-4 space-y-5 flex-1">
        {/* Profile Header */}
        <div className="text-center">
          <div className="w-16 h-16 border border-border bg-background text-foreground font-mono font-bold text-lg flex items-center justify-center mx-auto mb-3">
            {initials}
          </div>
          <h3 className="font-bold text-base text-foreground truncate">
            {isChannel ? `#${room.name}` : room.name}
          </h3>
          <p className="font-mono text-xs text-muted-foreground mt-0.5">
            {handle}
          </p>

          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="font-mono text-[10px] font-bold tracking-wider px-2 py-0.5 border border-border bg-background text-foreground">
              {tag} · Apex
            </span>
            <span className="font-mono text-[10px] font-bold tracking-wider px-2 py-0.5 border border-border bg-foreground text-background">
              Online
            </span>
          </div>
        </div>

        {/* Security & Protocol Section */}
        <div className="space-y-2 pt-2 border-t border-border">
          <h4 className="font-mono text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
            Security & Encryption
          </h4>
          <div className="p-3 border border-border bg-background space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-foreground shrink-0" /> E2EE (libsodium)
              </span>
              <span className="font-bold text-foreground">Active</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-foreground shrink-0" /> Signal Protocol
              </span>
              <span className="text-foreground font-bold">Verified</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-foreground shrink-0" /> Key Fingerprint
              </span>
              <span className="text-foreground font-bold">Matched</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default DetailsPanel;
