import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission, json, handleApiError, audit, fail } from "@/lib/api";

/** مصوبات جلسات — مسئول، مهلت پیگیری و وضعیت اجرا */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const decisions = await db.decision.findMany({ include: { meeting: { select: { number: true, title: true } } }, orderBy: { createdAt: "desc" } });
    return json({ decisions });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, "decisions:manage");
    const body = await req.json();
    const content = String(body.content ?? "").trim();
    if (!content) return fail(400, "متن مصوبه الزامی است.", "BAD_INPUT");
    const count = await db.decision.count();
    const decision = await db.decision.create({
      data: { code: `NIGC-DEC-${String(count + 1).padStart(3, "0")}`, meetingId: body.meetingId || null, content, responsible: body.responsible ?? null, dueDate: body.dueDate ? new Date(body.dueDate) : null, relatedActionRefStep: body.relatedActionRefStep != null ? Number(body.relatedActionRefStep) : null, relatedProjectId: body.relatedProjectId || null },
    });
    await audit(user, "CREATE", "DECISION", decision.id, { content: content.slice(0, 80) });
    return json({ decision }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
