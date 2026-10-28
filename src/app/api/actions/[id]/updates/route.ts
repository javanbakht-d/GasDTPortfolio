import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, json, handleApiError, fail } from "@/lib/api";

/** افزودن گزارش پیشرفت / توضیح / یادآوری به اقدام */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const action = await db.action.findUnique({ where: { id } });
    if (!action) return fail(404, "اقدام یافت نشد.", "NOT_FOUND");

    const body = await req.json();
    const content = String(body.content ?? "").trim();
    if (!content) return fail(400, "متن گزارش الزامی است.", "BAD_INPUT");
    const type = ["COMMENT", "PROGRESS", "REMINDER", "DELAY_REPORT", "REMEDIAL", "DECISION", "DRAFT", "FOLLOWUP"].includes(body.type) ? body.type : "COMMENT";

    const upd = await db.actionUpdate.create({
      data: { actionId: id, userId: user.id, type, progress: body.progress != null ? Number(body.progress) : null, content },
    });
    if (type === "REMINDER") {
      await db.auditLog.create({ data: { userId: user.id, username: user.username, action: "REMINDER_SENT", entityType: "ACTION", entityId: id } });
    }
    // ثبت پیگیری انجام‌شده — آخرین پیگیری به‌روزرسانی می‌شود
    if (type === "FOLLOWUP") {
      await db.action.update({ where: { id }, data: { lastFollowUpAt: new Date() } }).catch(() => undefined);
      await db.auditLog.create({ data: { userId: user.id, username: user.username, action: "FOLLOWUP", entityType: "ACTION", entityId: id } });
    }
    return json({ update: { ...upd, user: { fullName: user.fullName } } }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const updates = await db.actionUpdate.findMany({ where: { actionId: id }, orderBy: { createdAt: "desc" }, include: { user: { select: { fullName: true } } } });
    return json({ updates });
  } catch (e) {
    return handleApiError(e);
  }
}
