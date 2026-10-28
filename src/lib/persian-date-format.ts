// ───────────── قالب‌بندی تاریخ شمسی (سمت کلاینت — بدون وابستگی سرور) ─────────────

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

/** نمایش تاریخ + ساعت */
export function faDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  const t = jFmt({ hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  return `${faDate(date)} — ${t}`;
}

/** ماه و سال: آبان ۱۴۰۵ */
export function faMonth(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return jFmt({ year: "numeric", month: "long" }).format(date);
}

/** روز جاری برنامه نسبت به مبنای ابلاغ */
export function programDay(baseline: string | null | undefined, now = new Date()): number {
  if (!baseline) return 0;
  return Math.max(0, Math.floor((now.getTime() - new Date(baseline).getTime()) / 86400000));
}

/** روزهای باقی‌مانده تا سررسید (منفی = گذشته) */
export function daysUntil(due: Date | string | null | undefined, now = new Date()): number | null {
  if (!due) return null;
  const d = typeof due === "string" ? new Date(due) : due;
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

export const faNum = (n: number | string | null | undefined) =>
  n == null ? "—" : String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
