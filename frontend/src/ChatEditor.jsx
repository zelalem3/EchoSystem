import React, { useEffect, useState, useRef, useCallback } from "react";
import { socket } from "./socket";
import { auth } from "./firebase";
import { Avatar, Spinner } from "./components/ui";

function MessageSkeleton() {
  return (
    <div className="space-y-4 px-1">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`flex gap-2 ${i % 2 === 0 ? "justify-end" : "justify-start"}`}
        >
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

export function ChatEditor({
  documentId,
  pendingDescription = "",
  onJoined,
}) {
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
  const [sendError, setSendError] = useState("");
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  const [roomMeta, setRoomMeta] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [actionError, setActionError] = useState("");

  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const pendingDescriptionRef = useRef(pendingDescription);
  const onJoinedRef = useRef(onJoined);

  useEffect(() => {
    isNearBottomRef.current = isNearBottom;
  }, [isNearBottom]);

  useEffect(() => {
    pendingDescriptionRef.current = pendingDescription;
    onJoinedRef.current = onJoined;
  }, [pendingDescription, onJoined]);

  useEffect(() => {
    if (!documentId || !auth.currentUser) return;

    setLoadingHistory(true);
    setHistoryError("");
    setMessages([]);
    setRoomMeta(null);
    setSearchResults(null);
    setActionError("");
    setEditingId(null);
    setEditText("");
    setActiveUsers(0);
    setTypingUser(null);
    setHasNewMessages(false);

    const onUserCount = (count) => setActiveUsers(count);

    const onTyping = ({ email, isTyping }) => {
      setTypingUser(isTyping ? email.split("@")[0] : null);
    };

    const onHistory = (page) => {
      if (!Array.isArray(page) && page?.roomId !== documentId) return;
      const nextMessages = Array.isArray(page) ? page : page?.messages;
      setMessages(nextMessages || []);
      setHistoryCursor(Array.isArray(page) ? null : page?.cursor || null);
      setHasOlderMessages(Boolean(!Array.isArray(page) && page?.hasMore));
      setLoadingHistory(false);
      setHistoryError("");
      socket.emit("getUserRooms");
      onJoinedRef.current?.();
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

    const onRoomMeta = (meta) => {
      if (meta?.roomId === documentId) setRoomMeta(meta);
    };

    const onMessageUpdated = (updated) => {
      if (!updated?.id) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
      );
      setEditingId((current) => (current === updated.id ? null : current));
      setEditText("");
    };

    const onMessageDeleted = ({ id }) => {
      if (!id) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, deleted: true, message: "", edited: false }
            : m
        )
      );
    };

    socket.on("userCountUpdate", onUserCount);
    socket.on("userTypingUpdate", onTyping);
    socket.on("chatHistory", onHistory);
    socket.on("olderChatHistory", onOlderHistory);
    socket.on("chatHistoryError", onHistoryError);
    socket.on("roomError", onHistoryError);
    socket.on("receiveMessage", onMessage);
    socket.on("roomMeta", onRoomMeta);
    socket.on("messageUpdated", onMessageUpdated);
    socket.on("messageDeleted", onMessageDeleted);

    const joinRoom = () => {
      socket.emit("joinRoom", {
        roomId: documentId,
        ...(pendingDescriptionRef.current
          ? { description: pendingDescriptionRef.current }
          : {}),
      });
    };

    socket.on("connect", joinRoom);
    if (socket.connected) joinRoom();

    return () => {
      const wasTyping = Boolean(typingTimeoutRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;

      if (socket.connected) {
        if (wasTyping) {
          socket.emit("typing", { roomId: documentId, isTyping: false });
        }
        socket.emit("leaveRoom", documentId);
      }

      socket.off("connect", joinRoom);
      socket.off("userCountUpdate", onUserCount);
      socket.off("userTypingUpdate", onTyping);
      socket.off("chatHistory", onHistory);
      socket.off("olderChatHistory", onOlderHistory);
      socket.off("chatHistoryError", onHistoryError);
      socket.off("roomError", onHistoryError);
      socket.off("receiveMessage", onMessage);
      socket.off("roomMeta", onRoomMeta);
      socket.off("messageUpdated", onMessageUpdated);
      socket.off("messageDeleted", onMessageDeleted);
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

  useEffect(() => {
    if (isNearBottom && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typingUser, isNearBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 80;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
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

  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    adjustTextareaHeight();

    if (!typingTimeoutRef.current) {
      socket.emit("typing", {
        roomId: documentId,
        isTyping: true,
      });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing", {
        roomId: documentId,
        isTyping: false,
      });
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const handleSend = (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setSendError("");
    socket.emit(
      "sendMessage",
      {
        roomId: documentId,
        message: text,
      },
      (result) => {
        setSending(false);
        if (!result?.ok) {
          setSendError(
            result?.error || "Unable to send the message. Please try again."
          );
          return;
        }

        setInput("");
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
        setIsNearBottom(true);
      }
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSearch = (e) => {
    e?.preventDefault();
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    setActionError("");
    socket.emit("searchMessages", { roomId: documentId, query: q }, (result) => {
      setSearching(false);
      if (!result?.ok) {
        setActionError(result?.error || "Search failed.");
        setSearchResults([]);
        return;
      }
      setSearchResults(result.messages || []);
    });
  };

  const startEdit = (msg) => {
    if (!msg?.id || msg.deleted || msg.email !== auth.currentUser?.email) return;
    setEditingId(msg.id);
    setEditText(msg.message || "");
    setActionError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const submitEdit = (messageId) => {
    const text = editText.trim();
    if (!text || !messageId) return;
    setActionError("");
    socket.emit(
      "editMessage",
      { roomId: documentId, messageId, message: text },
      (result) => {
        if (!result?.ok) {
          setActionError(result?.error || "Could not edit message.");
          return;
        }
        if (result.message) {
          setMessages((previous) =>
            previous.map((message) =>
              message.id === result.message.id
                ? { ...message, ...result.message }
                : message
            )
          );
        }
        setEditingId(null);
        setEditText("");
      }
    );
  };

  const submitDelete = (messageId) => {
    if (!messageId) return;
    if (!window.confirm("Delete this message?")) return;
    setActionError("");
    socket.emit(
      "deleteMessage",
      { roomId: documentId, messageId },
      (result) => {
        if (!result?.ok) {
          setActionError(result?.error || "Could not delete message.");
          return;
        }
        const deletedId = result?.messageId || messageId;
        setMessages((previous) =>
          previous.map((message) =>
            message.id === deletedId
              ? { ...message, deleted: true, message: "", edited: false }
              : message
          )
        );
      }
    );
  };

  const jumpToMessage = (messageId) => {
    setSearchOpen(false);
    setSearchResults(null);
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-violet-400");
      setTimeout(() => el.classList.remove("ring-2", "ring-violet-400"), 1500);
    }
  };

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
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[linear-gradient(90deg,rgba(124,58,237,0.06),rgba(59,130,246,0.04))] px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="min-w-0 flex-1">
          <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-700">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            Room
          </div>
          <h3 className="truncate text-base font-semibold text-[var(--color-text)]">
            <span className="mr-1 text-[var(--color-text-muted)]">#</span>
            {documentId}
          </h3>
          {roomMeta?.description ? (
            <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
              {roomMeta.description}
            </p>
          ) : null}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
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
            {roomMeta?.createdByEmail ? (
              <span className="text-[11px] text-[var(--color-text-muted)]">
                · created by {roomMeta.createdByEmail.split("@")[0]}
              </span>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setSearchOpen((v) => !v);
            setSearchResults(null);
            setActionError("");
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white/80 text-[var(--color-text-secondary)] shadow-sm transition hover:bg-[var(--color-surface-secondary)]"
          aria-label="Search in room"
          title="Search in room"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3-3" />
          </svg>
        </button>
      </div>

      {searchOpen && (
        <div className="shrink-0 border-b border-[var(--color-border)] bg-white/80 px-3 py-2 sm:px-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages in this room…"
              className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[rgba(248,250,255,0.9)] px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200/80"
              autoFocus
            />
            <button
              type="submit"
              disabled={searching || searchQuery.trim().length < 2}
              className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              {searching ? "…" : "Search"}
            </button>
          </form>
          {searchResults && (
            <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white/90">
              {searchResults.length === 0 ? (
                <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                  No matches
                </p>
              ) : (
                searchResults.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => jumpToMessage(m.id)}
                    className="flex w-full flex-col items-start gap-0.5 border-b border-[var(--color-border)] px-3 py-2 text-left last:border-0 hover:bg-violet-50"
                  >
                    <span className="text-[11px] font-medium text-violet-700">
                      {(m.email || "").split("@")[0]}
                    </span>
                    <span className="line-clamp-2 text-xs text-[var(--color-text)]">
                      {m.message}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {actionError && (
        <p
          role="alert"
          className="shrink-0 px-4 py-1.5 text-xs text-[var(--color-danger)]"
        >
          {actionError}
        </p>
      )}

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
                  {loadingOlderMessages
                    ? "Loading older messages..."
                    : "Load older messages"}
                </button>
              </div>
            )}
            {historyError && (
              <p
                role="alert"
                className="py-2 text-center text-sm text-[var(--color-danger)]"
              >
                {historyError}
              </p>
            )}

            {messages.map((msg, i) => {
              const currentUser = auth.currentUser;
              const isMe =
                Boolean(currentUser) &&
                (msg.uid === currentUser.uid ||
                  (typeof msg.email === "string" &&
                    typeof currentUser.email === "string" &&
                    msg.email.trim().toLowerCase() ===
                      currentUser.email.trim().toLowerCase()));
              const first = isFirstInGroup(i);
              const last = isLastInGroup(i);
              const showHeader = !isMe && first;
              const isDeleted = msg.deleted === true;
              const isEditing = editingId === msg.id;

              return (
                <div
                  key={msg.id || i}
                  id={msg.id ? `msg-${msg.id}` : undefined}
                  className={`flex ${isMe ? "justify-end" : "justify-start"} ${
                    first ? "mt-3" : "mt-0.5"
                  }`}
                >
                  <div
                    className={`flex max-w-[78%] gap-2 sm:max-w-[70%] ${
                      isMe ? "flex-row-reverse" : ""
                    }`}
                  >
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
                            isDeleted
                              ? "border border-dashed border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)]"
                              : isMe
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
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              rows={2}
                              className="w-full rounded-lg border border-white/30 bg-white/20 px-2 py-1 text-sm text-inherit outline-none"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => submitEdit(msg.id)}
                                className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-violet-700"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="rounded-md px-2 py-1 text-[11px] font-medium text-white/90"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap break-words text-[0.925rem] leading-relaxed">
                            {isDeleted ? "Message deleted" : msg.message}
                          </div>
                        )}

                        <div
                          className={`mt-1 flex items-center justify-end gap-2 text-[0.65rem] font-medium ${
                            isMe && !isDeleted
                              ? "text-blue-200/90"
                              : "text-[var(--color-text-muted)]"
                          }`}
                        >
                          {msg.edited && !isDeleted ? <span>edited</span> : null}
                          {msg.timestamp && (
                            <span>
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Edit / Delete — only on your messages with an id */}
                      {isMe && !isDeleted && !isEditing && msg.id && (
                        <div className="mt-1 flex justify-end gap-3 px-1">
                          <button
                            type="button"
                            onClick={() => startEdit(msg)}
                            className="rounded-md border border-[var(--color-border)] bg-white/80 px-2.5 py-1 text-xs font-semibold text-[var(--color-text-secondary)] shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => submitDelete(msg.id)}
                            className="rounded-md border border-[var(--color-border)] bg-white/80 px-2.5 py-1 text-xs font-semibold text-[var(--color-text-secondary)] shadow-sm transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

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

      {hasNewMessages && (
        <div className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <button
            type="button"
            onClick={scrollToBottom}
            className="flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg transition hover:bg-[var(--color-primary-hover)]"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
            New messages
          </button>
        </div>
      )}

      {sendError && (
        <p role="alert" className="px-4 pt-2 text-sm text-[var(--color-danger)]">
          {sendError}
        </p>
      )}

      <form
        onSubmit={handleSend}
        className="flex shrink-0 items-end gap-2.5 border-t border-[var(--color-border)] bg-[rgba(255,255,255,0.72)] px-3 py-3 sm:px-4"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(event) => {
            setSendError("");
            handleInputChange(event);
          }}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${documentId}`}
          disabled={sending}
          className="max-h-[120px] min-h-[42px] flex-1 resize-none rounded-2xl border border-[var(--color-border)] bg-[rgba(248,250,255,0.9)] px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] transition-all duration-150 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200/80 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-[0_12px_25px_-12px_rgba(109,40,217,0.9)] transition-all duration-150 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
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