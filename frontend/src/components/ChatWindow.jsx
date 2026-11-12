import React, { useEffect, useRef } from 'react';
import { Bot, User } from 'lucide-react';

function ChatWindow({ messages, isThinking, interimTranscript }) {
  const containerRef = useRef(null);
  const isNearBottomRef = useRef(true);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 120;
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isNearBottomRef.current) return;
    // Scroll ONLY the chat message container, never the page window
    el.scrollTop = el.scrollHeight;
  }, [messages, isThinking, interimTranscript]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      data-lenis-prevent
      data-lenis-prevent-wheel
      data-lenis-prevent-touch
      className="min-h-[260px] flex-1 space-y-4 overflow-y-auto p-4 sm:p-5"
    >
      {messages.map((msg, idx) => {
        const isUser = msg.role === 'customer';
        return (
          <div
            key={msg.id || `${idx}-${msg.timestamp}`}
            className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                isUser ? 'bg-navy-900 text-white' : 'bg-brand-600 text-white'
              }`}
            >
              {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>

            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                isUser
                  ? 'rounded-tr-sm bg-navy-900 text-white'
                  : 'rounded-tl-sm border border-slate-200 bg-white text-slate-800'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        );
      })}

      {interimTranscript && (
        <div className="flex flex-row-reverse items-start gap-3 opacity-75">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-900 text-white">
            <User className="h-4 w-4" />
          </div>
          <div className="max-w-[80%] rounded-2xl rounded-tr-sm border border-dashed border-brand-400 bg-brand-50 px-4 py-2.5 text-sm italic text-navy-900">
            {interimTranscript}...
          </div>
        </div>
      )}

      {isThinking && (
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
            <Bot className="h-4 w-4" />
          </div>
          <div className="rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-bounce rounded-full bg-brand-600 [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-brand-600 [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-brand-600" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(ChatWindow);
