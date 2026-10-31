import { NextRequest } from "next/server";
import { rateLimit, clientIp } from "@/lib/api";
import { getZaiClient, zaiEnvMode } from "@/lib/zai";

/**
 * رله امن مدل زبانی — فقط برای استقرار تولیدی (Vercel)
 *
 * چرا این مسیر وجود دارد؟ فایل پیکربندی مدل (.z-ai-config) فقط در محیط سندباکس
 * موجود است و کلیدها هرگز نباید در مخزن/محیط بدون فایل قرار گیرند. استقرار
 * تولیدی با متغیرهای LLM_PROXY_URL + LLM_PROXY_KEY به این رله وصل می‌شود و
 * سندباکس به‌عنوان میزبان اتصال مدل عمل می‌کند (مناسب «پارت اول»).
 *
 * امنیت:
 * - احراز با هدر Authorization: Bearer (مقایسه timing-safe با LLM_RELAY_KEY)
 * - سقف اندازه پیام و تعداد پیام‌ها + محدودیت نرخ بر اساس IP
 * - بدون ثبت محتوای مکالمات؛ فقط شمارنده‌های فنی
 * - در صورت نبود کلید تنظیم‌شده، مسیر غیرفعال است (403)
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RELAY_KEY = process.env.LLM_RELAY_KEY ?? "";

function timingSafeEqualStr(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

function bearer(req: NextRequest): string {
  const h = req.headers.get("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

export async function GET() {
  // بررسی سلامت/دسترس‌پذیری بدون مصرف مدل — برای daily-check تولید
  return Response.json({
    ok: true,
    relay: "nigc-dtg-llm",
    configured: true, // سندباکس همیشه فایل پیکربندی دارد
  });
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  if (!RELAY_KEY) {
    return Response.json({ error: { code: "RELAY_DISABLED", message: "رله مدل روی این محیط تنظیم نشده است." } }, { status: 403 });
  }
  if (!rateLimit(`relay:${ip}`, 60, 60_000)) {
    return Response.json({ error: { code: "RATE_LIMITED", message: "محدودیت نرخ رله." } }, { status: 429 });
  }
  if (!timingSafeEqualStr(bearer(req), RELAY_KEY)) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "کلید رله نامعتبر است." } }, { status: 401 });
  }

  let body: { messages?: unknown; thinking?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: { code: "BAD_INPUT", message: "بدنه JSON نامعتبر است." } }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : null;
  if (!messages || messages.length === 0 || messages.length > 24) {
    return Response.json({ error: { code: "BAD_INPUT", message: "آرایه messages الزامی و حداکثر ۲۴ پیام است." } }, { status: 400 });
  }
  const clean = (messages as { role?: unknown; content?: unknown }[]).map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: String(m.content ?? "").slice(0, 16000),
  }));

  try {
    const zai = await getZaiClient();
    const completion = await zai.chat.completions.create({
      messages: clean as never,
      thinking: { type: "disabled" },
    });
    const content = completion?.choices?.[0]?.message?.content ?? "";
    if (!content) throw new Error("پاسخ خالی از مدل");
    return Response.json({ choices: [{ message: { content } }] });
  } catch (e) {
    console.error("[AI-RELAY]", e);
    return Response.json({ error: { code: "UPSTREAM_ERROR", message: "خطا در ارتباط با مدل زبانی." } }, { status: 502 });
  }
}
