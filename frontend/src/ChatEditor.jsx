import React, { useEffect, useState, useRef } from "react";
import { socket } from "./socket";
import { auth } from "./firebase";
import { Avatar } from "./components/ui";

export function ChatEditor({ documentId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [activeUsers, setActiveUsers] = useState(0);
  const [typingUser, setTypingUser] = useState(null);
  const scrollRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!documentId || !auth.currentUser) return;

    socket.emit("joinRoom", {
      roomId: documentId,
      user: { email: auth.currentUser.email },
    });

    socket.on("userCountUpdate", (count) => setActiveUsers(count));
    socket.on("userTypingUpdate", ({ email, isTyping }) => {
      setTypingUser(isTyping ? email.split("@")[0] : null);
    });
    socket.on("chatHistory", (history) => setMessages(history));
    socket.on("receiveMessage", (newMessage) => {
      setMessages((prev) => [...prev, newMessage]);
      setTypingUser(null);
    });

    return () => {
      socket.emit("leaveRoom", documentId);
      socket.off("userCountUpdate");
      socket.off("userTypingUpdate");
      socket.off("chatHistory");
      socket.off("receiveMessage");
    };
  }, [documentId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typingUser]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
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
    e.preventDefault();
    if (!input.trim()) return;
    socket.emit("sendMessage", {
      roomId: documentId,
      message: input,
      user: { email: auth.currentUser.email },
    });
    setInput("");
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Room header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
        <div>
          <h3 className="text-base font-semibold text-[var(--color-text)]">
            <span className="mr-1 text-[var(--color-text-muted)]">#</span>
            {documentId}
          </h3>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                activeUsers > 1 ? "bg-[var(--color-success)]" : "bg-[var(--color-text-muted)]"
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
        className="flex-1 space-y-3 overflow-y-auto bg-[var(--color-surface-secondary)] px-5 py-4"
      >
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
            No messages yet. Say hello!
          </p>
        )}

        {messages.map((msg, i) => {
          const isMe = msg.email === auth.currentUser?.email;
          const showAvatar = !isMe && (i === 0 || messages[i - 1]?.email !== msg.email);

          return (
            <div
              key={i}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div className={`flex max-w-[75%] gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                {!isMe && (
                  <div className="mt-1 w-8 shrink-0">
                    {showAvatar ? (
                      <Avatar name={msg.email} size="sm" />
                    ) : (
                      <div className="h-7 w-7" />
                    )}
                  </div>
                )}

                <div
                  className={`
                    rounded-2xl px-3.5 py-2.5 shadow-sm
                    ${
                      isMe
                        ? "rounded-br-sm bg-[var(--color-primary)] text-white"
                        : "rounded-bl-sm border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
                    }
                  `}
                >
                  {!isMe && showAvatar && (
                    <span className="mb-0.5 block text-xs font-semibold capitalize text-[var(--color-primary)]">
                      {msg.email?.split("@")[0]}
                    </span>
                  )}
                  <div className="whitespace-pre-wrap break-words text-[0.925rem] leading-relaxed">
                    {msg.message}
                  </div>
                  <div
                    className={`mt-1 text-right text-[0.65rem] font-medium ${
                      isMe ? "text-blue-200" : "text-[var(--color-text-muted)]"
                    }`}
                  >
                    {msg.timestamp
                      ? new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {typingUser && (
          <div className="flex items-center gap-2 pl-10 text-sm italic text-[var(--color-text-secondary)]">
            <span className="flex gap-0.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-muted)] [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-muted)] [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-muted)] [animation-delay:300ms]" />
            </span>
            {typingUser} is typing...
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex shrink-0 items-center gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
      >
        <input
          className="
            flex-1 rounded-full border border-[var(--color-border)]
            bg-[var(--color-surface-secondary)] px-4 py-2.5
            text-sm text-[var(--color-text)]
            placeholder:text-[var(--color-text-muted)]
            transition-all duration-150
            focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20
          "
          value={input}
          onChange={handleInputChange}
          placeholder={`Message #${documentId}`}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="
            flex h-10 w-10 shrink-0 items-center justify-center
            rounded-full bg-[var(--color-primary)] text-white
            shadow-sm transition-all duration-150
            hover:bg-[var(--color-primary-hover)]
            disabled:cursor-not-allowed disabled:opacity-40
          "
          aria-label="Send message"
        >
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
        </button>
      </form>
    </div>
  );
}