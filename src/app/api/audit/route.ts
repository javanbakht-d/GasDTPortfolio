import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, json, handleApiError } from "@/lib/api";

/** سوابق ممیزی — تفکیک‌شده از گزارش‌های معمول؛ بدون گذرواژه/کلید/محتوای حساس */
export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "audit:view");
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const take = 50;
    const logs = await db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
      include: { user: { select: { fullName: true } } },
    });
    const total = await db.auditLog.count();
    return json({ logs, total, page, pages: Math.ceil(total / take) });
  } catch (e) {
    return handleApiError(e);
  }
}
