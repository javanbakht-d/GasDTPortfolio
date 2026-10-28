import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, json, handleApiError } from "@/lib/api";
import { getBaselineDate, programDay, faDate } from "@/lib/persian-date";
import { computePriority, suggestNextStep } from "@/lib/priority";
import { buildBriefing } from "@/lib/scheduler-engine";

/**
 * میزکار روزانه دبیر شورا — پنج ناحیه دستور §۴
 * همه داده‌ها از رکوردهای واقعی و در محدوده دسترسی کاربر ساخته می‌شوند.
 * هیچ عدد ساختگی تولید نمی‌شود؛ کمبود داده صریحاً اعلام می‌شود.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const globalView = user.roles.some((r) => ["SYSTEM_ADMIN", "SECRETARIAT_ADMIN", "CONFIG_ADMIN", "COUNCIL_SECRETARY", "COUNCIL_MEMBER", "AUDITOR", "REPORT_MANAGER"].includes(r.key));
    const scope = globalView || !user.orgUnitId ? {} : { responsibleUnitId: user.orgUnitId };

    const baseline = await getBaselineDate();
    const pDay = programDay(baseline);
    const now = new Date();

    const actions = await db.action.findMany({
      where: { status: { notIn: ["COMPLETED", "CLOSED"] }, ...scope },
      include: { responsibleUnit: { select: { id: true, name: true } } },
    });

    // وابستگی‌ها و ریسک‌ها
    const blockedBy = new Map<number, number>();
    for (const a of actions) {
      let deps: number[] = [];
      try { deps = a.dependencies ? JSON.parse(a.dependencies) : []; } catch { /* — */ }
      for (const d of deps) blockedBy.set(d, (blockedBy.get(d) ?? 0) + 1);
    }
    const risks = await db.risk.findMany({ where: { status: { in: ["OPEN", "MONITORING"] }, relatedType: "ACTION" } });
    const riskByAction = new Map<string, number>();
    for (const r of risks) if (r.relatedId) riskByAction.set(r.relatedId, Math.max(riskByAction.get(r.relatedId) ?? 0, r.probability * r.impact));

    const lastUpdates = await db.actionUpdate.findMany({ orderBy: { createdAt: "desc" }, take: 500, select: { actionId: true, createdAt: true } });
    const lastUp = new Map<string, Date>();
    for (const u of lastUpdates) if (!lastUp.has(u.actionId)) lastUp.set(u.actionId, u.createdAt);

    type Item = {
      id: string; refStep: number; code: string; title: string; status: string; progress: number;
      dueDate: string | null; unit: string | null; score: number; band: string; reasons: string[];
      nextStep: string; daysLeft: number | null; waitingDays: number; zone: "focus" | "risk" | "waiting";
      lastUpdate: string | null;
    };
    const items: Item[] = [];
    for (const a of actions) {
      const daysLeft = a.dueDate ? Math.ceil((a.dueDate.getTime() - now.getTime()) / 86400000) : null;
      const lu = lastUp.get(a.id);
      const waitDays = a.status === "WAITING_INFO" && lu ? Math.floor((now.getTime() - lu.getTime()) / 86400000) : 0;
      const pr = await computePriority({
        priority: a.priority, daysLeft, blockedDependents: blockedBy.get(a.refStep) ?? 0,
        maxOpenRiskScore: riskByAction.get(a.id) ?? 0, waitingDays: waitDays, progress: a.progress,
      });

      // ناحیه‌بندی طبق دستور — خطر تأخیر ≠ تأخیر قطعی
      let zone: Item["zone"] | null = null;
      if (a.status === "WAITING_INFO") zone = "waiting";
      else if (daysLeft != null && daysLeft < 0) zone = "focus"; // تأخیر قطعی → اقدام امروز
      else if (pr.band === "CRITICAL" || pr.band === "HIGH" || (daysLeft != null && daysLeft <= 3)) zone = "focus";
      else zone = "risk";

      items.push({
        id: a.id, refStep: a.refStep, code: a.code, title: a.title, status: a.status, progress: a.progress,
        dueDate: a.dueDate?.toISOString() ?? null, unit: a.responsibleUnit?.name ?? null,
        score: pr.score, band: pr.band, reasons: pr.reasons, nextStep: suggestNextStep(a.status, !!daysLeft && daysLeft < 0, waitDays, !a.delayReason),
        daysLeft, waitingDays: waitDays, zone, lastUpdate: lu?.toISOString() ?? null,
      });
    }
    items.sort((a, b) => b.score - a.score);

    const focus = items.filter((i) => i.zone === "focus").slice(0, 6);
    const risk = items.filter((i) => i.zone === "risk").slice(0, 6);
    const waiting = items.filter((i) => i.zone === "waiting").slice(0, 8);

    const decisions = await db.decision.findMany({ where: { followUpStatus: { in: ["PENDING", "IN_PROGRESS"] } }, orderBy: { dueDate: "asc" }, take: 6 });
    const meetings = await db.meeting.findMany({ where: { status: "SCHEDULED", scheduledAt: { gte: now } }, orderBy: { scheduledAt: "asc" }, take: 2 });

    // آخرین گزارش صبحگاهی امروز (اگر موتور تولید کرده باشد)
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const morningDigest = await db.notification.findFirst({
      where: { userId: user.id, type: "DIGEST_MORNING", createdAt: { gte: todayStart } },
      orderBy: { createdAt: "desc" },
    });

    // آخرین مراجعه کاربر = آخرین اعلان خوانده‌شده (تقریب «تغییرات از آخرین مراجعه»)
    const lastSeen = await db.notification.findFirst({ where: { userId: user.id, isRead: true }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    const changesSince = await db.actionUpdate.findMany({
      where: { createdAt: { gte: lastSeen?.createdAt ?? new Date(now.getTime() - 86400000) }, type: { in: ["STATUS_CHANGE", "DELAY_REPORT", "REMEDIAL", "DECISION"] } },
      orderBy: { createdAt: "desc" }, take: 5,
      include: { action: { select: { code: true, title: true } } },
    });

    // کمبود داده — شفاف طبق دستور
    const dataGaps: string[] = [];
    const kpiMissing = await db.kpi.count({ where: { needsDefinition: true } });
    if (kpiMissing > 0) dataGaps.push(`${kpiMissing} شاخص بدون تعریف/خط مبنا`);
    const overdueNoReason = items.filter((i) => i.daysLeft != null && i.daysLeft < 0).length;
    if (overdueNoReason > 0) dataGaps.push(`${overdueNoReason} مورد معوق در محدوده شما`);
    if (!meetings.length) dataGaps.push("جلسه برنامه‌ریزی‌شده‌ای در تقویم ثبت نشده است");

    const briefing = await buildBriefing("morning", now).catch(() => null);

    return json({
      generatedAt: now.toISOString(),
      programDay: pDay,
      baselineDate: baseline.toISOString(),
      baselineLabel: faDate(baseline),
      summary: {
        programHealth: overdueNoReason === 0 ? "برنامه در چارچوب مهلت‌ها پیش می‌رود" : `${overdueNoReason} مورد از مهلت گذشته است`,
        topConcern: focus[0] ? `گام ${focus[0].refStep}: ${focus[0].title.slice(0, 60)}` : "مورد فوری‌ای برای امروز ثبت نشده است",
        counts: { urgent: focus.length, overdue: items.filter((i) => i.daysLeft != null && i.daysLeft < 0).length, awaitingDecision: decisions.length, unanswered: waiting.length },
        changesSinceLastVisit: changesSince.map((c) => ({ actionCode: c.action.code, actionTitle: c.action.title, content: c.content.slice(0, 120), at: c.createdAt.toISOString() })),
        dataFreshness: now.toISOString(),
        morningDigestAt: morningDigest?.createdAt?.toISOString() ?? null,
      },
      focus, risk, waiting,
      awaitingDecision: decisions.map((d) => ({ id: d.id, code: d.code, content: d.content, responsible: d.responsible, dueDate: d.dueDate?.toISOString() ?? null })),
      meetings: meetings.map((m) => ({ id: m.id, number: m.number, title: m.title, scheduledAt: m.scheduledAt?.toISOString() ?? null })),
      dataGaps,
      briefing: briefing ? { summary: briefing.summary, counts: briefing.counts, generatedAt: briefing.generatedAt } : null,
      priorityModelNote: "امتیاز اولویت با مدل پیشنهادی v0.1 محاسبه شده است — تا تصویب شورا جنبه پیشنهادی دارد",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
