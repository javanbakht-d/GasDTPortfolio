import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission, json, handleApiError, audit, fail } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const items = await db.budgetItem.findMany({ orderBy: [{ year: "desc" }, { category: "asc" }] });
    return json({ items });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, "budget:manage");
    const body = await req.json();
    const title = String(body.title ?? "").trim();
    if (!title) return fail(400, "عنوان قلم بودجه الزامی است.", "BAD_INPUT");
    const item = await db.budgetItem.create({
      data: { year: Number(body.year) || 1406, title, category: body.category ?? "OTHER", amountEstimate: body.amountEstimate ?? null, unit: body.unit ?? null, documentRef: body.documentRef ?? null, notes: body.notes ?? null, refStep: body.refStep ?? 29 },
    });
    await audit(user, "CREATE", "BUDGET_ITEM", item.id, { title });
    return json({ item }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
