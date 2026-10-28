import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, json, handleApiError, audit, fail } from "@/lib/api";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "decisions:manage");
    const { id } = await params;
    const dec = await db.decision.findUnique({ where: { id } });
    if (!dec) return fail(404, "مصوبه یافت نشد.", "NOT_FOUND");
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.content != null) data.content = String(body.content);
    if (body.responsible != null) data.responsible = String(body.responsible);
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.followUpStatus && ["PENDING", "IN_PROGRESS", "DONE", "OVERDUE"].includes(body.followUpStatus)) data.followUpStatus = body.followUpStatus;

    const updated = await db.decision.update({ where: { id }, data });
    await audit(user, "UPDATE", "DECISION", id, Object.keys(data));
    return json({ decision: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
