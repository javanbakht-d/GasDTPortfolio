import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, json, handleApiError, audit, fail } from "@/lib/api";
import { hashPassword, terminateUserSessions } from "@/lib/auth";

/** ویرایش / غیرفعال‌سازی کاربر — غیرفعال‌سازی، نشست‌های فعال را خاتمه می‌دهد */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePermission(req, "users:manage");
    const { id } = await params;
    const target = await db.user.findUnique({ where: { id } });
    if (!target) return fail(404, "کاربر یافت نشد.", "NOT_FOUND");
    const body = await req.json();

    if (body.isActive === false) {
      if (target.id === admin.id) return fail(400, "غیرفعال‌سازی حساب خودتان مجاز نیست.", "SELF_DEACTIVATION");
      await terminateUserSessions(target.id);
      await db.auditLog.create({ data: { userId: admin.id, username: admin.username, action: "PERMISSION_CHANGE", entityType: "USER_DEACTIVATED", entityId: target.id } });
    }

    const data: Record<string, unknown> = {};
    if (body.fullName != null) data.fullName = String(body.fullName);
    if (body.email != null) data.email = String(body.email);
    if (body.title != null) data.title = String(body.title);
    if (body.orgUnitId !== undefined) data.orgUnitId = body.orgUnitId || null;
    if (body.isActive != null) data.isActive = Boolean(body.isActive);
    if (body.password) {
      const pw = String(body.password);
      if (pw.length < 8) return fail(400, "گذرواژه باید حداقل ۸ نویسه باشد.", "WEAK_PASSWORD");
      data.passwordHash = hashPassword(pw);
      await terminateUserSessions(target.id);
    }

    const updated = await db.user.update({ where: { id }, data });

    // تغییر نقش‌ها
    if (Array.isArray(body.roleKeys)) {
      await db.userRole.deleteMany({ where: { userId: id } });
      for (const rk of body.roleKeys) {
        const role = await db.role.findUnique({ where: { key: rk } });
        if (role) await db.userRole.create({ data: { userId: id, roleId: role.id } });
      }
      await db.auditLog.create({ data: { userId: admin.id, username: admin.username, action: "PERMISSION_CHANGE", entityType: "USER_ROLES", entityId: id, details: JSON.stringify(body.roleKeys) } });
    }

    await audit(admin, "UPDATE", "USER", id, Object.keys(data));
    return json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
