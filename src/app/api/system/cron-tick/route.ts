// تیک زمان‌بند از طریق سرویس cron بیرونی (مثل cron-job.org) — برای استقرار Serverless
// اجرا: GET/POST /api/system/cron-tick با هدر «Authorization: Bearer <CRON_SECRET>» یا ?key=
// همارز کلیک دستی POST /api/scheduler (پنل مدیریت) — منطق یکسان: src/lib/scheduler-engine.ts
// امنیت: بدون CRON_SECRET همیشه 403؛ در محیط لوکال/سندباکس اسکجولر درون‌پردازشی (instrumentation) فعال است
import { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { json, fail, handleApiError } from "@/lib/api";
import { runFullTick } from "@/lib/scheduler-engine";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** قفل درون‌پردازشی — جلوگیری از تیک موازی در یک نمونه */
const g = globalThis as unknown as { __nigcTickRunning?: boolean };

function secretOk(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function extractSecret(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  const header = req.headers.get("x-cron-secret");
  if (header) return header.trim();
  return req.nextUrl.searchParams.get("key");
}

async function tick(req: NextRequest) {
  if (!secretOk(extractSecret(req), process.env.CRON_SECRET)) {
    return fail(403, "فراخوانی تیک مجاز نیست — متغیر محیطی CRON_SECRET تنظیم نشده یا کلید نادرست است.", "CRON_UNAUTHORIZED");
  }
  if (g.__nigcTickRunning) {
    return json({ ok: true, skipped: true, reason: "tick-in-progress", serverTime: new Date().toISOString() });
  }
  g.__nigcTickRunning = true;
  try {
    const started = Date.now();
    const results = await runFullTick();
    return json({ ok: true, skipped: false, durationMs: Date.now() - started, results, serverTime: new Date().toISOString() });
  } finally {
    g.__nigcTickRunning = false;
  }
}

export async function GET(req: NextRequest) {
  try {
    return await tick(req);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    return await tick(req);
  } catch (e) {
    return handleApiError(e);
  }
}
