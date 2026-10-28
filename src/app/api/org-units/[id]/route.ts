import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, json, handleApiError, audit, fail } from "@/lib/api";
import { terminateUserSessions } from "@/lib/auth";

/** به‌روزرسانی واحد — شامل پوشش معرفی رابط/مالک داده (گام ۱۱) — تغییر ساختار بدون حذف تاریخچه */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "org:manage");
    const { id } = await params;
    const unit = await db.orgUnit.findUnique({ where: { id } });
    if (!unit) return fail(404, "واحد یافت نشد.", "NOT_FOUND");
    const body = await req.json();

    const data: Record<string, unknown> = {};
    for (const k of ["name", "managerName", "dtLiaison", "dataOwner", "dataCustodian"]) {
      if (body[k] != null) data[k] = String(body[k]);
    }
    for (const k of ["liaisonReported", "dataOwnerReported", "internalBriefingDone", "statusReportSubmitted", "maturitySubmitted", "projectsSubmitted", "isActive"]) {
      if (body[k] != null) data[k] = Boolean(body[k]);
    }

    const updated = await db.orgUnit.update({ where: { id }, data });
    await audit(user, "UPDATE", "ORG_UNIT", id, Object.keys(data));
    return json({ unit: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
