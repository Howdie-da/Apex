import React from 'react';
import { X, User, Hash, Clock, Fingerprint } from 'lucide-react';
import type { User as UserType } from '../types/index';

interface UserInfoModalProps {
  user: UserType;
  isOpen: boolean;
  onClose: () => void;
}

const UserInfoModal: React.FC<UserInfoModalProps> = ({ user, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background w-full max-w-sm border border-border flex flex-col shadow-2xl rounded-none">
        
        {/* Header */}
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

        {/* Content */}
        <div className="p-6 flex flex-col gap-6">
          
          {/* Avatar Placeholder */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary text-primary-foreground font-mono font-bold text-2xl flex items-center justify-center border border-border">
              {user.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-lg text-foreground truncate leading-none mb-1">
                {user.displayName}
              </span>
              <span className="font-mono text-xs text-muted-foreground truncate">
                @{user.username}
              </span>
            </div>
          </div>

          <div className="w-full h-px bg-border/50" />

          {/* Details */}
          <div className="flex flex-col gap-4">
            
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 bg-sidebar border border-border text-muted-foreground">
                <User className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase mb-0.5">
                  Display Name
                </span>
                <span className="text-sm font-medium text-foreground truncate">
                  {user.displayName}
                </span>
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
                <span className="text-xs font-mono text-foreground truncate opacity-80" title={user.id}>
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
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
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
