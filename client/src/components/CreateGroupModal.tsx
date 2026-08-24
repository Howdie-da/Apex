import React, { useState, useEffect, useRef } from "react";
import { Search, X, Circle, Check } from "lucide-react";
import { fetchAPI } from "../lib/api";
import type { User, Room } from "../types/index";
import { useChatStore } from "../store/useChatStore";
interface CreateGroupModalProps {
  currentUserId: string;
  onClose: () => void;
  onRoomReady: (room: Room) => void;
}
export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  currentUserId,
  onClose,
  onRoomReady,
}) => {
  const [groupName, setGroupName] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const { rooms, setRooms } = useChatStore();
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  const handleSearch = async (targetUsername: string) => {
    const trimmed = targetUsername.trim().replace(/^@/, "");
    if (!trimmed) {
      setFoundUser(null);
      setHasSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results = await fetchAPI<User[]>(
        `/users?username=${encodeURIComponent(trimmed)}`,
      );
      if (results.length > 0 && results[0].id !== currentUserId) {
        setFoundUser(results[0]);
      } else {
        setFoundUser(null);
      }
      setHasSearched(true);
    } catch (err: any) {
      setError(err?.message || "Failed to search user.");
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
  const toggleUserSelection = (user: User) => {
    if (selectedUsers.some((u) => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
    setUsernameInput("");
    setFoundUser(null);
    setHasSearched(false);
  };
  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter((u) => u.id !== userId));
  };
  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const targetUserIds = selectedUsers.map((u) => u.id);
      const room = await fetchAPI<Room>("/rooms/group", {
        method: "POST",
        body: JSON.stringify({ name: groupName.trim(), targetUserIds }),
      });
      const exists = rooms.some((r) => r.id === room.id);
      if (!exists) {
        setRooms([...rooms, room]);
      }
      onRoomReady(room);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to create group.");
    } finally {
      setCreating(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {}
      <div
        className="w-full max-w-md mx-4 bg-card/95 backdrop-blur-md border border-border/50 flex flex-col shadow-2xl rounded-none overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-white/5"
        style={{ maxHeight: "85vh" }}
      >
        {}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <h2 className="font-bold text-sm tracking-tight text-foreground flex items-center gap-1.5">
              <span>Create Group</span>
            </h2>
            <p className="font-mono text-[10px] text-muted-foreground tracking-wider mt-0.5">
              Start a new group chat
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
        {}
        <div className="px-4 py-3 border-b border-border/50 shrink-0 bg-background/30">
          <label className="block font-mono text-[10px] uppercase text-muted-foreground tracking-wider mb-1">
            Group Name
          </label>
          <input
            ref={nameInputRef}
            type="text"
            placeholder="e.g. Project Alpha..."
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full bg-background border border-border/50 px-3 py-2 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all rounded-none font-bold"
          />
        </div>
        {}
        <form
          onSubmit={handleFormSubmit}
          className="px-4 py-3 border-b border-border/50 shrink-0"
        >
          <label className="block font-mono text-[10px] uppercase text-muted-foreground tracking-wider mb-1">
            Add Members
          </label>
          <div className="border border-border/50 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 bg-background/50 flex items-center px-3 py-2 gap-2.5 transition-all rounded-none">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
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
                  setUsernameInput("");
                  setFoundUser(null);
                  setHasSearched(false);
                }}
                className="text-muted-foreground hover:text-foreground text-xs font-mono"
              >
                Clear
              </button>
            )}
          </div>
        </form>
        {}
        {selectedUsers.length > 0 && (
          <div className="px-4 py-2 border-b border-border/50 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
            {selectedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-1.5 bg-secondary/50 border border-border/50 px-2 py-1 shrink-0 rounded-none"
              >
                <span className="font-mono text-xs truncate max-w-[100px]">
                  {user.displayName}
                </span>
                <button
                  onClick={() => handleRemoveUser(user.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {}
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
                Enter the exact username to find people for your group.
              </p>
            </div>
          )}
          {!loading && !error && hasSearched && !foundUser && (
            <div className="py-8 text-center select-none">
              <p className="font-mono text-xs text-muted-foreground tracking-wider font-bold">
                No user found matching &ldquo;
                {usernameInput.trim().replace(/^@/, "")}&rdquo;
              </p>
            </div>
          )}
          {!loading && !error && foundUser && (
            <div
              className="border border-border/50 bg-background/50 p-3 flex items-center gap-3 transition-colors hover:border-primary/50 hover:bg-card rounded-none cursor-pointer"
              onClick={() => toggleUserSelection(foundUser)}
            >
              <div className="w-10 h-10 shrink-0 bg-primary/20 text-primary font-mono text-xs font-bold flex items-center justify-center rounded-none">
                {foundUser.displayName
                  .replace(/[^a-zA-Z0-9]/g, "")
                  .slice(0, 2)
                  .toUpperCase() || "AP"}
              </div>
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
                  {foundUser.username}
                </p>
              </div>
              <div className="shrink-0 flex items-center justify-center w-6 h-6 border border-border/50 bg-background">
                {selectedUsers.some((u) => u.id === foundUser.id) && (
                  <Check className="w-4 h-4 text-primary" />
                )}
              </div>
            </div>
          )}
        </div>
        {}
        <div className="px-4 py-3 border-t border-border shrink-0 flex items-center justify-between">
          <p className="font-mono text-[10px] text-muted-foreground tracking-wider">
            {selectedUsers.length} members selected
          </p>
          <button
            type="button"
            onClick={handleCreateGroup}
            disabled={
              creating || !groupName.trim() || selectedUsers.length === 0
            }
            className="font-mono text-xs tracking-widest px-6 py-2.5 bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 font-bold rounded-none shadow-md shadow-primary/20"
          >
            {creating ? "Creating..." : "Create Group"}
          </button>
        </div>
      </div>
    </div>
  );
};
export default CreateGroupModal;
