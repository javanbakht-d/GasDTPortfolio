import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, json, handleApiError, audit, fail } from "@/lib/api";

/** ثبت صورت‌جلسه و بستن جلسه */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "meetings:manage");
    const { id } = await params;
    const meeting = await db.meeting.findUnique({ where: { id } });
    if (!meeting) return fail(404, "جلسه یافت نشد.", "NOT_FOUND");
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.minutesSummary != null) data.minutesSummary = String(body.minutesSummary);
    if (body.attendees != null) data.attendees = String(body.attendees);
    if (body.agenda != null) data.agenda = Array.isArray(body.agenda) ? JSON.stringify(body.agenda) : String(body.agenda);
    if (body.scheduledAt != null) data.scheduledAt = new Date(body.scheduledAt);
    if (body.status && ["SCHEDULED", "HELD", "CANCELED"].includes(body.status)) {
      data.status = body.status;
      if (body.status === "HELD") data.heldAt = new Date();
    }
    const updated = await db.meeting.update({ where: { id }, data });
    await audit(user, "UPDATE", "MEETING", id, Object.keys(data));
    return json({ meeting: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
