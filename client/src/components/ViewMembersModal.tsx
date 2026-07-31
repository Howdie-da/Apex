// ============================================
// client/src/components/ViewMembersModal.tsx
// Modal for viewing members of an existing group
// ============================================

import React, { useState, useEffect } from 'react';
import { X, Circle, Search } from 'lucide-react';
import { fetchAPI } from '../lib/api';
import type { User } from '../types/index';
import { socket } from '../config/socket';

interface ViewMembersModalProps {
  roomId: string;
  onClose: () => void;
}

export const ViewMembersModal: React.FC<ViewMembersModalProps> = ({ roomId, onClose }) => {
  const [members, setMembers] = useState<User[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    const fetchMembers = async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await fetchAPI<User[]>(`/rooms/${roomId}/members`);
        // Sort by online status (online first) then display name
        const sorted = results.sort((a, b) => {
          if (a.isOnline === b.isOnline) {
            return a.displayName.localeCompare(b.displayName);
          }
          return a.isOnline ? -1 : 1;
        });
        setMembers(sorted);
        setFilteredMembers(sorted);
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch members.');
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, [roomId]);

  // Live status updates
  useEffect(() => {
    const handleUserOnline = (data: { userId: string; username: string }) => {
      setMembers(prev => prev.map(m => m.id === data.userId ? { ...m, isOnline: true } : m));
    };

    const handleUserOffline = (data: { userId: string; username: string }) => {
      setMembers(prev => prev.map(m => m.id === data.userId ? { ...m, isOnline: false } : m));
    };

    socket.on('user:online', handleUserOnline);
    socket.on('user:offline', handleUserOffline);

    return () => {
      socket.off('user:online', handleUserOnline);
      socket.off('user:offline', handleUserOffline);
    };
  }, []);

  useEffect(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      setFilteredMembers(members);
    } else {
      setFilteredMembers(
        members.filter(m => 
          m.displayName.toLowerCase().includes(query) || 
          m.username.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, members]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md mx-4 bg-card/95 backdrop-blur-md border border-border/50 flex flex-col shadow-2xl rounded-none overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-white/5"
        style={{ maxHeight: '75vh' }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <h2 className="font-bold text-sm tracking-tight text-foreground flex items-center gap-1.5">
              <span>Group Members</span>
            </h2>
            <p className="font-mono text-[10px] text-muted-foreground tracking-wider mt-0.5">
              {members.length} member{members.length !== 1 ? 's' : ''} in this group
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-none text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input */}
        <div className="px-4 py-3 border-b border-border/50 shrink-0">
          <div className="border border-border/50 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 bg-background/50 flex items-center px-3 py-2 gap-2.5 transition-all rounded-none">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm font-mono focus:outline-none placeholder:text-muted-foreground placeholder:tracking-wider text-foreground"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-muted-foreground hover:text-foreground text-xs font-mono"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex justify-center py-6">
               <span className="font-mono text-[11px] tracking-wider text-muted-foreground">
                 Loading members...
               </span>
            </div>
          )}

          {!loading && error && (
            <div className="py-4 text-center">
              <p className="font-mono text-xs text-red-400">{error}</p>
            </div>
          )}

          {!loading && !error && filteredMembers.length === 0 && (
            <div className="py-8 text-center select-none">
              <p className="font-mono text-xs text-muted-foreground tracking-wider font-bold">
                No members found matching "{searchQuery}"
              </p>
            </div>
          )}

          {!loading && !error && filteredMembers.length > 0 && (
            <div className="space-y-2">
              {filteredMembers.map(user => (
                <div key={user.id} className="border border-border/50 bg-background/50 p-3 flex items-center gap-3 transition-colors hover:border-primary/50 hover:bg-card rounded-none">
                  
                  <div className="w-10 h-10 shrink-0 bg-primary/20 text-primary font-mono text-xs font-bold flex items-center justify-center rounded-none relative">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" />
                    ) : (
                      user.displayName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'AP'
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground truncate">
                        {user.displayName}
                      </span>
                      {user.isOnline && (
                        <Circle className="w-2 h-2 fill-current text-emerald-500 shrink-0" />
                      )}
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground truncate">
                      @{user.username}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewMembersModal;
