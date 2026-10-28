import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, json, handleApiError, audit, fail } from "@/lib/api";

const FLOW = ["DRAFT", "IN_REVIEW", "APPROVED", "ISSUED", "SUPERSEDED", "ARCHIVED"];

/** تغییر وضعیت/نسخه سند — سند مصوب/ابلاغی بدون نسخه جدید تغییر بی‌ردپا نمی‌کند */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "documents:edit");
    const { id } = await params;
    const doc = await db.document.findUnique({ where: { id } });
    if (!doc) return fail(404, "سند یافت نشد.", "NOT_FOUND");
    const body = await req.json();

    // تصویب/ابلاغ نیازمند مجوز ویژه
    if (["APPROVED", "ISSUED"].includes(body.status)) {
      const allowed = user.permissions.includes("*") || user.permissions.includes("documents:approve");
      if (!allowed) return fail(403, "تصویب و ابلاغ سند نیازمند نقش مجاز است.", "APPROVE_FORBIDDEN");
    }

    if (body.status && ["ISSUED", "APPROVED"].includes(doc.status) && body.status !== doc.status && !body.newVersion) {
      return fail(400, "سند مصوب/ابلاغی فقط با ثبت نسخه جدید قابل تغییر است.", "VERSION_REQUIRED");
    }

    const data: Record<string, unknown> = {};
    if (body.description != null) data.description = String(body.description);
    if (body.fileUrl != null) { data.fileUrl = String(body.fileUrl); data.needsUpload = false; }
    if (body.status && FLOW.includes(body.status)) data.status = body.status;

    if (body.newVersion) {
      const v = String(body.newVersion);
      // سند قبلی منسوخ و نسخه جدید ثبت می‌شود — سوابق حفظ می‌شود
      await db.documentVersion.create({ data: { documentId: id, version: v, status: String(data.status ?? doc.status), summary: body.versionSummary ?? "نسخه جدید", changeNote: body.versionNote ?? null, createdById: user.id } });
      data.version = v;
      await db.documentVersion.create({ data: { documentId: id, version: doc.version, status: "SUPERSEDED", summary: "نسخه قبلی — منسوخ‌شده", createdById: user.id } });
    }

    const updated = await db.document.update({ where: { id }, data });
    await audit(user, "UPDATE", "DOCUMENT", id, Object.keys(data));
    return json({ document: updated });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(req, "documents:view");
    const { id } = await params;
    const doc = await db.document.findUnique({ where: { id }, include: { versions: { orderBy: { createdAt: "desc" } }, ownerUnit: { select: { name: true } } } });
    if (!doc) return fail(404, "سند یافت نشد.", "NOT_FOUND");
    return json({ document: doc });
  } catch (e) {
    return handleApiError(e);
  }
}
