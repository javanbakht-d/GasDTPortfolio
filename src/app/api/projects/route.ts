import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission, json, handleApiError, audit, fail } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const url = new URL(req.url);
    const track = url.searchParams.get("track");
    const status = url.searchParams.get("status");
    const projects = await db.project.findMany({
      where: { ...(track ? { trackKey: track } : {}), ...(status ? { status } : {}) },
      include: { proposingUnit: { select: { name: true } }, scores: true },
      orderBy: { code: "asc" },
    });
    return json({ projects: projects.map((p) => ({ ...p, scoreTotal: p.scoreTotal ?? (p.scores.reduce((s, x) => s + x.score, 0) || null) })) });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, "projects:create");
    const body = await req.json();
    const title = String(body.title ?? "").trim();
    if (!title) return fail(400, "عنوان پروژه الزامی است.", "BAD_INPUT");
    const count = await db.project.count();
    const project = await db.project.create({
      data: {
        code: `NIGC-PRJ-${String(count + 4).padStart(3, "0")}`,
        title, trackKey: body.trackKey ?? "UNIT",
        proposingUnitId: body.proposingUnitId ?? user.orgUnitId ?? null,
        businessOwner: body.businessOwner ?? null, projectManager: body.projectManager ?? null,
        problem: body.problem ?? null, goals: body.goals ?? null, scope: body.scope ?? null,
        deliverables: body.deliverables ?? null, timeline: body.timeline ?? null,
        successMetrics: body.successMetrics ?? null, dataReadiness: body.dataReadiness ?? null,
        status: "PROPOSED", sourceRef: body.sourceRef ?? "ثبت توسط واحد",
      },
    });
    await audit(user, "CREATE", "PROJECT", project.id, { title });
    return json({ project }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
