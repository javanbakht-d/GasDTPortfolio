import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission, json, handleApiError, audit, fail } from "@/lib/api";
import { invalidateBaselineCache } from "@/lib/persian-date";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const settings = await db.setting.findMany({ orderBy: { key: "asc" } });
    const baseline = await db.setting.findUnique({ where: { key: "program.baselineDate" } });
    const changes = await db.baselineChange.findMany({ orderBy: { createdAt: "desc" }, take: 10 });
    return json({ settings, baseline: baseline?.value, baselineChanges: changes });
  } catch (e) {
    return handleApiError(e);
  }
}

/** تغییر تنظیمات — تغییر تاریخ مبنا نیازمند تأیید مجاز، علت و تاریخچه */
export async function PUT(req: NextRequest) {
  try {
    const user = await requirePermission(req, "settings:manage");
    const body = await req.json();
    const entries = Array.isArray(body.settings) ? body.settings : [];

    for (const e of entries) {
      const key = String(e.key ?? "");
      if (!key) continue;
      const existing = await db.setting.findUnique({ where: { key } });

      // تغییر تاریخ مبنا: گردش کار ویژه
      if (key === "program.baselineDate" && existing && existing.value !== e.value) {
        if (!body.baselineReason) return fail(400, "تغییر تاریخ مبنا نیازمند ثبت علت است.", "BASELINE_REASON_REQUIRED");
        if (!body.baselineApprovedBy) return fail(400, "تغییر تاریخ مبنا نیازمند ثبت مرجع تأیید است.", "BASELINE_APPROVAL_REQUIRED");
        const toTehranMidnight = (dateStr: string) => {
          const d = new Date(`${dateStr}T00:00:00.000Z`);
          d.setUTCDate(d.getUTCDate() - 1);
          d.setUTCHours(20, 30, 0, 0);
          return d;
        };
        const oldDate = existing.value ? toTehranMidnight(existing.value) : null;
        await db.baselineChange.create({
          data: { oldDate, newDate: toTehranMidnight(e.value), reason: String(body.baselineReason), approvedBy: String(body.baselineApprovedBy), createdById: user.id },
        });
        // بازمحاسبه همه سررسیدهای نسبی
        const actions = await db.action.findMany({ where: { dueEndDay: { not: null } } });
        for (const a of actions) {
          const d = toTehranMidnight(e.value);
          d.setUTCDate(d.getUTCDate() + (a.dueEndDay ?? 0));
          await db.action.update({ where: { id: a.id }, data: { dueDate: d } });
        }
        invalidateBaselineCache();
        await audit(user, "SETTING_CHANGE", "BASELINE_DATE", key, { from: existing.value, to: e.value, reason: body.baselineReason, recalculated: actions.length });
      }

      await db.setting.upsert({
        where: { key },
        create: { key, value: String(e.value ?? ""), valueType: e.valueType ?? "string", category: e.category ?? "general", updatedById: user.id },
        update: { value: String(e.value ?? ""), updatedById: user.id },
      });
    }
    await audit(user, "SETTING_CHANGE", "SETTINGS", undefined, entries.map((e: { key: string }) => e.key));
    return json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
