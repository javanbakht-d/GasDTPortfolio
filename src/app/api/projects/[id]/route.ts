import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, json, handleApiError, audit, fail, isGlobalViewer } from "@/lib/api";

const PROJECT_FLOW: Record<string, string[]> = {
  PROPOSED: ["SCREENING", "REJECTED"],
  SCREENING: ["INFO_COMPLETE", "REJECTED"],
  INFO_COMPLETE: ["SCORED", "PROPOSED"],
  SCORED: ["RECOMMENDED", "INFO_COMPLETE"],
  RECOMMENDED: ["APPROVED", "REJECTED", "SCORED"],
  APPROVED: ["PILOT", "STOPPED"],
  REJECTED: ["PROPOSED"],
  PILOT: ["EVALUATING", "STOPPED"],
  EVALUATING: ["GATE_DECISION", "PILOT"],
  GATE_DECISION: ["SCALING", "STOPPED"],
  SCALING: ["STOPPED"],
  STOPPED: [],
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "projects:view");
    const { id } = await params;
    const project = await db.project.findUnique({ where: { id }, include: { proposingUnit: { select: { name: true } }, scores: { orderBy: { criterion: "asc" } } } });
    if (!project) return fail(404, "پروژه یافت نشد.", "NOT_FOUND");

    // محدودسازی بین‌واحدی — پروژه‌های واحد خود + پیشران‌های برنامه ابلاغی (نقش‌های دبیرخانه: کل سبد)
    const inScope = isGlobalViewer(user)
      || project.trackKey === "DRIVER"
      || (user.orgUnitId != null && project.proposingUnitId === user.orgUnitId);
    if (!inScope) return fail(403, "دسترسی به پروژه‌های واحد دیگر مجاز نیست.", "FORBIDDEN");

    return json({ project, allowedTransitions: PROJECT_FLOW[project.status] ?? [] });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "projects:edit");
    const { id } = await params;
    const project = await db.project.findUnique({ where: { id } });
    if (!project) return fail(404, "پروژه یافت نشد.", "NOT_FOUND");
    const body = await req.json();

    // تصویب سبد/موج نیازمند مجوز شورا — تصمیم حاکمیتی در اختیار مرجع مجاز
    if (body.status === "APPROVED" || body.status === "REJECTED") {
      const allowed = user.permissions.includes("*") || user.permissions.includes("projects:approve");
      if (!allowed) return fail(403, "تصویب/رد پروژه فقط در اختیار شورای راهبری است.", "APPROVE_FORBIDDEN");
    }
    if (body.status && !PROJECT_FLOW[project.status]?.includes(body.status)) {
      return fail(400, "انتقال وضعیت پروژه مطابق چرخه مجاز نیست.", "INVALID_TRANSITION");
    }

    const data: Record<string, unknown> = {};
    for (const k of ["businessOwner", "projectManager", "problem", "goals", "scope", "deliverables", "timeline", "milestones", "budgetEstimate", "resources", "dependencies", "dataReadiness", "securityNotes", "risks", "assumptions", "successMetrics", "benefitBaseline", "benefitTarget", "benefitActual"]) {
      if (body[k] != null) data[k] = String(body[k]);
    }
    if (body.status) {
      data.status = body.status;
      if (body.status === "APPROVED") data.approvedAt = new Date();
    }

    const updated = await db.project.update({ where: { id }, data });
    await audit(user, "UPDATE", "PROJECT", id, Object.keys(data));
    return json({ project: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
