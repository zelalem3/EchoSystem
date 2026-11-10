import React, { useEffect, useState, useRef, useCallback } from "react";
import { socket } from "./socket";
import { auth } from "./firebase";
import { Avatar, Spinner } from "./components/ui";

function MessageSkeleton() {
  return (
    <div className="space-y-4 px-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className={`flex gap-2 ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
          {i % 2 !== 0 && (
            <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-[var(--color-border)]" />
          )}
          <div
            className={`h-12 animate-pulse rounded-2xl bg-[var(--color-border)] ${
              i % 2 === 0 ? "w-48 rounded-br-sm" : "w-56 rounded-bl-sm"
            }`}
          />
        </div>
      ))}
    </div>
  );
}

export function ChatEditor({ documentId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [activeUsers, setActiveUsers] = useState(0);
  const [typingUser, setTypingUser] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [historyCursor, setHistoryCursor] = useState(null);
  const [historyError, setHistoryError] = useState("");
  const [sending, setSending] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isNearBottomRef = useRef(true);

  // Keep ref in sync for use inside socket handlers
  useEffect(() => {
    isNearBottomRef.current = isNearBottom;
  }, [isNearBottom]);

  // Join room + socket listeners
  useEffect(() => {
    if (!documentId || !auth.currentUser) return;

    setMessages([]);
    setLoadingHistory(true);
    setLoadingOlderMessages(false);
    setHasOlderMessages(false);
    setHistoryCursor(null);
    setHistoryError("");
    setHasNewMessages(false);

    const onUserCount = (count) => setActiveUsers(count);
    const onTyping = ({ email, isTyping }) => {
      setTypingUser(isTyping ? email.split("@")[0] : null);
    };
    const onHistory = (page) => {
      if (!Array.isArray(page) && page?.roomId !== documentId) return;
      const messages = Array.isArray(page) ? page : page?.messages;
      setMessages(messages || []);
      setHistoryCursor(Array.isArray(page) ? null : page?.cursor || null);
      setHasOlderMessages(Boolean(!Array.isArray(page) && page?.hasMore));
      setLoadingHistory(false);
      setHistoryError("");
      // Scroll to bottom after history loads
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    };
    const onOlderHistory = (page) => {
      if (page.roomId !== documentId) return;

      const element = scrollRef.current;
      const previousHeight = element?.scrollHeight ?? 0;
      const previousTop = element?.scrollTop ?? 0;

      setMessages((previous) => [...(page.messages || []), ...previous]);
      setHistoryCursor(page.cursor || null);
      setHasOlderMessages(Boolean(page.hasMore));
      setLoadingOlderMessages(false);
      setHistoryError("");

      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop =
            previousTop + scrollRef.current.scrollHeight - previousHeight;
        }
      });
    };
    const onHistoryError = ({ roomId: failedRoomId, message }) => {
      if (failedRoomId !== documentId) return;
      setLoadingHistory(false);
      setLoadingOlderMessages(false);
      setHistoryError(message);
    };
    const onMessage = (newMessage) => {
      setMessages((prev) => [...prev, newMessage]);
      setTypingUser(null);
      setSending(false);

      if (!isNearBottomRef.current) {
        setHasNewMessages(true);
      }
    };

    socket.on("userCountUpdate", onUserCount);
    socket.on("userTypingUpdate", onTyping);
    socket.on("chatHistory", onHistory);
    socket.on("olderChatHistory", onOlderHistory);
    socket.on("chatHistoryError", onHistoryError);
    socket.on("receiveMessage", onMessage);

    socket.emit("joinRoom", {
      roomId: documentId,
      user: { email: auth.currentUser.email },
    });

    return () => {
      socket.emit("leaveRoom", documentId);
      socket.off("userCountUpdate", onUserCount);
      socket.off("userTypingUpdate", onTyping);
      socket.off("chatHistory", onHistory);
      socket.off("olderChatHistory", onOlderHistory);
      socket.off("chatHistoryError", onHistoryError);
      socket.off("receiveMessage", onMessage);
    };
  }, [documentId]);

  const loadOlderMessages = () => {
    if (!historyCursor || loadingOlderMessages) return;
    setLoadingOlderMessages(true);
    setHistoryError("");
    socket.emit("loadOlderMessages", {
      roomId: documentId,
      cursor: historyCursor,
    });
  };

  // Auto-scroll when near bottom and new content arrives
  useEffect(() => {
    if (isNearBottom && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setHasNewMessages(false);
    }
  }, [messages, typingUser, isNearBottom]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 80;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setIsNearBottom(nearBottom);
    if (nearBottom) setHasNewMessages(false);
  }, []);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
      setHasNewMessages(false);
      setIsNearBottom(true);
    }
  };

  // Auto-grow textarea
  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    adjustTextareaHeight();

    socket.emit("typing", {
      roomId: documentId,
      user: { email: auth.currentUser.email },
      isTyping: true,
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing", {
        roomId: documentId,
        user: { email: auth.currentUser.email },
        isTyping: false,
      });
    }, 2000);
  };

  const handleSend = (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    socket.emit("sendMessage", {
      roomId: documentId,
      message: text,
      user: { email: auth.currentUser.email },
    });
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    // Optimistically stay near bottom
    setIsNearBottom(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group helper
  const isFirstInGroup = (index) => {
    if (index === 0) return true;
    return messages[index].email !== messages[index - 1].email;
  };

  const isLastInGroup = (index) => {
    if (index === messages.length - 1) return true;
    return messages[index].email !== messages[index + 1].email;
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Room header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[linear-gradient(90deg,rgba(124,58,237,0.06),rgba(59,130,246,0.04))] px-5 py-3.5">
        <div>
          <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-700">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            Room
          </div>
          <h3 className="text-base font-semibold text-[var(--color-text)]">
            <span className="mr-1 text-[var(--color-text-muted)]">#</span>
            {documentId}
          </h3>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                activeUsers > 1
                  ? "bg-[var(--color-success)] shadow-[0_0_0_2px_rgba(16,185,129,0.25)]"
                  : "bg-[var(--color-text-muted)]"
              }`}
            />
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
              {activeUsers > 1 ? `${activeUsers} online` : "Only you"}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.08),_transparent_40%),_linear-gradient(180deg,rgba(248,250,255,0.9),rgba(255,255,255,0.7))] px-4 py-4 sm:px-5"
      >
        {loadingHistory ? (
          <MessageSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-12 text-center">
            {historyError ? (
              <p role="alert" className="text-sm text-[var(--color-danger)]">
                {historyError}
              </p>
            ) : (
              <>
                <div className="mb-3 text-3xl opacity-70">👋</div>
                <p className="text-sm font-medium text-[var(--color-text)]">
                  No messages yet
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Be the first to say hello in #{documentId}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {hasOlderMessages && (
              <div className="sticky top-0 z-10 flex justify-center bg-gradient-to-b from-white/90 to-transparent py-2">
                <button
                  type="button"
                  onClick={loadOlderMessages}
                  disabled={loadingOlderMessages}
                  className="rounded-full border border-[var(--color-border)] bg-white/80 px-4 py-2 text-xs font-semibold text-[var(--color-primary)] shadow-sm transition hover:bg-[var(--color-primary-light)] disabled:cursor-wait disabled:opacity-60"
                >
                  {loadingOlderMessages ? "Loading older messages..." : "Load older messages"}
                </button>
              </div>
            )}
            {historyError && (
              <p role="alert" className="py-2 text-center text-sm text-[var(--color-danger)]">
                {historyError}
              </p>
            )}
            {messages.map((msg, i) => {
              const isMe = msg.email === auth.currentUser?.email;
              const first = isFirstInGroup(i);
              const last = isLastInGroup(i);
              const showHeader = !isMe && first;

              return (
                <div
                  key={i}
                  className={`flex ${isMe ? "justify-end" : "justify-start"} ${
                    first ? "mt-3" : "mt-0.5"
                  }`}
                >
                  <div
                    className={`flex max-w-[78%] gap-2 sm:max-w-[70%] ${
                      isMe ? "flex-row-reverse" : ""
                    }`}
                  >
                    {/* Avatar column */}
                    {!isMe && (
                      <div className="w-8 shrink-0">
                        {showHeader ? (
                          <Avatar name={msg.email} size="sm" />
                        ) : (
                          <div className="h-7 w-7" />
                        )}
                      </div>
                    )}

                    <div className="min-w-0">
                      {showHeader && (
                        <span className="mb-1 block px-1 text-xs font-semibold capitalize text-[var(--color-primary)]">
                          {msg.email?.split("@")[0]}
                        </span>
                      )}

                      <div
                        className={`
                          px-3.5 py-2 shadow-[0_10px_20px_-14px_rgba(76,29,149,0.45)]
                          ${
                            isMe
                              ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white"
                              : "border border-[var(--color-border)] bg-[rgba(255,255,255,0.92)] text-[var(--color-text)]"
                          }
                          ${
                            isMe
                              ? last
                                ? "rounded-2xl rounded-br-md"
                                : "rounded-2xl rounded-br-sm"
                              : last
                                ? "rounded-2xl rounded-bl-md"
                                : "rounded-2xl rounded-bl-sm"
                          }
                        `}
                      >
                        <div className="whitespace-pre-wrap break-words text-[0.925rem] leading-relaxed">
                          {msg.message}
                        </div>
                        {msg.timestamp && (
                          <div
                            className={`mt-1 text-right text-[0.65rem] font-medium ${
                              isMe
                                ? "text-blue-200/90"
                                : "text-[var(--color-text-muted)]"
                            }`}
                          >
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Typing indicator */}
        {typingUser && (
          <div className="mt-3 flex items-center gap-2 pl-10 text-sm text-[var(--color-text-secondary)]">
            <span className="flex gap-0.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-muted)] [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-muted)] [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-muted)] [animation-delay:300ms]" />
            </span>
            <span className="italic">{typingUser} is typing…</span>
          </div>
        )}
      </div>

      {/* New messages button */}
      {hasNewMessages && (
        <div className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <button
            type="button"
            onClick={scrollToBottom}
            className="
              flex items-center gap-1.5 rounded-full
              bg-[var(--color-primary)] px-3.5 py-1.5
              text-xs font-semibold text-white shadow-lg
              transition hover:bg-[var(--color-primary-hover)]
            "
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
            New messages
          </button>
        </div>
      )}

      {/* Input area */}
      <form
        onSubmit={handleSend}
        className="flex shrink-0 items-end gap-2.5 border-t border-[var(--color-border)] bg-[rgba(255,255,255,0.72)] px-3 py-3 sm:px-4"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${documentId}`}
          disabled={sending}
          className="
            max-h-[120px] min-h-[42px] flex-1 resize-none
            rounded-2xl border border-[var(--color-border)]
            bg-[rgba(248,250,255,0.9)] px-4 py-2.5
            text-sm text-[var(--color-text)]
            placeholder:text-[var(--color-text-muted)]
            transition-all duration-150
            focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200/80
            disabled:opacity-60
          "
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="
            flex h-[42px] w-[42px] shrink-0 items-center justify-center
            rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white
            shadow-[0_12px_25px_-12px_rgba(109,40,217,0.9)] transition-all duration-150
            hover:scale-[1.02] hover:shadow-[0_18px_30px_-16px_rgba(109,40,217,0.9)]
            disabled:cursor-not-allowed disabled:opacity-40
          "
          aria-label="Send message"
        >
          {sending ? (
            <Spinner size="sm" className="border-white/30 border-t-white" />
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}