import { NextRequest } from "next/server";
import { requireAuth, json, handleApiError, fail } from "@/lib/api";
import { buildBriefing } from "@/lib/scheduler-engine";

/**
 * گزارش کوتاه دبیر شورا — صبحگاهی / پایان روز / هفتگی
 * همه اشکال از یک سازنده واحد تغذیه می‌شوند (سازگاری آزمون ۸: داشبورد/میزکار/گزارش از یک داده).
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const type = req.nextUrl.searchParams.get("type") ?? "morning";
    if (!["morning", "eod", "weekly"].includes(type)) return fail(400, "نوع گزارش نامعتبر است.", "BAD_INPUT");
    const briefing = await buildBriefing(type as "morning" | "eod" | "weekly");
    return json({ briefing });
  } catch (e) {
    return handleApiError(e);
  }
}
