import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, json, handleApiError, audit, fail } from "@/lib/api";

/** به‌روزرسانی قلم بودجه — تغییر وضعیت (DRAFT|SUBMITTED|CONFIRMED) در مسیر گام ۲۹ */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "budget:manage");
    const { id } = await params;
    const item = await db.budgetItem.findUnique({ where: { id } });
    if (!item) return fail(404, "قلم بودجه یافت نشد.", "NOT_FOUND");
    const body = await req.json();
    const data: Record<string, unknown> = {};
    for (const k of ["title", "amountEstimate", "unit", "documentRef", "notes"]) {
      if (body[k] != null) data[k] = String(body[k]);
    }
    if (body.category != null) data.category = String(body.category);
    if (body.year != null) data.year = Number(body.year);
    if (body.status && ["DRAFT", "SUBMITTED", "CONFIRMED"].includes(body.status)) data.status = body.status;
    const updated = await db.budgetItem.update({ where: { id }, data });
    await audit(user, "UPDATE", "BUDGET_ITEM", id, Object.keys(data));
    return json({ item: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
