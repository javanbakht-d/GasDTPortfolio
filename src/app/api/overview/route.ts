import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, json, handleApiError } from "@/lib/api";
import { getBaselineDate, programDay } from "@/lib/persian-date";
import { GLOBAL_VIEW_ROLES } from "@/lib/constants";

/** میزکار من — وظایف، مهلت‌ها و موارد منتظر اقدامِ کاربر جاری */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const baseline = await getBaselineDate();
    const now = new Date();

    const globalView = user.roles.some((r) => GLOBAL_VIEW_ROLES.includes(r.key));

    const myActions = await db.action.findMany({
      where: {
        OR: [
          { followUpOwnerId: user.id },
          ...(globalView || !user.orgUnitId ? [] : [{ responsibleUnitId: user.orgUnitId }]),
        ],
      },
      include: { responsibleUnit: { select: { name: true } } },
      orderBy: [{ dueDate: "asc" }],
    });

    const active = myActions.filter((a) => !["COMPLETED", "CLOSED", "APPROVED"].includes(a.status));
    const overdue = active.filter((a) => a.dueDate && new Date(a.dueDate) < now);
    const dueSoon = active.filter((a) => a.dueDate && new Date(a.dueDate) >= now && (new Date(a.dueDate).getTime() - now.getTime()) / 86400000 <= 7);
    const waitingReview = active.filter((a) => a.status === "IN_REVIEW");

    const pendingApprovals = user.permissions.includes("*") || user.permissions.some((p) => ["actions:approve", "documents:approve"].includes(p))
      ? await db.action.count({ where: { status: "IN_REVIEW" } })
      : 0;

    const notifications = await db.notification.findMany({
      where: { userId: user.id, isRead: false },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const openRisks = await db.risk.findMany({ where: { status: { in: ["OPEN", "MONITORING"] } }, orderBy: [{ probability: "desc" }, { impact: "desc" }], take: 5 });

    const upcomingMeetings = await db.meeting.findMany({ where: { status: "SCHEDULED" }, orderBy: { scheduledAt: "asc" }, take: 3 });

    return json({
      programDay: programDay(baseline, now),
      baselineDate: baseline,
      stats: {
        myActive: active.length,
        overdue: overdue.length,
        dueSoon: dueSoon.length,
        waitingReview: waitingReview.length,
        pendingApprovals,
        unreadNotifications: notifications.length,
      },
      myTasks: active.slice(0, 8).map((a) => ({
        id: a.id, refStep: a.refStep, code: a.code, title: a.title, status: a.status,
        progress: a.progress, dueDate: a.dueDate, priority: a.priority, groupKey: a.groupKey,
        unit: a.responsibleUnit?.name ?? null,
      })),
      overdueTasks: overdue.slice(0, 5).map((a) => ({ id: a.id, refStep: a.refStep, title: a.title, dueDate: a.dueDate })),
      dueSoonTasks: dueSoon.slice(0, 5).map((a) => ({ id: a.id, refStep: a.refStep, title: a.title, dueDate: a.dueDate })),
      notifications,
      openRisks,
      upcomingMeetings,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
