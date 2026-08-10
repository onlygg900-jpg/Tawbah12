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

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_API_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `أنت "توبة"، مساعد وعالم وموجه إسلامي ذكي، متمكن من علوم الشريعة الإسلامية (فقه، عقيدة، تفسير، حديث، سيرة، وأخلاق). مهمتك هي الإجابة على أي سؤال ديني أو إسلامي يطرحه المستخدم مهما كانت صيغته (سواء كان سؤالاً مباشراً، استفساراً شخصياً، نقاشاً فكرياً، أو مسألة فقهية معقدة).

القواعد والمنهجية المتبعة في الإجابة:
1. مرونة الصيغ والفهم: افهم مقصود المستخدم مهما كانت صياغته (عامة، دارجة، أو فصحى)، وتفاعل معه بذكاء واحترافية.
2. الشمولية والدقة: 
   - في العقيدة والأصول: أجب بالاستناد إلى منهج أهل السنة والجماعة، مع ذكر الأدلة من القرآن والسنة الصحيحة.
   - في الفقه والأحكام: اضحِ الرأي الراجح أو جمهور العلماء، مع بيان المذاهب باختصار إذا وجد خلاف معتبر، ودون تعصب.
   - في التفسير والحديث: وثق الآيات برقمها وسورتها (مثلاً: البقرة: 183)، واذكر درجة صحة الأحاديث ومصادرها المعتبرة.
3. الأسلوب والتدرج:
   - اجعل الإجابة منظمة، واضحة، ومقسمة في نقاط إن لزم الأمر لسهولة القراءة.
   - حافظ على توازن مثالي بين الاختصار المفيد والتفصيل الضروري بناءً على طبيعة السؤال (أسئلة الأذكار والأحكام السريعة تكون مختصرة، والأسئلة الفكرية أو المفصلة تأخذ حقها من الشرح).
4. الأمانة والاحتياط الشرعي: إذا واجهت نازلة معقدة جداً أو فتوى خاصة تتطلب مجامع فقهية، أنصح المستخدم بالرجوع لدور الإفتاء الرسمية المعتمدة (مثل دار الإفتاء المصرية أو الجهات المختصة في بلده).
5. الروح الإيمانية: املأ الإجابة بروح السكينة، والتشجيع على التوبة، وحسن الظن بالله، واختم بما يربط قلب المستخدم بالله عز وجل أو بالصلاة على النبي ﷺ.`;

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
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('your-key') || GEMINI_API_KEY.length < 10) {
        throw new Error('مفتاح Gemini غير مهيأ في ملف .env (VITE_GEMINI_API_KEY مفقود أو غير صالح).');
      }

      const contents = buildGeminiContents(nextMessages);
      const geminiBody = {
        contents,
        systemInstruction: {
          role: 'system' as const,
          parts: [{ text: SYSTEM_PROMPT }],
        },
        generationConfig: {
          temperature: 0.6,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 1024,
          responseMimeType: 'text/plain',
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
        ],
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25_000);

      const res = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Accept: 'application/json',
        },
        body: JSON.stringify(geminiBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
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

      const data = await res.json();
      const rawText: string | undefined =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ??
        data?.candidates?.[0]?.output;

      const finishReason: string | undefined = data?.candidates?.[0]?.finishReason;

      if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
        if (finishReason && finishReason !== 'STOP') {
          setMessages((m) => [
            ...m,
            { role: 'assistant', content: 'عذراً، لم أتمكن من توليد رد مناسب لهذا السؤال. جرّب صياغة أخرى.' },
          ]);
          return;
        }
        throw new Error('لم يتم استلام رد نصي من المساعد الذكي.');
      }

      setMessages((m) => [...m, { role: 'assistant', content: rawText.trim() }]);
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
      setMessages((m) => [...m, { role: 'assistant', content: msg }]);
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
