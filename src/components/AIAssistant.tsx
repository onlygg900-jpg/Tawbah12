import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

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
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`;

const SYSTEM_PROMPT = `أنت "توبة"، عالم وموجّه إسلامي مختصر ومباشر متخصص في جميع العلوم الشرعية (العقيدة، التفسير، الحديث الشريف، الفقه الميسر، والسيرة النبوية). مهمتك هي تقديم إجابات دقيقة وموثوقة تماماً، مستندة حصرياً إلى القرآن الكريم والسنة النبوية الصحيحة، وفقاً لمنهج أهل السنة والجماعة.

قواعد الإجابة الإلزامية (مهمة جداً):
1. **الإجابة المختصرة (الافتراضي):** رد مباشر ومختصر جواب السؤال فقط بلا مقدمات طويلة أو بسم الله مكرر أو صلوات طويلة في كل رسالة. لا تفتح إلا بتحية قصيرة إذا لزم، واذهب مباشرة للجواب. اكفِ بذكر الدليل أو الآية باختصار (مثال: [البقرة:255]) بدون إطالة.
2. **الإجابة المفصلة (فقط عند الطلب صراحة):** إذا قال المستخدم كلمات مثل: "اشرحلي"، "تفصيل"، "مفصل"، "واضح"، "إجابة وافية"، "علي البسط" – فقط عندها أعطِ إجابة وافية ومفصلة بفقرات ونقاط.
3. **التوثيق الدقيق (باختصار):** عند الاستشهاد اذكر المصدر باختصار فقط:
   - آية: اذكر اسم السورة ورقمها بين أقواس مثل (البقرة: 255) وآخرها آية كاملة إذا كانت قصيرة.
   - حديث: اذكر المصدر المختصر مثل (صحيح مسلم) أو (أخرجه البخاري).
4. **المنهج الوسطي واليسر:** قدم الأحكام بأسلوب يسر. عند وجود خلاف فقهي معتدل بذكر الاختلاف باختصار جداً إلا إذا طلب التفصيل.
5. **الأسلوب:** لغة عربية فصحى مبسطة، دافئة، ودون مواعظ أو وعظات لا علاقة لها بالسؤال إلا إذا طلبها المستخدم.
6. **الضابط:** إذا السؤال فتوى خاصة أو نازلة كبرى تحتاج تخصص، وجّه السائل بحكمة لمراجعة علم ثقة أو دار إفتاء، باختصار.

مثال لرد صحيح مختصر:
س: متى ولد رسول الله صلى الله عليه وسلم؟
ج: ولد النبي صلى الله عليه وسلم يوم الإثنين في شهر ربيع الأول عام الفيل (حوالي سنة 571م). المتداول بين المؤرخين 12 ربيع الأول، والراجح عند بعض المحققين 9 ربيع الأول، وكلاهما صحيح السنة. دليل أنّه ولد يوم الإثنين: حديث صحيح مسلم (1162).

ثَمَّ إن قال المستخدم "اشرحلي أكتر" أو "تفصيل" – اكتب الشرح المفصل.`;

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
          maxOutputTokens: 4096,
          responseMimeType: 'text/markdown',
        },
safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' }
        ],
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25_000);

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

      setMessages((m) => [...m, { role: 'assistant', content: '' }]);

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
                setMessages((m) => {
                  const copy = [...m];
                  copy[copy.length - 1] = { role: 'assistant', content: accumulatedText };
                  return copy;
                });
              }
              if (parsed?.candidates?.[0]?.finishReason) {
                finishReason = parsed.candidates[0].finishReason;
              }
            } catch {
              // تجاهل أخطاء تحليل أجزاء الـ JSON غير الكاملة أثناء التدفق
            }
          }
        }
      }

      if (!accumulatedText || !accumulatedText.trim()) {
        if (finishReason && finishReason !== 'STOP') {
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = {
              role: 'assistant',
              content: 'عذراً، لم أتمكن من توليد رد مناسب لهذا السؤال. جرّب صياغة أخرى.',
            };
            return copy;
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
                      : 'bg-slate-100 dark:bg-emerald-soft/30 text-slate-800 dark:text-slate-100 rounded-br-sm markdown-content'
                  }`}
                >
                  {msg.role === 'user' ? (
                    msg.content
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
                          code: ({ children }) => <code className="bg-slate-200 dark:bg-emerald-deep/60 rounded px-1.5 py-0.5 text-xs">{children}</code>,
                          pre: ({ children }) => <pre className="bg-slate-200 dark:bg-emerald-deep/60 rounded p-2 text-xs overflow-x-auto my-2">{children}</pre>,
                          a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="underline text-emerald dark:text-gold-light hover:opacity-80">{children}</a>,
                          hr: () => <hr className="my-3 border-slate-300 dark:border-emerald-soft/50" />,
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
              <div className="flex justify-end">
                <div className="rounded-2xl bg-slate-100 dark:bg-emerald-soft/30 px-4 py-3">
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    جاري التفكير
                    <span className="inline-flex w-6 text-left">
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
