// ============================================
// client/src/components/DetailsPanel.tsx
// Details Panel — Top Popup inside MessageThread (Room Overview & Security)
// ============================================

import React, { useState } from 'react';
import { X, Edit2, Check, UserPlus, Users, Lock } from 'lucide-react';
import type { Room } from '../types/index';
import { fetchAPI } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import AddMemberModal from './AddMemberModal';
import ViewMembersModal from './ViewMembersModal';

interface DetailsPanelProps {
  room: Room | null;
  onClose: () => void;
}

function getAvatarInitials(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, '');
  return cleaned.slice(0, 2).toUpperCase() || 'AP';
}

export const DetailsPanel: React.FC<DetailsPanelProps> = ({ room, onClose }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(room?.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [viewMembersModalOpen, setViewMembersModalOpen] = useState(false);

  const currentUser = useAuthStore(s => s.user);
  const { updateRoomName } = useChatStore();

  if (!room) return null;

  const isGroup = room.type === 'group';
  const handle = isGroup ? `#${room.name}` : (room.dmUser ? `@${room.dmUser.username}` : 'DM');
  const initials = getAvatarInitials(room.dmUser ? room.dmUser.displayName : room.name);

  const handleSave = async () => {
    if (!editName.trim() || editName.trim() === room.name) {
      setIsEditing(false);
      setEditName(room.name);
      return;
    }

    setIsSaving(true);
    try {
      await fetchAPI(`/rooms/${room.id}/name`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName.trim() })
      });
      updateRoomName(room.id, editName.trim());
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      setEditName(room.name);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="border-b border-border bg-card p-3 sm:p-4 shrink-0 select-none animate-slide-down w-full">
      {/* Top Bar: Title & Close Button */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/60">
        <span className="font-mono text-[11px] font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-foreground inline-block" />
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

      {/* Main Content: Responsive layout (Column on tiny screens, Row on normal screens) */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Profile Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 border border-border bg-background text-foreground font-mono font-bold text-sm flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            {isEditing && isGroup ? (
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 min-w-[120px] bg-background border border-primary/50 px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 font-bold"
                  autoFocus
                  disabled={isSaving}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') {
                      setIsEditing(false);
                      setEditName(room.name);
                    }
                  }}
                />
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="p-1 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  title="Save"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditName(room.name);
                  }}
                  disabled={isSaving}
                  className="p-1 bg-sidebar border border-border text-muted-foreground hover:bg-card"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group mb-0.5">
                <h3 className="font-bold text-sm text-foreground truncate">
                  {isGroup ? `#${room.name}` : room.dmUser?.displayName || 'Direct Message'}
                </h3>
                {isGroup && (
                  <button
                    onClick={() => {
                      setEditName(room.name);
                      setIsEditing(true);
                    }}
                    className="opacity-100 p-1 text-muted-foreground text-foreground transition-opacity"
                    title="Edit Group Name"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            <p className="font-mono text-xs text-muted-foreground truncate">
              {handle}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {!isGroup && (
                <span className="font-mono text-[9px] font-bold tracking-wider px-1.5 py-0.5 border border-border bg-foreground text-background">
                  {room.dmUser?.isOnline ? 'Online' : 'Offline'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Security Badges & Group Actions */}
        <div className="flex flex-col gap-2 w-full md:w-auto">
          {isGroup && (
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <button
                onClick={() => setViewMembersModalOpen(true)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 p-2 bg-primary text-primary-foreground hover:opacity-40 transition-opacity text-xs font-mono font-bold"
              >
                <Users className="w-3.5 h-3.5" /> View Members
              </button>
              <button
                onClick={() => setAddMemberModalOpen(true)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 p-2 bg-primary text-primary-foreground hover:opacity-40 transition-opacity text-xs font-mono font-bold"
              >
                <UserPlus className="w-3.5 h-3.5" /> Add Member
              </button>
            </div>
          )}
          {!isGroup && room.isEncrypted && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] uppercase tracking-wider font-mono font-bold select-none whitespace-nowrap">
              <Lock className="w-3.5 h-3.5" />
              <span>End-to-End Encrypted</span>
            </div>
          )}
        </div>
      </div>

      {addMemberModalOpen && currentUser && (
        <AddMemberModal
          currentUserId={currentUser.id}
          roomId={room.id}
          onClose={() => setAddMemberModalOpen(false)}
        />
      )}

      {viewMembersModalOpen && (
        <ViewMembersModal
          roomId={room.id}
          onClose={() => setViewMembersModalOpen(false)}
        />
      )}
    </div>
  );
};

export default DetailsPanel;
