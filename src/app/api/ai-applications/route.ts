import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission, json, handleApiError, audit, fail } from "@/lib/api";
import { GLOBAL_VIEW_ROLES } from "@/lib/constants";

/** دفتر مرکزی ثبت کاربردهای هوش مصنوعی — قاعده: بدون ثبت و ارزیابی، بهره‌برداری ممنوع */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const user = await requireAuth(req);
    const globalView = user.roles.some((r) => GLOBAL_VIEW_ROLES.includes(r.key));
    const apps = await db.aiApplication.findMany({
      where: globalView || !user.orgUnitId ? {} : { ownerUnitId: user.orgUnitId },
      include: { ownerUnit: { select: { name: true } } },
      orderBy: { code: "asc" },
    });
    const stats = {
      total: apps.length,
      byStatus: apps.reduce<Record<string, number>>((m, a) => { m[a.status] = (m[a.status] ?? 0) + 1; return m; }, {}),
      highRisk: apps.filter((a) => ["HIGH", "CRITICAL"].includes(a.riskLevel)).length,
      withoutOperationApproval: apps.filter((a) => !a.isRegisteredForOperation && ["PILOT", "OPERATIONAL"].includes(a.status)).length,
      notAssessed: apps.filter((a) => !a.evaluationResults).length,
      needsReview: apps.filter((a) => !a.lastReviewAt).length,
    };
    return json({ applications: apps, stats });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, "ai_registry:create");
    const body = await req.json();
    const title = String(body.title ?? "").trim();
    if (!title) return fail(400, "عنوان کاربرد الزامی است.", "BAD_INPUT");
    const count = await db.aiApplication.count();
    const app = await db.aiApplication.create({
      data: {
        code: `NIGC-AI-${String(count + 1).padStart(3, "0")}`,
        title, ownerUnitId: body.ownerUnitId ?? user.orgUnitId ?? null,
        businessOwner: body.businessOwner ?? null, problem: body.problem ?? null,
        useType: body.useType ?? null, businessProcess: body.businessProcess ?? null,
        providerModel: body.providerModel ?? null, inputData: body.inputData ?? null,
        outputData: body.outputData ?? null, dataSources: body.dataSources ?? null,
        classification: body.classification ?? "INTERNAL", riskLevel: body.riskLevel ?? "MEDIUM",
        humanOversight: body.humanOversight ?? null, status: "PROPOSED",
        refStep: 13,
      },
    });
    await audit(user, "CREATE", "AI_APPLICATION", app.id, { title });
    return json({ application: app }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
