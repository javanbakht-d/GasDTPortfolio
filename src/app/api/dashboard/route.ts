import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, json, handleApiError } from "@/lib/api";
import { getBaselineDate, programDay, dueFromDay } from "@/lib/persian-date";

/** داشبورد راهبری — همه اعداد از پایگاه داده محاسبه می‌شوند؛ عدد نمایشی ثابت وجود ندارد */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const baseline = await getBaselineDate();
    const now = new Date();
    const pDay = programDay(baseline, now);

    const actions = await db.action.findMany();
    const by = (s: string) => actions.filter((a) => a.status === s).length;

    const total = actions.length;
    const completed = by("COMPLETED") + by("APPROVED") + by("CLOSED");
    const inProgress = by("IN_PROGRESS") + by("IN_REVIEW") + by("WAITING_INFO") + by("NEEDS_FIX");
    const notStarted = by("READY") + by("DRAFT");
    const overdue = actions.filter((a) => a.dueDate && new Date(a.dueDate) < now && !["COMPLETED", "CLOSED", "APPROVED"].includes(a.status)).length;
    const dueIn7 = actions.filter((a) => a.dueDate && !["COMPLETED", "CLOSED", "APPROVED"].includes(a.status) && (new Date(a.dueDate).getTime() - now.getTime()) / 86400000 <= 7 && new Date(a.dueDate) >= now).length;
    const dueIn30 = actions.filter((a) => a.dueDate && !["COMPLETED", "CLOSED", "APPROVED"].includes(a.status) && (new Date(a.dueDate).getTime() - now.getTime()) / 86400000 <= 30 && new Date(a.dueDate) >= now).length;

    // درصد تحقق: میانگین وزنی پیشرفت اقدامات (قاعده محاسبه قابل ردیابی)
    const progressSum = actions.reduce((s, a) => s + a.progress, 0);
    const completionPct = total ? Math.round((progressSum / total)) : 0;
    const onTimePct = completed ? Math.round((actions.filter((a) => ["APPROVED", "COMPLETED", "CLOSED"].includes(a.status) && (!a.actualEndDate || !a.dueDate || new Date(a.actualEndDate) <= new Date(a.dueDate))).length / completed) * 100) : null;

    const groups = ["IMMEDIATE", "PHASE_30", "PHASE_60", "PHASE_90", "CONTINUOUS"].map((g) => {
      const ga = actions.filter((a) => a.groupKey === g);
      return {
        group: g,
        total: ga.length,
        done: ga.filter((a) => ["COMPLETED", "APPROVED", "CLOSED"].includes(a.status)).length,
        active: ga.filter((a) => !["COMPLETED", "APPROVED", "CLOSED"].includes(a.status)).length,
        avgProgress: ga.length ? Math.round(ga.reduce((s, a) => s + a.progress, 0) / ga.length) : 0,
      };
    });

    // پوشش معرفی رابط / مالک داده (شاخص ۲)
    const units = await db.orgUnit.findMany({ where: { isActive: true, type: { not: "COMMITTEE" } } });
    const liaisonCover = units.length ? Math.round((units.filter((u) => u.liaisonReported).length / units.length) * 100) : 0;
    const dataOwnerCover = units.length ? Math.round((units.filter((u) => u.dataOwnerReported).length / units.length) * 100) : 0;
    const briefingCover = units.length ? Math.round((units.filter((u) => u.internalBriefingDone).length / units.length) * 100) : 0;
    const statusReportCover = units.length ? Math.round((units.filter((u) => u.statusReportSubmitted).length / units.length) * 100) : 0;
    const maturityCover = units.length ? Math.round((units.filter((u) => u.maturitySubmitted).length / units.length) * 100) : 0;
    const projectsCover = units.length ? Math.round((units.filter((u) => u.projectsSubmitted).length / units.length) * 100) : 0;

    const docs = await db.document.findMany();
    const docStatus = {
      total: docs.length,
      issued: docs.filter((d) => d.status === "ISSUED").length,
      inReview: docs.filter((d) => d.status === "IN_REVIEW").length,
      draft: docs.filter((d) => d.status === "DRAFT").length,
      approved: docs.filter((d) => d.status === "APPROVED").length,
      needsUpload: docs.filter((d) => d.needsUpload).length,
    };

    const aiApps = await db.aiApplication.findMany();
    const aiStatus = {
      total: aiApps.length,
      operational: aiApps.filter((a) => a.status === "OPERATIONAL").length,
      notAssessed: aiApps.filter((a) => !a.evaluationResults).length,
      highRisk: aiApps.filter((a) => ["HIGH", "CRITICAL"].includes(a.riskLevel)).length,
      withoutOperationApproval: aiApps.filter((a) => !a.isRegisteredForOperation && ["PILOT", "OPERATIONAL"].includes(a.status)).length,
    };

    const projects = await db.project.findMany();
    const projStatus = {
      total: projects.length,
      drivers: projects.filter((p) => p.trackKey === "DRIVER").length,
      approved: projects.filter((p) => ["APPROVED", "PILOT", "SCALING"].includes(p.status)).length,
      scored: projects.filter((p) => p.scoreTotal != null).length,
      pending: projects.filter((p) => ["PROPOSED", "SCREENING", "INFO_COMPLETE"].includes(p.status)).length,
    };

    const risks = await db.risk.findMany();
    const riskStatus = {
      total: risks.length,
      open: risks.filter((r) => r.status === "OPEN").length,
      high: risks.filter((r) => r.probability * r.impact >= 15).length,
      monitoring: risks.filter((r) => r.status === "MONITORING").length,
    };

    const decisions = await db.decision.findMany();
    const decisionStatus = {
      total: decisions.length,
      pending: decisions.filter((d) => d.followUpStatus === "PENDING").length,
      overdue: decisions.filter((d) => d.followUpStatus === "OVERDUE" || (d.dueDate && new Date(d.dueDate) < now && d.followUpStatus !== "DONE")).length,
      done: decisions.filter((d) => d.followUpStatus === "DONE").length,
    };

    // عطف‌های زمانی کلیدی برنامه (از داده واقعی مهلت‌ها)
    const milestones = [
      { label: "گام‌های فوری (۱–۹)", day: 10 },
      { label: "مهلت ۳۰ روزه واحدها (۱۰–۱۷)", day: 30 },
      { label: "تصویب اسناد محوری (۱۸–۲۴)", day: 60 },
      { label: "موج نخست و گزارش ۹۰روزه (۲۵–۲۹)", day: 90 },
    ].map((m) => ({ ...m, date: dueFromDay(baseline, m.day), passed: pDay > m.day }));

    return json({
      programDay: pDay,
      baselineDate: baseline,
      counts: { total, completed, inProgress, notStarted, overdue, dueIn7, dueIn30 },
      percentages: { completionPct, onTimePct },
      groups,
      coverage: { liaisonCover, dataOwnerCover, briefingCover, statusReportCover, maturityCover, projectsCover, unitCount: units.length },
      docStatus, aiStatus, projStatus, riskStatus, decisionStatus, milestones,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
