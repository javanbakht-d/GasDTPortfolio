import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission, json, handleApiError, audit, fail } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const risks = await db.risk.findMany({ orderBy: [{ status: "asc" }, { probability: "desc" }] });
    return json({ risks });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, "risks:manage");
    const body = await req.json();
    const title = String(body.title ?? "").trim();
    if (!title) return fail(400, "عنوان ریسک الزامی است.", "BAD_INPUT");
    const count = await db.risk.count();
    const risk = await db.risk.create({
      data: {
        code: `NIGC-RSK-${String(count + 5).padStart(3, "0")}`,
        title, category: body.category ?? "ORGANIZATIONAL",
        relatedType: body.relatedType ?? "GENERAL", relatedTitle: body.relatedTitle ?? null,
        probability: Math.max(1, Math.min(5, Number(body.probability) || 3)),
        impact: Math.max(1, Math.min(5, Number(body.impact) || 3)),
        owner: body.owner ?? null, preventiveAction: body.preventiveAction ?? null,
        responsePlan: body.responsePlan ?? null, dueDate: body.dueDate ? new Date(body.dueDate) : null,
        sourceRef: body.sourceRef ?? null,
      },
    });
    await audit(user, "CREATE", "RISK", risk.id, { title });
    return json({ risk }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
