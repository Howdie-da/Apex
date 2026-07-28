// ============================================
// client/src/components/MessageThread.tsx
// Column 3: Message Thread — Real-time Socket.io & REST (80% compact ratio)
// Includes Top DetailsPanel Popup
// ============================================

import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Hash,
  SendHorizontal,
} from 'lucide-react';
import type { Message, Room } from '../types/index';
import type { User } from '../types/index';
import DetailsPanel from './DetailsPanel';

interface MessageThreadProps {
  room: Room | null;
  messages: Message[];
  currentUser: User | null;
  typingUsers: string[];
  loadingHistory: boolean;
  onSendMessage: (content: string) => void;
  onTyping: () => void;
  onStopTyping: () => void;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  onBack?: () => void;
}

function getAvatarInitials(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, '');
  return cleaned.slice(0, 2).toUpperCase() || 'AP';
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '--:--';
  }
}

export const MessageThread: React.FC<MessageThreadProps> = ({
  room,
  messages,
  currentUser,
  typingUsers,
  loadingHistory,
  onSendMessage,
  onTyping,
  onStopTyping,
  detailsOpen,
  onToggleDetails,
  onBack,
}) => {
  const [inputText, setInputText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // Scroll to bottom on new message
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!room) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background p-6 select-none">
        <span className="font-mono text-xs tracking-wider text-muted-foreground">
          Select a room
        </span>
      </div>
    );
  }

  const roomName = room.name;
  const displayName = `#${roomName}`;
  const initials = getAvatarInitials(roomName);

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onStopTyping();
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTyping();
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onStopTyping();
    }, 2000);
  };

  const isEmpty = !inputText.trim();
  const placeholderText = `Message #${roomName}...`;

  return (
    <div className="flex-1 flex flex-col h-full bg-background min-w-0">
      {/* Header */}
      <header className="h-14 px-4 border-b border-border bg-background flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Back Button */}
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-1.5 border border-border hover:border-foreground text-foreground transition-colors shrink-0"
              aria-label="Back to conversations"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          {/* Clickable Channel Name & Avatar Header */}
          <button
            type="button"
            onClick={onToggleDetails}
            className="flex items-center gap-3 min-w-0 text-left hover:opacity-85 transition-opacity focus:outline-none group cursor-pointer"
            title="Toggle Channel Details"
            aria-label="Toggle Channel Details"
          >
            {/* Avatar Tile */}
            <div className="w-8 h-8 font-mono text-xs font-bold border border-border bg-card text-foreground flex items-center justify-center shrink-0 group-hover:border-foreground transition-colors">
              {initials}
            </div>

            {/* Info Column */}
            <div className="flex flex-col min-w-0">
              <h1 className="font-bold text-sm leading-tight truncate text-foreground flex items-center gap-1.5">
                <span>{displayName}</span>
                <span className="text-[9px] font-mono text-muted-foreground group-hover:text-foreground transition-colors">
                  {detailsOpen ? '▲' : '▼'}
                </span>
              </h1>
              <div className="font-mono text-[10px] tracking-wider text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 shrink-0 bg-foreground" />
                <span>Apex Net / Online</span>
              </div>
            </div>
          </button>
        </div>
      </header>

      {/* Top Details Panel Popup (Pops down from top of MessageThread) */}
      {detailsOpen && (
        <DetailsPanel room={room} onClose={onToggleDetails} />
      )}

      {/* Scrollable Thread Body */}
      <div className="flex-1 overflow-y-auto p-3.5 md:p-4 space-y-3.5">
        {/* Loading Indicator */}
        {loadingHistory && (
          <div className="flex justify-center py-2">
            <span className="font-mono text-[11px] tracking-wider text-muted-foreground">
              Loading history...
            </span>
          </div>
        )}

        {/* Top Section Divider */}
        {!loadingHistory && (
          <div className="flex items-center gap-3.5 my-2">
            <div className="flex-1 border-t border-border" />
            <span className="font-mono text-[11px] tracking-wider text-muted-foreground shrink-0">
              — Start of #{roomName} —
            </span>
            <div className="flex-1 border-t border-border" />
          </div>
        )}

        {/* Empty State */}
        {!loadingHistory && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center select-none">
            <div className="w-18 h-18 border border-foreground bg-foreground text-background flex items-center justify-center mb-3.5">
              <Hash className="w-9 h-9" />
            </div>
            <p className="font-mono text-xs tracking-wider text-foreground font-bold">
              No messages yet.
            </p>
          </div>
        )}

        {/* Messages List */}
        {messages.map((msg) => {
          const isMine = msg.senderId === currentUser?.id;
          const timeLabel = formatTime(msg.createdAt);
          const senderName = msg.sender?.displayName || msg.sender?.username || 'User';

          return (
            <div
              key={msg.id}
              className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex flex-col max-w-[78%] sm:max-w-[70%] ${isMine ? 'items-end' : 'items-start'}`}>
                {/* Mesmerizing Brutalist Chat Bubble */}
                <div
                  className={`p-3 sm:p-3.5 leading-relaxed whitespace-pre-wrap select-text relative flex flex-col transition-colors ${
                    isMine
                      ? 'bg-[#1c1c20] text-foreground border-x border-b border-border shadow-sm'
                      : 'bg-[#121215] text-foreground border border-border'
                  }`}
                >
                  {/* Sender Name Header */}
                  <div
                    className={`font-mono text-[11px] font-bold tracking-wider pb-1 mb-1 flex items-center justify-between gap-3 border-b ${
                      isMine
                        ? 'text-foreground border-border/40'
                        : 'text-muted-foreground border-border/30'
                    }`}
                  >
                    <span>{isMine ? 'You' : senderName}</span>
                    {msg.type === 'encrypted' && (
                      <span className="font-mono text-[8px] tracking-widest px-1 py-0.2 border border-border text-muted-foreground uppercase">
                        E2EE
                      </span>
                    )}
                  </div>

                  {/* Message Content */}
                  <div className="wrap-break-words font-sans text-sm text-foreground">
                    {msg.content}
                  </div>

                  {/* Timestamp */}
                  <div className="self-end font-mono text-[10px] tracking-wider text-muted-foreground mt-1 select-none">
                    {timeLabel}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 ml-1 mb-1.5 text-muted-foreground">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 inline-block bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 inline-block bg-muted-foreground animate-bounce" style={{ animationDelay: '120ms' }} />
              <span className="w-1.5 h-1.5 inline-block bg-muted-foreground animate-bounce" style={{ animationDelay: '240ms' }} />
            </div>
            <span className="font-mono text-xs tracking-wider">
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Composer Container */}
      <div className="p-3 border-t border-border bg-background shrink-0">
        <div className="border border-border focus-within:border-foreground bg-card transition-colors flex items-end p-1">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholderText}
            className="flex-1 py-2 px-3 text-xs sm:text-sm font-mono bg-transparent focus:outline-none resize-none placeholder:text-muted-foreground placeholder:tracking-wider text-foreground caret-foreground"
            style={{ maxHeight: '128px', minHeight: '38px' }}
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={isEmpty}
            aria-label="Send Message"
            title="Send Message"
            className={`w-9 h-9 border flex items-center justify-center shrink-0 transition-colors ml-1 ${
              isEmpty
                ? 'bg-muted text-muted-foreground border-border opacity-40 cursor-not-allowed'
                : 'bg-foreground text-background border-foreground hover:bg-secondary hover:text-foreground cursor-pointer'
            }`}
          >
            <SendHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageThread;
