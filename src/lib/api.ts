import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, type AuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { GLOBAL_VIEW_ROLES } from "@/lib/constants";

// ───────────── کنترل دسترسی سمت سرور (RBAC) ─────────────
// قاعده: پیش‌فرض رد — مجوز فقط با تخصیص صریح. مخفی‌بودن منو کافی نیست.

export function can(user: AuthUser | null, permission: string): boolean {
  if (!user) return false;
  return user.permissions.includes("*") || user.permissions.includes(permission);
}

export function canAny(user: AuthUser | null, permissions: string[]): boolean {
  return permissions.some((p) => can(user, p));
}

/**
 * دید سراسری — نقش‌های دبیرخانه/شورا/حسابرس که داده‌های کل برنامه را می‌بینند.
 * سایر نقش‌ها فقط داده‌های واحد سازمانی خود (یا اقدامات محول‌شده شخصی) را می‌بینند.
 */
export function isGlobalViewer(user: AuthUser | null): boolean {
  if (!user) return false;
  return user.roles.some((r) => GLOBAL_VIEW_ROLES.includes(r.key));
}

/** فیلتر محدوده اقدامات برای نقش‌های غیرسراسری — واحد سازمانی یا اقدامات محول‌شده شخصی */
export function actionScopeFilter(user: AuthUser): Record<string, unknown> {
  if (isGlobalViewer(user)) return {};
  return user.orgUnitId
    ? { OR: [{ responsibleUnitId: user.orgUnitId }, { followUpOwnerId: user.id }] }
    : { followUpOwnerId: user.id };
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data as object, { status });
}

export function fail(status: number, message: string, code = "ERROR") {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** احراز هویت اجباری — در صورت نبود نشست معتبر ۴۰۱ */
export async function requireAuth(req: NextRequest): Promise<AuthUser> {
  const user = await getAuthUser(req);
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "نشست معتبری یافت نشد. لطفاً وارد شوید.");
  return user;
}

/** احراز هویت + مجوز اجباری */
export async function requirePermission(req: NextRequest, permission: string): Promise<AuthUser> {
  const user = await requireAuth(req);
  if (!can(user, permission)) {
    await db.auditLog.create({
      data: { userId: user.id, username: user.username, action: "ACCESS_DENIED", entityType: "PERMISSION", entityId: permission },
    }).catch(() => undefined);
    throw new ApiError(403, "FORBIDDEN", "شما مجوز انجام این عملیات را ندارید.");
  }
  return user;
}

export function handleApiError(e: unknown) {
  if (e instanceof ApiError) return fail(e.status, e.message, e.code);
  console.error("[API]", e);
  // بدون افشای اطلاعات فنی داخلی
  return fail(500, "خطای داخلی سامانه. لطفاً با پشتیبانی تماس بگیرید.", "INTERNAL");
}

/** ثبت رخداد حساس در سوابق ممیزی (بدون گذرواژه/کلید/محتوای حساس) */
export async function audit(user: AuthUser | null, action: string, entityType?: string, entityId?: string, details?: unknown, ip?: string) {
  try {
    await db.auditLog.create({
      data: {
        userId: user?.id ?? null,
        username: user?.username ?? null,
        action,
        entityType,
        entityId,
        details: details ? JSON.stringify(details) : undefined,
        ip,
      },
    });
  } catch (err) {
    console.error("[audit]", err);
  }
}

/** محدودیت نرخ ساده در حافظه — کنترل تلاش‌های ناموفق ورود */
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = rateBuckets.get(key);
  if (!b || b.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count++;
  return b.count <= limit;
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}
