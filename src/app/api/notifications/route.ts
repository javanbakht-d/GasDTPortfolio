import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, json, handleApiError, fail } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const notifications = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
    return json({ notifications, unread: notifications.filter((n) => !n.isRead).length });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    if (body.id) {
      await db.notification.updateMany({ where: { id: String(body.id), userId: user.id }, data: { isRead: true } });
    } else {
      await db.notification.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true } });
    }
    return json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
