import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, json, handleApiError, audit, fail } from "@/lib/api";
import { hashPassword } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "users:view");
    const users = await db.user.findMany({
      include: { roles: { include: { role: { select: { key: true, name: true } } } }, orgUnit: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return json({
      users: users.map((u) => ({
        id: u.id, username: u.username, fullName: u.fullName, email: u.email, title: u.title,
        isActive: u.isActive, lastLoginAt: u.lastLoginAt,
        orgUnit: u.orgUnit, roles: u.roles.map((r) => r.role),
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "users:manage");
    const body = await req.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    const fullName = String(body.fullName ?? "").trim();
    const password = String(body.password ?? "");
    if (!username || !fullName || password.length < 8) return fail(400, "نام کاربری، نام کامل و گذرواژه (حداقل ۸ نویسه) الزامی است.", "BAD_INPUT");
    const exists = await db.user.findUnique({ where: { username } });
    if (exists) return fail(409, "این نام کاربری قبلاً ثبت شده است.", "DUPLICATE");

    const user = await db.user.create({
      data: { username, fullName, passwordHash: hashPassword(password), email: body.email ?? null, title: body.title ?? null, orgUnitId: body.orgUnitId || null },
    });
    if (Array.isArray(body.roleKeys)) {
      for (const rk of body.roleKeys) {
        const role = await db.role.findUnique({ where: { key: rk } });
        if (role) await db.userRole.create({ data: { userId: user.id, roleId: role.id } });
      }
    }
    await audit(admin, "CREATE", "USER", user.id, { username });
    return json({ user: { id: user.id, username: user.username } }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
