// ───────────── پیکربندی موتور یادآوری، گزارش‌های خودکار و اولویت‌بندی ─────────────
// همه مقادیر از جدول Setting خوانده می‌شوند و از پنل مدیریت قابل تغییرند؛
// در نبود رکورد، این مقادیر پیش‌فرض «پیشنهادی» اعمال و در پنل نمایش داده می‌شوند.

import { db } from "@/lib/db";

export type ReminderSettings = {
  enabled: boolean;
  tickIntervalSec: number;
  preDueCriticalDays: number; // یادآوری پیش از سررسید برای اولویت بحرانی
  preDueHighDays: number;
  preDueNormalDays: number;
  dueDayNotify: boolean; // اطلاع‌رسانی در روز سررسید
  overdueEscalateDays: number; // تشدید پس از N روز تأخیر
  followUpDefaultDays: number; // پیش‌فرض زمان پیگیری بعدی
  quietStart: number; // ساعت شروع سکوت (۰–۲۳)
  quietEnd: number; // ساعت پایان سکوت
  quietBypassCritical: boolean; // موارد بحرانی از سکوت مستثنا شوند (فقط طبق سیاست)
  morningDigestEnabled: boolean;
  morningDigestTime: string; // "HH:MM"
  eodDigestEnabled: boolean;
  eodDigestTime: string;
  weeklyDigestEnabled: boolean;
  weeklyDigestDay: number; // ۰=یکشنبه … ۴=پنجشنبه (JS getDay)
  weeklyDigestTime: string;
  healthAlertToAdmin: boolean;
};

export type PriorityWeights = {
  urgency: number; // فاصله تا سررسید
  importance: number; // اهمیت خروجی (اولویت مصوب رکورد)
  dependency: number; // تأثیر بر اقدامات وابسته
  risk: number; // ریسک مرتبط باز
  waiting: number; // مدت انتظار برای پاسخ/تصمیم
};

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,
  tickIntervalSec: 60,
  preDueCriticalDays: 7,
  preDueHighDays: 5,
  preDueNormalDays: 3,
  dueDayNotify: true,
  overdueEscalateDays: 3,
  followUpDefaultDays: 3,
  quietStart: 21,
  quietEnd: 7,
  quietBypassCritical: true,
  morningDigestEnabled: true,
  morningDigestTime: "07:30",
  eodDigestEnabled: true,
  eodDigestTime: "18:00",
  weeklyDigestEnabled: true,
  weeklyDigestDay: 4, // پنجشنبه
  weeklyDigestTime: "16:00",
  healthAlertToAdmin: true,
};

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  urgency: 35,
  importance: 25,
  dependency: 15,
  risk: 15,
  waiting: 10,
};

export const PRIORITY_MODEL_VERSION = "priority-model-v0.1-پیشنهادی-نیازمند-تصویب";

async function readSettings(prefix: string): Promise<Record<string, string>> {
  const rows = await db.setting.findMany({ where: { key: { startsWith: prefix } } });
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

function bool(v: string | undefined, dflt: boolean): boolean {
  if (v == null) return dflt;
  return v === "true" || v === "1";
}
function num(v: string | undefined, dflt: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

export async function getReminderSettings(): Promise<ReminderSettings> {
  const d = DEFAULT_REMINDER_SETTINGS;
  try {
    // هر دو خانواده کلید: reminders.* و digest.*
    const [r, g] = await Promise.all([readSettings("reminders."), readSettings("digest.")]);
    const s = { ...g, ...r };
    return {
      enabled: bool(s["reminders.enabled"], d.enabled),
      tickIntervalSec: num(s["reminders.tickIntervalSec"], d.tickIntervalSec),
      preDueCriticalDays: num(s["reminders.preDueCriticalDays"], d.preDueCriticalDays),
      preDueHighDays: num(s["reminders.preDueHighDays"], d.preDueHighDays),
      preDueNormalDays: num(s["reminders.preDueNormalDays"], d.preDueNormalDays),
      dueDayNotify: bool(s["reminders.dueDayNotify"], d.dueDayNotify),
      overdueEscalateDays: num(s["reminders.overdueEscalateDays"], d.overdueEscalateDays),
      followUpDefaultDays: num(s["reminders.followUpDefaultDays"], d.followUpDefaultDays),
      quietStart: num(s["reminders.quietStart"], d.quietStart),
      quietEnd: num(s["reminders.quietEnd"], d.quietEnd),
      quietBypassCritical: bool(s["reminders.quietBypassCritical"], d.quietBypassCritical),
      morningDigestEnabled: bool(s["digest.morningEnabled"], d.morningDigestEnabled),
      morningDigestTime: s["digest.morningTime"] ?? d.morningDigestTime,
      eodDigestEnabled: bool(s["digest.eodEnabled"], d.eodDigestEnabled),
      eodDigestTime: s["digest.eodTime"] ?? d.eodDigestTime,
      weeklyDigestEnabled: bool(s["digest.weeklyEnabled"], d.weeklyDigestEnabled),
      weeklyDigestDay: num(s["digest.weeklyDay"], d.weeklyDigestDay),
      weeklyDigestTime: s["digest.weeklyTime"] ?? d.weeklyDigestTime,
      healthAlertToAdmin: bool(s["reminders.healthAlertToAdmin"], d.healthAlertToAdmin),
    };
  } catch {
    return d; // خرابی تنظیمات نباید کل موتور را متوقف کند
  }
}

export async function getPriorityWeights(): Promise<PriorityWeights> {
  try {
    const s = await readSettings("priority.");
    if (!s["priority.weights"]) return DEFAULT_PRIORITY_WEIGHTS;
    const parsed = JSON.parse(s["priority.weights"]) as Partial<PriorityWeights>;
    return { ...DEFAULT_PRIORITY_WEIGHTS, ...parsed };
  } catch {
    return DEFAULT_PRIORITY_WEIGHTS;
  }
}

/** آیا اکنون در ساعات سکوت هستیم؟ (به وقت تهران) */
export function isQuietHours(s: ReminderSettings, now = new Date()): boolean {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tehran", hour: "numeric", hour12: false }).format(now));
  if (s.quietStart === s.quietEnd) return false;
  if (s.quietStart < s.quietEnd) return hour >= s.quietStart && hour < s.quietEnd;
  return hour >= s.quietStart || hour < s.quietEnd; // بازه شبانه
}
