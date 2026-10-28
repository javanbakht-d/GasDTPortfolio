import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, json, handleApiError, audit, fail } from "@/lib/api";

/** اعتبارسنجی رکورد وضعیت موجود (گام ۱۲) */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "governance:manage");
    const { id } = await params;
    const entry = await db.digitalStatusEntry.findUnique({ where: { id } });
    if (!entry) return fail(404, "رکورد یافت نشد.", "NOT_FOUND");
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (body.status && ["SUBMITTED", "VALIDATED", "NEEDS_INFO"].includes(body.status)) data.status = body.status;
    if (body.validationNote != null) data.validationNote = String(body.validationNote);
    if (body.classification != null) data.classification = String(body.classification);

    const updated = await db.digitalStatusEntry.update({ where: { id }, data });
    await audit(user, "UPDATE", "DIGITAL_STATUS_ENTRY", id, Object.keys(data));
    return json({ entry: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
