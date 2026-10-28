import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission, json, handleApiError, audit, fail } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const meetings = await db.meeting.findMany({ include: { decisions: true }, orderBy: [{ scheduledAt: "desc" }] });
    return json({ meetings });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, "meetings:manage");
    const body = await req.json();
    const title = String(body.title ?? "").trim();
    if (!title) return fail(400, "عنوان جلسه الزامی است.", "BAD_INPUT");
    const count = await db.meeting.count();
    const meeting = await db.meeting.create({
      data: {
        number: body.number ?? count + 1, title, meetingType: body.meetingType ?? "STEERING",
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        agenda: Array.isArray(body.agenda) ? JSON.stringify(body.agenda) : body.agenda ?? null,
        attendees: body.attendees ?? null, refStep: body.refStep ?? null,
      },
    });
    await audit(user, "CREATE", "MEETING", meeting.id, { title });
    return json({ meeting }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
