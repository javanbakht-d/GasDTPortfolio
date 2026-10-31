// ───────────── گزارش روزانه سلامت و عملکرد سامانه (فقط‌خواندنی) ─────────────
// اجرا: GET /api/system/daily-check با هدر «Authorization: Bearer <CRON_SECRET>» یا ?key=
// هدف: یک فراخوانی واحد، کل سلامت سامانه را در قالب JSON ساخت‌یافته برمی‌گرداند تا
//       دستورالعمل عملیاتی روزانه (docs/daily-ops-procedure.md) بر مبنای آن اجرا شود.
// اصول: بدون اثر جانبی (هیچ نوشتنی در دیتابیس ندارد)، هر بررسی مستقل در try/catch،
//       خطای یک بررسی هرگز کل گزارش را نمی‌کُشد. کد پاسخ همیشه 200 است (به‌جز 403 کلید نادرست)
//       تا cron-job.org تاریخچه سبز داشته باشد و وضعیت از خود JSON خوانده شود.
import { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { json, fail, handleApiError } from "@/lib/api";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

type Status = "PASS" | "WARN" | "FAIL" | "SKIP";

type Check = {
  key: string;
  title: string;
  status: Status;
  value: string;
  threshold: string;
  detail?: string;
};

// ───────────── امنیت — الگوی یکسان با cron-tick ─────────────

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

// ───────────── ابزار ─────────────

const STATUS_ORDER: Record<Status, number> = { SKIP: 0, PASS: 0, WARN: 1, FAIL: 2 };

function worst(statuses: Status[]): Status {
  return statuses.reduce<Status>((acc, s) => (STATUS_ORDER[s] > STATUS_ORDER[acc] ? s : acc), "PASS");
}

function isPostgres(): boolean {
  return !!process.env.DATABASE_URL?.startsWith("postgresql") || !!process.env.DATABASE_URL?.startsWith("postgres");
}

const DAY = 86400000;
const DONE_STATUSES = ["COMPLETED", "CLOSED", "HALTED", "CANCELED"];
const SUPABASE_FREE_QUOTA_MB = 500; // سقف پلن رایگان Supabase

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

// ───────────── گزارش اصلی ─────────────

async function buildReport(): Promise<{
  overall: Status;
  checks: Check[];
  metrics: Record<string, unknown>;
  summary: string;
  durationMs: number;
}> {
  const checks: Check[] = [];
  const metrics: Record<string, unknown> = {};
  const started = Date.now();

  // ۱) اتصال و تأخیر دیتابیس
  {
    const t0 = Date.now();
    const ok = await safe(async () => {
      await db.$queryRaw`SELECT 1`;
      return true;
    }, false);
    const latency = Date.now() - t0;
    metrics.dbLatencyMs = ok ? latency : null;
    checks.push({
      key: "db_connectivity",
      title: "اتصال دیتابیس",
      status: !ok ? "FAIL" : latency < 2000 ? "PASS" : latency < 8000 ? "WARN" : "FAIL",
      value: ok ? `${latency}ms` : "قطع",
      threshold: "سبز <۲۰۰۰ms | زرد <۸۰۰۰ms | قرمز قطع",
      detail: ok ? "پرس‌وجوی SELECT 1 موفق" : "پرس‌وجوی SELECT 1 ناموفق — اتصال دیتابیس برقرار نشد",
    });
  }

  // ۲) تازگی زمان‌بند (cron بیرونی هر ۵ دقیقه)
  let lastRun: { jobKey: string; startedAt: Date; status: string; failed: number; error: string | null } | null = null;
  {
    lastRun = await safe(
      async () =>
        db.schedulerRun.findFirst({ orderBy: { startedAt: "desc" }, select: { jobKey: true, startedAt: true, status: true, failed: true, error: true } }),
      null,
    );
    const ageMin = lastRun ? Math.round((Date.now() - lastRun.startedAt.getTime()) / 60000) : null;
    metrics.lastTickAgeMin = ageMin;
    checks.push({
      key: "scheduler_freshness",
      title: "تازگی تیک زمان‌بند",
      status: ageMin === null ? "FAIL" : ageMin < 20 ? "PASS" : ageMin < 60 ? "WARN" : "FAIL",
      value: ageMin === null ? "بدون اجرا" : `${ageMin} دقیقه پیش`,
      threshold: "سبز <۲۰ دقیقه | زرد <۶۰ دقیقه | قرمز ≥۶۰ دقیقه",
      detail: lastRun ? `آخرین اجرا: ${lastRun.jobKey} — وضعیت ${lastRun.status}` : "هیچ اجرایی در SchedulerRun ثبت نشده — cron بیرونی از کار افتاده است",
    });
  }

  // ۳) خطاهای زمان‌بند در ۲۴ ساعت گذشته
  {
    const failed24h = await safe(
      () => db.schedulerRun.count({ where: { status: { in: ["FAILED", "PARTIAL"] }, startedAt: { gte: new Date(Date.now() - DAY) } } }),
      -1,
    );
    metrics.schedulerFailed24h = failed24h;
    checks.push({
      key: "scheduler_errors_24h",
      title: "خطاهای زمان‌بند (۲۴ ساعت)",
      status: failed24h < 0 ? "SKIP" : failed24h === 0 ? "PASS" : failed24h <= 5 ? "WARN" : "FAIL",
      value: failed24h < 0 ? "نامشخص" : `${failed24h}`,
      threshold: "سبز ۰ | زرد ≤۵ | قرمز >۵",
      detail: failed24h > 0 && lastRun?.error ? `آخرین خطا: ${lastRun.error.slice(0, 200)}` : undefined,
    });
  }

  // ۴) نسبت تیک به زمان مشاهده — مقاوم در برابر استقرار تازه
  // پنجره مشاهده: از max(۲۴ ساعت پیش، اولین اجرای ثبت‌شده) تا اکنون.
  // انتظار: هر ۵ دقیقه یک تیک از cron بیرونی → نسبت = اجرای واقعی ÷ انتظار
  {
    const EXTERNAL_INTERVAL_MIN = 5;
    const firstRun = await safe(() => db.schedulerRun.findFirst({ orderBy: { startedAt: "asc" }, select: { startedAt: true } }), null);
    if (!firstRun) {
      checks.push({
        key: "tick_frequency_24h",
        title: "نسبت تیک به زمان مشاهده",
        status: "FAIL",
        value: "بدون اجرا",
        threshold: "سبز ≥۸۰٪ انتظار | زرد ≥۴۰٪ | قرمز <۴۰٪",
        detail: "هیچ تیکی ثبت نشده است — cron بیرونی یا دیتابیس از کار افتاده است",
      });
      metrics.tickRunsWindow = 0;
    } else {
      const windowStart = new Date(Math.max(Date.now() - DAY, firstRun.startedAt.getTime()));
      const runsWindow = await safe(() => db.schedulerRun.count({ where: { startedAt: { gte: windowStart } } }), -1);
      const elapsedMin = Math.max(1, (Date.now() - windowStart.getTime()) / 60000);
      const expected = Math.max(1, Math.floor(elapsedMin / EXTERNAL_INTERVAL_MIN));
      metrics.tickRunsWindow = runsWindow;
      metrics.tickExpectedWindow = expected;
      const ratio = runsWindow < 0 ? -1 : runsWindow / expected;
      metrics.tickRatio = ratio === -1 ? null : Math.round(ratio * 100) / 100;
      checks.push({
        key: "tick_frequency_24h",
        title: "نسبت تیک به زمان مشاهده",
        status: ratio < 0 ? "SKIP" : ratio >= 0.8 ? "PASS" : ratio >= 0.4 ? "WARN" : "FAIL",
        value: ratio < 0 ? "نامشخص" : `${runsWindow} اجرا در ${Math.round(elapsedMin)} دقیقه (${Math.round(ratio * 100)}٪ انتظار)`,
        threshold: "سبز ≥۸۰٪ انتظار | زرد ≥۴۰٪ | قرمز <۴۰٪",
        detail:
          runsWindow >= 0 && ratio < 0.8
            ? `کمتر از انتظار (باید ~${expected} اجرا بود) — cron-job.org بخشی از بازه از کار بوده است`
            : undefined,
      });
    }
  }

  // ۵) اعلان‌های خراب و معوق
  {
    const failedNotif = await safe(() => db.notification.count({ where: { deliveryStatus: "FAILED" } }), -1);
    const pendingNotif = await safe(() => db.notification.count({ where: { deliveryStatus: "PENDING" } }), -1);
    metrics.notificationsFailed = failedNotif;
    metrics.notificationsPending = pendingNotif;
    checks.push({
      key: "notifications",
      title: "اعلان‌ها",
      status: failedNotif < 0 ? "SKIP" : failedNotif === 0 ? "PASS" : "WARN",
      value: failedNotif < 0 ? "نامشخص" : `خراب ${failedNotif} | معوق ${pendingNotif}`,
      threshold: "سبز خراب=۰ | زرد خراب>۰",
      detail: "معوق‌ها معمولاً در ساعات سکوت طبیعی است و در تیک بعدی ارسال می‌شوند",
    });
  }

  // ۶) صف ایمیل (اطلاعاتی — SMTP سازمانی هنوز پیکربندی نشده است)
  {
    const pending = await safe(() => db.emailOutbox.count({ where: { status: "PENDING" } }), -1);
    const sent = await safe(() => db.emailOutbox.count({ where: { status: "SENT" } }), -1);
    const failedMail = await safe(() => db.emailOutbox.count({ where: { status: "FAILED" } }), -1);
    metrics.emailPending = pending;
    metrics.emailSent = sent;
    metrics.emailFailed = failedMail;
    checks.push({
      key: "email_outbox",
      title: "صف ایمیل",
      status: "PASS",
      value: `در صف ${pending < 0 ? "؟" : pending} | ارسال‌شده ${sent < 0 ? "؟" : sent} | خراب ${failedMail < 0 ? "؟" : failedMail}`,
      threshold: "اطلاعاتی — ارسال بدون SMTP سازمانی جعل نمی‌شود",
    });
  }

  // ۷) شمارش داده‌ها و رشد
  {
    const users = await safe(() => db.user.count({ where: { isActive: true } }), -1);
    const actionsTotal = await safe(() => db.action.count(), -1);
    const actionsOpen = await safe(() => db.action.count({ where: { status: { notIn: DONE_STATUSES } } }), -1);
    const documents = await safe(() => db.document.count(), -1);
    const kpis = await safe(() => db.kpi.count(), -1);
    const audit24h = await safe(() => db.auditLog.count({ where: { createdAt: { gte: new Date(Date.now() - DAY) } } }), -1);
    metrics.usersActive = users;
    metrics.actionsTotal = actionsTotal;
    metrics.actionsOpen = actionsOpen;
    metrics.documents = documents;
    metrics.kpis = kpis;
    metrics.auditEvents24h = audit24h;
    checks.push({
      key: "data_counts",
      title: "داده‌های سامانه",
      status: users < 0 ? "SKIP" : "PASS",
      value: `کاربر فعال ${users < 0 ? "؟" : users} | اقدام باز ${actionsOpen < 0 ? "؟" : actionsOpen}/${actionsTotal < 0 ? "؟" : actionsTotal} | سند ${documents < 0 ? "؟" : documents} | شاخص ${kpis < 0 ? "؟" : kpis}`,
      threshold: "اطلاعاتی — رشد طبیعی است",
      detail: `رخداد ممیزی ۲۴ ساعت گذشته: ${audit24h < 0 ? "؟" : audit24h}`,
    });
  }

  // ۸) حجم دیتابیس در برابر سقف پلن رایگان (فقط PostgreSQL)
  if (isPostgres()) {
    const sizeRow = await safe<bigint | null>(
      async () => {
        const rows = await db.$queryRaw<{ size: bigint }[]>`SELECT pg_database_size(current_database()) AS size`;
        return rows[0]?.size ?? null;
      },
      null,
    );
    if (sizeRow !== null && sizeRow !== undefined) {
      const mb = Number(sizeRow) / (1024 * 1024);
      const pct = Math.round((mb / SUPABASE_FREE_QUOTA_MB) * 100);
      metrics.dbSizeMb = Math.round(mb * 10) / 10;
      metrics.dbQuotaPct = pct;
      checks.push({
        key: "db_size",
        title: "حجم دیتابیس (سهمیه Supabase)",
        status: pct < 60 ? "PASS" : pct < 85 ? "WARN" : "FAIL",
        value: `${(Math.round(mb * 10) / 10).toLocaleString("fa-IR")} مگابایت (${pct}٪ سهمیه)`,
        threshold: "سبز <۶۰٪ از ۵۰۰MB | زرد <۸۵٪ | قرمز ≥۸۵٪",
      });
    } else {
      checks.push({
        key: "db_size",
        title: "حجم دیتابیس (سهمیه Supabase)",
        status: "SKIP",
        value: "نامشخص",
        threshold: "سبز <۶۰٪ از ۵۰۰MB",
        detail: "اجرای pg_database_size مجاز نشد — از داشبورد Supabase بررسی کنید",
      });
    }
  } else {
    checks.push({ key: "db_size", title: "حجم دیتابیس", status: "SKIP", value: "لوکال SQLite", threshold: "—" });
  }

  // ۹) اتصالات فعال دیتابیس (فقط PostgreSQL)
  if (isPostgres()) {
    const connRow = await safe<number | null>(
      async () => {
        const rows = await db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database()`;
        return rows[0]?.n ?? null;
      },
      null,
    );
    if (connRow !== null && connRow !== undefined) {
      metrics.dbConnections = connRow;
      checks.push({
        key: "db_connections",
        title: "اتصالات فعال دیتابیس",
        status: connRow < 40 ? "PASS" : connRow < 55 ? "WARN" : "FAIL",
        value: `${connRow}`,
        threshold: "سبز <۴۰ | زرد <۵۵ | قرمز ≥۵۵",
      });
    } else {
      checks.push({ key: "db_connections", title: "اتصالات فعال دیتابیس", status: "SKIP", value: "نامشخص", threshold: "—" });
    }
  }

  // ۱۰) امنیت — قفل bootstrap
  {
    const locked = !process.env.BOOTSTRAP_TOKEN;
    metrics.bootstrapLocked = locked;
    checks.push({
      key: "security_bootstrap",
      title: "امنیت: قفل bootstrap",
      status: locked ? "PASS" : "FAIL",
      value: locked ? "قفل ✓" : "باز!",
      threshold: "سبز: BOOTSTRAP_TOKEN حذف شده باشد",
      detail: locked ? undefined : "متغیر BOOTSTRAP_TOKEN در Vercel هنوز تنظیم است — حذفش کنید تا مسیر /api/system/bootstrap بسته بماند",
    });
  }

  // ۱۱) امنیت — تلاش‌های مشکوک ورود در ۲۴ ساعت
  {
    const denied24h = await safe(() => db.auditLog.count({ where: { action: "ACCESS_DENIED", createdAt: { gte: new Date(Date.now() - DAY) } } }), -1);
    metrics.accessDenied24h = denied24h;
    checks.push({
      key: "security_failed_logins",
      title: "امنیت: رخدادهای دسترسی مردود (۲۴ ساعت)",
      status: denied24h < 0 ? "SKIP" : denied24h <= 10 ? "PASS" : denied24h <= 50 ? "WARN" : "FAIL",
      value: denied24h < 0 ? "نامشخص" : `${denied24h}`,
      threshold: "سبز ≤۱۰ | زرد ≤۵۰ | قرمز >۵۰",
      detail: denied24h > 10 ? "الگوی احتمالی تلاش ناموفق ورود — لاگ ممیزی را بررسی کنید" : undefined,
    });
  }

  // ۱۲) اتصال مدل زبانی دستیار — پیکربندی + دسترس‌پذیری رله (بدون مصرف توکن)
  {
    const { zaiConfigMode } = await import("@/lib/zai");
    const mode = await zaiConfigMode();
    metrics.aiMode = mode;
    if (mode === "none") {
      metrics.aiRelayReachable = null;
      checks.push({
        key: "ai_model",
        title: "اتصال مدل زبانی دستیار",
        status: "WARN",
        value: "پیکربندی نشده",
        threshold: "سبز: منبع اتصال تنظیم و در دسترس | زرد: پیکربندی نشده یا رله در دسترس نیست",
        detail: "متغیرهای LLM_PROXY_URL/KEY (رله سندباکس) یا AI_BASE_URL/KEY تنظیم نشده‌اند — دستیار هوشمند پاسخ نمی‌دهد. راهنما: docs/ai-model-setup.md",
      });
    } else if (mode === "env-relay") {
      const reachable = await safe(async () => {
        const res = await fetch(`${process.env.LLM_PROXY_URL!.replace(/\/+$/, "")}`, { method: "GET", signal: AbortSignal.timeout(8000) });
        return res.ok;
      }, false);
      metrics.aiRelayReachable = reachable;
      checks.push({
        key: "ai_model",
        title: "اتصال مدل زبانی دستیار (رله سندباکس)",
        status: reachable ? "PASS" : "WARN",
        value: reachable ? "پیکربندی + رله در دسترس ✓" : "پیکربندی‌شده اما رله پاسخ نمی‌دهد",
        threshold: "سبز: رله در دسترس | زرد: رله در دسترس نیست",
        detail: reachable ? undefined : "فضای میزبان رله (gdtportfolio.space-z.ai) در دسترس نیست — دستیار موقتاً پاسخ نمی‌دهد؛ بعداً پایش کنید",
      });
    } else if (mode === "env-zai") {
      // مسیر مستقیم — دسترس‌پذیری endpoint (هر پاسخ HTTP حتی 4xx یعنی شبکه باز است)
      const baseUrl = (() => {
        try {
          if (process.env.ZAI_CONFIG_JSON) return (JSON.parse(process.env.ZAI_CONFIG_JSON) as { baseUrl?: string }).baseUrl;
          return process.env.ZAI_BASE_URL;
        } catch { return undefined; }
      })();
      const reachable = baseUrl
        ? await safe(async () => {
            await fetch(baseUrl.replace(/\/+$/, ""), { method: "GET", signal: AbortSignal.timeout(8000) });
            return true;
          }, false)
        : false;
      metrics.aiEndpointReachable = reachable;
      checks.push({
        key: "ai_model",
        title: "اتصال مدل زبانی دستیار (مستقیم)",
        status: reachable ? "PASS" : "WARN",
        value: reachable ? "پیکربندی + endpoint در دسترس ✓" : "پیکربندی‌شده اما endpoint از این شبکه در دسترس نیست",
        threshold: "سبز: endpoint در دسترس | زرد: شبکه بسته",
        detail: reachable ? undefined : "endpoint مدل از شبکه این استقرار پاسخ نمی‌دهد — fallback به رله انجام می‌شود؛ در صورت نبود رله، دستیار پاسخ نمی‌دهد",
      });
    } else {
      metrics.aiRelayReachable = null;
      checks.push({
        key: "ai_model",
        title: "اتصال مدل زبانی دستیار",
        status: "PASS",
        value: `پیکربندی شده (${mode})`,
        threshold: "سبز: منبع اتصال تنظیم شده",
      });
    }
  }

  const overall = worst(checks.map((c) => c.status));
  const passCount = checks.filter((c) => c.status === "PASS").length;
  const warnCount = checks.filter((c) => c.status === "WARN").length;
  const failCount = checks.filter((c) => c.status === "FAIL").length;
  const summary =
    overall === "PASS"
      ? `همه بررسی‌های ضروری سبز است (${passCount}/${checks.length})`
      : overall === "WARN"
        ? `نیازمند توجه: ${warnCount} بررسی زرد، ${failCount} قرمز`
        : `بحرانی: ${failCount} بررسی قرمز، ${warnCount} زرد — به playbook حادثه در docs/daily-ops-procedure.md مراجعه کنید`;

  return { overall, checks, metrics, summary, durationMs: Date.now() - started };
}

// ───────────── هندلر ─────────────

export async function GET(req: NextRequest) {
  try {
    if (!secretOk(extractSecret(req), process.env.CRON_SECRET)) {
      return fail(403, "فراخوانی گزارش روزانه مجاز نیست — کلید نادرست یا CRON_SECRET تنظیم نشده است.", "DAILY_CHECK_UNAUTHORIZED");
    }
    const report = await buildReport();
    return json({
      ok: true,
      overall: report.overall,
      summary: report.summary,
      generatedAt: new Date().toISOString(),
      region: process.env.VERCEL_REGION ?? "local",
      durationMs: report.durationMs,
      checks: report.checks,
      metrics: report.metrics,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
