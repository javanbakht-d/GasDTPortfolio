import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission, json, handleApiError, audit, fail } from "@/lib/api";

/** انحرافات — هر انحراف از مهلت باید علت، مسئول، شدت اثر و اقدام جبرانی داشته باشد */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const deviations = await db.deviation.findMany({ orderBy: { detectedAt: "desc" } });
    return json({ deviations });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, "deviations:manage");
    const body = await req.json();
    const relatedType = String(body.relatedType ?? "ACTION");
    const relatedId = String(body.relatedId ?? "");
    const cause = String(body.cause ?? "").trim();
    if (!relatedId || !cause) return fail(400, "مورد مرتبط و علت انحراف الزامی است.", "BAD_INPUT");
    const relatedTitle = String(body.relatedTitle ?? "");
    const count = await db.deviation.count();
    const deviation = await db.deviation.create({
      data: { code: `NIGC-DEV-${String(count + 1).padStart(3, "0")}`, relatedType, relatedId, relatedTitle, cause, responsible: body.responsible ?? null, severity: body.severity ?? "MEDIUM", remedialAction: body.remedialAction ?? null, remedialDueDate: body.remedialDueDate ? new Date(body.remedialDueDate) : null },
    });
    // ثبت انحراف روی اقدام مرتبط
    if (relatedType === "ACTION") {
      await db.actionUpdate.create({ data: { actionId: relatedId, userId: user.id, type: "DELAY_REPORT", content: `ثبت انحراف ${deviation.code}: ${cause}` } }).catch(() => undefined);
    }
    await audit(user, "CREATE", "DEVIATION", deviation.id, { relatedType, relatedTitle });
    return json({ deviation }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
