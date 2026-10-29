// راه‌اندازی اولیه ابری — یک‌بار برای هر محیط
// اجرا: POST/GET /api/system/bootstrap با هدر «Authorization: Bearer <BOOTSTRAP_TOKEN>» یا ?token=
// کارها: اجرای DDL PostgreSQL (تولیدشده از prisma/schema.postgres.prisma) + seed کامل داده‌های سند مرجع
// امنیت: بدون BOOTSTRAP_TOKEN این مسیر همیشه 403 می‌دهد؛ پس از راه‌اندازی، حذف متغیر از محیط مسیر را غیرفعال می‌کند
import { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { json, fail, handleApiError, audit } from "@/lib/api";
import { POSTGRES_DDL } from "@/lib/postgres-ddl";
import { runSeed, type SeedSummary } from "@/lib/seed-core";
import { runUpgradeSeed } from "@/lib/seed-upgrade-core";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** مقایسه امن توکن (بدون نشت زمانی) */
function tokenOk(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  return req.nextUrl.searchParams.get("token");
}

/** کدهای خطای PostgreSQL که در اجرای مجدد DDL نرمال و قابل‌چشم‌پوشی هستند */
const IDEMPOTENT_PG_CODES = new Set(["42P07", "42P06", "42710", "42701", "42P16"]);

async function bootstrap(req: NextRequest) {
  const provided = extractToken(req);
  if (!tokenOk(provided, process.env.BOOTSTRAP_TOKEN)) {
    return fail(403, "راه‌اندازی اولیه غیرفعال است — متغیر محیطی BOOTSTRAP_TOKEN تنظیم نشده یا توکن نادرست است.", "BOOTSTRAP_DISABLED");
  }

  const started = Date.now();

  // ── ۱) آیا قبلاً راه‌اندازی شده؟ ──
  const existingUsers = await db.user.count();
  if (existingUsers > 0) {
    const [actions, settings] = await Promise.all([db.action.count(), db.setting.count()]);
    return json({
      alreadyBootstrapped: true,
      counts: { users: existingUsers, actions, settings },
      message: "سامانه قبلاً راه‌اندازی شده است. برای بازنشانی کامل، دیتابیس خالی شود و مسیر دوباره فراخوانی گردد.",
    });
  }

  // ── ۲) اجرای DDL (idempotent) ──
  let ddlExecuted = 0;
  let ddlSkipped = 0;
  const ddlErrors: { index: number; error: string }[] = [];
  for (let i = 0; i < POSTGRES_DDL.length; i++) {
    try {
      await db.$executeRawUnsafe(POSTGRES_DDL[i]);
      ddlExecuted++;
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      if (IDEMPOTENT_PG_CODES.has(code)) {
        ddlSkipped++;
      } else {
        ddlErrors.push({ index: i, error: `${code}: ${(e as Error).message?.slice(0, 200)}` });
        if (ddlErrors.length >= 3) break; // قطع زودهنگام — خطای ساختاری
      }
    }
  }
  if (ddlErrors.length > 0) {
    return json({ ok: false, code: "DDL_FAILED", message: "اجرای ساخت جداول ناقص ماند — اتصال دیتابیس و DATABASE_URL را بررسی کنید.", ddlExecuted, ddlSkipped, ddlErrors }, 500);
  }

  // ── ۳) seed کامل داده‌های سند مرجع + تنظیمات ارتقا ──
  const seed: SeedSummary = await runSeed(db);
  const upgrade = await runUpgradeSeed(db);

  // ── ۴) دستیار هوشمند: روی استقرار serverless پیش‌فرض غیرفعال (نیازمند اعتبارنامه ارائه‌دهنده مدل) ──
  const aiEnabled = process.env.AI_ENABLED === "true" ? "true" : process.env.VERCEL === "1" ? "false" : "true";
  await db.setting.upsert({
    where: { key: "ai.enabled" },
    update: { value: aiEnabled },
    create: { key: "ai.enabled", value: aiEnabled, valueType: "boolean", category: "ai", description: "فعال‌بودن دستیار هوشمند دبیرخانه" },
  });

  await audit(null, "SYSTEM_BOOTSTRAP", "SYSTEM", "cloud-bootstrap", {
    ddlExecuted, ddlSkipped, seed: seed.counts, upgrade, aiEnabled, durationMs: Date.now() - started,
  });

  return json({
    ok: true,
    durationMs: Date.now() - started,
    ddl: { executed: ddlExecuted, skipped: ddlSkipped },
    seed: seed.counts,
    upgradeSettings: upgrade,
    assistantEnabled: aiEnabled === "true",
    demoCredentials: {
      warning: "⚠️ فقط حساب admin فعال است (سایر حساب‌های نمونه غیرفعال‌اند). بلافاصله پس از نخستین ورود رمز admin را از ماژول مدیریت کاربران تغییر دهید. این پاسخ را ذخیره کنید؛ دوباره نمایش داده نمی‌شود.",
      users: seed.demoUsers,
      password: seed.demoPassword,
      adminHint: "با admin وارد شوید (دسترسی کامل) → تغییر رمز → سپس در مدیریت کاربران حساب واقعی کاربران را بر اساس نقش‌ها بسازید و حساب‌های نمونه را حذف/فعال کنید.",
    },
    nextSteps: [
      "با admin ورود کنید و رمز همه کاربران نمونه را تغییر دهید",
      "زمان‌بند بیرونی (cron-job.org) را روی /api/system/cron-tick با CRON_SECRET تنظیم کنید",
      "متغیر BOOTSTRAP_TOKEN را از Vercel حذف کنید تا این مسیر قفل شود",
    ],
  });
}

export async function POST(req: NextRequest) {
  try {
    return await bootstrap(req);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function GET(req: NextRequest) {
  try {
    return await bootstrap(req);
  } catch (e) {
    return handleApiError(e);
  }
}
