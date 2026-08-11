import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, Send, Sparkles, Plus, Trash2, MessageSquare, ChevronRight, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { loadState, saveState } from '@/services/storage';
import type { ChatSession, ChatMessage } from '@/types';
import { uuid } from '@/utils/uuid';

const SUGGESTIONS = [
  'ما فضل صلاة الفجر في جماعة؟',
  'كيف أُكثر من الاستغفار؟',
  'ما هي أذكار الصباح؟',
  'كيف أبدأ ختمة القرآن؟',
  'أدعية تريح القلب',
];

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_API_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`;

const STORAGE_KEY = 'ai_sessions_v1';
const ACTIVE_KEY = 'ai_active_session_v1';

const SYSTEM_PROMPT = `أنت "توبة"، رفيقك الإسلامي المخلص والودود. تتحدث بلغة عربية دافئة طبيعية جداً زي صديق حقيقي، مش روبوت جامد. تقدم نصائح في جميع جوانب الحياة (عبادة، سيرة، علاقات، صبر، هموم، فرح، دراسة...) وتجيب دائماً بموضوعية وموثوقية مستندة إلى القرآن والسنة الصحيحة.

قواعد الإجابة الإلزامية (مهمة جداً):
1. **الإجابة المختصرة (الافتراضي):** جواب مباشر ومختصر للسؤال. لا تفتح ببسم الله وصلوات طويلة في كل رسالة (يكفي صلاة السلام واحدة نهاية الإجابة إذا كان الجواب عن النبي صلى الله عليه وسلم). اذهب مباشرة للجواب، وتعامل مع المستخدم كصديق (مثل: "أهلاً بك يا أخي..." أو "كل عام وأنت بخير" إذا كان مناسباً).
2. **الإجابة المفصلة (فقط عند الطلب صراحة):** إذا قال المستخدم: "اشرحلي" / "تفصيل" / "مفصل" / "واضح أكتر" / "علي البسط" / "إجابة وافية" – فقط عندها أعطِ شرحاً وافياً بفقرات ونقاط ومواعظ.
3. **الرفيق الحقيقي (أهم قاعدة):**
   - إذا سألك عن هم، أو أتى بكلام يحتاج تعزية أو مساعدة نفسية: كن دافئاً، تعزّ، واعِد، واذكر آيات وأحاديث تريح القلب باختصار ثم ردّ على همّه.
   - إذا قال صباح الخير أو مساء الخير: ردّ عليه بنفس الروح واطرح سؤال صغير لفتح الحديث (مثل: "صباح النور والبركة! كيف حالك اليوم؟").
   - لا تظهر دائماً "عالم جامد" - أظهر إنسانية، وفهم، وتعاطف.
   - تذكّر أشياء تم ذكرها في نفس الدردشة، إشعر المستخدم أنك تسمع جيداً.
4. **التوثيق الدقيق (باختصار):**
   - آية: (اسم السورة: رقم الآية) مثلاً (البقرة: 255) - فقط عند الحاجة ولا تكررها كثيراً.
   - حديث: (صحيح البخاري) أو (رواه مسلم) باختصار.
5. **المنهج الوسطي واليسر:** كن دائماً واسع الصدر، وسهل، ومتسامح. عند الخلاف العلمي اذكر: "عند علماء..." باختصار ولا تقلع في النقاش إلا إذا طلب.
6. **الضابط:** فتوى شخصية نازلة كبرى أو خلاف زوجي حاد أو أمور تحتاج إفتاء رسمي: أوّل الحل بقول مريح ثم اقترح مراجعة عالم ثقة أو دار إفتاء، برفق وتحفيز لا تقاطعة.`;

interface GeminiPart {
  text: string;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

function buildGeminiContents(messages: ChatMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];
  for (const m of messages) {
    if (!m || typeof m.content !== 'string' || !m.content.trim()) continue;
    const role: 'user' | 'model' = m.role === 'assistant' ? 'model' : 'user';
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts.push({ text: '\n' + m.content.trim() });
    } else {
      contents.push({ role, parts: [{ text: m.content.trim() }] });
    }
  }
  if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
    contents.push({ role: 'user', parts: [{ text: 'السلام عليكم' }] });
  }
  return contents;
}

function genTitleFromFirstMessage(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= 30) return clean;
  return clean.slice(0, 28).trimEnd() + '…';
}

function toIso(v: unknown): string {
  if (typeof v === 'string' && v.length > 0) return v;
  if (typeof v === 'number' && Number.isFinite(v)) {
    try { return new Date(v).toISOString(); } catch { /* fallthrough */ }
  }
  return new Date().toISOString();
}

function loadSessions(): ChatSession[] {
  const result = loadState<ChatSession[]>(STORAGE_KEY, []);
  let list: any[] = result;
  if (!Array.isArray(list) && list && typeof list === 'object') {
    list = Object.values(list).filter((v) => v && typeof v === 'object');
  }
  if (!Array.isArray(list)) return [];
  const safe: ChatSession[] = [];
  let needsNormalize = false;
  for (const item of list) {
    if (!item || typeof item !== 'object') { needsNormalize = true; continue; }
    if (typeof item.id !== 'string') { needsNormalize = true; continue; }
    if (typeof item.title !== 'string') { needsNormalize = true; continue; }
    if (!Array.isArray(item.messages)) { needsNormalize = true; continue; }
    if (typeof item.createdAt !== 'string' || typeof item.updatedAt !== 'string') needsNormalize = true;
    const msgs: ChatMessage[] = [];
    for (const m of item.messages) {
      if (
        m &&
        typeof m === 'object' &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string'
      ) {
        msgs.push({ role: m.role, content: m.content });
      }
    }
    safe.push({
      id: item.id,
      title: item.title,
      messages: msgs,
      createdAt: toIso(item.createdAt),
      updatedAt: toIso(item.updatedAt),
    });
  }
  if (needsNormalize || safe.length !== list.length || !Array.isArray(result)) {
    saveState<ChatSession[]>(STORAGE_KEY, safe);
  }
  return safe;
}

function saveSessions(sessions: ChatSession[]) {
  saveState<ChatSession[]>(STORAGE_KEY, sessions);
}

function loadActiveId(): string | null {
  try {
    return localStorage.getItem('tawbah:' + ACTIVE_KEY);
  } catch {
    return null;
  }
}

function saveActiveId(id: string | null) {
  try {
    if (id) localStorage.setItem('tawbah:' + ACTIVE_KEY, id);
    else localStorage.removeItem('tawbah:' + ACTIVE_KEY);
  } catch {
    // ignore
  }
}

export default function AIAssistant() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadSessions());
  const [activeId, setActiveId] = useState<string | null>(() => {
    const saved = loadActiveId();
    const list = loadSessions();
    if (saved && list.find((s) => s.id === saved)) return saved;
    if (list.length > 0) return list[0].id;
    return null;
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    saveActiveId(activeId);
  }, [activeId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sessions, activeId, loading]);

  const activeSession = sessions.find((s) => s.id === activeId) ?? null;
  const messages = activeSession?.messages ?? [];

  const createNewSession = useCallback((): string => {
    const now = new Date().toISOString();
    const ns: ChatSession = {
      id: uuid(),
      title: 'دردشة جديدة',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    setSessions((prev) => [ns, ...prev]);
    setActiveId(ns.id);
    setInput('');
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 50);
    return ns.id;
  }, []);

  const ensureSession = useCallback((): string => {
    if (activeSession && activeSession.messages.length === 0) return activeSession.id;
    return createNewSession();
  }, [activeSession, createNewSession]);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (activeId === id) {
        const newActive = next.length > 0 ? next[0].id : null;
        setActiveId(newActive);
      }
      return next;
    });
  }, [activeId]);

  const upsertSessionMessages = useCallback((sessionId: string, updater: (s: ChatSession) => ChatSession) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? updater({ ...s, updatedAt: new Date().toISOString() }) : s))
    );
  }, []);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    let sessionId = activeId;
    if (!sessionId || !activeSession) {
      sessionId = createNewSession();
      // انتظر حتى يتم إنشاؤها فعلًا في الـ state
      await new Promise((r) => setTimeout(r, 0));
    }
    const currentSessionId = sessionId;

    const userMsg: ChatMessage = { role: 'user', content: trimmed };

    upsertSessionMessages(currentSessionId, (s) => {
      const firstMessage = s.messages.length === 0;
      return {
        ...s,
        title: firstMessage ? genTitleFromFirstMessage(trimmed) : s.title,
        messages: [...s.messages, userMsg],
      };
    });

    setInput('');
    setLoading(true);

    try {
      if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('your-key') || GEMINI_API_KEY.length < 10) {
        throw new Error('مفتاح Gemini غير مهيأ في ملف .env (VITE_GEMINI_API_KEY مفقود أو غير صالح).');
      }

      const currentMessages = [...(activeSession?.messages ?? []), userMsg];
      const contents = buildGeminiContents(currentMessages);
      const geminiBody = {
        contents,
        systemInstruction: {
          role: 'system' as const,
          parts: [{ text: SYSTEM_PROMPT }],
        },
        generationConfig: {
          temperature: 0.65,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 4096,
          responseMimeType: 'text/plain',
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
        ],
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45_000);

      const res = await fetch(`${GEMINI_API_URL}&key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(geminiBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok || !res.body) {
        let errText = '';
        try { errText = await res.text(); } catch { /* ignore */ }
        console.error(`Gemini HTTP ${res.status}:`, errText.slice(0, 500));
        if (res.status === 401 || res.status === 403) {
          throw new Error('مفتاح Gemini غير صالح أو مقيد (401/403).');
        }
        if (res.status === 429) {
          throw new Error('الكثير من الطلبات حالياً. حاول بعد لحظات.');
        }
        if (res.status >= 500) {
          throw new Error('خادم Gemini غير متاح حالياً. حاول لاحقاً.');
        }
        throw new Error(`خطأ في الاتصال بالمساعد (${res.status}).`);
      }

      upsertSessionMessages(currentSessionId, (s) => ({
        ...s,
        messages: [...s.messages, { role: 'assistant', content: '' }],
      }));

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';
      let finishReason: string | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.replace('data: ', '').trim();
            if (!jsonStr) continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const textChunk = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (textChunk) {
                accumulatedText += textChunk;
                upsertSessionMessages(currentSessionId, (s) => {
                  const copy = [...s.messages];
                  if (copy.length > 0) {
                    copy[copy.length - 1] = { role: 'assistant', content: accumulatedText };
                  }
                  return { ...s, messages: copy };
                });
              }
              if (parsed?.candidates?.[0]?.finishReason) {
                finishReason = parsed.candidates[0].finishReason;
              }
            } catch {
              // ignore incomplete JSON chunks
            }
          }
        }
      }

      if (!accumulatedText || !accumulatedText.trim()) {
        if (finishReason && finishReason !== 'STOP') {
          upsertSessionMessages(currentSessionId, (s) => {
            const copy = [...s.messages];
            if (copy.length > 0) {
              copy[copy.length - 1] = {
                role: 'assistant',
                content: 'عذراً، لم أتمكن من توليد رد مناسب. جرّب صياغة أخرى.',
              };
            }
            return { ...s, messages: copy };
          });
          return;
        }
        throw new Error('لم يتم استلام رد نصي من المساعد الذكي.');
      }
    } catch (e) {
      console.error('AI assistant exception:', e);
      let msg: string;
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          msg = 'عذراً، انتهت مهلة الطلب. الرجاء المحاولة مرة أخرى.';
        } else if (e.message && !e.message.startsWith('[object') && !e.message.includes('Unexpected')) {
          msg = `عذراً، حدث خطأ: ${e.message}`;
        } else {
          msg = 'عذراً، تعذّر الاتصال بالمساعد الذكي. تحقق من المفتاح أو حاول مرة أخرى.';
        }
      } else {
        msg = 'عذراً، تعذّر الاتصال بالمساعد الذكي. تحقق من المفتاح أو حاول مرة أخرى.';
      }
      upsertSessionMessages(currentSessionId, (s) => ({
        ...s,
        messages: [...s.messages, { role: 'assistant', content: msg }],
      }));
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [loading, activeId, activeSession, createNewSession, upsertSessionMessages]);

  const sortedSessions = [...sessions].sort((a, b) => {
    const ta = Date.parse(typeof a.updatedAt === 'string' ? a.updatedAt : new Date(Number(a.updatedAt) || Date.now()).toISOString());
    const tb = Date.parse(typeof b.updatedAt === 'string' ? b.updatedAt : new Date(Number(b.updatedAt) || Date.now()).toISOString());
    return Number.isFinite(tb) && Number.isFinite(ta) ? tb - ta : 0;
  });

  return (
    <div className="flex h-[calc(100vh-56px)] lg:h-screen overflow-hidden" dir="rtl">
      {/* Sidebar - Chat Sessions */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-l border-slate-200/80 dark:border-emerald-soft/30 bg-white/60 dark:bg-emerald-deep/60 backdrop-blur-lg">
        <div className="p-3">
          <button
            onClick={createNewSession}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-emerald to-emerald-deep px-3 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald/20 transition hover:shadow-lg active:scale-95 dark:from-gold dark:to-gold-dark dark:text-emerald-deep dark:shadow-gold/20"
          >
            <Plus size={18} />
            دردشة جديدة
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
          {sortedSessions.length === 0 && (
            <div className="px-3 py-10 text-center text-xs text-slate-400 dark:text-slate-500">
              لا توجد دردشات سابقة
              <p className="mt-1">ابدأ دردشتك الأولى مع مساعد توبة</p>
            </div>
          )}
          {sortedSessions.map((s) => {
            const active = s.id === activeId;
            const preview = s.messages.length > 0 ? s.messages[s.messages.length - 1]?.content : 'بدء الدردشة';
            return (
              <div key={s.id} className="group relative">
                <button
                  onClick={() => setActiveId(s.id)}
                  className={`flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-right transition ${
                    active
                      ? 'bg-emerald/10 dark:bg-gold/15 text-emerald-deep dark:text-gold-light'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-emerald-soft/20'
                  }`}
                >
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-emerald/15 dark:bg-gold/20' : 'bg-slate-100 dark:bg-emerald-soft/20'}`}>
                    <MessageSquare size={16} className={active ? 'text-emerald dark:text-gold-light' : 'text-slate-500 dark:text-slate-400'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`truncate text-[13px] font-bold ${active ? '' : ''}`}>{s.title}</p>
                    <p className={`mt-0.5 truncate text-[11px] ${active ? 'text-emerald-deep/70 dark:text-gold/80' : 'text-slate-500 dark:text-slate-400'}`}>
                      {preview}
                    </p>
                  </div>
                  <ChevronRight size={14} className={`mt-1 shrink-0 ${active ? 'text-emerald dark:text-gold-light' : 'text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100'}`} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                  className="absolute top-1.5 left-1.5 z-10 rounded-md p-1 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/40 group-hover:opacity-100"
                  aria-label="حذف الدردشة"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-200/70 dark:border-emerald-soft/30 px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <Sparkles size={14} className="text-emerald dark:text-gold-light" />
            <span>مساعد توبة · رفيقك على الدرب</span>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex flex-1 flex-col bg-slate-50/60 dark:bg-emerald-deep/30">
        {/* Header (mobile: new chat button + title) */}
        <header className="flex items-center justify-between gap-2 border-b border-slate-200/70 dark:border-emerald-soft/30 bg-white/80 dark:bg-emerald-deep/70 backdrop-blur px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald to-emerald-deep text-white shadow-md shadow-emerald/20 dark:from-gold dark:to-gold-dark dark:text-emerald-deep dark:shadow-gold/20">
              <Sparkles size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-extrabold text-slate-800 dark:text-slate-100">
                {activeSession?.title ?? 'مساعد توبة'}
              </h2>
              <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                {messages.length > 0 ? `${messages.length} رسالة` : 'ابدأ دردشة جديدة'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={createNewSession}
              className="md:hidden flex items-center gap-1 rounded-xl bg-emerald/10 dark:bg-gold/15 px-3 py-1.5 text-[11px] font-bold text-emerald dark:text-gold-light transition active:scale-95"
            >
              <Plus size={14} />
              جديد
            </button>
            <button
              onClick={() => {
                if (!activeId) return;
                if (confirm('هل تريد حذف هذه الدردشة؟')) deleteSession(activeId);
              }}
              disabled={!activeId}
              className="flex items-center justify-center rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-30 dark:hover:bg-red-900/40"
              aria-label="حذف الدردشة الحالية"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 md:px-6 md:py-6 space-y-4">
          {messages.length === 0 && (
            <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center gap-6 text-center py-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald/10 to-gold/10 dark:from-gold/15 dark:to-emerald/10 shadow-inner">
                <MessageCircle size={36} className="text-emerald dark:text-gold-light" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">مرحباً بك يا صديقي 👋</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  أنا <span className="font-bold text-emerald dark:text-gold-light">توبة</span>، رفيقك الإسلامي المخلص.
                  اسألني عن أي شيء.. القرآن، السيرة، الأذكار، همومك، نصائح، أو حتى كلمني عشان تريح بالك 💚
                </p>
              </div>
              <div className="grid w-full grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="group flex items-center justify-between gap-2 rounded-2xl border border-slate-200 dark:border-emerald-soft/30 bg-white dark:bg-emerald-deep/50 px-4 py-3 text-right text-[13px] font-semibold text-slate-700 dark:text-slate-200 transition hover:border-emerald/50 hover:bg-emerald/5 dark:hover:border-gold/40 dark:hover:bg-gold/10"
                  >
                    <span>{s}</span>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald dark:group-hover:text-gold-light" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-emerald to-emerald-deep text-white'
                  : 'bg-gradient-to-br from-gold/20 to-emerald/20 text-emerald dark:text-gold-light ring-1 ring-emerald/20 dark:ring-gold/20'
              }`}>
                {msg.role === 'user' ? <User size={15} /> : <Bot size={15} />}
              </div>
              <div className={`max-w-[85%] md:max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-emerald to-emerald-deep text-white rounded-tr-sm'
                  : 'bg-white dark:bg-emerald-deep/60 text-slate-800 dark:text-slate-100 rounded-tl-sm border border-slate-200/60 dark:border-emerald-soft/20'
              }`}>
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div dir="rtl" className="markdown-body">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>,
                        h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-3 text-emerald dark:text-gold-light">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3 text-emerald dark:text-gold-light">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-bold mb-1.5 mt-2.5 text-emerald-deep dark:text-gold">{children}</h3>,
                        h4: ({ children }) => <h4 className="text-sm font-bold mb-1 mt-2 text-emerald-deep dark:text-gold">{children}</h4>,
                        strong: ({ children }) => <strong className="font-bold text-emerald-deep dark:text-gold">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                        ul: ({ children }) => <ul className="list-disc mr-6 mb-2 space-y-1 marker:text-emerald dark:marker:text-gold">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal mr-6 mb-2 space-y-1 marker:text-emerald dark:marker:text-gold">{children}</ol>,
                        li: ({ children }) => <li className="text-sm pr-1">{children}</li>,
                        blockquote: ({ children }) => <blockquote className="border-r-4 border-emerald dark:border-gold pr-3 italic text-slate-600 dark:text-slate-300 my-2 mr-1">{children}</blockquote>,
                        code: ({ children }) => <code className="bg-slate-100 dark:bg-emerald-deep/70 rounded px-1.5 py-0.5 text-xs">{children}</code>,
                        pre: ({ children }) => <pre className="bg-slate-100 dark:bg-emerald-deep/70 rounded-lg p-2 text-xs overflow-x-auto my-2">{children}</pre>,
                        a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="underline text-emerald dark:text-gold-light hover:opacity-80">{children}</a>,
                        hr: () => <hr className="my-3 border-slate-300/60 dark:border-emerald-soft/40" />,
                      }}
                    >
                      {msg.content || ''}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold/20 to-emerald/20 text-emerald dark:text-gold-light ring-1 ring-emerald/20 dark:ring-gold/20 shadow-sm">
                <Bot size={15} />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-white dark:bg-emerald-deep/60 border border-slate-200/60 dark:border-emerald-soft/20 px-4 py-3 shadow-sm">
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  جاري التفكير
                  <span className="inline-flex w-6 text-right justify-start mr-0.5">
                    <span className="animate-pulse">.</span>
                    <span className="animate-pulse" style={{ animationDelay: '150ms' }}>.</span>
                    <span className="animate-pulse" style={{ animationDelay: '300ms' }}>.</span>
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-slate-200/70 dark:border-emerald-soft/30 bg-white/80 dark:bg-emerald-deep/70 backdrop-blur p-3 md:p-4">
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="mx-auto flex max-w-3xl items-end gap-2"
          >
            <div className="flex-1">
              <textarea
                ref={inputRef as any}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder="اكتب رسالتك هنا... (Enter للإرسال، Shift+Enter للسطر الجديد)"
                className="w-full resize-none rounded-2xl border border-slate-200 dark:border-emerald-soft/40 bg-slate-50 dark:bg-emerald-deep/40 px-4 py-3 text-[13.5px] leading-relaxed text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-emerald focus:outline-none focus:ring-4 focus:ring-emerald/15 dark:focus:border-gold dark:focus:ring-gold/20 disabled:opacity-50"
                disabled={loading}
                style={{ minHeight: '48px', maxHeight: '160px' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald to-emerald-deep text-white shadow-lg shadow-emerald/30 transition hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 dark:from-gold dark:to-gold-dark dark:text-emerald-deep dark:shadow-gold/25"
              aria-label="إرسال"
            >
              <Send size={19} className="rotate-180" />
            </button>
          </form>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-slate-400 dark:text-slate-500">
            قد تحتاج الإجابات للمراجعة. اعتمد على العلماء الثقات في المسائل الفقهية الكبرى.
          </p>
        </div>
      </main>
    </div>
  );
}
