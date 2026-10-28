import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission, json, handleApiError, audit, fail } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const kpis = await db.kpi.findMany({ include: { measurements: { orderBy: { recordedAt: "desc" }, take: 6 } }, orderBy: { code: "asc" } });
    return json({ kpis });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, "kpis:manage");
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (!name) return fail(400, "نام شاخص الزامی است.", "BAD_INPUT");
    const count = await db.kpi.count();
    const kpi = await db.kpi.create({
      data: { code: body.code || `KPI-${count + 9}`, name, definition: body.definition ?? null, formula: body.formula ?? null, unit: body.unit ?? null, dataSource: body.dataSource ?? null, owner: body.owner ?? null, target: body.target ?? null, reportingCycle: body.reportingCycle ?? null, needsDefinition: !body.definition, sourceRef: body.sourceRef ?? null },
    });
    await audit(user, "CREATE", "KPI", kpi.id, { name });
    return json({ kpi }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
