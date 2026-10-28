// ───────────── موتور یادآوری و زمان‌بندی سروری (مستقل از مرورگر) ─────────────
// اجرا: از src/instrumentation.ts هنگام بوت سرور + دستی از /api/scheduler/tick
// اصول: ضدتکرار (dedupeKey یکتا)، ثبت هر اجرا (SchedulerRun)، ساعات سکوت،
// تجمیع موارد کم‌اهمیت، شفافیت هشدار (reason + actionHint)، جعل نکردن ارسال ایمیل.

import { db } from "@/lib/db";
import { getBaselineDate, programDay, faDate } from "@/lib/persian-date";
import { computePriority } from "@/lib/priority";
import { getReminderSettings, isQuietHours, type ReminderSettings } from "@/lib/assistant-settings";

const DAY = 86400000;
const DONE_STATUSES = ["COMPLETED", "CLOSED", "HALTED", "CANCELED"];

export type TickResult = { jobKey: string; processed: number; created: number; skipped: number; failed: number; error?: string };

// ───────────── ابزار ─────────────

function tehranDateKey(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(d); // YYYY-MM-DD
}
function tehranHourMinute(d = new Date()): { h: number; m: number } {
  const t = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  const [h, m] = t.split(":").map(Number);
  return { h, m };
}
function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function nextQuietEnd(s: ReminderSettings, now = new Date()): Date {
  const { h } = tehranHourMinute(now);
  const end = new Date(now);
  if (h >= s.quietStart || h < s.quietEnd) {
    // تا پایان سکوت امروز/فردا
    const target = new Date(now.getTime());
    if (h >= s.quietStart) target.setTime(now.getTime() + DAY); // فردا
    const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(target);
    return new Date(`${ymd}T${String(s.quietEnd).padStart(2, "0")}:${String(s.quietEnd).padStart(2, "0")}`.replace(/:\d{2}$/, ":00") + ":00+03:30");
  }
  return now;
}

async function usersWithRoles(roleKeys: string[]): Promise<{ id: string; email: string | null; fullName: string }[]> {
  return db.user.findMany({
    where: { isActive: true, roles: { some: { role: { key: { in: roleKeys }, isActive: true } } } },
    select: { id: true, email: true, fullName: true },
  });
}
async function secretariatUsers(): Promise<{ id: string; email: string | null; fullName: string }[]> {
  const u = await usersWithRoles(["SECRETARIAT_ADMIN", "COUNCIL_SECRETARY"]);
  if (u.length) return u;
  return usersWithRoles(["SYSTEM_ADMIN"]);
}
async function unitUsers(unitId: string | null | undefined): Promise<{ id: string; email: string | null; fullName: string }[]> {
  if (!unitId) return [];
  return db.user.findMany({ where: { isActive: true, orgUnitId: unitId }, select: { id: true, email: true, fullName: true } });
}

type NotifyInput = {
  userIds: { id: string }[];
  type: string;
  title: string;
  body?: string;
  relatedType?: string;
  relatedId?: string;
  severity?: "NORMAL" | "IMPORTANT" | "CRITICAL";
  reason?: string;
  actionHint?: string;
  dedupeKey?: string;
  settings?: ReminderSettings;
  now?: Date;
};

/** ایجاد اعلان با احترام به ساعات سکوت و ضدتکرار. خروجی: created | skipped */
async function notify(input: NotifyInput): Promise<"created" | "skipped"> {
  const s = input.settings ?? await getReminderSettings();
  const now = input.now ?? new Date();
  const severity = input.severity ?? "NORMAL";

  let scheduledFor: Date | null = null;
  let deliveryStatus = "DELIVERED";
  if (s.enabled && isQuietHours(s, now) && !(severity === "CRITICAL" && s.quietBypassCritical)) {
    scheduledFor = nextQuietEnd(s, now);
    deliveryStatus = "PENDING"; // پس از پایان سکوت ارسال می‌شود (promotion در تیک بعدی)
  }

  let created = 0;
  for (const u of input.userIds) {
    const key = input.dedupeKey ? `${input.dedupeKey}:${u.id}` : null;
    try {
      await db.notification.create({
        data: {
          userId: u.id, type: input.type, title: input.title, body: input.body,
          relatedType: input.relatedType, relatedId: input.relatedId,
          severity, reason: input.reason, actionHint: input.actionHint,
          dedupeKey: key, channel: "IN_APP", deliveryStatus, scheduledFor,
        },
      });
      created++;
    } catch (e: unknown) {
      // تکراری (P2002) → عادی است؛ خطای دیگر را ثبت می‌کنیم
      const code = (e as { code?: string })?.code;
      if (code !== "P2002") console.error("[notify]", code, (e as Error).message?.slice(0, 200));
    }
  }
  return created > 0 ? "created" : "skipped";
}

// ───────────── تیک یادآوری‌ها ─────────────

export async function runReminderTick(now = new Date()): Promise<TickResult> {
  const res: TickResult = { jobKey: "REMINDER_TICK", processed: 0, created: 0, skipped: 0, failed: 0 };
  const s = await getReminderSettings();
  if (!s.enabled) return res;

  try {
    // ۰) ارتقای اعلان‌های معوق سکوت به ارسال‌شده
    const promoted = await db.notification.updateMany({
      where: { deliveryStatus: "PENDING", scheduledFor: { lte: now } },
      data: { deliveryStatus: "DELIVERED", scheduledFor: null },
    });
    res.processed += promoted.count;

    const baseline = await getBaselineDate();
    const pDay = programDay(baseline, now);
    const actions = await db.action.findMany({
      where: { status: { notIn: DONE_STATUSES } },
      include: { responsibleUnit: { select: { id: true, name: true } } },
    });

    // وابستگی‌ها: چه اقداماتی به هر اقدام وابسته‌اند و مسدود هستند؟
    const blockedBy = new Map<number, number>(); // refStep پیش‌نیاز → تعداد وابستهٔ ناتمام
    for (const a of actions) {
      let deps: number[] = [];
      try { deps = a.dependencies ? JSON.parse(a.dependencies) : []; } catch { /* بی‌اهمیت */ }
      for (const d of deps) blockedBy.set(d, (blockedBy.get(d) ?? 0) + 1);
    }
    // ریسک‌های باز مرتبط با اقدامات
    const risks = await db.risk.findMany({ where: { status: { in: ["OPEN", "MONITORING"] }, relatedType: "ACTION" }, select: { relatedId: true, probability: true, impact: true } });
    const riskByAction = new Map<string, number>();
    for (const r of risks) {
      if (!r.relatedId) continue;
      const sc = r.probability * r.impact;
      riskByAction.set(r.relatedId, Math.max(riskByAction.get(r.relatedId) ?? 0, sc));
    }

    for (const a of actions) {
      res.processed++;
      if (a.dueDateOverridden === false && a.dueEndDay != null && !a.dueDate) {
        // همگام‌سازی سررسیدِ محاسبه‌نشده (ایمنی)
        const due = new Date(baseline); due.setUTCDate(due.getUTCDate() + a.dueEndDay);
        await db.action.update({ where: { id: a.id }, data: { dueDate: due } }).catch(() => undefined);
      }
      if (!a.dueDate) continue;

      const daysLeft = Math.ceil((a.dueDate.getTime() - now.getTime()) / DAY);
      const dueEpoch = Math.floor(a.dueDate.getTime() / DAY);
      const isOverdue = daysLeft < 0;
      const recipients = (await unitUsers(a.responsibleUnitId)).length
        ? await unitUsers(a.responsibleUnitId)
        : await secretariatUsers();

      if (isOverdue) {
        const overdueDays = Math.abs(daysLeft);
        const severity = overdueDays >= s.overdueEscalateDays ? "CRITICAL" : "IMPORTANT";
        const r1 = await notify({
          userIds: recipients, type: "OVERDUE", severity,
          title: `تأخیر در گام ${a.refStep}: ${a.title.slice(0, 60)}`,
          body: `${overdueDays} روز از سررسید (${faDate(a.dueDate)}) گذشته است. واحد مسئول: ${a.responsibleUnit?.name ?? "دبیرخانه"}${a.delayReason ? ` — علت ثبت‌شده: ${a.delayReason}` : " — علت تأخیر ثبت نشده است."}`,
          relatedType: "ACTION", relatedId: a.id,
          reason: `سررسید ${faDate(a.dueDate)} سپری شده و وضعیت «${a.status}» است`,
          actionHint: a.delayReason ? "پیشبرد اقدام جبرانی و به‌روزرسانی وضعیت" : "ثبت علت تأخیر و تعیین اقدام جبرانی با مهلت مشخص",
          dedupeKey: `ovd:${a.id}:${dueEpoch}`, settings: s, now,
        });
        res[r1 === "created" ? "created" : "skipped"]++;
        // تشدید طبق قاعده
        if (overdueDays >= s.overdueEscalateDays) {
          const r2 = await notify({
            userIds: await secretariatUsers(), type: "OVERDUE_ESCALATED", severity: "CRITICAL",
            title: `تشدید: تأخیر ${overdueDays}روزه در گام ${a.refStep}`,
            body: `اقدام «${a.title.slice(0, 70)}» طبق قاعده ${s.overdueEscalateDays} روزِ تأخیر، به دبیرخانه ارجاع شد.`,
            relatedType: "ACTION", relatedId: a.id,
            reason: "مطابق قاعده ارجاع موارد تأخیری مهم به نقش بالاتر (تنظیمات یادآوری)",
            actionHint: "بررسی راهکار در سطح راهبری یا ارجاع به جلسه شورا",
            dedupeKey: `ovdesc:${a.id}:${dueEpoch}:${s.overdueEscalateDays}`, settings: s, now,
          });
          res[r2 === "created" ? "created" : "skipped"]++;
        }
        continue;
      }

      // یادآوری پیش از سررسید بر اساس اهمیت و زمان باقی‌مانده
      const threshold = a.priority === "CRITICAL" ? s.preDueCriticalDays : a.priority === "HIGH" ? s.preDueHighDays : s.preDueNormalDays;
      if (daysLeft > 0 && daysLeft <= threshold && !["IN_REVIEW", "APPROVED"].includes(a.status)) {
        const r = await notify({
          userIds: recipients, type: "DEADLINE_NEAR", severity: a.priority === "CRITICAL" ? "CRITICAL" : "IMPORTANT",
          title: `سررسید نزدیک — گام ${a.refStep}`,
          body: `${daysLeft} روز تا سررسید ${faDate(a.dueDate)}. پیشرفت فعلی: ${a.progress}٪.${a.progress === 0 ? " اقدام هنوز شروع نشده است." : ""}`,
          relatedType: "ACTION", relatedId: a.id,
          reason: `یادآوری پیش از سررسید برای اولویت ${a.priority} با آستانه ${threshold} روز (تنظیمات یادآوری)`,
          actionHint: a.progress === 0 ? "آغاز اجرا یا ثبت مانع پیشروی" : "تکمیل خروجی و ارسال برای بررسی",
          dedupeKey: `near:${a.id}:${dueEpoch}`, settings: s, now,
        });
        res[r === "created" ? "created" : "skipped"]++;
      }
      // روز سررسید
      if (s.dueDayNotify && daysLeft === 0) {
        const r = await notify({
          userIds: recipients, type: "DEADLINE_TODAY", severity: "IMPORTANT",
          title: `امروز سررسید گام ${a.refStep} است`,
          body: `سررسید «${a.title.slice(0, 70)}» امروز است. وضعیت: ${a.status} — پیشرفت: ${a.progress}٪`,
          relatedType: "ACTION", relatedId: a.id,
          reason: "اطلاع‌رسانی در روز سررسید (تنظیمات یادآوری)",
          actionHint: "ارسال خروجی برای بررسی یا ثبت وضعیت و مانع",
          dedupeKey: `due0:${a.id}:${dueEpoch}`, settings: s, now,
        });
        res[r === "created" ? "created" : "skipped"]++;
      }
    }

    // پیگیری‌های زمان‌بندی‌شده (زمان پیگیری بعدی سپری شده)
    const followUps = await db.action.findMany({
      where: { nextFollowUpAt: { lte: now }, status: { notIn: DONE_STATUSES } },
      include: { responsibleUnit: { select: { name: true } } },
      take: 50,
    });
    for (const a of followUps) {
      res.processed++;
      const epoch = Math.floor((a.nextFollowUpAt?.getTime() ?? 0) / DAY);
      const r = await notify({
        userIds: a.followUpOwnerId ? [{ id: a.followUpOwnerId }] : await secretariatUsers(),
        type: "FOLLOWUP", severity: "IMPORTANT",
        title: `زمان پیگیری «${a.title.slice(0, 55)}» رسیده است`,
        body: `طبق برنامه پیگیری، امروز نوبت پیگیری این تعهد است. آخرین پیگیری: ${a.lastFollowUpAt ? faDate(a.lastFollowUpAt) : "ثبت نشده"}.`,
        relatedType: "ACTION", relatedId: a.id,
        reason: "رسیدن به زمان پیگیری بعدی ثبت‌شده در پرونده اقدام",
        actionHint: "پیگیری با واحد مسئول و ثبت نتیجه + تعیین زمان پیگیری بعدی",
        dedupeKey: `fu:${a.id}:${epoch}`, settings: s, now,
      });
      res[r === "created" ? "created" : "skipped"]++;
    }

    // جلسات پیش‌رو (۴۸ ساعت) — یادآوری آماده‌سازی
    const soon = new Date(now.getTime() + 2 * DAY);
    const meetings = await db.meeting.findMany({ where: { status: "SCHEDULED", scheduledAt: { gte: now, lte: soon } } });
    for (const m of meetings) {
      res.processed++;
      const epoch = Math.floor((m.scheduledAt?.getTime() ?? 0) / DAY);
      const r = await notify({
        userIds: await secretariatUsers(), type: "MEETING_PREP", severity: "IMPORTANT",
        title: `جلسه ${m.number ? `شماره ${m.number} ` : ""}پیش‌رو — آماده‌سازی`,
        body: `جلسه «${m.title}» در ${faDate(m.scheduledAt)} برگزار می‌شود. دستور جلسه و مصوبات پیگیری‌نشده را آماده کنید.`,
        relatedType: "MEETING", relatedId: m.id,
        reason: "یادآوری آماده‌سازی پیش از جلسه (۴۸ ساعت قبل)",
        actionHint: "تهیه دستور جلسه و گزارش وضعیت مصوبات مربوط",
        dedupeKey: `mtg:${m.id}:${epoch}`, settings: s, now,
      });
      res[r === "created" ? "created" : "skipped"]++;
    }

    // تصمیم‌های باز شورا با سررسید
    const decisions = await db.decision.findMany({ where: { followUpStatus: { in: ["PENDING", "IN_PROGRESS"] } } });
    for (const d of decisions) {
      if (!d.dueDate) continue;
      res.processed++;
      const dl = Math.ceil((d.dueDate.getTime() - now.getTime()) / DAY);
      if (dl < 0) {
        const epoch = Math.floor(d.dueDate.getTime() / DAY);
        const r = await notify({
          userIds: await secretariatUsers(), type: "DECISION_OVERDUE", severity: "IMPORTANT",
          title: `تصمیم مصوب معوق: ${d.content.slice(0, 55)}`,
          body: `مهلت اجرای تصمیم (${faDate(d.dueDate)}) گذشته است. مسئول: ${d.responsible ?? "ثبت نشده"}.`,
          relatedType: "DECISION", relatedId: d.id,
          reason: "عبور از مهلت مصوبه با وضعیت اجرا‌نشده",
          actionHint: "ثبت وضعیت اجرا یا ارجاع به جلسه شورا",
          dedupeKey: `dec-ovd:${d.id}:${epoch}`, settings: s, now,
        });
        res[r === "created" ? "created" : "skipped"]++;
      }
    }
  } catch (e) {
    res.failed++;
    res.error = (e as Error).message?.slice(0, 300);
  }
  return res;
}

// ───────────── سازنده گزارش‌های کوتاه (مشترک بین API و digest) ─────────────

export type BriefingItem = {
  id: string;
  refStep?: number;
  title: string;
  reason: string;
  dueDate?: string | null;
  unit?: string | null;
  status: string;
  nextStep: string;
  score?: number;
  severity?: string;
};

export type Briefing = {
  kind: "morning" | "eod" | "weekly";
  generatedAt: string;
  programDay: number;
  baselineDate: string;
  summary: string;
  counts: { urgent: number; overdue: number; awaitingDecision: number; unanswered: number };
  topPriorities: BriefingItem[];
  dueSoon: BriefingItem[];
  overdue: BriefingItem[];
  awaitingDecision: { id: string; code: string; content: string; responsible: string | null; dueDate: string | null }[];
  unanswered: { id: string; refStep: number; title: string; unit: string | null; waitingDays: number; lastUpdate: string | null }[];
  meetings: { id: string; title: string; scheduledAt: string | null; agendaCount: number }[];
  changes: { actionCode: string; actionTitle: string; type: string; content: string; at: string }[];
  dataGaps: string[];
};

async function buildBriefing(kind: Briefing["kind"], now = new Date()): Promise<Briefing> {
  const baseline = await getBaselineDate();
  const pDay = programDay(baseline, now);
  const s = await getReminderSettings();
  const weights = (await import("@/lib/assistant-settings")).getPriorityWeights;

  const actions = await db.action.findMany({
    where: { status: { notIn: DONE_STATUSES } },
    include: { responsibleUnit: { select: { name: true } } },
  });

  // محاسبه وابستگی‌ها و ریسک‌ها (همان منطق تیک)
  const blockedBy = new Map<number, number>();
  for (const a of actions) {
    let deps: number[] = [];
    try { deps = a.dependencies ? JSON.parse(a.dependencies) : []; } catch { /* — */ }
    for (const d of deps) blockedBy.set(d, (blockedBy.get(d) ?? 0) + 1);
  }
  const risks = await db.risk.findMany({ where: { status: { in: ["OPEN", "MONITORING"] }, relatedType: "ACTION" } });
  const riskByAction = new Map<string, number>();
  for (const r of risks) if (r.relatedId) riskByAction.set(r.relatedId, Math.max(riskByAction.get(r.relatedId) ?? 0, r.probability * r.impact));

  // آخرین به‌روزرسانی هر اقدام (برای waitingDays)
  const lastUpdates = await db.actionUpdate.findMany({ orderBy: { createdAt: "desc" }, take: 400, select: { actionId: true, createdAt: true } });
  const lastUpByAction = new Map<string, Date>();
  for (const u of lastUpdates) if (!lastUpByAction.has(u.actionId)) lastUpByAction.set(u.actionId, u.createdAt);

  const w = await weights();
  const scored: (BriefingItem & { _days: number | null; _wait: number; _score: number })[] = [];
  for (const a of actions) {
    const daysLeft = a.dueDate ? Math.ceil((a.dueDate.getTime() - now.getTime()) / DAY) : null;
    const lastUp = lastUpByAction.get(a.id);
    const waitDays = a.status === "WAITING_INFO" && lastUp ? Math.floor((now.getTime() - lastUp.getTime()) / DAY) : 0;
    const pr = await computePriority({
      priority: a.priority, daysLeft, blockedDependents: blockedBy.get(a.refStep) ?? 0,
      maxOpenRiskScore: riskByAction.get(a.id) ?? 0, waitingDays: waitDays, progress: a.progress,
    }, w);
    const item = {
      id: a.id, refStep: a.refStep, title: a.title,
      reason: pr.reasons.length ? pr.reasons.join(" · ") : (a.dueDate ? `در بازه زمانی خود — سررسید ${faDate(a.dueDate)}` : "اقدام مستمر برنامه"),
      dueDate: a.dueDate?.toISOString() ?? null, unit: a.responsibleUnit?.name ?? null, status: a.status,
      nextStep: (await import("@/lib/priority")).suggestNextStep(a.status, !!daysLeft && daysLeft < 0, waitDays, !a.delayReason),
      score: pr.score, severity: pr.band, _days: daysLeft, _wait: waitDays, _score: pr.score,
    };
    scored.push(item);
  }
  scored.sort((a, b) => b._score - a._score);

  const urgentThreshold = Math.max(s.preDueCriticalDays, 7);
  const overdue = scored.filter((i) => i._days != null && i._days < 0);
  const dueSoon = scored.filter((i) => i._days != null && i._days >= 0 && i._days <= urgentThreshold);
  const topPriorities = scored.slice(0, 5);

  const decisions = await db.decision.findMany({ where: { followUpStatus: { in: ["PENDING", "IN_PROGRESS"] } }, orderBy: { dueDate: "asc" }, take: 10 });
  const unansweredActions = actions.filter((a) => a.status === "WAITING_INFO").slice(0, 10).map((a) => {
    const lu = lastUpByAction.get(a.id);
    return {
      id: a.id, refStep: a.refStep, title: a.title, unit: a.responsibleUnit?.name ?? null,
      waitingDays: lu ? Math.floor((now.getTime() - lu.getTime()) / DAY) : 0,
      lastUpdate: lu?.toISOString() ?? null,
    };
  }).sort((a, b) => b.waitingDays - a.waitingDays);

  const meetings = await db.meeting.findMany({ where: { status: "SCHEDULED", scheduledAt: { gte: now } }, orderBy: { scheduledAt: "asc" }, take: 3 });

  // تغییرات مهم از آخرین گزارش صبحگاهی (یا ۲۴ ساعت)
  const lastDigest = await db.notification.findFirst({
    where: { type: "DIGEST_MORNING", createdAt: { lt: now } }, orderBy: { createdAt: "desc" }, select: { createdAt: true },
  });
  const since = kind === "weekly" ? new Date(now.getTime() - 7 * DAY) : (lastDigest?.createdAt ?? new Date(now.getTime() - DAY));
  const updates = await db.actionUpdate.findMany({
    where: { createdAt: { gte: since }, type: { in: ["STATUS_CHANGE", "DELAY_REPORT", "REMEDIAL", "DECISION"] } },
    orderBy: { createdAt: "desc" }, take: 8,
    include: { action: { select: { code: true, title: true } } },
  });

  const dataGaps: string[] = [];
  const kpiMissing = await db.kpi.count({ where: { needsDefinition: true } });
  if (kpiMissing > 0) dataGaps.push(`${kpiMissing} شاخص کلیدی هنوز تعریف یا خط مبنای مصوب ندارد`);
  const noReason = overdue.filter((o) => !o.reason.includes("علت")).length;
  if (noReason > 0) dataGaps.push(`${noReason} اقدام معوق بدون علت ثبت‌شده تأخیر`);
  const openRisks = await db.risk.count({ where: { status: "OPEN" } });
  if (openRisks > 0) dataGaps.push(`${openRisks} ریسک باز نیازمند بررسی راهکار`);

  const summary = kind === "morning"
    ? `امروز ${overdue.length} مورد تأخیری و ${dueSoon.length} تعهد نزدیک به سررسید دارید؛ ${decisions.filter((d) => !d.dueDate || d.dueDate < now).length} مصوبه در انتظار پیگیری است.`
    : kind === "eod"
      ? `در پایان روز: ${scored.slice(0, 3).map((t) => t.title.slice(0, 30)).join("، ")} مهم‌ترین موارد فردا هستند. ${overdue.length} مورد معوق باقی است.`
      : `نمای هفتگی: ${overdue.length} مورد تأخیری، ${dueSoon.length} تعهد نزدیک به سررسید و ${openRisks} ریسک باز.`;

  return {
    kind, generatedAt: now.toISOString(), programDay: pDay, baselineDate: baseline.toISOString(),
    summary,
    counts: {
      urgent: dueSoon.length, overdue: overdue.length,
      awaitingDecision: decisions.length, unanswered: unansweredActions.length,
    },
    topPriorities, dueSoon, overdue,
    awaitingDecision: decisions.map((d) => ({ id: d.id, code: d.code, content: d.content, responsible: d.responsible, dueDate: d.dueDate?.toISOString() ?? null })),
    unanswered: unansweredActions,
    meetings: meetings.map((m) => ({ id: m.id, title: m.title, scheduledAt: m.scheduledAt?.toISOString() ?? null, agendaCount: (() => { try { return m.agenda ? JSON.parse(m.agenda).length : 0; } catch { return 0; } })() })),
    changes: updates.map((u) => ({ actionCode: u.action.code, actionTitle: u.action.title, type: u.type, content: u.content.slice(0, 140), at: u.createdAt.toISOString() })),
    dataGaps,
  };
}

// ───────────── خلاصه‌های خودکار ─────────────

async function digestRecipients(): Promise<{ id: string; email: string | null; fullName: string }[]> {
  return secretariatUsers();
}

async function queueDigestEmails(briefing: Briefing, dedupeKey: string, now = new Date()) {
  const s = await getReminderSettings();
  const recipients = await digestRecipients();
  const lines: string[] = [];
  lines.push(briefing.summary, "");
  if (briefing.topPriorities.length) {
    lines.push("اولویت‌های امروز:");
    briefing.topPriorities.forEach((p, i) => lines.push(`${i + 1}. گام ${p.refStep} — ${p.title.slice(0, 60)} (${p.reason})`));
  }
  if (briefing.dataGaps.length) { lines.push("", "کمبود داده:"); briefing.dataGaps.forEach((g) => lines.push(`- ${g}`)); }
  lines.push("", "برای جزئیات و اقدام، وارد سامانه شوید.");
  const body = lines.join("\n");
  const smtpConfigured = !!(await db.setting.findUnique({ where: { key: "smtp.host" } }))?.value;

  for (const r of recipients) {
    if (!r.email) continue; // بدون ایمیل ثبت‌شده، کانال ایمیل خاموش می‌ماند (صادقانه)
    await db.emailOutbox.upsert({
      where: { dedupeKey: `${dedupeKey}:${r.id}` },
      create: {
        dedupeKey: `${dedupeKey}:${r.id}`, toUserId: r.id, toEmail: r.email,
        subject: `خلاصه ${briefing.kind === "morning" ? "صبحگاهی" : briefing.kind === "eod" ? "پایان روز" : "هفتگی"} سامانه تحول دیجیتال — ${faDate(now)}`,
        body,
        status: "PENDING",
        blockedReason: smtpConfigured ? null : "پیکربندی SMTP سازمانی انجام نشده است؛ پیام در صف می‌ماند و تا نصب SMTP ارسال نمی‌شود.",
        relatedType: "DIGEST",
      },
      update: {},
    }).catch(() => undefined); // تکراری → نادیده
  }
  void s;
}

export async function runMorningDigest(now = new Date()): Promise<TickResult> {
  const res: TickResult = { jobKey: "MORNING_DIGEST", processed: 0, created: 0, skipped: 0, failed: 0 };
  try {
    const s = await getReminderSettings();
    if (!s.morningDigestEnabled) return res;
    const briefing = await buildBriefing("morning", now);
    const recipients = await digestRecipients();
    res.processed = recipients.length;
    for (const u of recipients) {
      try {
        await db.notification.create({
          data: {
            userId: u.id, type: "DIGEST_MORNING", title: `گزارش صبحگاهی — روز ${briefing.programDay} برنامه`,
            body: briefing.summary, severity: "NORMAL", relatedType: "BRIEFING",
            reason: "زمان‌بندی گزارش صبحگاهی (تنظیمات: " + s.morningDigestTime + " به وقت تهران)",
            actionHint: "مرور اولویت‌ها در میزکار روزانه", dedupeKey: `digest-morning:${tehranDateKey(now)}:${u.id}`,
          },
        });
        res.created++;
      } catch (e: unknown) {
        if ((e as { code?: string })?.code === "P2002") res.skipped++; else { res.failed++; console.error("[digest]", (e as Error).message); }
      }
    }
    await queueDigestEmails(briefing, `digest-morning-email:${tehranDateKey(now)}`, now);
  } catch (e) {
    res.failed++;
    res.error = (e as Error).message?.slice(0, 300);
  }
  return res;
}

export async function runEodDigest(now = new Date()): Promise<TickResult> {
  const res: TickResult = { jobKey: "EOD_DIGEST", processed: 0, created: 0, skipped: 0, failed: 0 };
  try {
    const s = await getReminderSettings();
    if (!s.eodDigestEnabled) return res;
    const briefing = await buildBriefing("eod", now);
    const recipients = await digestRecipients();
    res.processed = recipients.length;
    for (const u of recipients) {
      try {
        await db.notification.create({
          data: {
            userId: u.id, type: "DIGEST_EOD", title: `خلاصه پایان روز — روز ${briefing.programDay}`,
            body: briefing.summary, severity: "NORMAL",
            reason: "زمان‌بندی گزارش پایان روز (" + s.eodDigestTime + " تهران)",
            actionHint: "بررسی تعهدات باقی‌مانده پیش از پایان روز کاری",
            dedupeKey: `digest-eod:${tehranDateKey(now)}:${u.id}`,
          },
        });
        res.created++;
      } catch (e: unknown) {
        if ((e as { code?: string })?.code === "P2002") res.skipped++; else res.failed++;
      }
    }
    await queueDigestEmails(briefing, `digest-eod-email:${tehranDateKey(now)}`, now);
  } catch (e) {
    res.failed++; res.error = (e as Error).message?.slice(0, 300);
  }
  return res;
}

export async function runWeeklyDigest(now = new Date()): Promise<TickResult> {
  const res: TickResult = { jobKey: "WEEKLY_DIGEST", processed: 0, created: 0, skipped: 0, failed: 0 };
  try {
    const s = await getReminderSettings();
    if (!s.weeklyDigestEnabled) return res;
    const briefing = await buildBriefing("weekly", now);
    const recipients = await digestRecipients();
    res.processed = recipients.length;
    for (const u of recipients) {
      try {
        await db.notification.create({
          data: {
            userId: u.id, type: "DIGEST_WEEKLY", title: `خلاصه هفتگی وضعیت و ریسک‌ها — هفته منتهی به ${faDate(now)}`,
            body: briefing.summary, severity: "NORMAL",
            reason: "زمان‌بندی خلاصه هفتگی (روز/ساعت تنظیم‌شده)",
            actionHint: "مرور وضعیت برنامه و ریسک‌ها در داشبورد راهبری",
            dedupeKey: `digest-weekly:${tehranDateKey(now)}:${u.id}`,
          },
        });
        res.created++;
      } catch (e: unknown) {
        if ((e as { code?: string })?.code === "P2002") res.skipped++; else res.failed++;
      }
    }
    await queueDigestEmails(briefing, `digest-weekly-email:${tehranDateKey(now)}`, now);
  } catch (e) {
    res.failed++; res.error = (e as Error).message?.slice(0, 300);
  }
  return res;
}

/** هشدار سلامت به ادمین‌ها در صورت شکست اجرا (بدون سکوت بی‌صدا) */
async function alertAdminsIfFailed(jobKey: string, error?: string) {
  const s = await getReminderSettings();
  if (!s.healthAlertToAdmin || !error) return;
  const admins = await usersWithRoles(["SYSTEM_ADMIN", "SECRETARIAT_ADMIN"]);
  await notify({
    userIds: admins, type: "SCHEDULER_ALERT", severity: "IMPORTANT",
    title: `اختلال در اجرای زمان‌بند (${jobKey})`,
    body: `آخرین اجرای وظیفه «${jobKey}» با خطا مواجه شد: ${error.slice(0, 160)}`,
    relatedType: "SCHEDULER",
    reason: "هشدار سلامت سرویس زمان‌بندی — سرویس نباید بی‌صدا از کار بیفتد",
    actionHint: "بررسی پنل «سلامت و قابلیت اعتماد دستیار» در تنظیمات",
    dedupeKey: `sched-alert:${jobKey}:${tehranDateKey()}`,
    settings: s,
  }).catch(() => undefined);
}

async function recordRun(job: () => Promise<TickResult>): Promise<TickResult> {
  const started = Date.now();
  const run = await db.schedulerRun.create({ data: { jobKey: "PENDING", startedAt: new Date(), status: "RUNNING" } });
  let result: TickResult;
  try {
    result = await job();
    await db.schedulerRun.update({
      where: { id: run.id },
      data: {
        jobKey: result.jobKey, finishedAt: new Date(),
        status: result.failed > 0 ? "PARTIAL" : "SUCCESS",
        processed: result.processed, created: result.created, skipped: result.skipped, failed: result.failed,
        error: result.error, durationMs: Date.now() - started,
      },
    });
    await alertAdminsIfFailed(result.jobKey, result.error);
  } catch (e) {
    result = { jobKey: "UNKNOWN", processed: 0, created: 0, skipped: 0, failed: 1, error: (e as Error).message?.slice(0, 300) };
    await db.schedulerRun.update({ where: { id: run.id }, data: { jobKey: result.jobKey, finishedAt: new Date(), status: "FAILED", error: result.error, durationMs: Date.now() - started } }).catch(() => undefined);
    await alertAdminsIfFailed(result.jobKey, result.error).catch(() => undefined);
  }
  return result;
}

/** چرخه کامل زمان‌بند: یادآوری + خلاصه‌های زمان‌دار */
export async function runFullTick(now = new Date()): Promise<TickResult[]> {
  const out: TickResult[] = [];
  out.push(await recordRun(() => runReminderTick(now)));

  const s = await getReminderSettings();
  const { h, m } = tehranHourMinute(now);
  const cur = h * 60 + m;
  const inWindow = (time: string) => cur >= minutesOf(time) && cur < minutesOf(time) + Math.max(2, Math.ceil(s.tickIntervalSec / 60) + 1);

  if (inWindow(s.morningDigestTime)) out.push(await recordRun(() => runMorningDigest(now)));
  if (inWindow(s.eodDigestTime)) out.push(await recordRun(() => runEodDigest(now)));
  if (s.weeklyDigestEnabled && now.getDay() === s.weeklyDigestDay && inWindow(s.weeklyDigestTime)) out.push(await recordRun(() => runWeeklyDigest(now)));

  // پاکسازی: سوابق اجرای قدیمی (بیش از ۳۰ روز) برای جلوگیری از رشد بی‌رویه
  await db.schedulerRun.deleteMany({ where: { startedAt: { lt: new Date(now.getTime() - 30 * DAY) } } }).catch(() => undefined);

  return out;
}

export { buildBriefing };
