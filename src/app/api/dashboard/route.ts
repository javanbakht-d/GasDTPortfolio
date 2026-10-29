import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, json, handleApiError, isGlobalViewer } from "@/lib/api";
import { getBaselineDate, programDay, dueFromDay } from "@/lib/persian-date";

/**
 * داشبورد — همه اعداد از پایگاه داده محاسبه می‌شوند؛ عدد نمایشی ثابت وجود ندارد.
 * محدوده داده: نقش‌های دبیرخانه/شورا/حسابرس — کل برنامه؛ سایر نقش‌ها — فقط داده‌های واحد خود
 * (مطابق شرح وظایف؛ اطلاعات خارج از حوزه نقش نمایش داده نمی‌شود).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const globalView = isGlobalViewer(user);
    const unitId = user.orgUnitId ?? null;

    const baseline = await getBaselineDate();
    const now = new Date();
    const pDay = programDay(baseline, now);

    // ── اقدامات: محدود به واحد سازمانی کاربر برای نقش‌های غیرسراسری ──
    const actionScope = globalView
      ? {}
      : unitId
        ? { OR: [{ responsibleUnitId: unitId }, { followUpOwnerId: user.id }] }
        : { followUpOwnerId: user.id };
    const actions = await db.action.findMany({ where: actionScope });
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

    // ── پوشش تعهدات واحدها — فقط برای نقش‌های سراسری دبیرخانه/شورا ──
    type Coverage = { liaisonCover: number; dataOwnerCover: number; briefingCover: number; statusReportCover: number; maturityCover: number; projectsCover: number; unitCount: number };
    let coverage: Coverage | null = null;
    let unitObligations: { liaisonReported: boolean; dataOwnerReported: boolean; internalBriefingDone: boolean; statusReportSubmitted: boolean; maturitySubmitted: boolean; projectsSubmitted: boolean } | null = null;
    let unitName: string | null = null;
    if (globalView) {
      const units = await db.orgUnit.findMany({ where: { isActive: true, type: { not: "COMMITTEE" } } });
      type UnitFlag = "liaisonReported" | "dataOwnerReported" | "internalBriefingDone" | "statusReportSubmitted" | "maturitySubmitted" | "projectsSubmitted";
      const pct = (flag: UnitFlag) => (units.length ? Math.round((units.filter((u) => u[flag]).length / units.length) * 100) : 0);
      coverage = {
        liaisonCover: pct("liaisonReported"),
        dataOwnerCover: pct("dataOwnerReported"),
        briefingCover: pct("internalBriefingDone"),
        statusReportCover: pct("statusReportSubmitted"),
        maturityCover: pct("maturitySubmitted"),
        projectsCover: pct("projectsSubmitted"),
        unitCount: units.length,
      };
    } else if (unitId) {
      // نقش واحد: وضعیت تعهدات شش‌گانه واحد خود
      const unit = await db.orgUnit.findUnique({ where: { id: unitId } });
      if (unit) {
        unitName = unit.name;
        unitObligations = {
          liaisonReported: unit.liaisonReported,
          dataOwnerReported: unit.dataOwnerReported,
          internalBriefingDone: unit.internalBriefingDone,
          statusReportSubmitted: unit.statusReportSubmitted,
          maturitySubmitted: unit.maturitySubmitted,
          projectsSubmitted: unit.projectsSubmitted,
        };
      }
    }

    // ── اسناد: نقش‌های غیرسراسری فقط اسناد عمومی/داخلی یا واحد خود ──
    const docScope = globalView
      ? {}
      : { OR: [{ classification: { in: ["PUBLIC", "INTERNAL"] } }, ...(unitId ? [{ ownerUnitId: unitId }] : [])] };
    const docs = await db.document.findMany({ where: docScope });
    const docStatus = {
      total: docs.length,
      issued: docs.filter((d) => d.status === "ISSUED").length,
      inReview: docs.filter((d) => d.status === "IN_REVIEW").length,
      draft: docs.filter((d) => d.status === "DRAFT").length,
      approved: docs.filter((d) => d.status === "APPROVED").length,
      needsUpload: docs.filter((d) => d.needsUpload).length,
    };

    // ── هوش مصنوعی و سبد پروژه‌ها: محدود به واحد برای نقش‌های غیرسراسری ──
    const aiScope = globalView || !unitId ? {} : { ownerUnitId: unitId };
    const aiApps = await db.aiApplication.findMany({ where: aiScope });
    const aiStatus = {
      total: aiApps.length,
      operational: aiApps.filter((a) => a.status === "OPERATIONAL").length,
      notAssessed: aiApps.filter((a) => !a.evaluationResults).length,
      highRisk: aiApps.filter((a) => ["HIGH", "CRITICAL"].includes(a.riskLevel)).length,
      withoutOperationApproval: aiApps.filter((a) => !a.isRegisteredForOperation && ["PILOT", "OPERATIONAL"].includes(a.status)).length,
    };

    const projScope = globalView
      ? {}
      : { OR: [{ proposingUnitId: unitId ?? "__none__" }, { trackKey: "DRIVER" }] };
    const projects = await db.project.findMany({ where: projScope });
    const projStatus = {
      total: projects.length,
      drivers: projects.filter((p) => p.trackKey === "DRIVER").length,
      approved: projects.filter((p) => ["APPROVED", "PILOT", "SCALING"].includes(p.status)).length,
      scored: projects.filter((p) => p.scoreTotal != null).length,
      pending: projects.filter((p) => ["PROPOSED", "SCREENING", "INFO_COMPLETE"].includes(p.status)).length,
    };

    // ── ریسک‌ها و مصوبات شورا — اطلاعات حکمرانی کلان؛ فقط برای نقش‌های سراسری ──
    let riskStatus: { total: number; open: number; high: number; monitoring: number } | null = null;
    let decisionStatus: { total: number; pending: number; overdue: number; done: number } | null = null;
    if (globalView) {
      const risks = await db.risk.findMany();
      riskStatus = {
        total: risks.length,
        open: risks.filter((r) => r.status === "OPEN").length,
        high: risks.filter((r) => r.probability * r.impact >= 15).length,
        monitoring: risks.filter((r) => r.status === "MONITORING").length,
      };
      const decisions = await db.decision.findMany();
      decisionStatus = {
        total: decisions.length,
        pending: decisions.filter((d) => d.followUpStatus === "PENDING").length,
        overdue: decisions.filter((d) => d.followUpStatus === "OVERDUE" || (d.dueDate && new Date(d.dueDate) < now && d.followUpStatus !== "DONE")).length,
        done: decisions.filter((d) => d.followUpStatus === "DONE").length,
      };
    }

    // عطف‌های زمانی کلیدی برنامه (از داده واقعی مهلت‌ها) — تقویم برنامه برای همه نقش‌ها
    const milestones = [
      { label: "گام‌های فوری (۱–۹)", day: 10 },
      { label: "مهلت ۳۰ روزه واحدها (۱۰–۱۷)", day: 30 },
      { label: "تصویب اسناد محوری (۱۸–۲۴)", day: 60 },
      { label: "موج نخست و گزارش ۹۰روزه (۲۵–۲۹)", day: 90 },
    ].map((m) => ({ ...m, date: dueFromDay(baseline, m.day), passed: pDay > m.day }));

    return json({
      scope: globalView ? "GLOBAL" : "UNIT",
      unitName,
      programDay: pDay,
      baselineDate: baseline,
      counts: { total, completed, inProgress, notStarted, overdue, dueIn7, dueIn30 },
      percentages: { completionPct, onTimePct },
      groups,
      coverage,
      unitObligations,
      docStatus, aiStatus, projStatus, riskStatus, decisionStatus, milestones,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
