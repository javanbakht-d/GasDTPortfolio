import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, json, handleApiError, audit, clientIp } from "@/lib/api";
import { getReminderSettings, getPriorityWeights, PRIORITY_MODEL_VERSION } from "@/lib/assistant-settings";
import { runFullTick } from "@/lib/scheduler-engine";

/** وضعیت سلامت و قابلیت اعتماد دستیار — پنل مدیریت (§۱۰ دستور) */
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(req, "settings:manage");
    void user;
    const settings = await getReminderSettings();
    const weights = await getPriorityWeights();

    const runs = await db.schedulerRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 });
    const lastRun = runs[0] ?? null;
    const failedLast24h = await db.schedulerRun.count({
      where: { status: { in: ["FAILED", "PARTIAL"] }, startedAt: { gte: new Date(Date.now() - 86400000) } },
    });
    const pendingEmails = await db.emailOutbox.count({ where: { status: "PENDING" } });
    const blockedEmails = await db.emailOutbox.count({ where: { status: "PENDING", blockedReason: { not: null } } });
    const pendingNotifications = await db.notification.count({ where: { deliveryStatus: "PENDING" } });
    const aiEnabled = (await db.setting.findUnique({ where: { key: "ai.enabled" } }))?.value !== "false";
    const lastAiError = await db.auditLog.findFirst({ where: { action: "AI_QUERY_ERROR" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    const dbOk = await db.$queryRaw`SELECT 1`.then(() => true).catch(() => false);

    // سلامت زمان‌بند: آخرین اجرا جدیدتر از ۳×فاصله تیک باشد
    const intervalMs = Math.max(30, settings.tickIntervalSec) * 1000;
    const schedulerAlive = lastRun ? Date.now() - lastRun.startedAt.getTime() < intervalMs * 5 : false;

    return json({
      scheduler: {
        enabled: settings.enabled,
        alive: schedulerAlive,
        tickIntervalSec: settings.tickIntervalSec,
        lastRun: lastRun ? { jobKey: lastRun.jobKey, startedAt: lastRun.startedAt, finishedAt: lastRun.finishedAt, status: lastRun.status, created: lastRun.created, skipped: lastRun.skipped, failed: lastRun.failed, error: lastRun.error, durationMs: lastRun.durationMs } : null,
        failedLast24h,
        recentRuns: runs.slice(0, 10).map((r) => ({ jobKey: r.jobKey, startedAt: r.startedAt, status: r.status, created: r.created, skipped: r.skipped, failed: r.failed, durationMs: r.durationMs })),
      },
      notifications: { pendingQuiet: pendingNotifications },
      emailChannel: {
        configured: blockedEmails < pendingEmails ? "partial" : "no",
        pending: pendingEmails,
        note: pendingEmails > 0 ? "صف ایمیل بدون پیکربندی SMTP سازمانی ارسال نمی‌شود — ارسال جعل نمی‌شود" : "صف ایمیل خالی است",
      },
      assistant: { enabled: aiEnabled, lastErrorAt: lastAiError?.createdAt ?? null },
      infrastructure: { dbConnected: dbOk, timezone: "Asia/Tehran", serverTime: new Date().toISOString() },
      settingsSnapshot: settings,
      priorityModel: { version: PRIORITY_MODEL_VERSION, weights, note: "مدل اولویت پیشنهادی است و تا تصویب شورا صرفاً برای مرتب‌سازی نمایش استفاده می‌شود" },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** اجرای دستی چرخه زمان‌بند (برای آزمون پذیرش و عیب‌یابی) — ممیزی‌شده */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, "settings:manage");
    const results = await runFullTick();
    await audit(user, "SCHEDULER_RUN", "SCHEDULER", "manual-tick", { results }, clientIp(req));
    return json({ ok: true, results });
  } catch (e) {
    return handleApiError(e);
  }
}
