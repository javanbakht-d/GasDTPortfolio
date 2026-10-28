import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, json, handleApiError, audit, fail } from "@/lib/api";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "risks:manage");
    const { id } = await params;
    const risk = await db.risk.findUnique({ where: { id } });
    if (!risk) return fail(404, "ریسک یافت نشد.", "NOT_FOUND");
    const body = await req.json();
    const data: Record<string, unknown> = {};
    for (const k of ["owner", "preventiveAction", "responsePlan", "relatedTitle"]) {
      if (body[k] != null) data[k] = String(body[k]);
    }
    if (body.probability != null) data.probability = Math.max(1, Math.min(5, Number(body.probability)));
    if (body.impact != null) data.impact = Math.max(1, Math.min(5, Number(body.impact)));
    if (body.status != null && ["OPEN", "MONITORING", "MITIGATED", "CLOSED"].includes(body.status)) data.status = body.status;
    if (body.dueDate != null) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;

    const updated = await db.risk.update({ where: { id }, data });
    await audit(user, "UPDATE", "RISK", id, Object.keys(data));
    return json({ risk: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
