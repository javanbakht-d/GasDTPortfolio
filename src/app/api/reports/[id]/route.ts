import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, json, handleApiError, audit, fail } from "@/lib/api";

/** نهایی‌سازی/ارسال گزارش دوره‌ای */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "reports:create");
    const { id } = await params;
    const report = await db.report.findUnique({ where: { id } });
    if (!report) return fail(404, "گزارش یافت نشد.", "NOT_FOUND");
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.title != null) data.title = String(body.title);
    if (body.summary != null) data.summary = String(body.summary);
    if (body.content != null) data.content = String(body.content);
    if (body.period != null) data.period = String(body.period);
    if (body.status && ["DRAFT", "FINAL", "SUBMITTED"].includes(body.status)) data.status = body.status;
    const updated = await db.report.update({ where: { id }, data });
    await audit(user, "UPDATE", "REPORT", id, Object.keys(data));
    return json({ report: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
