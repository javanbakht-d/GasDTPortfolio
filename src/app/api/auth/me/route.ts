import { NextRequest } from "next/server";
import { requireAuth, json, handleApiError } from "@/lib/api";
import { getBaselineDate } from "@/lib/persian-date";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const baseline = await getBaselineDate();
    return json({ user, baselineDate: baseline });
  } catch (e) {
    return handleApiError(e);
  }
}
