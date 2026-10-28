// ───────────── موتور اولویت‌بندی شفاف (پیشنهادی — نیازمند تصویب شورا) ─────────────
// دستور §۸: فرمول باید شفاف، پیکربندی‌پذیر و قابل ممیزی باشد و به‌عنوان سیاست مصوب وانمود نشود.
// هر موردِ خروجی، اجزای امتیاز و «دلیل» متنی را برمی‌گرداند تا «چرا»ی هر اولویت قابل مشاهده باشد.

import { getPriorityWeights, PRIORITY_MODEL_VERSION, type PriorityWeights } from "@/lib/assistant-settings";

export type PriorityInput = {
  priority: string; // اولویت مصوب رکورد: LOW | MEDIUM | HIGH | CRITICAL
  daysLeft: number | null; // تا سررسید (منفی = تأخیر)
  blockedDependents: number; // تعداد اقدامات وابسته‌ای که این رکورد مانع پیشروی آنهاست
  maxOpenRiskScore: number; // بیشینه امتیاز ریسک باز مرتبط (احتمال×اثر) ۰..۲۵
  waitingDays: number; // مدت انتظار برای پاسخ/تصمیم/اطلاعات
  progress: number; // ۰..۱۰۰
};

export type PriorityResult = {
  score: number; // ۰..۱۰۰
  band: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  label: string;
  factors: { key: string; label: string; weight: number; raw: number; weighted: number; note: string }[];
  reasons: string[]; // دلایل قابل نمایش برای کاربر
  modelVersion: string;
};

const IMPORTANCE_BASE: Record<string, number> = { CRITICAL: 100, HIGH: 75, MEDIUM: 45, LOW: 20 };

/** فاصله تا سررسید → ۰..۱۰۰ (هرچه نزدیک‌تر/گذشته‌تر از مهلت، بالاتر) */
function urgencyRaw(daysLeft: number | null): number {
  if (daysLeft == null) return 25; // مستمر بدون مهلت مشخص
  if (daysLeft < 0) return 100; // تأخیر قطعی
  if (daysLeft === 0) return 95;
  if (daysLeft <= 3) return 85;
  if (daysLeft <= 7) return 70;
  if (daysLeft <= 14) return 50;
  if (daysLeft <= 30) return 30;
  return 12;
}

function dependencyRaw(n: number): number {
  if (n <= 0) return 0;
  if (n === 1) return 55;
  if (n === 2) return 75;
  return Math.min(100, 75 + (n - 2) * 12);
}

function riskRaw(score: number): number {
  // ماتریس ۵×۵: ۱–۴ کم، ۵–۹ متوسط، ۱۰–۱۴ زیاد، ۱۵–۲۵ بحرانی
  if (score >= 15) return 100;
  if (score >= 10) return 75;
  if (score >= 5) return 45;
  if (score > 0) return 15;
  return 0;
}

function waitingRaw(days: number): number {
  if (days <= 0) return 0;
  if (days <= 2) return 25;
  if (days <= 5) return 50;
  if (days <= 10) return 75;
  return Math.min(100, 75 + (days - 10) * 3);
}

/** پیشنهاد اقدام بعدی متناسب با وضعیت — متن راهنما، نه تصمیم رسمی */
export function suggestNextStep(status: string, overdue: boolean, waitingDays: number, missingReason: boolean): string {
  switch (status) {
    case "DRAFT": return "کامل‌کردن مشخصات و آماده‌سازی برای شروع";
    case "READY": return overdue ? "ثبت علت تأخیر و اقدام جبرانی، یا شروع اجرا" : "آغاز اجرا و تعیین مسئول پیگیری";
    case "IN_PROGRESS": return overdue ? "به‌روزرسانی پیشرفت و ثبت اقدام جبرانی" : "به‌روزرسانی پیشرفت و ارسال خروجی برای بررسی";
    case "WAITING_INFO": return waitingDays > 0 ? "ارسال یادآوری/پیگیری به واحد پاسخ‌گو و ثبت زمان پیگیری بعدی" : "مشخص‌کردن موارد موردنیاز و مسئول پاسخ‌گو";
    case "IN_REVIEW": return "بررسی خروجی و تأیید یا عودت با ذکر نقص";
    case "NEEDS_FIX": return "پیگیری اصلاح توسط مسئول و ارسال مجدد";
    case "APPROVED": return "ثبت تحویل خروجی و نهایی‌سازی";
    case "OVERDUE": return missingReason ? "ثبت علت تأخیر (الزامی) و اقدام جبرانی با مهلت مشخص" : "پیشبرد اقدام جبرانی و رصد مهلت آن";
    case "HALTED": return "بررسی شرط ازسرگیری یا تمدید مجوز توقف";
    default: return "بازبینی وضعیت رکورد";
  }
}

export async function computePriority(input: PriorityInput, weightsOverride?: PriorityWeights): Promise<PriorityResult> {
  const weights = weightsOverride ?? await getPriorityWeights();
  const totalW = Object.values(weights).reduce((a, b) => a + b, 0) || 1;

  const u = urgencyRaw(input.daysLeft);
  const imp = IMPORTANCE_BASE[input.priority] ?? 45;
  // کاهش اهمیت مؤثر اگر تقریباً کامل شده (پیشگیری از هشدار مسلط روی کارهای نزدیک به پایان)
  const impAdj = input.progress >= 100 ? imp * 0.4 : imp;
  const dep = dependencyRaw(input.blockedDependents);
  const risk = riskRaw(input.maxOpenRiskScore);
  const wait = waitingRaw(input.waitingDays);

  const mk = (key: string, label: string, w: number, raw: number, note: string) => ({
    key, label, weight: Math.round((w / totalW) * 100), raw: Math.round(raw),
    weighted: Math.round((raw * w) / totalW), note,
  });

  const factors = [
    mk("urgency", "فاصله تا سررسید", weights.urgency, u, input.daysLeft == null ? "مستمر — بدون مهلت مصوب" : input.daysLeft < 0 ? `${Math.abs(input.daysLeft)} روز تأخیر` : `${input.daysLeft} روز تا سررسید`),
    mk("importance", "اهمیت خروجی", weights.importance, impAdj, input.progress >= 100 ? "تکمیل‌شده — اهمیت مؤثر کاهش یافته" : `اهمیت مصوب رکورد: ${input.priority}`),
    mk("dependency", "تأثیر بر وابستگان", weights.dependency, dep, input.blockedDependents > 0 ? `${input.blockedDependents} اقدام وابسته منتظر این رکورد است` : "هیچ اقدام وابسته مسدودی ندارد"),
    mk("risk", "ریسک باز مرتبط", weights.risk, risk, input.maxOpenRiskScore > 0 ? `بیشینه امتیاز ریسک باز: ${input.maxOpenRiskScore}` : "ریسک باز مرتبط ثبت نشده"),
    mk("waiting", "مدت انتظار", weights.waiting, wait, input.waitingDays > 0 ? `${input.waitingDays} روز در انتظار پاسخ/اطلاعات` : "در انتظار پاسخ نیست"),
  ];

  const score = Math.max(0, Math.min(100, factors.reduce((a, f) => a + f.weighted, 0)));
  const band = score >= 80 ? "CRITICAL" : score >= 60 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW";
  const label = { CRITICAL: "بحرانی", HIGH: "بالا", MEDIUM: "متوسط", LOW: "پایین" }[band];

  const reasons: string[] = [];
  if (input.daysLeft != null && input.daysLeft < 0) reasons.push(`${Math.abs(input.daysLeft)} روز از سررسید گذشته است`);
  else if (input.daysLeft != null && input.daysLeft <= 3) reasons.push(`تنها ${input.daysLeft} روز تا سررسید`);
  if (input.blockedDependents > 0) reasons.push(`${input.blockedDependents} اقدام وابسته به این رکورد است`);
  if (input.maxOpenRiskScore >= 10) reasons.push("ریسک باز با امتیاز بالا مرتبط است");
  if (input.waitingDays > 5) reasons.push(`${input.waitingDays} روز بی‌پاسخ مانده`);
  if (input.progress === 0 && input.daysLeft != null && input.daysLeft >= 0 && input.daysLeft <= 7) reasons.push("شروع نشده ولی سررسید نزدیک است");

  return { score: Math.round(score), band, label, factors, reasons, modelVersion: PRIORITY_MODEL_VERSION };
}
