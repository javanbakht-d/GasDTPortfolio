import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission, json, handleApiError, audit, fail } from "@/lib/api";
import { getBaselineDate, programDay } from "@/lib/persian-date";

/** گزارش‌های دوره‌ای: ماهانه پایش، فصلی (مهلت ۱۵ روز پس از پایان فصل)، ۹۰روزه، سالانه */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const baseline = await getBaselineDate();
    const reports = await db.report.findMany({ orderBy: { createdAt: "desc" } });
    const pDay = programDay(baseline);
    const due90 = reports.find((r) => r.reportType === "90DAY");
    return json({
      reports,
      schedule: {
        quarterlyWindowDays: 15, // قاعده سند ابلاغی (گام ۳۱)
        report90DueDay: 90,
        currentProgramDay: pDay,
        report90Status: due90?.status ?? "NOT_CREATED",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, "reports:create");
    const body = await req.json();
    const title = String(body.title ?? "").trim();
    if (!title) return fail(400, "عنوان گزارش الزامی است.", "BAD_INPUT");
    const count = await db.report.count();
    const report = await db.report.create({
      data: { code: `NIGC-RPT-${String(count + 1).padStart(3, "0")}`, title, reportType: body.reportType ?? "MONTHLY", period: body.period ?? null, summary: body.summary ?? null, content: body.content ?? null, refStep: body.refStep ?? null },
    });
    await audit(user, "CREATE", "REPORT", report.id, { title });
    return json({ report }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
