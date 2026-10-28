import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission, json, handleApiError, audit, fail } from "@/lib/api";
import { getBaselineDate, dueFromDay } from "@/lib/persian-date";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const action = await db.action.findUnique({
      where: { id },
      include: {
        responsibleUnit: { select: { id: true, name: true, code: true } },
        followUpOwner: { select: { id: true, fullName: true } },
        updates: { orderBy: { createdAt: "desc" }, include: { user: { select: { fullName: true } } } },
      },
    });
    if (!action) return fail(404, "اقدام یافت نشد.", "NOT_FOUND");

    // محدودسازی دید بین‌واحدی
    const globalView = user.roles.some((r) => ["SYSTEM_ADMIN", "SECRETARIAT_ADMIN", "CONFIG_ADMIN", "COUNCIL_SECRETARY", "COUNCIL_MEMBER", "AUDITOR", "REPORT_MANAGER"].includes(r.key));
    if (!globalView && user.orgUnitId && action.responsibleUnitId !== user.orgUnitId) {
      return fail(403, "دسترسی به اقدامات واحد دیگر مجاز نیست.", "FORBIDDEN");
    }

    // وابستگی‌ها
    const depSteps = action.dependencies ? (JSON.parse(action.dependencies) as number[]) : [];
    const deps = depSteps.length
      ? await db.action.findMany({ where: { refStep: { in: depSteps } }, select: { refStep: true, title: true, status: true, code: true } })
      : [];
    return json({ action: { ...action, dependencies: depSteps }, depActions: deps, canEdit: true });
  } catch (e) {
    return handleApiError(e);
  }
}

/** ویرایش اقدام — اصلاح سررسید فقط از گردش کار مجاز و با ثبت تاریخچه */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "actions:edit");
    const { id } = await params;
    const action = await db.action.findUnique({ where: { id } });
    if (!action) return fail(404, "اقدام یافت نشد.", "NOT_FOUND");

    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.progress != null) {
      const p = Math.max(0, Math.min(100, Number(body.progress)));
      data.progress = p;
      // نکته حاکمیتی: مهلت مصوب با تغییر پیشرفت تغییر نمی‌کند
    }
    if (body.statusNote) data.riskNote = String(body.statusNote);
    if (body.delayReason != null) data.delayReason = String(body.delayReason);
    if (body.remedialAction != null) data.remedialAction = String(body.remedialAction);
    if (body.priority != null) data.priority = String(body.priority);
    if (body.description != null) data.description = String(body.description);
    if (body.deliverable != null) data.deliverable = String(body.deliverable);
    if (body.responsibleUnitId != null) data.responsibleUnitId = String(body.responsibleUnitId);
    // زمان پیگیری بعدی — سازوکار پیگیری نظام‌مند (بدون تغییر مهلت مصوب)
    if (body.nextFollowUpAt != null) {
      const d = new Date(String(body.nextFollowUpAt));
      if (isNaN(d.getTime())) return fail(400, "تاریخ پیگیری نامعتبر است.", "BAD_INPUT");
      data.nextFollowUpAt = d;
      await db.actionUpdate.create({
        data: { actionId: id, userId: user.id, type: "REMINDER", content: `زمان پیگیری بعدی برای ${d.toISOString()} تنظیم شد.` },
      });
    }

    // اصلاح سررسید نیازمند مجوز ویژه و ثبت علت — سررسید قبلی در سوابق می‌ماند
    if (body.dueEndDay != null && Number(body.dueEndDay) !== action.dueEndDay) {
      if (!user.permissions.includes("*") && !user.permissions.includes("actions:manage")) {
        return fail(403, "اصلاح مهلت مصوب فقط توسط مدیر دبیرخانه/راهبری سامانه و با ثبت علت مجاز است.", "DUE_CHANGE_FORBIDDEN");
      }
      if (!body.dueChangeReason) return fail(400, "برای اصلاح مهلت، ثبت علت الزامی است.", "DUE_REASON_REQUIRED");
      const baseline = await getBaselineDate();
      data.dueEndDay = Number(body.dueEndDay);
      data.dueDate = dueFromDay(baseline, Number(body.dueEndDay));
      data.dueDateOverridden = true;
      await db.actionUpdate.create({
        data: { actionId: id, userId: user.id, type: "DELAY_REPORT", content: `اصلاح مهلت از «روز ${action.dueEndDay ?? "—"}» به «روز ${body.dueEndDay}». علت: ${body.dueChangeReason}` },
      });
      await audit(user, "STATUS_CHANGE", "ACTION_DUE_CHANGE", id, { from: action.dueEndDay, to: body.dueEndDay, reason: body.dueChangeReason });
    }

    const updated = await db.action.update({ where: { id }, data });
    if (body.progress != null) {
      await db.actionUpdate.create({
        data: { actionId: id, userId: user.id, type: "PROGRESS", progress: Number(body.progress), content: `پیشرفت به ${body.progress}٪ به‌روزرسانی شد.` },
      });
    }
    await audit(user, "UPDATE", "ACTION", id, Object.keys(data));
    return json({ action: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
