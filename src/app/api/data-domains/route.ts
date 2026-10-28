import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission, json, handleApiError, audit, fail } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const domains = await db.dataDomain.findMany({ include: { ownerUnit: { select: { name: true } } }, orderBy: { code: "asc" } });
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
