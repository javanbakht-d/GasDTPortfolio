// ───────────── واژه‌نامه مشترک وضعیت‌ها و گروه‌ها (فرانت‌اند) ─────────────

export const ACTION_GROUPS = [
  { key: "IMMEDIATE", label: "گام‌های فوری", sub: "روز ۰ تا ۱۰ — استقرار و تجهیز", steps: "۱–۹" },
  { key: "PHASE_30", label: "بازه نخست", sub: "روز ۱۱ تا ۳۰", steps: "۱۰–۱۷" },
  { key: "PHASE_60", label: "بازه دوم", sub: "روز ۳۱ تا ۶۰", steps: "۱۸–۲۴" },
  { key: "PHASE_90", label: "بازه سوم", sub: "روز ۶۱ تا ۹۰", steps: "۲۵–۲۹" },
  { key: "CONTINUOUS", label: "اقدامات مستمر و چرخه‌ای", sub: "از روز نخست و در ادامه برنامه", steps: "۳۰–۳۷" },
] as const;

export const ACTION_STATUSES: Record<string, { label: string; color: string; desc: string }> = {
  DRAFT: { label: "پیش‌نویس", color: "bg-stone-100 text-stone-700 border-stone-200", desc: "اقدام ثبت شده ولی آماده اقدام نیست" },
  READY: { label: "آماده اقدام", color: "bg-slate-100 text-slate-700 border-slate-200", desc: "در بازه زمانی خود هنوز شروع نشده" },
  IN_PROGRESS: { label: "در حال انجام", color: "bg-amber-50 text-amber-800 border-amber-200", desc: "اجرا جریان دارد" },
  WAITING_INFO: { label: "منتظر اطلاعات یا همکاری", color: "bg-orange-50 text-orange-800 border-orange-200", desc: "نیازمند اطلاعات یا همکاری واحد دیگر" },
  IN_REVIEW: { label: "ارسال‌شده برای بررسی", color: "bg-teal-50 text-teal-800 border-teal-200", desc: "خروجی برای تأیید ارسال شده است" },
  NEEDS_FIX: { label: "نیازمند اصلاح", color: "bg-red-50 text-red-700 border-red-200", desc: "بررسی با عودت برای اصلاح" },
  APPROVED: { label: "تأییدشده", color: "bg-emerald-50 text-emerald-700 border-emerald-200", desc: "تأیید نقش مجاز دریافت شده" },
  COMPLETED: { label: "تکمیل‌شده", color: "bg-green-100 text-green-800 border-green-300", desc: "خروجی تحویل و پذیرفته شده است" },
  HALTED: { label: "متوقف‌شده با مجوز", color: "bg-zinc-100 text-zinc-700 border-zinc-200", desc: "توقف با مجوز مرجع مجاز" },
  OVERDUE: { label: "معوق", color: "bg-rose-100 text-rose-800 border-rose-300", desc: "از سررسید گذشته با ثبت علت" },
  CLOSED: { label: "بسته‌شده", color: "bg-neutral-200 text-neutral-700 border-neutral-300", desc: "بسته نهایی با سوابق" },
};

export const ACTION_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["READY", "IN_PROGRESS"],
  READY: ["IN_PROGRESS", "WAITING_INFO", "DRAFT"],
  IN_PROGRESS: ["IN_REVIEW", "WAITING_INFO", "NEEDS_FIX", "COMPLETED", "HALTED", "OVERDUE"],
  WAITING_INFO: ["IN_PROGRESS", "HALTED", "OVERDUE"],
  IN_REVIEW: ["APPROVED", "NEEDS_FIX", "IN_PROGRESS"],
  NEEDS_FIX: ["IN_PROGRESS", "IN_REVIEW"],
  APPROVED: ["COMPLETED", "IN_REVIEW"],
  COMPLETED: ["CLOSED"],
  HALTED: ["IN_PROGRESS", "CLOSED"],
  OVERDUE: ["IN_PROGRESS", "COMPLETED", "HALTED", "CLOSED"],
  CLOSED: [],
};

export const PRIORITIES: Record<string, { label: string; color: string }> = {
  LOW: { label: "کم", color: "text-stone-600" },
  MEDIUM: { label: "متوسط", color: "text-slate-700" },
  HIGH: { label: "زیاد", color: "text-amber-700" },
  CRITICAL: { label: "بحرانی", color: "text-rose-700" },
};

export const ACTION_TYPES: Record<string, string> = {
  ROUTINE: "عادی",
  RESOLUTION: "مصوبه",
  CONTINUOUS: "مستمر",
  CRITICAL: "بحرانی",
  SPECIAL: "مورد خاص",
};

export const CYCLES: Record<string, string> = {
  MONTHLY: "ماهانه",
  QUARTERLY: "فصلی",
  SEMIANNUAL: "شش‌ماهه",
  ANNUAL: "سالانه",
  CONTINUOUS: "مستمر",
};

export const DOC_STATUSES: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "پیش‌نویس", color: "bg-stone-100 text-stone-700" },
  IN_REVIEW: { label: "در حال بررسی", color: "bg-amber-50 text-amber-800" },
  APPROVED: { label: "تأییدشده", color: "bg-teal-50 text-teal-800" },
  ISSUED: { label: "ابلاغ‌شده", color: "bg-emerald-100 text-emerald-800" },
  SUPERSEDED: { label: "منسوخ", color: "bg-zinc-100 text-zinc-600" },
  ARCHIVED: { label: "بایگانی‌شده", color: "bg-neutral-200 text-neutral-600" },
};

export const DOC_TYPES: Record<string, string> = {
  CHARTER: "منشور",
  DIRECTIVE: "دستورالعمل",
  FRAMEWORK: "چارچوب",
  MECHANISM: "سازوکار",
  FORM: "فرم",
  AGREEMENT: "تفاهم‌نامه",
  MINUTES: "صورت‌جلسه",
  REPORT: "گزارش",
  BUDGET: "بودجه",
  REFERENCE_PLAN: "برنامه مرجع",
};

export const DOC_CLASSIFICATIONS: Record<string, string> = {
  PUBLIC: "عمومی",
  INTERNAL: "داخلی",
  CONFIDENTIAL: "محرمانه",
  SECRET: "خیلی محرمانه",
};

export const PROJECT_STATUSES: Record<string, { label: string; color: string; desc?: string }> = {
  PROPOSED: { label: "ثبت پیشنهاد", color: "bg-stone-100 text-stone-700" },
  SCREENING: { label: "بررسی اولیه", color: "bg-amber-50 text-amber-800" },
  INFO_COMPLETE: { label: "اطلاعات کامل", color: "bg-sky-50 text-sky-800" },
  SCORED: { label: "امتیازدهی‌شده", color: "bg-teal-50 text-teal-800" },
  RECOMMENDED: { label: "پیشنهاد برای تصویب", color: "bg-violet-50 text-violet-800" },
  APPROVED: { label: "مصوب", color: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "ردشده", color: "bg-rose-50 text-rose-700" },
  PILOT: { label: "اجرای پایلوت", color: "bg-lime-50 text-lime-800" },
  EVALUATING: { label: "ارزیابی نتایج", color: "bg-orange-50 text-orange-800" },
  GATE_DECISION: { label: "تصمیم دروازه فاز", color: "bg-fuchsia-50 text-fuchsia-800" },
  SCALING: { label: "توسعه/مقیاس", color: "bg-green-100 text-green-800" },
  STOPPED: { label: "متوقف‌شده", color: "bg-zinc-200 text-zinc-700" },
};

export const AI_APP_STATUSES: Record<string, { label: string; color: string }> = {
  PROPOSED: { label: "پیشنهادی", color: "bg-stone-100 text-stone-700" },
  EVALUATING: { label: "در حال ارزیابی", color: "bg-amber-50 text-amber-800" },
  PILOT: { label: "آزمایشی", color: "bg-lime-50 text-lime-800" },
  APPROVED: { label: "مصوب", color: "bg-teal-50 text-teal-800" },
  OPERATIONAL: { label: "عملیاتی", color: "bg-emerald-100 text-emerald-800" },
  STOPPED: { label: "متوقف‌شده", color: "bg-zinc-100 text-zinc-700" },
  RETIRED: { label: "بازنشسته", color: "bg-neutral-200 text-neutral-600" },
};

export const RISK_LEVELS: Record<string, string> = { LOW: "کم", MEDIUM: "متوسط", HIGH: "زیاد", CRITICAL: "بحرانی" };
export const ENTRY_TYPES: Record<string, string> = { INFORMATION_SYSTEM: "سامانه اطلاعاتی", DATABASE: "پایگاه داده", AI_APPLICATION: "کاربرد هوش مصنوعی" };
export const ENTRY_STATUSES: Record<string, string> = { SUBMITTED: "ثبت‌شده", VALIDATED: "اعتبارسنجی‌شده", NEEDS_INFO: "نیازمند تکمیل" };
export const MEETING_STATUSES: Record<string, string> = { SCHEDULED: "برنامه‌ریزی‌شده", HELD: "برگزارشده", CANCELED: "لغوشده" };
export const DECISION_STATUSES: Record<string, string> = { PENDING: "در انتظار اقدام", IN_PROGRESS: "در حال اجرا", DONE: "اجرا‌شده", OVERDUE: "معوق" };
export const REPORT_TYPES: Record<string, string> = { MONTHLY: "ماهانه پایش", QUARTERLY: "فصلی", "90DAY": "جامع ۹۰روزه", ANNUAL: "سالانه عملکرد" };
export const PHASES: Record<string, { label: string; focus: string }> = {
  "1405": { label: "۱۴۰۵ — استقرار حکمرانی", focus: "استقرار شورا و دبیرخانه؛ تصویب منشورها؛ ثبت پروژه‌ها و کاربردهای هوش مصنوعی؛ آغاز پروژه‌های پیشران" },
  "1406": { label: "۱۴۰۶ — یکپارچه‌سازی و مقیاس", focus: "معماری یکپارچه داده و سکوهای مشترک؛ داده مرجع؛ برنامه توانمندسازی" },
  "1407": { label: "۱۴۰۷ — هوشمندی در مقیاس", focus: "کاربردهای هوش مصنوعی بر پایه داده مرجع؛ تحقق منافع؛ تثبیت حکمرانی" },
};

export const faNum = (n: number | string | null | undefined) =>
  n == null ? "—" : String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

/** واحدهای کاری مجاز برای دبیرخانه/ادمین (دید سراسری) */
export const GLOBAL_VIEW_ROLES = ["SYSTEM_ADMIN", "SECRETARIAT_ADMIN", "CONFIG_ADMIN", "COUNCIL_SECRETARY", "COUNCIL_MEMBER", "AUDITOR", "REPORT_MANAGER"];
