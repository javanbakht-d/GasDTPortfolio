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
 *     OpenAI-compat، Ollama و …) کار می‌کند. پیشنهادی بلندمدت برای تولید.
 *  2) رله سندباکس: LLM_PROXY_URL + LLM_PROXY_KEY — تولید از مسیر امن
 *     /api/ai/relay روی فضای سندباکس (که فایل پیکربندی را دارد) مدل می‌گیرد.
 *     پیش‌فرض فعال «پارت اول» — بدون نیاز به ثبت‌نام از سرویس بیرونی.
 *  3) متغیرهای محیطی سبک Z.ai:  ZAI_BASE_URL + ZAI_API_KEY + ZAI_TOKEN
 *     (+ ZAI_CHAT_ID + ZAI_USER_ID) — همان امضای فایل .z-ai-config.
 *     یا به‌صورت یکجا: ZAI_CONFIG_JSON (کل JSON فایل پیکربندی).
 *  4) فایل .z-ai-config از طریق SDK (محیط سندباکس — بدون تغییر رفتار قبلی).
 *
 * کلید/توکن هرگز در کد یا مخزن ذخیره نمی‌شود؛ فقط از env خوانده می‌شود.
 */

import fs from "fs/promises";
import path from "path";
import os from "os";

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
  mode: "env-openai" | "env-relay" | "env-zai" | "file-config";
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

/** کلاینت رله سندباکس — OpenAI-compatible روی مسیر امن /api/ai/relay */
function relayClient(proxyUrl: string, proxyKey: string): ZaiClient {
  return {
    mode: "env-relay",
    chat: {
      completions: {
        create: async (body) => {
          const res = await fetch(trimSlash(proxyUrl), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${proxyKey}`,
            },
            body: JSON.stringify({ messages: body.messages, thinking: body.thinking ?? { type: "disabled" } }),
          });
          if (!res.ok) {
            const errText = (await res.text()).slice(0, 300);
            throw new Error(`LLM relay ${res.status}: ${errText}`);
          }
          return (await res.json()) as ChatCompletionResult;
        },
      },
    },
  };
}

/** کدام حالت env پیکربندی شده؟ (بدون فراخوانی شبکه — ترتیب: عمومی → مستقیم → رله) */
export function zaiEnvMode(): "env-openai" | "env-relay" | "env-zai" | "none" {
  if (process.env.AI_BASE_URL && process.env.AI_API_KEY) return "env-openai";
  if (process.env.ZAI_CONFIG_JSON) return "env-zai";
  if (process.env.ZAI_BASE_URL && process.env.ZAI_API_KEY) return "env-zai";
  if (process.env.LLM_PROXY_URL && process.env.LLM_PROXY_KEY) return "env-relay";
  return "none";
}

/** تشخیص کامل حالت پیکربندی شامل فایل SDK (برای پایش و پیام راهنما) */
export async function zaiConfigMode(): Promise<"env-openai" | "env-relay" | "env-zai" | "file-config" | "none"> {
  const envMode = zaiEnvMode();
  if (envMode !== "none") return envMode;
  const candidates = [path.join(process.cwd(), ".z-ai-config"), path.join(os.homedir(), ".z-ai-config"), "/etc/.z-ai-config"];
  for (const p of candidates) {
    try {
      const c = JSON.parse(await fs.readFile(p, "utf-8")) as { baseUrl?: string; apiKey?: string };
      if (c.baseUrl && c.apiKey) return "file-config";
    } catch { /* فایل بعدی */ }
  }
  return "none";
}

/** متن راهنمای دقیق برای راهبر سامانه — فقط برای نقش‌های مدیریتی نمایش داده می‌شود */
export async function zaiSetupHint(): Promise<string> {
  const mode = await zaiConfigMode();
  if (mode !== "none") return "";
  return (
    "راهنمای راهبر: روی استقرار فعلی هیچ متغیر محیطی اتصال مدل تنظیم نشده است. " +
    "سریع‌ترین راه: متغیرهای LLM_PROXY_URL و LLM_PROXY_KEY (رله سندباکس — مقادیر آماده در vercel.json مخزن) یا AI_BASE_URL و AI_API_KEY (هر سرویس سازگار با OpenAI) را در Vercel → Settings → Environment Variables ثبت و Redeploy کنید. جزئیات کامل در docs/ai-model-setup.md."
  );
}

/** کلاینت آماده استفاده — نخستین منبع پیکربندی‌شده به ترتیب اولویت */
export async function getZaiClient(): Promise<ZaiClient> {
  const sources = await configuredSources();
  if (!sources.length) throw new Error("هیچ منبع اتصال به مدل زبانی پیکربندی نشده است (راهنما: docs/ai-model-setup.md)");
  return sources[0];
}

/** منابع پیکربندی‌شده به ترتیب اولویت: عمومی OpenAI → مستقیم Z.ai → رله سندباکس → فایل SDK */
async function configuredSources(): Promise<ZaiClient[]> {
  const sources: ZaiClient[] = [];

  // ۱) OpenAI-compatible عمومی — استقلال کامل (پیشنهاد بلندمدت)
  if (process.env.AI_BASE_URL && process.env.AI_API_KEY) {
    sources.push(openAiCompatibleClient(process.env.AI_BASE_URL, process.env.AI_API_KEY, process.env.AI_MODEL || undefined));
  }

  // ۲) پیکربندی مستقیم Z.ai از طریق env — بدون وابستگی به سندباکس
  if (process.env.ZAI_CONFIG_JSON) {
    try {
      const c = JSON.parse(process.env.ZAI_CONFIG_JSON) as {
        baseUrl?: string; apiKey?: string; chatId?: string; userId?: string; token?: string;
      };
      if (c.baseUrl && c.apiKey) sources.push(zaiPlatformClient(c.baseUrl, c.apiKey, { chatId: c.chatId, userId: c.userId, token: c.token }));
    } catch {
      // JSON نامعتبر → منبع بعدی
    }
  }
  if (process.env.ZAI_BASE_URL && process.env.ZAI_API_KEY) {
    sources.push(zaiPlatformClient(process.env.ZAI_BASE_URL, process.env.ZAI_API_KEY, {
      chatId: process.env.ZAI_CHAT_ID || undefined,
      userId: process.env.ZAI_USER_ID || undefined,
      token: process.env.ZAI_TOKEN || undefined,
    }));
  }

  // ۳) رله سندباکس — پیش‌فرض فعال «پارت اول»
  if (process.env.LLM_PROXY_URL && process.env.LLM_PROXY_KEY) {
    sources.push(relayClient(process.env.LLM_PROXY_URL, process.env.LLM_PROXY_KEY));
  }

  // ۴) فایل .z-ai-config از طریق SDK — محیط سندباکس
  if (await zaiConfigMode() === "file-config") {
    const { default: ZAI } = await import("z-ai-web-dev-sdk");
    const sdk = await ZAI.create();
    sources.push({
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
    });
  }

  return sources;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`مهلت ${Math.round(ms / 1000)} ثانیه‌ای منبع اتصال تمام شد`)), ms)),
  ]);
}

/** حافظه منبع موفق اخیر — برای اولویت‌دهی در فراخوانی بعدی */
let preferredMode: ZaiClient["mode"] | null = null;

/**
 * فراخوانی تکمیل چت با زنجیره fallback — منابع را به ترتیب اولویت امتحان می‌کند
 * و نخستین پاسخ موفق را برمی‌گرداند. منبع موفق برای فراخوانی‌های بعدی در اولویت می‌نشیند.
 */
export async function chatWithFallback(body: ChatCreateBody): Promise<{ result: ChatCompletionResult; mode: ZaiClient["mode"] }> {
  const sources = await configuredSources();
  if (!sources.length) throw new Error("هیچ منبع اتصال به مدل زبانی پیکربندی نشده است — راهنمای راهبر در docs/ai-model-setup.md");

  const ordered = preferredMode
    ? [...sources.filter((s) => s.mode === preferredMode), ...sources.filter((s) => s.mode !== preferredMode)]
    : sources;

  let lastError: unknown = null;
  for (const src of ordered) {
    try {
      // منبع اثبات‌نشده با تایم‌اوت کوتاه امتحان می‌شود تا مسیرهای شکسته، پرسش را گروگان نگیرند
      const timeoutMs = src.mode === preferredMode ? 25_000 : 7_000;
      const result = await withTimeout(src.chat.completions.create(body), timeoutMs);
      preferredMode = src.mode;
      return { result, mode: src.mode };
    } catch (e) {
      lastError = e;
      if (preferredMode === src.mode) preferredMode = null;
      console.error(`[AI] منبع ${src.mode} ناموفق بود:`, e instanceof Error ? e.message : e);
    }
  }
  throw lastError ?? new Error("اتصال به مدل زبانی ناموفق بود");
}
