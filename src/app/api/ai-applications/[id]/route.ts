import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission, json, handleApiError, audit, fail } from "@/lib/api";

const AI_FLOW: Record<string, string[]> = {
  PROPOSED: ["EVALUATING", "STOPPED"],
  EVALUATING: ["PILOT", "APPROVED", "STOPPED"],
  PILOT: ["APPROVED", "OPERATIONAL", "STOPPED"],
  APPROVED: ["OPERATIONAL", "STOPPED"],
  OPERATIONAL: ["STOPPED", "RETIRED"],
  STOPPED: ["RETIRED"],
  RETIRED: [],
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const app = await db.aiApplication.findUnique({ where: { id }, include: { ownerUnit: { select: { name: true } } } });
    if (!app) return fail(404, "کاربرد یافت نشد.", "NOT_FOUND");
    return json({ application: app });
  } catch (e) {
    return handleApiError(e);
  }
}

/** ارزیابی/تصویب کاربرد هوش مصنوعی — پرریسک نیازمند بررسی تکمیلی و تأیید انسانی */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "ai_registry:manage");
    const { id } = await params;
    const app = await db.aiApplication.findUnique({ where: { id } });
    if (!app) return fail(404, "کاربرد یافت نشد.", "NOT_FOUND");
    const body = await req.json();

    if (body.status && !AI_FLOW[app.status]?.includes(body.status)) {
      return fail(400, "انتقال وضعیت کاربرد مطابق چرخه مجاز نیست.", "INVALID_TRANSITION");
    }
    if (body.status === "OPERATIONAL" && app.riskLevel === "HIGH" && !body.humanApprovalNote) {
      return fail(400, "کاربرد پرریسک نیازمند ثبت تأیید انسانی و بررسی تکمیلی است.", "HUMAN_APPROVAL_REQUIRED");
    }
    // قاعده حاکمیتی: ثبت‌شدن به‌تنهایی مجوز بهره‌برداری نیست
    if (body.status === "OPERATIONAL" && !app.evaluationResults && !body.evaluationResults) {
      return fail(400, "بهره‌برداری رسمی نیازمند ثبت نتایج ارزیابی معتبر است («بدون ثبت و ارزیابی، بهره‌برداری ممنوع»).", "ASSESSMENT_REQUIRED");
    }

    const data: Record<string, unknown> = {};
    for (const k of ["businessOwner", "problem", "useType", "businessProcess", "providerModel", "inputData", "outputData", "dataSources", "humanOversight", "constraints", "acceptanceCriteria", "successMetrics", "evaluationResults", "authorizationDocs", "reviewResponsible"]) {
      if (body[k] != null) data[k] = String(body[k]);
    }
    if (body.riskLevel != null && ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(body.riskLevel)) data.riskLevel = body.riskLevel;
    if (body.classification != null) data.classification = String(body.classification);
    if (body.isRegisteredForOperation != null) data.isRegisteredForOperation = Boolean(body.isRegisteredForOperation) && Boolean(data.evaluationResults ?? app.evaluationResults);
    if (body.status) data.status = body.status;
    if (body.markReviewed) data.lastReviewAt = new Date();

    const updated = await db.aiApplication.update({ where: { id }, data });
    await audit(user, "UPDATE", "AI_APPLICATION", id, Object.keys(data));
    return json({ application: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
