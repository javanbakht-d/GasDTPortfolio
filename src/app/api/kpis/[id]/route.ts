import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, json, handleApiError, audit, fail } from "@/lib/api";

/** ویرایش تعریف شاخص + ثبت اندازه‌گیری — خط مبنا فقط پس از تصویب رسمی (گام ۲۶) */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "kpis:manage");
    const { id } = await params;
    const kpi = await db.kpi.findUnique({ where: { id } });
    if (!kpi) return fail(404, "شاخص یافت نشد.", "NOT_FOUND");
    const body = await req.json();

    // تعیین/تغییر خط مبنا = تصمیم حاکمیتی — نیازمند مجوز و ثبت مرجع تأیید
    if (body.baseline != null && body.baseline !== kpi.baseline) {
      const allowed = user.permissions.includes("*") || user.permissions.includes("kpis:manage");
      if (!allowed) return fail(403, "تعیین خط مبنا نیازمند مجوز است.", "BASELINE_FORBIDDEN");
      if (!body.baselineApprovalRef) return fail(400, "ثبت خط مبنا نیازمند مرجع تأیید (مصوبه/شماره مصوبه) است.", "APPROVAL_REF_REQUIRED");
    }

    const data: Record<string, unknown> = {};
    for (const k of ["definition", "formula", "unit", "dataSource", "owner", "target", "reportingCycle", "dataQuality"]) {
      if (body[k] != null) data[k] = String(body[k]);
    }
    if (body.baseline != null) data.baseline = String(body.baseline);
    if (body.needsDefinition != null) data.needsDefinition = Boolean(body.needsDefinition);
    data.lastUpdatedAt = new Date();

    const updated = await db.kpi.update({ where: { id }, data });
    await audit(user, "UPDATE", "KPI", id, Object.keys(data));
    return json({ kpi: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
