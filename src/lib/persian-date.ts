// ───────────── ابزار تاریخ شمسی و محاسبه مهلت‌ها ─────────────
// ذخیره‌سازی داخلی: ISO استاندارد. نمایش: تقویم هجری شمسی با ارقام فارسی.

export const TEHRAN_TZ = "Asia/Tehran";

const jFmt = (opts?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-arabext", { timeZone: TEHRAN_TZ, ...opts });

/** نمایش تاریخ شمسی: ۱۴۰۵/۰۸/۰۱ */
export function faDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return jFmt({ year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** نمایش تاریخ + ساعت: ۱۴۰۵/۰۸/۰۱ — ۰۹:۳۰ */
export function faDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  const t = jFmt({ hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  return `${faDate(date)} — ${t}`;
}

/** نام ماه و سال: آبان ۱۴۰۵ */
export function faMonth(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return jFmt({ year: "numeric", month: "long" }).format(date);
}

/** روز هفته: دوشنبه */
export function faWeekday(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return jFmt({ weekday: "long" }).format(date);
}

/** تبدیل رشته تاریخ شمسی ۱۴۰۵-۰۸-۰۱ به Date (تقریبی جهت ذخیره) */
export function jalaliToGregorian(jy: number, jm: number, jd: number): Date {
  // تبدیل با الگوریتم استاندارد جلالی
  const gy = jalCal(jy).gy;
  const days = daysBeforeJalaliMonth(jm) + jd - 1 + (jalCal(jy).leap ? 0 : 0);
  const base = new Date(gy, 2, 20); // ۲۰ مارس
  base.setDate(base.getDate() + days);
  return base;
}

function jalCal(jy: number): { gy: number; leap: boolean } {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 1701, 1748];
  let leap = false, gy = 0;
  let jp = breaks[0], jump = 0;
  for (let i = 1; i < breaks.length; i++) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leap = (((jp + 1) * 8 + ((jp - jp) % 4) * 1) % 33 + 1) % 4 === 0;
    jp = jm;
  }
  gy = jy + 621;
  leap = (jy + 1) % 33 === 0 || [1, 5, 9, 13, 17, 22, 26, 30].includes((jy + 1) % 33);
  void jump;
  return { gy, leap };
}

function daysBeforeJalaliMonth(m: number): number {
  const counts = [0, 31, 62, 93, 124, 155, 186, 216, 246, 276, 306, 336];
  return counts[Math.max(0, Math.min(11, m - 1))];
}

/** روز صفر از تنظیمات (با کش در حافظه) */
let baselineCache: { value: Date; at: number } | null = null;
export async function getBaselineDate(): Promise<Date> {
  if (baselineCache && Date.now() - baselineCache.at < 60_000) return baselineCache.value;
  const s = await db_settingBaseline();
  baselineCache = { value: s, at: Date.now() };
  return s;
}
export function invalidateBaselineCache() { baselineCache = null; }

import { db } from "@/lib/db";
async function db_settingBaseline(): Promise<Date> {
  const s = await db.setting.findUnique({ where: { key: "program.baselineDate" } });
  const v = s?.value ?? "2026-10-23";
  // رشته تاریخ (YYYY-MM-DD) = نیمه‌شب تهران ⇒ 20:30 روز قبل به UTC
  const d = new Date(`${v}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(20, 30, 0, 0);
  return d;
}

/** شماره روز جاری برنامه نسبت به روز صفر */
export function programDay(baseline: Date, now = new Date()): number {
  return Math.floor((now.getTime() - baseline.getTime()) / 86400000);
}

/** سررسید مطلق از روز نسبی */
export function dueFromDay(baseline: Date, day: number): Date {
  const d = new Date(baseline);
  d.setUTCDate(d.getUTCDate() + day);
  return d;
}

/** روزهای باقی‌مانده تا سررسید (منفی = گذشته) */
export function daysUntil(dueDate: Date | string | null | undefined, now = new Date()): number | null {
  if (!dueDate) return null;
  const d = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}
