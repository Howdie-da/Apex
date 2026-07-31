// ============================================
// client/src/components/AddMemberModal.tsx
// Modal for adding members to an existing group
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Circle, Check } from 'lucide-react';
import { fetchAPI } from '../lib/api';
import type { User } from '../types/index';

interface AddMemberModalProps {
  currentUserId: string;
  roomId: string;
  onClose: () => void;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({ roomId, onClose }) => {
  const [usernameInput, setUsernameInput] = useState('');
  const [foundUsers, setFoundUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setFoundUsers([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const results = await fetchAPI<User[]>(`/users?username=${encodeURIComponent(trimmed)}`);
      setFoundUsers(results);
      setHasSearched(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to search users.');
      setFoundUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUsernameInput(val);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!val.trim()) {
      setFoundUsers([]);
      setHasSearched(false);
    } else {
      searchTimeoutRef.current = setTimeout(() => {
        handleSearch(val);
      }, 400);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (usernameInput.trim()) {
      handleSearch(usernameInput);
    }
  };

  const toggleUserSelection = (user: User) => {
    if (selectedUsers.some(u => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
    // Reset search
    setUsernameInput('');
    setFoundUsers([]);
    setHasSearched(false);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId));
  };

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) return;
    
    setAdding(true);
    setError(null);
    try {
      const targetUserIds = selectedUsers.map(u => u.id);
      await fetchAPI(`/rooms/${roomId}/members`, {
        method: 'POST',
        body: JSON.stringify({ targetUserIds }),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add members.');
    } finally {
      setAdding(false);
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
        style={{ maxHeight: '75vh' }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <h2 className="font-bold text-sm tracking-tight text-foreground flex items-center gap-1.5">
              <span>Add Members</span>
            </h2>
            <p className="font-mono text-[10px] text-muted-foreground tracking-wider mt-0.5">
              Add new people to this group
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
              placeholder="Search exact username..."
              value={usernameInput}
              onChange={handleInputChange}
              className="flex-1 bg-transparent text-sm font-mono focus:outline-none placeholder:text-muted-foreground placeholder:tracking-wider text-foreground"
            />
            {usernameInput && (
              <button
                type="button"
                onClick={() => { 
                  setUsernameInput(''); 
                  setFoundUsers([]); 
                  setHasSearched(false); 
                  if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                }}
                className="text-muted-foreground hover:text-foreground text-xs font-mono"
              >
                Clear
              </button>
            )}
          </div>
        </form>

        {/* Selected Users */}
        {selectedUsers.length > 0 && (
          <div className="px-4 py-2 border-b border-border/50 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
            {selectedUsers.map(user => (
              <div key={user.id} className="flex items-center gap-1.5 bg-secondary/50 border border-border/50 px-2 py-1 shrink-0 rounded-none">
                <span className="font-mono text-xs truncate max-w-[100px]">{user.displayName}</span>
                <button onClick={() => handleRemoveUser(user.id)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex justify-center py-6">
               <span className="font-mono text-[11px] tracking-wider text-muted-foreground">
                 Searching...
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
                Search for a name or username to add people.
              </p>
            </div>
          )}

          {!loading && !error && hasSearched && foundUsers.length === 0 && (
            <div className="py-8 text-center select-none">
              <p className="font-mono text-xs text-muted-foreground tracking-wider font-bold">
                No users found matching &ldquo;{usernameInput.trim().replace(/^@/, '')}&rdquo;
              </p>
            </div>
          )}

          {!loading && !error && foundUsers.length > 0 && (
            <div className="space-y-2">
              {foundUsers.map(user => (
                <div key={user.id} className="border border-border/50 bg-background/50 p-3 flex items-center gap-3 transition-colors hover:border-primary/50 hover:bg-card rounded-none cursor-pointer"
                     onClick={() => toggleUserSelection(user)}>
                  
                  <div className="w-10 h-10 shrink-0 bg-primary/20 text-primary font-mono text-xs font-bold flex items-center justify-center rounded-none">
                    {user.displayName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'AP'}
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

                  <div className="shrink-0 flex items-center justify-center w-6 h-6 border border-border/50 bg-background">
                    {selectedUsers.some(u => u.id === user.id) && <Check className="w-4 h-4 text-primary" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border shrink-0 flex items-center justify-between">
          <p className="font-mono text-[10px] text-muted-foreground tracking-wider">
             {selectedUsers.length} members selected
          </p>
          <button
            type="button"
            onClick={handleAddMembers}
            disabled={adding || selectedUsers.length === 0}
            className="font-mono text-xs tracking-widest px-6 py-2.5 bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 font-bold rounded-none shadow-md shadow-primary/20"
          >
             {adding ? 'Adding...' : 'Add Members'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddMemberModal;
