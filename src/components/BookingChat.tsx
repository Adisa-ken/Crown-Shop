import { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Check, Sparkles } from 'lucide-react';
import type { ChatMessage } from '../types';
import { BRAND } from '../brand';

interface BookingChatProps {
  bookingId: string;
  bookingCode: string;
  customerName: string;
  barberName: string;
  senderRole: 'customer' | 'barber';
  senderDisplayName: string;
  messages: ChatMessage[];
  onSendMessage: (msg: ChatMessage) => void;
  accentColor?: string;
  compact?: boolean;
}

export function BookingChat({
  bookingId,
  bookingCode,
  customerName,
  barberName,
  senderRole,
  senderDisplayName,
  messages,
  onSendMessage,
  accentColor,
  compact = false,
}: BookingChatProps) {
  const [inputText, setInputText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const bookingMessages = messages
    .filter((m) => m.bookingId === bookingId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [bookingMessages.length]);

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      bookingId,
      sender: senderRole,
      senderName: senderDisplayName,
      text,
      createdAt: new Date().toISOString(),
    };

    onSendMessage(newMsg);
    setInputText('');
  };

  const customerQuickChips = [
    "I'm on my way!",
    "Arrived and seated in waiting area",
    "Running about 10 mins late",
    "Is free parking available?",
  ];

  const barberQuickChips = [
    "Chair is ready for you!",
    "Running about 5 mins behind schedule",
    "See you soon! Call if you need directions",
    "Thanks for letting us know!",
  ];

  const activeChips = senderRole === 'customer' ? customerQuickChips : barberQuickChips;

  return (
    <div className="flex flex-col bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden">
      {/* Chat Header */}
      <div className="px-4 py-3 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
            style={{ background: accentColor || BRAND.colors.accent }}
          >
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <span>{senderRole === 'customer' ? `Chat with ${barberName}` : `Chat with ${customerName}`}</span>
              <span className="text-[10px] font-mono text-stone-400 dark:text-stone-500 uppercase">
                {bookingCode}
              </span>
            </h4>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              {senderRole === 'customer'
                ? `Direct messaging with your barber at ${BRAND.businessName}`
                : `Customer phone: ${bookingId ? '' : ''} direct thread`}
            </p>
          </div>
        </div>
      </div>

      {/* Message List */}
      <div
        className={`p-3.5 space-y-3 overflow-y-auto ${
          compact ? 'max-h-56 min-h-[160px]' : 'max-h-80 min-h-[220px]'
        }`}
      >
        {bookingMessages.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center text-center text-stone-400 dark:text-stone-500 text-xs px-4">
            <MessageSquare className="w-6 h-6 mb-1.5 opacity-40" />
            <p className="font-medium text-stone-600 dark:text-stone-400">
              No messages yet
            </p>
            <p className="text-[11px] mt-0.5">
              Send a quick message about your appointment, timing, or special requests.
            </p>
          </div>
        ) : (
          bookingMessages.map((msg) => {
            const isMe = msg.sender === senderRole;
            const timeStr = new Date(msg.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-baseline gap-1.5 mb-1 px-1">
                  <span className="text-[10px] font-semibold text-stone-500 dark:text-stone-400">
                    {msg.senderName}
                  </span>
                  <span className="text-[9px] text-stone-400 dark:text-stone-500 tabular-nums">
                    {timeStr}
                  </span>
                </div>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs sm:text-sm leading-relaxed shadow-xs ${
                    isMe
                      ? 'text-white rounded-tr-xs'
                      : 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200 rounded-tl-xs'
                  }`}
                  style={isMe ? { background: accentColor || BRAND.colors.accent } : undefined}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Quick suggestions chips */}
      <div className="px-3 py-2 bg-stone-100/60 dark:bg-stone-900/40 border-t border-stone-200/60 dark:border-stone-800/60 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
        <Sparkles className="w-3 h-3 text-stone-400 shrink-0 ml-1 mr-0.5" />
        {activeChips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => handleSend(chip)}
            className="whitespace-nowrap shrink-0 px-2.5 py-1 rounded-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-amber-500 text-[11px] font-medium transition-colors cursor-pointer"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-2.5 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 flex gap-2 items-center"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Type a message to ${
            senderRole === 'customer' ? barberName : customerName
          }...`}
          className="flex-1 min-h-[40px] px-3.5 text-xs sm:text-sm rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="min-h-[40px] px-3.5 rounded-xl text-white font-semibold text-xs flex items-center gap-1.5 disabled:opacity-40 transition-opacity shrink-0"
          style={{ background: accentColor || BRAND.colors.accent }}
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
}
