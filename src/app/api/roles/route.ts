import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, json, handleApiError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const roles = await db.role.findMany({ where: { isActive: true }, orderBy: { key: "asc" } });
    return json({ roles: roles.map((r) => ({ ...r, permissions: JSON.parse(r.permissions) })) });
  } catch (e) {
    return handleApiError(e);
  }
}
