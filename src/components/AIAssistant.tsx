import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'ما فضل صلاة الفجر في جماعة؟',
  'كيف أُكثر من الاستغفار؟',
  'ما هي أذكار الصباح؟',
  'كيف أبدأ ختمة القرآن؟',
];

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: trimmed };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error('network');
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'عذراً، تعذّر الاتصال بالمساعد. حاول مرة أخرى.' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 left-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald to-emerald-deep text-white shadow-xl shadow-emerald/30 transition active:scale-90 lg:bottom-6 lg:left-6"
          aria-label="المساعد الذكي"
        >
          <Sparkles size={24} />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/60 opacity-75" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-gold" />
          </span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 left-4 z-50 flex h-[60vh] max-h-[520px] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-emerald-soft/30 bg-white dark:bg-emerald-deep shadow-2xl lg:bottom-6 lg:left-6 lg:w-96">
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-l from-emerald to-emerald-deep px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-sm font-bold">مساعد توبة</p>
                <p className="text-[10px] text-emerald-100">اسألني عن أي شيء</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 transition hover:bg-white/15"
              aria-label="إغلاق"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald/10 dark:bg-gold/10">
                  <MessageCircle size={32} className="text-emerald dark:text-gold-light" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">مرحباً بك في مساعد توبة</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">اسألني عن الأذكار، الصلاة، القرآن، أو أي سؤال إسلامي</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-emerald/20 dark:border-gold/20 bg-emerald/5 dark:bg-gold/5 px-3 py-1.5 text-[11px] font-semibold text-emerald dark:text-gold-light transition hover:bg-emerald/10 dark:hover:bg-gold/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-emerald text-white rounded-bl-sm'
                      : 'bg-slate-100 dark:bg-emerald-soft/30 text-slate-800 dark:text-slate-100 rounded-br-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-end">
                <div className="flex items-center gap-1 rounded-2xl bg-slate-100 dark:bg-emerald-soft/30 px-4 py-3">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 dark:bg-slate-300" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 dark:bg-slate-300" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 dark:bg-slate-300" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-slate-200 dark:border-emerald-soft/30 p-3">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="اكتب سؤالك..."
                className="flex-1 rounded-xl border border-slate-200 dark:border-emerald-soft/40 bg-slate-50 dark:bg-emerald-deep/40 px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-emerald focus:outline-none dark:focus:border-gold"
                disabled={loading}
              />
              <button
                onClick={() => send(input)}
                disabled={loading || !input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald text-white transition hover:bg-emerald-deep disabled:opacity-40 dark:bg-gold dark:hover:bg-gold-dark dark:text-emerald-deep"
                aria-label="إرسال"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
