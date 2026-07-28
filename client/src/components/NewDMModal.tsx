// ============================================
// client/src/components/NewDMModal.tsx
// Exact username search modal — security & privacy focused
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Circle } from 'lucide-react';
import { fetchAPI } from '../lib/api';
import type { User, Room } from '../types/index';
import { useChatStore } from '../store/useChatStore';

interface NewDMModalProps {
  currentUserId: string;
  onClose: () => void;
  onRoomReady: (room: Room) => void;
}

export const NewDMModal: React.FC<NewDMModalProps> = ({ currentUserId, onClose, onRoomReady }) => {
  const [usernameInput, setUsernameInput] = useState('');
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { rooms, setRooms } = useChatStore();

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Exact username search trigger
  const handleSearch = async (targetUsername: string) => {
    const trimmed = targetUsername.trim().replace(/^@/, '');
    if (!trimmed) {
      setFoundUser(null);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const results = await fetchAPI<User[]>(`/users?username=${encodeURIComponent(trimmed)}`);
      if (results.length > 0 && results[0].id !== currentUserId) {
        setFoundUser(results[0]);
      } else {
        setFoundUser(null);
      }
      setHasSearched(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to search user.');
      setFoundUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUsernameInput(val);
    if (!val.trim()) {
      setFoundUser(null);
      setHasSearched(false);
    } else {
      handleSearch(val);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim()) {
      handleSearch(usernameInput);
    }
  };

  const handleStartDM = async (targetUser: User) => {
    setStarting(targetUser.id);
    setError(null);
    try {
      const room = await fetchAPI<Room>('/rooms/dm', {
        method: 'POST',
        body: JSON.stringify({ targetUserId: targetUser.id }),
      });

      const exists = rooms.some((r) => r.id === room.id);
      if (!exists) {
        setRooms([...rooms, room]);
      }

      onRoomReady(room);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to start DM.');
    } finally {
      setStarting(null);
    }
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal panel */}
      <div
        className="w-full max-w-md mx-4 bg-card/95 backdrop-blur-md border border-border/50 flex flex-col shadow-2xl rounded-none overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-white/5"
        style={{ maxHeight: '70vh' }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <h2 className="font-bold text-sm tracking-tight text-foreground flex items-center gap-1.5">
              <span>New Direct Message</span>
            </h2>
            <p className="font-mono text-[10px] text-muted-foreground tracking-wider mt-0.5">
              Type an exact username to find a user
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

        {/* Search Input Form */}
        <form onSubmit={handleFormSubmit} className="px-4 py-3 border-b border-border/50 shrink-0">
          <div className="border border-border/50 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 bg-background/50 flex items-center px-3 py-2 gap-2.5 transition-all rounded-none">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Enter exact username (e.g. alice)..."
              value={usernameInput}
              onChange={handleInputChange}
              className="flex-1 bg-transparent text-sm font-mono focus:outline-none placeholder:text-muted-foreground placeholder:tracking-wider text-foreground"
            />
            {usernameInput && (
              <button
                type="button"
                onClick={() => { setUsernameInput(''); setFoundUser(null); setHasSearched(false); }}
                className="text-muted-foreground hover:text-foreground text-xs font-mono"
              >
                Clear
              </button>
            )}
          </div>
        </form>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex justify-center py-6">
              <span className="font-mono text-[11px] tracking-wider text-muted-foreground">
                Verifying username...
              </span>
            </div>
          )}

          {!loading && error && (
            <div className="py-4 text-center">
              <p className="font-mono text-xs text-red-400">{error}</p>
            </div>
          )}

          {!loading && !error && !hasSearched && (
            <div className="py-8 text-center select-none">
              <p className="font-mono text-xs text-muted-foreground tracking-wider leading-relaxed">
                Enter the complete, exact username of the person you want to message.
              </p>
            </div>
          )}

          {!loading && !error && hasSearched && !foundUser && (
            <div className="py-8 text-center select-none">
              <p className="font-mono text-xs text-muted-foreground tracking-wider font-bold">
                No user found with exact username &ldquo;{usernameInput.trim().replace(/^@/, '')}&rdquo;
              </p>
              <p className="font-mono text-[10px] text-muted-foreground/70 mt-1">
                Usernames are case-insensitive. Check spelling and try again.
              </p>
            </div>
          )}

          {!loading && !error && foundUser && (
            <div className="border border-border/50 bg-background/50 p-3 flex items-center gap-3 transition-colors hover:border-primary/50 hover:bg-card rounded-none">
              {/* Avatar */}
              <div className="w-10 h-10 shrink-0 bg-primary/20 text-primary font-mono text-xs font-bold flex items-center justify-center rounded-none">
                {foundUser.displayName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'AP'}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground truncate">
                    {foundUser.displayName}
                  </span>
                  {foundUser.isOnline && (
                    <Circle className="w-2 h-2 fill-current text-emerald-500 shrink-0" />
                  )}
                </div>
                <p className="font-mono text-[11px] text-muted-foreground truncate">
                  @{foundUser.username}
                </p>
              </div>

              {/* Start DM Button */}
              <button
                type="button"
                onClick={() => handleStartDM(foundUser)}
                disabled={!!starting}
                className="font-mono text-xs tracking-widest shrink-0 px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60 font-bold rounded-none shadow-md shadow-primary/20"
              >
                {starting === foundUser.id ? 'Connecting...' : 'Start DM →'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border shrink-0">
          <p className="font-mono text-[10px] text-muted-foreground tracking-wider flex items-center gap-1">
            <span>Direct message connection.</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default NewDMModal;
