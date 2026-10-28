import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission, json, handleApiError, audit, fail } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const units = await db.orgUnit.findMany({
      include: { parent: { select: { name: true } }, _count: { select: { users: true, actions: true, projects: true } } },
      orderBy: { sortOrder: "asc" },
    });
    return json({ units });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, "org:manage");
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (!name) return fail(400, "نام واحد الزامی است.", "BAD_INPUT");
    const unit = await db.orgUnit.create({
      data: { code: body.code || `U${Date.now().toString(36).toUpperCase()}`, name, type: body.type ?? "HQ_DIRECTORATE", parentId: body.parentId || null, managerName: body.managerName ?? null },
    });
    await audit(user, "CREATE", "ORG_UNIT", unit.id, { name });
    return json({ unit }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
