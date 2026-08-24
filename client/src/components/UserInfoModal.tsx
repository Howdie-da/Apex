import React, { useState } from "react";
import { X, User, Hash, Clock, Fingerprint, Edit2, Check } from "lucide-react";
import type { User as UserType } from "../types/index";
import { useAuthStore } from "../store/useAuthStore";
interface UserInfoModalProps {
  user: UserType;
  isOpen: boolean;
  onClose: () => void;
}
const UserInfoModal: React.FC<UserInfoModalProps> = ({
  user,
  isOpen,
  onClose,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user.displayName);
  const [isSaving, setIsSaving] = useState(false);
  const { updateDisplayName } = useAuthStore();
  if (!isOpen) return null;
  const handleSave = async () => {
    if (!editName.trim() || editName.trim() === user.displayName) {
      setIsEditing(false);
      setEditName(user.displayName);
      return;
    }
    setIsSaving(true);
    try {
      await updateDisplayName(editName);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      setEditName(user.displayName);
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background w-full max-w-sm border border-border flex flex-col shadow-2xl rounded-none">
        {}
        <div className="flex items-center justify-between p-4 border-b border-border bg-sidebar">
          <h2 className="font-mono text-sm font-bold tracking-wider uppercase text-foreground">
            My Info
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-card transition-colors border border-transparent hover:border-border rounded-none"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {}
        <div className="p-6 flex flex-col gap-6">
          {}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary text-primary-foreground font-mono font-bold text-2xl flex items-center justify-center border border-border">
              {user.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-lg text-foreground truncate leading-none mb-1">
                {user.displayName}
              </span>
              <span className="font-mono text-xs text-muted-foreground truncate">
                {user.username}
              </span>
            </div>
          </div>
          <div className="w-full h-px bg-border/50" />
          {}
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 bg-sidebar border border-border text-muted-foreground">
                <User className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase mb-0.5">
                  Display Name
                </span>
                {isEditing ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 bg-background border border-primary/50 px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 font-bold"
                      autoFocus
                      disabled={isSaving}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSave();
                        if (e.key === "Escape") {
                          setIsEditing(false);
                          setEditName(user.displayName);
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
                        setEditName(user.displayName);
                      }}
                      disabled={isSaving}
                      className="p-1 bg-sidebar border border-border text-muted-foreground hover:bg-card"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between group">
                    <span className="text-sm font-medium text-foreground truncate">
                      {user.displayName}
                    </span>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="opacity-100 p-1 text-muted-foreground text-foreground transition-opacity"
                      title="Edit Display Name"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 bg-sidebar border border-border text-muted-foreground">
                <Hash className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase mb-0.5">
                  Username
                </span>
                <span className="text-sm font-mono text-foreground truncate">
                  {user.username}
                </span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 bg-sidebar border border-border text-muted-foreground">
                <Fingerprint className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase mb-0.5">
                  User ID
                </span>
                <span
                  className="text-xs font-mono text-foreground truncate opacity-80"
                  title={user.id}
                >
                  {user.id}
                </span>
              </div>
            </div>
            {user.createdAt && (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-1.5 bg-sidebar border border-border text-muted-foreground">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase mb-0.5">
                    Member Since
                  </span>
                  <span className="text-sm text-foreground truncate">
                    {new Date(user.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        {}
        <div className="p-4 border-t border-border bg-sidebar flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-foreground text-background font-mono text-xs font-bold tracking-wider uppercase hover:bg-muted-foreground transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
export default UserInfoModal;
