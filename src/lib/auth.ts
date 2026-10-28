import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";

export const SESSION_COOKIE = "nigc_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // ۱۲ ساعت

export type AuthUser = {
  id: string;
  username: string;
  fullName: string;
  title?: string | null;
  orgUnitId?: string | null;
  orgUnitName?: string | null;
  roles: { key: string; name: string; permissions: string[] }[];
  permissions: string[];
};

export function hashPassword(pw: string) {
  return bcrypt.hashSync(pw, 10);
}

export function verifyPassword(pw: string, hash: string) {
  return bcrypt.compareSync(pw, hash);
}

/** ورود: بررسی اعتبار و ساخت نشست سمت سرور */
export async function login(username: string, password: string, ip?: string, userAgent?: string) {
  const user = await db.user.findUnique({
    where: { username },
    include: { roles: { include: { role: true } }, orgUnit: true },
  });
  if (!user || !user.isActive) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: { id: token, userId: user.id, expiresAt, ip, userAgent },
  });
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await db.auditLog.create({
    data: { userId: user.id, username: user.username, action: "LOGIN", entityType: "SESSION", entityId: token.slice(0, 8), ip },
  });
  return { token, expiresAt, user: toAuthUser(user) };
}

type UserWithRelations = NonNullable<Awaited<ReturnType<typeof loadUser>>>;

async function loadUser(id: string) {
  return db.user.findUnique({
    where: { id },
    include: { roles: { include: { role: true } }, orgUnit: true },
  });
}

export function toAuthUser(u: UserWithRelations): AuthUser {
  const roles = u.roles.filter((r) => r.role.isActive).map((r) => ({
    key: r.role.key,
    name: r.role.name,
    permissions: JSON.parse(r.role.permissions) as string[],
  }));
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    title: u.title,
    orgUnitId: u.orgUnitId,
    orgUnitName: u.orgUnit?.name ?? null,
    roles,
    permissions: Array.from(new Set(roles.flatMap((r) => r.permissions))),
  };
}

/** دریافت کاربر جاری از کوکی نشست */
export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { id: token } });
  if (!session || session.expiresAt < new Date()) return null;
  const u = await loadUser(session.userId);
  if (!u || !u.isActive) return null;
  return toAuthUser(u);
}

export async function logout(token: string) {
  const session = await db.session.findUnique({ where: { id: token } });
  if (session) {
    await db.session.delete({ where: { id: token } });
    await db.auditLog.create({
      data: { userId: session.userId, action: "LOGOUT", entityType: "SESSION", entityId: token.slice(0, 8) },
    });
  }
}

/** خاتمه همه نشست‌های کاربر (مثلاً هنگام غیرفعال‌سازی) */
export async function terminateUserSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}
