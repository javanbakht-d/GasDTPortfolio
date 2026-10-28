import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, json, handleApiError, audit, fail } from "@/lib/api";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "deviations:manage");
    const { id } = await params;
    const dev = await db.deviation.findUnique({ where: { id } });
    if (!dev) return fail(404, "انحراف یافت نشد.", "NOT_FOUND");
    const body = await req.json();
    const data: Record<string, unknown> = {};
    for (const k of ["responsible", "remedialAction", "cause"]) {
      if (body[k] != null) data[k] = String(body[k]);
    }
    if (body.severity != null && ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(body.severity)) data.severity = body.severity;
    if (body.status != null && ["OPEN", "REMEDIAL_IN_PROGRESS", "RESOLVED", "CLOSED"].includes(body.status)) data.status = body.status;
    if (body.remedialDueDate != null) data.remedialDueDate = body.remedialDueDate ? new Date(body.remedialDueDate) : null;

    const updated = await db.deviation.update({ where: { id }, data });
    await audit(user, "UPDATE", "DEVIATION", id, Object.keys(data));
    return json({ deviation: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
