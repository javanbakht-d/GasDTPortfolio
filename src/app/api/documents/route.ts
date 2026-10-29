import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission, json, handleApiError, audit, fail, isGlobalViewer } from "@/lib/api";

/** لیست اسناد — اسناد محرمانه فقط برای واحد مالک و نقش‌های مجاز دبیرخانه/شورا */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const type = url.searchParams.get("type");
    const q = url.searchParams.get("q");

    // محدودسازی طبقه‌بندی: نقش‌های غیرسراسری فقط اسناد عمومی/داخلی یا اسناد واحد خود
    const globalView = isGlobalViewer(user);
    const scope = globalView
      ? {}
      : user.orgUnitId
        ? { OR: [{ classification: { in: ["PUBLIC", "INTERNAL"] } }, { ownerUnitId: user.orgUnitId }] }
        : { classification: { in: ["PUBLIC", "INTERNAL"] } };

    const docs = await db.document.findMany({
      where: {
        AND: [
          scope,
          ...(status ? [{ status }] : []),
          ...(type ? [{ docType: type }] : []),
          ...(q ? [{ OR: [{ title: { contains: q } }, { code: { contains: q } }, { description: { contains: q } }] }] : []),
        ],
      },
      include: { ownerUnit: { select: { name: true } } },
      orderBy: { code: "asc" },
    });
    return json({ documents: docs });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, "documents:create");
    const body = await req.json();
    const title = String(body.title ?? "").trim();
    if (!title) return fail(400, "عنوان سند الزامی است.", "BAD_INPUT");
    const count = await db.document.count();
    const doc = await db.document.create({
      data: {
        code: body.code || `NIGC-DOC-${String(count + 12).padStart(3, "0")}`,
        title, docType: body.docType ?? "REPORT", status: "DRAFT",
        description: body.description ?? null, sourceRef: body.sourceRef ?? null,
        relatedRefStep: body.relatedRefStep != null ? Number(body.relatedRefStep) : null,
        ownerUnitId: body.ownerUnitId ?? user.orgUnitId ?? null,
      },
    });
    await db.documentVersion.create({ data: { documentId: doc.id, version: doc.version, status: "DRAFT", summary: "ایجاد سند", createdById: user.id } });
    await audit(user, "CREATE", "DOCUMENT", doc.id, { title });
    return json({ document: doc }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
