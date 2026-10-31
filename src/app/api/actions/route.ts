import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission, json, handleApiError, audit, fail, actionScopeFilter } from "@/lib/api";
import { getBaselineDate, dueFromDay, programDay } from "@/lib/persian-date";
import { CYCLES } from "@/lib/constants";

/** لیست اقدامات — محدود به واحد سازمانی/اقدامات محول‌شده کاربر (نقش‌های دبیرخانه: کل برنامه) */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const url = new URL(req.url);
    const group = url.searchParams.get("group");
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q");

    const where: { AND: Record<string, unknown>[] } = { AND: [actionScopeFilter(user)] };
    if (group) where.AND.push({ groupKey: group });
    if (status) where.AND.push({ status });
    if (q) where.AND.push({ OR: [{ title: { contains: q } }, { description: { contains: q } }, { code: { contains: q } }] });

    const actions = await db.action.findMany({
      where,
      include: {
        responsibleUnit: { select: { id: true, name: true, code: true } },
        followUpOwner: { select: { id: true, fullName: true } },
        updates: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { refStep: "asc" },
    });

    const baseline = await getBaselineDate();
    const now = new Date();
    const enriched = actions.map((a) => {
      const dueDays = a.dueDate ? Math.ceil((new Date(a.dueDate).getTime() - now.getTime()) / 86400000) : null;
      return {
        ...a,
        dependencies: a.dependencies ? JSON.parse(a.dependencies) : [],
        isOverdue: a.dueDate ? new Date(a.dueDate) < now && !["COMPLETED", "CLOSED", "APPROVED"].includes(a.status) : false,
        dueInDays: dueDays,
        isDueSoon: dueDays != null && dueDays >= 0 && dueDays <= 7 && !["COMPLETED", "CLOSED", "APPROVED"].includes(a.status),
        lastUpdate: a.updates[0] ?? null,
        updates: undefined,
      };
    });

    return json({ actions: enriched, programDay: programDay(baseline, now), baselineDate: baseline });
  } catch (e) {
    return handleApiError(e);
  }
}

/** ایجاد اقدام جدید (دبیرخانه) — بدون جعل داده حاکمیتی */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, "actions:create");
    const body = await req.json();
    const title = String(body.title ?? "").trim();
    if (!title) return fail(400, "عنوان اقدام الزامی است.", "BAD_INPUT");
    const cycleKey = body.cycleKey ? String(body.cycleKey) : null;
    if (cycleKey && !Object.keys(CYCLES).includes(cycleKey)) return fail(400, "چرخه انتخابی نامعتبر است.", "BAD_INPUT");
    const deps = Array.isArray(body.dependencies) ? body.dependencies.map((x: unknown) => Number(x)).filter((n: number) => Number.isInteger(n) && n > 0) : [];

    const baseline = await getBaselineDate();
    const count = await db.action.count();
    const refStep = count + 1;
    const dueEndDay = body.dueEndDay != null ? Number(body.dueEndDay) : null;

    const action = await db.action.create({
      data: {
        code: `NIGC-ACT-${String(refStep).padStart(2, "0")}`,
        refStep,
        title,
        description: String(body.description ?? ""),
        groupKey: body.groupKey ?? "CONTINUOUS",
        actionType: body.actionType ?? "ROUTINE",
        dueStartDay: body.dueStartDay != null ? Number(body.dueStartDay) : null,
        dueEndDay,
        dueDate: dueEndDay != null ? dueFromDay(baseline, dueEndDay) : body.dueDate ? new Date(body.dueDate) : null,
        deliverable: body.deliverable ?? null,
        dependencies: deps.length ? JSON.stringify(deps) : null,
        cycleKey,
        responsibleUnitId: body.responsibleUnitId ?? null,
        followUpOwnerId: body.followUpOwnerId ?? null,
        priority: body.priority ?? "MEDIUM",
        status: "DRAFT",
        sourceRef: body.sourceRef ?? null,
      },
    });
    await db.actionUpdate.create({
      data: { actionId: action.id, userId: user.id, type: "COMMENT", toStatus: "DRAFT", content: "اقدام جدید ایجاد شد." },
    });
    await audit(user, "CREATE", "ACTION", action.id, { title });
    return json({ action }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
