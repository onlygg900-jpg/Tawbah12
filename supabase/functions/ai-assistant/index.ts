import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// CONSTANTS
// ============================================================================
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, Accept, Accept-Language",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

const GEMINI_MODEL = "gemini-1.5-flash";
const GEMINI_API_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `أنت "توبة"، مساعد ذكي إسلامي ودود ومحترم ومختصر. تجيب على الأسئلة الإسلامية والعامة باللغة العربية وبأسلوب لطيف مبسط.

قواعد الإجابة:
1. اجب بالعربية دائماً.
2. كن مختصراً (3-5 أسطر عادة) إلا إذا طلب المستخدم التفصيل.
3. عند الاستشهاد بآية قرآنية اذكر رقم السورة والآية بين قوسين.
4. عند ذكر حديث اذكر المصدر (صحيح البخاري، مسلم، إلخ) إن كنت متأكداً.
5. إذا لم تكن متأكداً من إجابة شرعية: قل ذلك صراحة، واقترح مراجعة عالم متخصص أو مرجع موثوق.
6. لا تفتي في مسائل فقهية خلافية؛ أحل المستخدم لمراجعها.
7. شجع المستخدم دائماً على الطاعات والتوبة والأعمال الصالحة.
8. تجنب المحتوى الضار أو المسيء أو المتعارض مع الشريعة الإسلامية.`;

// ============================================================================
// HELPERS
// ============================================================================

/** Always return HTTP 200 with JSON body so supabase.functions.invoke()
 *  does NOT throw generic "non-2xx status code". Frontend checks both
 *  `error` (functions error) and `data?.error` (embedded JSON error).  */
function jsonResponse(body: unknown, _status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...CORS_HEADERS, ...extraHeaders },
  });
}

/** Lightweight auth check. Since we deploy with --no-verify-jwt, we only
 *  verify that the caller passes SOME form of supabase-originated header
 *  (anon key or bearer token) — the platform itself already gates access. */
function isAuthPlausible(req: Request): boolean {
  const authHeader = req.headers.get("Authorization") ?? "";
  const apiKeyHeader = req.headers.get("Apikey") ?? "";
  if (authHeader.toLowerCase().startsWith("bearer ")) return true;
  if (apiKeyHeader && apiKeyHeader.length > 8) return true;
  // When running completely locally / with no env configured at all, allow.
  const allEmpty =
    !Deno.env.get("SUPABASE_URL") &&
    !Deno.env.get("SUPABASE_ANON_KEY") &&
    !Deno.env.get("GEMINI_API_KEY");
  if (allEmpty) return true;
  return false;
}

interface ChatMessage {
  role: "user" | "assistant" | "model";
  content: string;
}

interface GeminiPart {
  text: string;
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

function buildGeminiContents(messages: ChatMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];
  for (const m of messages) {
    if (!m || typeof m.content !== "string" || !m.content.trim()) continue;
    const role: "user" | "model" =
      m.role === "assistant" || m.role === "model" ? "model" : "user";
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts.push({ text: "\n" + m.content.trim() });
    } else {
      contents.push({ role, parts: [{ text: m.content.trim() }] });
    }
  }
  if (contents.length === 0 || contents[contents.length - 1].role !== "user") {
    contents.push({ role: "user", parts: [{ text: "السلام عليكم" }] });
  }
  return contents;
}

// ============================================================================
// MAIN
// ============================================================================

// Boot-time diagnostics (visible in edge function logs only; no secrets echoed)
console.log("[ai-assistant] boot");
console.log("[ai-assistant] SUPABASE_URL set:", !!Deno.env.get("SUPABASE_URL"));
console.log("[ai-assistant] SUPABASE_ANON_KEY set:", !!Deno.env.get("SUPABASE_ANON_KEY"));
const rawGem = Deno.env.get("GEMINI_API_KEY");
console.log(
  "[ai-assistant] GEMINI_API_KEY set:",
  !!rawGem,
  "- length:",
  rawGem ? rawGem.length : 0,
  "- looks placeholder:",
  rawGem ? rawGem.includes("your-key") || rawGem.length < 10 : "N/A",
);

Deno.serve(async (req: Request) => {
  try {
    // --- 1. CORS preflight FIRST ------------------------------------------
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // --- 2. Method validation ---------------------------------------------
    if (req.method !== "POST") {
      return jsonResponse(
        { error: `الطلب غير مدعوم: ${req.method}. استخدم POST.` },
        405,
      );
    }

    // --- 3. Lightweight auth ----------------------------------------------
    // (We deploy with --no-verify-jwt; platform already gates invocations.)
    if (!isAuthPlausible(req)) {
      console.warn("[ai-assistant] implausible auth; headers:", Object.fromEntries(req.headers));
      return jsonResponse(
        { error: "غير مصرح: الرجاء تسجيل الدخول لاستخدام المساعد." },
        401,
      );
    }

    // --- 4. Parse body ----------------------------------------------------
    let messages: ChatMessage[] = [];
    try {
      const contentType = req.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        return jsonResponse(
          { error: "الرجاء إرسال الطلب بصيغة JSON." },
          400,
        );
      }
      const body = await req.json();
      if (!body || !Array.isArray(body.messages)) {
        return jsonResponse(
          { error: "الطلب يجب أن يحتوي حقل messages كمصفوفة." },
          400,
        );
      }
      messages = body.messages as ChatMessage[];
      if (messages.length === 0) {
        return jsonResponse(
          { error: "لا توجد رسائل. الرجاء إرسال سؤال على الأقل." },
          400,
        );
      }
    } catch (err) {
      console.error("[ai-assistant] JSON parse error:", err);
      return jsonResponse(
        { error: "هيكل الطلب غير صالح (JSON غير صحيح)." },
        400,
      );
    }

    // --- 5. Gemini key ----------------------------------------------------
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey || geminiKey.includes("your-key") || geminiKey.length < 10) {
      console.error("[ai-assistant] GEMINI_API_KEY missing or looks like placeholder");
      return jsonResponse(
        { error: "لم يتم إعداد المساعد الذكي بعد (مفتاح Gemini مفقود في Secrets)." },
        500,
      );
    }

    // --- 6. Build Gemini payload ------------------------------------------
    const contents = buildGeminiContents(messages);
    const geminiBody = {
      contents,
      systemInstruction: {
        role: "system" as const,
        parts: [{ text: SYSTEM_PROMPT }],
      },
      generationConfig: {
        temperature: 0.6,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 1024,
        responseMimeType: "text/plain",
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_LOW_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_LOW_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_LOW_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_LOW_AND_ABOVE" },
      ],
    };

    // --- 7. Call Gemini with timeout --------------------------------------
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25_000);

      const res = await fetch(`${GEMINI_API_URL}?key=${geminiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Accept": "application/json",
          "x-goog-api-client": "tawbah-edge/1.0",
        },
        body: JSON.stringify(geminiBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        let errText = "";
        try {
          errText = await res.text();
        } catch { /* ignore */ }
        console.error(`[ai-assistant] Gemini HTTP ${res.status}:`, errText.slice(0, 500));

        if (res.status === 401 || res.status === 403) {
          return jsonResponse(
            { error: "خطأ في إعدادات المساعد (مفتاح Gemini غير صالح أو مقيد)." },
            502,
          );
        }
        if (res.status === 429) {
          return jsonResponse(
            { error: "الكثير من الطلبات حالياً. الرجاء المحاولة بعد لحظات." },
            503,
          );
        }
        if (res.status >= 500) {
          return jsonResponse(
            { error: "خادم المساعد الذكي غير متاح حالياً. حاول لاحقاً." },
            502,
          );
        }
        return jsonResponse(
          { error: `تعذّر الحصول على رد من المساعد: (${res.status})` },
          502,
        );
      }

      // --- 8. Parse Gemini response ---------------------------------------
      const data = await res.json();
      const rawText: string | undefined =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ??
        data?.candidates?.[0]?.output;

      const finishReason: string | undefined = data?.candidates?.[0]?.finishReason;
      const safetyRatings = data?.candidates?.[0]?.safetyRatings;
      void safetyRatings;

      if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
        if (finishReason && finishReason !== "STOP") {
          console.warn("[ai-assistant] Gemini finishReason =", finishReason);
          return jsonResponse(
            { reply: "عذراً، لم أتمكن من توليد رد مناسب لهذا السؤال. جرّب صياغة أخرى." },
            200,
          );
        }
        return jsonResponse(
          { error: "لم يتم استلام رد نصي من المساعد الذكي." },
          502,
        );
      }

      return jsonResponse({ reply: rawText.trim() }, 200);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return jsonResponse(
          { error: "انتهت مهلة الطلب. الرجاء المحاولة مرة أخرى." },
          504,
        );
      }
      console.error("[ai-assistant] Gemini fetch/call error:", err);
      return jsonResponse(
        { error: "حدث خطأ غير متوقع أثناء الاتصال بالمساعد الذكي." },
        500,
      );
    }
  } catch (outer) {
    // Final safety net: NEVER let an unhandled exception bubble into a 500
    // from deno/supabase, because that becomes "non-2xx status code".
    console.error("[ai-assistant] UNHANDLED outer error:", outer);
    return jsonResponse(
      { error: "حدث خطأ داخلي في المساعد الذكي. الرجاء المحاولة لاحقاً." },
      500,
    );
  }
});
