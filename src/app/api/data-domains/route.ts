import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission, json, handleApiError, audit, fail, isGlobalViewer } from "@/lib/api";

/** لیست حوزه‌های داده — حوزه‌های محرمانه فقط برای واحد مالک و نقش‌های مجاز */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const globalView = isGlobalViewer(user);
    const scope = globalView
      ? {}
      : user.orgUnitId
        ? { OR: [{ ownerUnitId: user.orgUnitId }, { classification: { in: ["PUBLIC", "INTERNAL"] } }] }
        : { classification: { in: ["PUBLIC", "INTERNAL"] } };
    const domains = await db.dataDomain.findMany({ where: scope, include: { ownerUnit: { select: { name: true } } }, orderBy: { code: "asc" } });
    return json({ domains });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, "governance:manage");
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (!name) return fail(400, "نام حوزه داده الزامی است.", "BAD_INPUT");
    const count = await db.dataDomain.count();
    const domain = await db.dataDomain.create({
      data: { code: body.code || `DD-${count + 1}`, name, description: body.description ?? null, ownerUnitId: body.ownerUnitId ?? user.orgUnitId ?? null, dataOwnerName: body.dataOwnerName ?? null, dataCustodianName: body.dataCustodianName ?? null, classification: body.classification ?? "INTERNAL", systems: body.systems ?? null, notes: body.notes ?? null },
    });
    await audit(user, "CREATE", "DATA_DOMAIN", domain.id, { name });
    return json({ domain }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
