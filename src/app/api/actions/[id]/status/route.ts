import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission, json, handleApiError, audit, fail } from "@/lib/api";
import { ACTION_TRANSITIONS } from "@/lib/constants";

const APPROVE_PERM_STATUSES = ["APPROVED", "COMPLETED", "CLOSED", "HALTED"];

/** تغییر وضعیت گردش کار — تابع قواعد معتبر، با ثبت ردپا */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const action = await db.action.findUnique({ where: { id } });
    if (!action) return fail(404, "اقدام یافت نشد.", "NOT_FOUND");

    const body = await req.json();
    const toStatus = String(body.toStatus ?? "");
    const content = String(body.content ?? "").trim();
    if (!toStatus || !ACTION_TRANSITIONS[action.status]?.includes(toStatus)) {
      return fail(400, `انتقال وضعیت از «${action.status}» به «${toStatus}» مطابق گردش کار مجاز نیست.`, "INVALID_TRANSITION");
    }

    // تأیید/تکمیل/توقف/بستن نیازمند نقش مجاز
    if (APPROVE_PERM_STATUSES.includes(toStatus)) {
      const allowed = user.permissions.includes("*") || user.permissions.some((p) => ["actions:approve", "actions:close", "actions:manage"].includes(p));
      if (!allowed) return fail(403, "تأیید و بستن اقدام نیازمند نقش مجاز است (تفکیک تأیید از ایجادکننده).", "APPROVE_FORBIDDEN");
    }
    if (toStatus === "OVERDUE" && !content) {
      return fail(400, "ثبت وضعیت معوق نیازمند ثبت علت تأخیر است.", "REASON_REQUIRED");
    }

    // تکمیل اقدام مهم: خروجی و پیشرفت
    if (toStatus === "COMPLETED" && action.progress < 100) {
      return fail(400, "برای تکمیل اقدام، پیشرفت باید ۱۰۰٪ ثبت شده باشد.", "PROGRESS_REQUIRED");
    }

    const data: Record<string, unknown> = { status: toStatus };
    if (toStatus === "OVERDUE") data.delayReason = content;
    if (toStatus === "COMPLETED") data.actualEndDate = new Date();
    if (toStatus === "OVERDUE" && action.dueDate && new Date(action.dueDate) < new Date()) data.status = "OVERDUE";

    const updated = await db.action.update({ where: { id }, data });

    await db.actionUpdate.create({
      data: { actionId: id, userId: user.id, type: toStatus === "OVERDUE" ? "DELAY_REPORT" : "STATUS_CHANGE", fromStatus: action.status, toStatus, content: content || `تغییر وضعیت به «${toStatus}»` },
    });

    // اعلان به مسئول پیگیری
    if (action.followUpOwnerId && action.followUpOwnerId !== user.id) {
      await db.notification.create({
        data: { userId: action.followUpOwnerId, type: "STATUS_CHANGE", title: `گام ${action.refStep}: تغییر وضعیت`, body: `${action.title} — وضعیت جدید ثبت شد.`, relatedType: "ACTION", relatedId: id },
      });
    }
    await audit(user, "STATUS_CHANGE", "ACTION", id, { from: action.status, to: toStatus });
    return json({ action: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
