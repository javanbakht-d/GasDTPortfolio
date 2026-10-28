import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, json, handleApiError, audit, fail } from "@/lib/api";

/** ثبت اندازه‌گیری شاخص */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "kpis:measure");
    const { id } = await params;
    const kpi = await db.kpi.findUnique({ where: { id } });
    if (!kpi) return fail(404, "شاخص یافت نشد.", "NOT_FOUND");
    const body = await req.json();
    const value = String(body.value ?? "").trim();
    const period = String(body.period ?? "").trim();
    if (!value || !period) return fail(400, "مقدار و دوره اندازه‌گیری الزامی است.", "BAD_INPUT");
    const m = await db.kpiMeasurement.create({ data: { kpiId: id, period, value, note: body.note ?? null, recordedById: user.id } });
    await db.kpi.update({ where: { id }, data: { lastUpdatedAt: new Date() } });
    await audit(user, "CREATE", "KPI_MEASUREMENT", id, { period, value });
    return json({ measurement: m }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
