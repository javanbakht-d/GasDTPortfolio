/**
 * لایه یکپارچه اتصال به مدل زبانی — برای دستیار هوشمند دبیرخانه
 *
 * ریشه مشکل تولید (gasdt.vercel.app): پکیج z-ai-web-dev-sdk پیکربندی را فقط از
 * فایل .z-ai-config (مسیر پروژه/خانه//etc) می‌خواند؛ این فایل روی Vercel وجود
 * ندارد و نباید کلید آن را در مخزن گیت ذخیره کرد. در نتیجه ZAI.create() خطا
 * می‌دهد و سامانه پیام «اتصال به مدل زبانی در دسترس نیست» نشان می‌دهد.
 *
 * راه‌حل: کلاس client مستقل که به این ترتیب پیکربندی را پیدا می‌کند:
 *  1) متغیرهای محیطی عمومی OpenAI-Compatible:  AI_BASE_URL + AI_API_KEY (+ AI_MODEL)
 *     — با هر سرویس سازگار با OpenAI (OpenRouter، Z.ai API عمومی، Gemini
 *     OpenAI-compat، Ollama و …) کار می‌کند. پیشنهادی برای تولید.
 *  2) متغیرهای محیطی سبک Z.ai:  ZAI_BASE_URL + ZAI_API_KEY + ZAI_TOKEN
 *     (+ ZAI_CHAT_ID + ZAI_USER_ID) — همان امضای فایل .z-ai-config.
 *     یا به‌صورت یکجا: ZAI_CONFIG_JSON (کل JSON فایل پیکربندی).
 *  3) فایل .z-ai-config از طریق SDK (محیط سندباکس — بدون تغییر رفتار قبلی).
 *
 * کلید/توکن هرگز در کد یا مخزن ذخیره نمی‌شود؛ فقط از env خوانده می‌شود.
 */

export type ChatMessage = { role: string; content: string };

export type ChatCompletionResult = {
  choices?: { message?: { content?: string } }[];
};

type ChatCreateBody = {
  messages: ChatMessage[];
  thinking?: { type: string };
};

export type ZaiClient = {
  /** حالت فعال پیکربندی — برای پیام راهنمای راهبر */
  mode: "env-openai" | "env-zai" | "file-config";
  chat: {
    completions: {
      create: (body: ChatCreateBody) => Promise<ChatCompletionResult>;
    };
  };
};

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** کلاینت عمومی سازگار با OpenAI (Bearer auth) */
function openAiCompatibleClient(baseUrl: string, apiKey: string, model?: string): ZaiClient {
  return {
    mode: "env-openai",
    chat: {
      completions: {
        create: async (body) => {
          const payload: Record<string, unknown> = {
            messages: body.messages,
            // برخی سرویس‌ها پارامتر ناشناخته را ۴۰۰ می‌کنند — فقط در صورت فعال‌سازی صریح
            ...(process.env.AI_THINKING === "true" ? { thinking: body.thinking ?? { type: "disabled" } } : {}),
            ...(model ? { model } : {}),
          };
          const res = await fetch(`${trimSlash(baseUrl)}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const errText = (await res.text()).slice(0, 300);
            throw new Error(`AI provider ${res.status}: ${errText}`);
          }
          return (await res.json()) as ChatCompletionResult;
        },
      },
    },
  };
}

/** کلاینت با امضای پلتفرم Z.ai (هدرهای اختصاصی X-Token و thinking پیش‌فرض) */
function zaiPlatformClient(
  baseUrl: string,
  apiKey: string,
  extra: { chatId?: string; userId?: string; token?: string },
): ZaiClient {
  return {
    mode: "env-zai",
    chat: {
      completions: {
        create: async (body) => {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "X-Z-AI-From": "Z",
          };
          if (extra.chatId) headers["X-Chat-Id"] = extra.chatId;
          if (extra.userId) headers["X-User-Id"] = extra.userId;
          if (extra.token) headers["X-Token"] = extra.token;
          const res = await fetch(`${trimSlash(baseUrl)}/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify({ ...body, thinking: body.thinking ?? { type: "disabled" } }),
          });
          if (!res.ok) {
            const errText = (await res.text()).slice(0, 300);
            throw new Error(`ZAI API ${res.status}: ${errText}`);
          }
          return (await res.json()) as ChatCompletionResult;
        },
      },
    },
  };
}

/** کدام حالت env پیکربندی شده؟ (بدون فراخوانی شبکه) */
export function zaiEnvMode(): "env-openai" | "env-zai" | "none" {
  if (process.env.AI_BASE_URL && process.env.AI_API_KEY) return "env-openai";
  if (process.env.ZAI_CONFIG_JSON) return "env-zai";
  if (process.env.ZAI_BASE_URL && process.env.ZAI_API_KEY) return "env-zai";
  return "none";
}

/** متن راهنمای دقیق برای راهبر سامانه — فقط برای نقش‌های مدیریتی نمایش داده می‌شود */
export function zaiSetupHint(): string {
  const mode = zaiEnvMode();
  if (mode !== "none") return "";
  return (
    "راهنمای راهبر: روی استقرار فعلی هیچ متغیر محیطی اتصال مدل تنظیم نشده است. " +
    "در Vercel → Settings → Environment Variables دو متغیر AI_BASE_URL و AI_API_KEY " +
    "(سرویس سازگار با OpenAI) را ثبت و سپس Redeploy کنید. جزئیات کامل در docs/ai-model-setup.md."
  );
}

/** کلاینت آماده استفاده — ترتیب اولویت: env عمومی → env سبک Z.ai → فایل SDK (سندباکس) */
export async function getZaiClient(): Promise<ZaiClient> {
  // ۱) OpenAI-compatible عمومی — پیشنهادی برای تولید
  if (process.env.AI_BASE_URL && process.env.AI_API_KEY) {
    return openAiCompatibleClient(process.env.AI_BASE_URL, process.env.AI_API_KEY, process.env.AI_MODEL || undefined);
  }

  // ۲) پیکربندی سبک Z.ai از طریق env (یکجا یا تفکیکی)
  if (process.env.ZAI_CONFIG_JSON) {
    try {
      const c = JSON.parse(process.env.ZAI_CONFIG_JSON) as {
        baseUrl?: string; apiKey?: string; chatId?: string; userId?: string; token?: string;
      };
      if (c.baseUrl && c.apiKey) return zaiPlatformClient(c.baseUrl, c.apiKey, { chatId: c.chatId, userId: c.userId, token: c.token });
    } catch {
      // JSON نامعتبر → ادامه به حالت بعدی
    }
  }
  if (process.env.ZAI_BASE_URL && process.env.ZAI_API_KEY) {
    return zaiPlatformClient(process.env.ZAI_BASE_URL, process.env.ZAI_API_KEY, {
      chatId: process.env.ZAI_CHAT_ID || undefined,
      userId: process.env.ZAI_USER_ID || undefined,
      token: process.env.ZAI_TOKEN || undefined,
    });
  }

  // ۳) فایل .z-ai-config از طریق SDK — محیط سندباکس
  const { default: ZAI } = await import("z-ai-web-dev-sdk");
  const sdk = await ZAI.create();
  return {
    mode: "file-config",
    chat: {
      completions: {
        create: async (body) =>
          (await sdk.chat.completions.create({
            messages: body.messages as never,
            thinking: body.thinking ?? { type: "disabled" },
          } as never)) as ChatCompletionResult,
      },
    },
  };
}
