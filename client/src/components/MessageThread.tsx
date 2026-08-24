import React, { useState, useRef, useEffect } from "react";
import {
  ArrowLeft,
  Hash,
  SendHorizontal,
  CornerUpLeft,
  X,
  CheckCheck,
} from "lucide-react";
import type { Message, Room } from "../types/index";
import type { User } from "../types/index";
import DetailsPanel from "./DetailsPanel";
import { useChatStore } from "../store/useChatStore";
import { fetchAPI } from "../lib/api";
import { socket } from "../config/socket";

interface MessageThreadProps {
  room: Room | null;
  messages: Message[];
  currentUser: User | null;
  typingUsers: string[];
  loadingHistory: boolean;
  onSendMessage: (content: string, replyTo?: string) => void;
  onTyping: () => void;
  onStopTyping: () => void;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  onBack?: () => void;
}

function getAvatarInitials(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, "");
  return cleaned.slice(0, 2).toUpperCase() || "AP";
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "--:--";
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
  const [inputText, setInputText] = useState("");
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const { replyTo, setReplyTo, markRoomRead } =
    useChatStore();

  const [groupMembers, setGroupMembers] = useState<User[]>([]);
  const [loadingGroupMembers, setLoadingGroupMembers] = useState(false);

  useEffect(() => {
    if (room && (room.unreadCount || 0) > 0) {
      markRoomRead(room.id);
    }
  }, [room?.id, room?.unreadCount, markRoomRead, messages.length]);

  useEffect(() => {
    if (!room || room.type !== "group") {
      setGroupMembers([]);
      return;
    }

    let isMounted = true;
    setLoadingGroupMembers(true);
    fetchAPI<User[]>(`/rooms/${room.id}/members`)
      .then((data) => {
        if (isMounted) {
          setGroupMembers(data);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch room members:", err);
      })
      .finally(() => {
        if (isMounted) {
          setLoadingGroupMembers(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [room?.id, room?.type, detailsOpen]);

  useEffect(() => {
    const handleUserOnline = (data: { userId: string; username: string }) => {
      setGroupMembers((prev) =>
        prev.map((m) => (m.id === data.userId ? { ...m, isOnline: true } : m)),
      );
    };

    const handleUserOffline = (data: { userId: string; username: string }) => {
      setGroupMembers((prev) =>
        prev.map((m) => (m.id === data.userId ? { ...m, isOnline: false } : m)),
      );
    };

    socket.on("user:online", handleUserOnline);
    socket.on("user:offline", handleUserOffline);

    return () => {
      socket.off("user:online", handleUserOnline);
      socket.off("user:offline", handleUserOffline);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages.length]);


  if (!room) {
    return (
      <div className="flex-1 min-h-screen flex items-center justify-center bg-background p-6 select-none">
        <span className="font-mono text-xs tracking-wider text-muted-foreground">
          Select a chat to start messaging
        </span>
      </div>
    );
  }
  const isDirect = room.type === "direct";
  const dmUser = room.dmUser;
  const roomName =
    isDirect && dmUser ? dmUser.displayName || dmUser.username : room.name;
  const displayName = isDirect ? roomName : `#${roomName}`;
  const initials =
    isDirect && dmUser
      ? getAvatarInitials(dmUser.displayName || dmUser.username)
      : getAvatarInitials(roomName);

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage(trimmed, replyTo?.id);
    setInputText("");
    setReplyTo(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onStopTyping();
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === "Escape" && replyTo) {
      setReplyTo(null);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTyping();
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    // Note: We debounce typing emissions to 2s to prevent hammering the WebSocket server on rapid keystrokes.
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onStopTyping();
    }, 2000);
  };
  const isEmpty = !inputText.trim();
  const placeholderText = `Message ${isDirect ? "" : "#"}${roomName}...`;

  return (
    <div className="flex-1 flex flex-col h-full bg-background min-w-0">
      { }
      <header className="h-14 px-4 border-b border-border bg-background flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3 min-w-0">
          { }
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-1.5 border border-border hover:border-foreground text-foreground transition-colors shrink-0"
              aria-label="Back to conversations"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          { }
          <button
            type="button"
            onClick={onToggleDetails}
            className="flex items-center gap-3 min-w-0 text-left hover:opacity-85 transition-opacity focus:outline-none group cursor-pointer"
            title="Toggle Room Details"
            aria-label="Toggle Room Details"
          >
            { }
            <div className="w-8 h-8 font-mono text-xs font-bold bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors rounded-none">
              {initials}
            </div>
            { }
            <div className="flex flex-col min-w-0">
              <h1 className="font-bold text-sm leading-tight truncate text-foreground flex items-center gap-1.5">
                <span>{displayName}</span>
                <span className="text-[9px] font-mono text-muted-foreground group-hover:text-foreground transition-colors">
                  {detailsOpen ? "▲" : "▼"}
                </span>
              </h1>
              <div className="font-mono text-[10px] tracking-wider text-muted-foreground flex items-center gap-1.5 mt-0.5">
                {room.type === "direct" ? (
                  <>
                    {room.dmUser?.isOnline ? (
                      <span className="bg-foreground text-background px-1.5 py-0 rounded-none font-bold">
                        Online
                      </span>
                    ) : (
                      <span>Offline</span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 shrink-0 bg-foreground" />
                    <span>
                      {loadingGroupMembers && groupMembers.length === 0
                        ? "Loading..."
                        : `${groupMembers.filter((m) => m.isOnline).length} ${groupMembers.filter((m) => m.isOnline).length === 1
                          ? "person"
                          : "people"
                        } online`}
                    </span>
                  </>
                )}
              </div>
            </div>
          </button>
        </div>
        { }
        <div className="flex items-center gap-2">{ }</div>
      </header>
      { }
      {detailsOpen && <DetailsPanel room={room} onClose={onToggleDetails} />}
      { }
      <div className="flex-1 overflow-y-auto p-3.5 md:p-4 space-y-3.5 w-full">
        {loadingHistory && (
          <div className="flex justify-center py-2">
            <span className="font-mono text-[11px] tracking-wider text-muted-foreground">
              Loading history...
            </span>
          </div>
        )}
        {!loadingHistory && (
          <div className="flex items-center gap-3.5 my-2">
            <div className="flex-1 border-t border-border" />
            <span className="font-mono text-[11px] tracking-wider text-muted-foreground shrink-0">
              — Start of {room.type !== "direct" ? `#` : ""}
              {roomName} —
            </span>
            <div className="flex-1 border-t border-border" />
          </div>
        )}
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
        { }
        {messages.map((msg) => {
          const isMine = msg.senderId === currentUser?.id;
          const timeLabel = formatTime(msg.createdAt);
          const senderName =
            msg.sender?.displayName || msg.sender?.username || "User";
          const displayContent = msg.decrypted ?? msg.content;
          const isHovered = hoveredMsgId === msg.id;
          return (
            <div
              key={msg.id}
              className={`flex w-full ${isMine ? "justify-end" : "justify-start"}`}
              onMouseEnter={() => setHoveredMsgId(msg.id)}
              onMouseLeave={() => {
                setHoveredMsgId(null);
              }}
            >
              <div
                className={`flex flex-col max-w-[85%] md:max-w-md min-w-0 ${isMine ? "items-end" : "items-start"}`}
              >
                { }
                <div
                  className={`flex flex-col gap-1 group ${isMine ? "items-end" : "items-start"}`}
                >
                  { }
                  <div
                    className={`p-3 select-text relative flex flex-col min-w-20 gap-1.5 transition-colors shadow-sm rounded-none ${isMine
                      ? "bg-zinc-200 text-zinc-900"
                      : "bg-zinc-800 text-zinc-100 border border-zinc-700"
                      }`}
                  >
                    { }
                    {msg.replyToMessage &&
                      (() => {
                        const isReplyMine =
                          msg.replyToMessage.senderDisplayName ===
                          currentUser?.displayName;
                        return (
                          <div
                            className={`p-2 mb-1.5 flex flex-col min-w-0 max-w-full overflow-hidden border ${isReplyMine
                              ? "bg-zinc-200 text-zinc-900 border-zinc-300 selection:bg-zinc-900 selection:text-zinc-100"
                              : "bg-zinc-800 text-zinc-100 border-zinc-700 selection:bg-zinc-200 selection:text-zinc-900"
                              } ${isMine ? "text-right" : "text-left"}`}
                          >
                            <p
                              className={`font-mono text-[12px] truncate ${isReplyMine ? "text-zinc-900/80" : "text-zinc-300"}`}
                            >
                              {(msg.replyToMessage.decrypted ?? msg.replyToMessage.content).length > 15
                                ? (msg.replyToMessage.decrypted ?? msg.replyToMessage.content).slice(0, 15) +
                                "..."
                                : (msg.replyToMessage.decrypted ?? msg.replyToMessage.content)}
                            </p>
                          </div>
                        );
                      })()}
                    <div
                      className={`flex flex-col gap-1.5 ${isMine ? "selection:bg-zinc-900 selection:text-zinc-100" : "selection:bg-zinc-200 selection:text-zinc-900"}`}
                    >
                      { }
                      {room?.type !== "direct" && (
                        <div
                          className={`font-mono text-[11px] font-bold tracking-wider pb-1 flex items-center justify-between gap-3 border-b ${isMine
                            ? "text-zinc-900/80 border-zinc-900/15"
                            : "text-zinc-400 border-zinc-700"
                            }`}
                        >
                          <span>{isMine ? "You" : senderName}</span>
                        </div>
                      )}
                      { }
                      <div className="wrap-break-words font-sans text-sm leading-relaxed">
                        {displayContent}
                      </div>
                      { }
                      <div
                        className={`self-end flex items-center gap-1 font-mono text-[10px] tracking-wider select-none ${isMine ? "text-zinc-900/60" : "text-zinc-400"
                          }`}
                      >
                        {timeLabel}
                        {isMine && room?.type === "direct" && (
                          <CheckCheck
                            className={`w-3 h-3 ${msg.isRead ? "text-zinc-900" : "text-zinc-900/30"}`}
                          />
                        )}
                      </div>
                    </div>
                    { }
                    {isHovered && (
                      <div
                        className={`absolute top-0 flex flex-row border border-zinc-700 bg-zinc-900 ${isMine ? "right-full mr-2" : "left-full ml-2"} z-10`}
                      >
                        <button
                          onClick={() => setReplyTo(msg)}
                          className="w-7 h-7 rounded-none bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center justify-center"
                          title="Reply"
                        >
                          <CornerUpLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          );
        })}
        { }
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 ml-1 mb-1.5 text-muted-foreground">
            <div className="flex gap-1">
              <span
                className="w-1.5 h-1.5 inline-block bg-muted-foreground animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-1.5 h-1.5 inline-block bg-muted-foreground animate-bounce"
                style={{ animationDelay: "120ms" }}
              />
              <span
                className="w-1.5 h-1.5 inline-block bg-muted-foreground animate-bounce"
                style={{ animationDelay: "240ms" }}
              />
            </div>
            <span className="font-mono text-xs tracking-wider">
              {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"}{" "}
              typing...
            </span>
          </div>
        )}
        { }
        <div ref={scrollRef} className="h-2" />
      </div>
      { }
      {replyTo && (
        <div className="px-3 pt-2 pb-0 border-t border-border/50 bg-background/80 flex items-start justify-between gap-3 shrink-0">
          <div className="flex flex-col min-w-0">
            <span className="font-mono text-[10px] text-muted-foreground tracking-wider">
              ↩ Replying to{" "}
              <span className="text-foreground font-bold">
                {replyTo.sender?.displayName || "User"}
              </span>
            </span>
            <p className="font-mono text-[10px] text-muted-foreground/70 truncate mt-0.5">
              {(replyTo.decrypted ?? replyTo.content).length > 15
                ? (replyTo.decrypted ?? replyTo.content).slice(0, 15) + "..."
                : (replyTo.decrypted ?? replyTo.content)}
            </p>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
            title="Cancel reply"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      { }
      <div className="p-3 border-t border-border/50 bg-background/80 backdrop-blur-sm shrink-0 w-full">
        <div className="border border-border/50 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 bg-card transition-all flex items-end p-1 rounded-none shadow-sm">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholderText}
            className="flex-1 py-2.5 px-3 text-xs sm:text-sm font-sans bg-transparent focus:outline-none resize-none placeholder:text-muted-foreground placeholder:tracking-wider text-foreground caret-primary"
            style={{ maxHeight: "128px", minHeight: "42px" }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isEmpty}
            aria-label="Send Message"
            title="Send Message"
            className={`w-9 h-9 flex items-center justify-center shrink-0 transition-all ml-1 rounded-none mb-0.5 mr-0.5 ${isEmpty
              ? "bg-muted text-muted-foreground/50 cursor-not-allowed"
              : "bg-primary text-primary-foreground shadow-md hover:opacity-90 cursor-pointer"
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
