import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, json, handleApiError, audit, fail } from "@/lib/api";

// مدل امتیازدهی متوازن سند ابلاغی (محور ۶-۳) — نسخه v1.0
export const SCORE_MODEL = [
  { criterion: "VALUE", maxScore: 40, label: "ارزش و منفعت" },
  { criterion: "DATA_READINESS", maxScore: 20, label: "آمادگی داده" },
  { criterion: "RISK_SECURITY", maxScore: 20, label: "ریسک و امنیت" },
  { criterion: "FEASIBILITY", maxScore: 20, label: "امکان‌پذیری اجرا" },
];

/** ثبت امتیاز پروژه — همراه توضیح، شواهد، ارزیاب و تاریخ؛ قابل ممیزی */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "projects:score");
    const { id } = await params;
    const project = await db.project.findUnique({ where: { id } });
    if (!project) return fail(404, "پروژه یافت نشد.", "NOT_FOUND");
    const body = await req.json();
    const scores = Array.isArray(body.scores) ? body.scores : [];

    for (const s of scores) {
      const model = SCORE_MODEL.find((m) => m.criterion === s.criterion);
      if (!model) return fail(400, `معیار نامعتبر: ${s.criterion}`, "BAD_CRITERION");
      const score = Math.max(0, Math.min(model.maxScore, Number(s.score) || 0));
      await db.projectScore.upsert({
        where: { projectId_criterion: { projectId: id, criterion: s.criterion } },
        create: { projectId: id, criterion: s.criterion, maxScore: model.maxScore, score, rationale: s.rationale ?? null, evidence: s.evidence ?? null, assessor: user.fullName, modelVersion: "v1.0-ابلاغی" },
        update: { score, maxScore: model.maxScore, rationale: s.rationale ?? null, evidence: s.evidence ?? null, assessor: user.fullName, assessedAt: new Date(), modelVersion: "v1.0-ابلاغی" },
      });
    }

    const all = await db.projectScore.findMany({ where: { projectId: id } });
    const total = all.reduce((s, x) => s + x.score, 0);
    const complete = SCORE_MODEL.every((m) => all.some((x) => x.criterion === m.criterion));

    const updated = await db.project.update({
      where: { id },
      data: { scoreTotal: total, status: complete && project.status === "INFO_COMPLETE" ? "SCORED" : project.status },
    });
    await audit(user, "UPDATE", "PROJECT_SCORE", id, { total, complete });
    return json({ project: updated, scores: all, scoreTotal: total, modelComplete: complete });
  } catch (e) {
    return handleApiError(e);
  }
}
