/**
 * Seed — NIGC-DTG
 * داده‌های اولیه: ۳۷ گام سند مرجع، واحدها، نقش‌ها، کاربران نمونه، اسناد محوری،
 * هشت شاخص کلیدی (بدون مقدار ساختگی)، سه پیشران، جلسه نخست شورا، تنظیمات.
 *
 * نسخه هسته (importپذیر در سرور) — CLI در scripts/seed.ts
 */
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

let db: PrismaClient; // کلاینت تزریقی — توسط runSeed(client) مقداردهی می‌شود

// ۱ آبان ۱۴۰۵ == 2026-10-23 (فرض اولیه؛ پارامتر پیکربندی‌پذیر در سامانه)
const BASELINE = new Date("2026-10-22T20:30:00.000Z"); // نیمه‌شب تهران

function due(days: number | null): Date | null {
  if (days == null) return null;
  const d = new Date(BASELINE);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// ───────────────── ۳۷ گام سند مرجع ─────────────────
type SeedAction = {
  refStep: number; title: string; description: string;
  groupKey: string; actionType?: string; sourceRef?: string;
  dueStartDay?: number; dueEndDay?: number; cycleKey?: string;
  deliverable?: string; deps?: number[]; unitCode?: string; priority?: string;
};

const ACTIONS: SeedAction[] = [
  // ── گام‌های فوری: روز ۰ تا ۱۰ (استقرار و تجهیز) ──
  { refStep: 1, groupKey: "IMMEDIATE", dueStartDay: 1, dueEndDay: 3, unitCode: "SEC", priority: "CRITICAL",
    title: "اعلام رسمی استقرار و آغاز فعالیت دبیرخانه",
    description: "ارسال نامه رسمی به کلیه مدیریت‌های ستادی و شرکت‌های تابعه، معرفی دبیر و اعضای دبیرخانه و اعلام کانال‌های رسمی مکاتبات و ارسال مستندات، به‌عنوان نخستین پیگیری ابلاغ سراسری مدیرعامل.",
    deliverable: "نامه رسمی اعلام استقرار (ابلاغی به همه واحدها)", sourceRef: "جدول ۱ سند مرجع" },
  { refStep: 2, groupKey: "IMMEDIATE", dueStartDay: 3, dueEndDay: 7, unitCode: "SEC", priority: "CRITICAL",
    title: "تدوین و ابلاغ «بسته ابزار اجرای الزامات واحدها»",
    description: "فرم معرفی رابط تحول دیجیتال و مالک و متولی داده به همراه جانشین؛ فرم ثبت وضعیت موجود (سامانه‌های اطلاعاتی، پایگاه‌های داده و کاربردهای هوش مصنوعی)؛ فرم استاندارد ثبت پروژه در سبد؛ الگوی خودارزیابی بلوغ دیجیتال؛ فرم درخواست مجوز کتبی برای اقدامات خارج از چارچوب برنامه؛ به همراه راهنمای تکمیل و پرسش‌های متداول. (فصل ۵ سند ابلاغی)",
    deliverable: "بسته ابلاغی فرم‌ها و راهنماها", sourceRef: "فصل ۵ سند ابلاغی" },
  { refStep: 3, groupKey: "IMMEDIATE", dueStartDay: 3, dueEndDay: 7, unitCode: "SEC", priority: "HIGH",
    title: "ابلاغ «تقویم اقدامات ۹۰ روزه» به کلیه واحدها",
    description: "اعلام مهلت‌های ۳۰، ۶۰ و ۹۰ روزه تکالیف واحدها، چرخه گزارش‌دهی فصلی و مرجع رفع ابهام، برای پیشگیری از معوقات ناشی از ابهام در مهلت‌ها.",
    deliverable: "نامه تقویم اجرایی + پیگیری", sourceRef: "جدول ۱ سند مرجع" },
  { refStep: 4, groupKey: "IMMEDIATE", dueStartDay: 5, dueEndDay: 10, unitCode: "SEC", priority: "HIGH",
    title: "راه‌اندازی سامانه رهگیری و داشبورد پایش",
    description: "ایجاد فهرست رهگیری تعهدات ۳۰، ۶۰ و ۹۰ روزه واحدها و شاخص‌های ماهانه برنامه (پوشش معرفی رابط و مالک داده؛ تحقق زمان‌بندی مصوبات) و به‌روزرسانی مستمر آن. (این سامانه، ابزار اجرای همین گام است.)",
    deliverable: "داشبورد / فهرست رهگیری تعهدات (فعال)", sourceRef: "جدول ۱ سند مرجع" },
  { refStep: 5, groupKey: "IMMEDIATE", dueStartDay: 5, dueEndDay: 10, unitCode: "SEC", priority: "HIGH",
    title: "تشکیل سه تیم کاری تدوین اسناد محوری",
    description: "تیم‌های «منشور حاکمیت داده»، «چارچوب حاکمیت هوش مصنوعی» و «سازوکار مدیریت سبد پروژه‌ها و مدل امتیازدهی متوازن» با مشارکت مدیریت فناوری اطلاعات و ارتباطات (فاوا) و مدیریت‌های صاحب فرایند، به همراه تقویم گردش نظرات.",
    deliverable: "مصوبه تشکیل تیم‌ها + تقویم تدوین اسناد", sourceRef: "جدول ۱ سند مرجع" },
  { refStep: 6, groupKey: "IMMEDIATE", dueStartDay: 5, dueEndDay: 60, unitCode: "SEC", priority: "HIGH",
    title: "آغاز تدوین تفاهم‌نامه مرزبندی مأموریت‌ها میان مدیریت پژوهش و فناوری و مدیریت فاوا",
    description: "تشکیل کارگروه مشترک دو مدیریت و تهیه پیش‌نویس اولیه مرزبندی مأموریت‌ها، نحوه همکاری و سازوکار هماهنگی. مهلت نهایی: حداکثر ۶۰ روز.",
    deliverable: "پیش‌نویس اولیه تفاهم‌نامه", sourceRef: "فصل ۴ سند ابلاغی" },
  { refStep: 7, groupKey: "IMMEDIATE", dueStartDay: 5, dueEndDay: 10, unitCode: "SEC", priority: "CRITICAL",
    title: "آغاز هماهنگی با مدیریت‌های برنامه‌ریزی تلفیقی و مالی برای بودجه‌ریزی سال ۱۴۰۶",
    description: "شناسایی و برآورد نیازهای مالی برنامه و اخذ نوبت در چرخه بودجه‌ریزی سال ۱۴۰۶. این مسیر زمان‌حساس است و به تعویق افتادن آن، فرصت تأمین منابع سال نخست اجرا را از بین می‌برد.",
    deliverable: "صورت‌جلسه آغاز هماهنگی + تقویم بودجه ۱۴۰۶", sourceRef: "جدول ۱ سند مرجع" },
  { refStep: 8, groupKey: "IMMEDIATE", dueStartDay: 5, dueEndDay: 10, unitCode: "SEC", priority: "MEDIUM",
    title: "اعلام سازوکار دسترسی واحدها به اسناد پشتیبان",
    description: "اعلام نحوه درخواست و دریافت نسخه تفصیلی برنامه، پیش‌نویس منشورها و چارچوب‌ها و فرم استاندارد پروژه‌ها. (فصل ۱۰ سند ابلاغی)",
    deliverable: "اطلاعیه رسمی دسترسی به اسناد", sourceRef: "فصل ۱۰ سند ابلاغی" },
  { refStep: 9, groupKey: "IMMEDIATE", dueStartDay: 5, dueEndDay: 10, unitCode: "SEC", priority: "HIGH",
    title: "آماده‌سازی نخستین جلسه شورای راهبری",
    description: "تدوین بسته پیشنهادی جلسه شامل پیشنهاد دستور جلسه (تقویم منظم جلسات، تیم‌های کاری و برنامه تدوین اسناد محوری)، آیین‌کار جلسات و فهرست مدعوین.",
    deliverable: "بسته پیشنهادی جلسه نخست شورا", sourceRef: "جدول ۱ سند مرجع" },
  // ── بازه نخست: روز ۱۱ تا ۳۰ ──
  { refStep: 10, groupKey: "PHASE_30", dueStartDay: 15, dueEndDay: 30, unitCode: "SEC", priority: "CRITICAL",
    title: "برگزاری نخستین جلسه رسمی شورای راهبری و آغاز رسمی فعالیت شورا",
    description: "تصویب تقویم جلسات، تیم‌های کاری و برنامه تدوین اسناد محوری و ثبت مصوبات پایه. (جدول ۱ سند ابلاغی)",
    deliverable: "صورت‌جلسه و مصوبات نخستین جلسه شورا", sourceRef: "جدول ۱ سند ابلاغی" },
  { refStep: 11, groupKey: "PHASE_30", dueStartDay: 11, dueEndDay: 30, unitCode: "SEC", priority: "CRITICAL",
    title: "پایش و پیگیری معرفی رابط تحول دیجیتال و مالک و متولی داده توسط کلیه واحدها",
    description: "مهلت واحدها: ۳۰ روز. رصد روزانه دریافت‌ها، ارسال یادآوری کتبی به واحدهای تأخیری و گزارش پوشش (شاخص ماهانه جدول ۳ سند ابلاغی).",
    deliverable: "گزارش پوشش معرفی رابط / مالک داده", sourceRef: "شاخص ۲ جدول ۳ سند ابلاغی" },
  { refStep: 12, groupKey: "PHASE_30", dueStartDay: 11, dueEndDay: 30, unitCode: "SEC", priority: "HIGH",
    title: "دریافت و ساماندهی «وضعیت موجود دیجیتال» واحدها",
    description: "مهلت واحدها: ۳۰ روز. اعتبارسنجی فرم‌های دریافتی و تشکیل پایگاه وضعیت موجود شامل فهرست سامانه‌های اطلاعاتی، پایگاه‌های داده و کاربردهای هوش مصنوعی.",
    deliverable: "پایگاه وضعیت موجود دیجیتال (نسخه اول)", sourceRef: "فصل ۵ سند ابلاغی" },
  { refStep: 13, groupKey: "PHASE_30", dueStartDay: 11, dueEndDay: 30, unitCode: "SEC", priority: "HIGH",
    title: "راه‌اندازی «دفتر مرکزی ثبت کاربردهای هوش مصنوعی»",
    description: "فعال‌سازی سازوکار ثبت متمرکز (محور ۶-۲ سند ابلاغی) و درج کاربردهای شناسایی‌شده از وضعیت موجود واحدها در آن.",
    deliverable: "دفتر ثبت هوش مصنوعی فعال با رکوردهای اولیه", sourceRef: "محور ۶-۲ سند ابلاغی", deps: [12] },
  { refStep: 14, groupKey: "PHASE_30", dueStartDay: 11, dueEndDay: 30, unitCode: "SEC", priority: "MEDIUM",
    title: "پایش ابلاغ داخلی و جلسات توجیهی واحدها",
    description: "مهلت واحدها: ۳۰ روز. رصد اجرای تعهد واحدها به ابلاغ برنامه در سطح مدیران، سرپرستان و کارشناسان کلیدی و برگزاری جلسات توجیهی.",
    deliverable: "گزارش پوشش ابلاغ داخلی واحدها", sourceRef: "جدول ۱ سند ابلاغی" },
  { refStep: 15, groupKey: "PHASE_30", dueStartDay: 15, dueEndDay: 30, unitCode: "SEC", priority: "CRITICAL",
    title: "ثبت پروژه‌های پیشران در سبد مرکزی و آغاز تدوین اسناد پروژه",
    description: "ثبت «کنتورهای هوشمند گاز»، «سکوی خدمات یکپارچه دیجیتال گاز (BSS)» و «سبد پروژه‌های سازمانی تحول دیجیتال (DT Portfolio)» با فرم استاندارد و آغاز تدوین فازبندی، اهداف کمی و سنجه‌های موفقیت برای تصویب شورا. (فصل ۷ سند ابلاغی)",
    deliverable: "پرونده ثبت پیشران‌ها + پیش‌نویس اسناد پروژه", sourceRef: "فصل ۷ سند ابلاغی" },
  { refStep: 16, groupKey: "PHASE_30", dueStartDay: 20, dueEndDay: 30, unitCode: "SEC", priority: "HIGH",
    title: "گردش نظر پیش‌نویس اسناد محوری",
    description: "ارسال پیش‌نویس اولیه منشور حاکمیت داده، چارچوب حاکمیت هوش مصنوعی و سازوکار مدیریت سبد به مدیریت فاوا و مدیریت‌های کلیدی و تجمیع نظرات دریافتی.",
    deliverable: "گزارش گردش نظر نسخه اول اسناد", sourceRef: "جدول ۱ سند مرجع" },
  { refStep: 17, groupKey: "PHASE_30", dueStartDay: 25, dueEndDay: 30, unitCode: "SEC", priority: "MEDIUM",
    title: "برگزاری نخستین نشست توجیهی مشترک رابطان واحدها",
    description: "نشست حضوری یا برخط با رابطان معرفی‌شده برای تثبیت نقش‌ها، شیوه تکمیل فرم‌ها و چرخه گزارش‌دهی.",
    deliverable: "صورت‌جلسه نشست و فهرست حضور", sourceRef: "جدول ۲ سند مرجع", deps: [11] },
  // ── بازه دوم: روز ۳۱ تا ۶۰ ──
  { refStep: 18, groupKey: "PHASE_60", dueStartDay: 31, dueEndDay: 55, unitCode: "SEC", priority: "CRITICAL",
    title: "نهایی‌سازی بسته اسناد محوری برای تصویب شورا",
    description: "منشور حاکمیت داده به همراه دستورالعمل‌های اجرایی (طبقه‌بندی داده، تعیین سطح محرمانگی و کنترل‌های متناسب)، چارچوب حاکمیت هوش مصنوعی و سازوکار مدیریت سبد پروژه‌ها. مهلت کل اسناد تکمیلی: حداکثر ۶۰ روز.",
    deliverable: "بسته نهایی اسناد (ارائه‌شده به شورا)", sourceRef: "جدول ۱ سند ابلاغی — فصل ۶" },
  { refStep: 19, groupKey: "PHASE_60", dueStartDay: 31, dueEndDay: 60, unitCode: "SEC", priority: "CRITICAL", deps: [10, 16, 18],
    title: "تصویب اسناد محوری و اسناد تکمیلی محورهای چهارگانه در شورای راهبری",
    description: "مهلت اسناد تکمیلی حداکثر ۶۰ روز. ابلاغ مصوبات به کلیه واحدها. عبور تصویب سیاست‌ها و منشورها فقط از مرجع مجاز (شورای راهبری).",
    deliverable: "مصوبات شورا + نامه ابلاغ به واحدها", sourceRef: "فصل ۶ سند ابلاغی" },
  { refStep: 20, groupKey: "PHASE_60", dueStartDay: 31, dueEndDay: 60, unitCode: "SEC", priority: "HIGH",
    title: "نهایی‌سازی تفاهم‌نامه مرزبندی مأموریت‌ها و ارائه به مرجع تأیید",
    description: "نهایی‌سازی تفاهم‌نامه مرزبندی مأموریت‌های مدیریت پژوهش و فناوری و مدیریت فاوا و ارائه به مرجع تأیید مربوط. حداکثر ۶۰ روز از تاریخ ابلاغ.",
    deliverable: "تفاهم‌نامه نهایی‌شده (ارائه به مرجع تأیید)", sourceRef: "فصل ۴ سند ابلاغی" },
  { refStep: 21, groupKey: "PHASE_60", dueStartDay: 31, dueEndDay: 60, unitCode: "SEC", priority: "HIGH",
    title: "دریافت و اعتبارسنجی فهرست پروژه‌های دیجیتال جاری و پیشنهادی همه واحدها",
    description: "مهلت واحدها: ۶۰ روز. ثبت در قالب فرم استاندارد سبد، کنترل کامل بودن داده‌ها و تشکیل سبد مرکزی پروژه‌های شرکت.",
    deliverable: "سبد مرکزی پروژه‌های دیجیتال (نسخه اول)", sourceRef: "فصل ۶ سند ابلاغی" },
  { refStep: 22, groupKey: "PHASE_60", dueStartDay: 31, dueEndDay: 60, unitCode: "SEC", priority: "HIGH",
    title: "دریافت و تحلیل خودارزیابی‌های بلوغ دیجیتال واحدها",
    description: "مهلت واحدها: ۶۰ روز. تحلیل وضعیت در محورهای حاکمیت داده، زیرساخت، فرایندها و توانمندی منابع انسانی و تهیه تصویر تجمیعی بلوغ شرکت.",
    deliverable: "گزارش تحلیل بلوغ دیجیتال شرکت", sourceRef: "فصل ۵ سند ابلاغی" },
  { refStep: 23, groupKey: "PHASE_60", dueStartDay: 45, dueEndDay: 60, unitCode: "SEC", priority: "CRITICAL", deps: [21],
    title: "امتیازدهی و اولویت‌بندی پروژه‌های سبد مرکزی",
    description: "اعمال مدل امتیازدهی متوازن: ارزش و منفعت ۴۰ امتیاز، آمادگی داده ۲۰، ریسک و امنیت ۲۰ و امکان‌پذیری اجرا ۲۰ (محور ۶-۳ سند ابلاغی) و تهیه فهرست نامزدهای موج نخست جهت تصمیم شورا.",
    deliverable: "جدول امتیازدهی + پیشنهاد نامزدهای موج نخست", sourceRef: "محور ۶-۳ سند ابلاغی" },
  { refStep: 24, groupKey: "PHASE_60", dueStartDay: 50, dueEndDay: 60, unitCode: "SEC", priority: "HIGH", deps: [22],
    title: "تدوین پیشنهادهای خط مبنا، دروازه فاز و توانمندسازی",
    description: "پیشنهاد خط مبنای هشت شاخص کلیدی بر پایه داده‌های واقعی دریافتی (جدول ۳ سند ابلاغی)، پیشنهاد معیارهای دروازه فاز و پیشنهاد برنامه توانمندسازی سواد داده و هوش مصنوعی (محور ۶-۴).",
    deliverable: "سه پیشنهاد مستند جهت تصویب شورا", sourceRef: "جدول ۳ و محور ۶-۴ سند ابلاغی" },
  // ── بازه سوم: روز ۶۱ تا ۹۰ ──
  { refStep: 25, groupKey: "PHASE_90", dueStartDay: 75, dueEndDay: 90, unitCode: "SEC", priority: "CRITICAL", deps: [10, 23],
    title: "تصویب و ابلاغ سبد موج نخست پروژه‌ها",
    description: "ارائه سبد موج نخست — پروژه‌های پیشران همراه اسناد پروژه و فازبندی، به علاوه پروژه‌های منتخب واحدها — به شورا و ابلاغ مصوبه به واحدها. (تا ۹۰ روز)",
    deliverable: "مصوبه سبد موج نخست + نامه ابلاغ", sourceRef: "جدول ۱ سند ابلاغی" },
  { refStep: 26, groupKey: "PHASE_90", dueStartDay: 61, dueEndDay: 90, unitCode: "SEC", priority: "CRITICAL", deps: [22, 24],
    title: "تعیین و ابلاغ خط مبنای شاخص‌های کلیدی برنامه",
    description: "نهایی‌سازی خط مبنای هشت شاخص بر پایه داده‌های واقعی واحدها و ثبت آن به‌عنوان مبنای سنجش تحقق منافع (شاخص ۷). تا ۹۰ روز.",
    deliverable: "جدول خط مبنای مصوب شاخص‌ها", sourceRef: "جدول ۱ و ۳ سند ابلاغی" },
  { refStep: 27, groupKey: "PHASE_90", dueStartDay: 60, dueEndDay: 75, unitCode: "SEC", priority: "CRITICAL", deps: [19],
    title: "ابلاغ دستورالعمل‌های اجرایی منشور حاکمیت داده و پایش آغاز اجرای واحدها",
    description: "زمان‌بندی ابلاغ به‌گونه‌ای که مهلت ۹۰ روزه واحدها برای طبقه‌بندی داده، تعیین سطح محرمانگی و اعمال کنترل‌های متناسب رعایت شود.",
    deliverable: "دستورالعمل‌های ابلاغی + نخستین گزارش پایش اجرا", sourceRef: "فصل ۵ سند ابلاغی" },
  { refStep: 28, groupKey: "PHASE_90", dueStartDay: 85, dueEndDay: 90, unitCode: "SEC", priority: "CRITICAL",
    title: "تدوین و ارائه «گزارش ۹۰ روزه» به مدیرعامل",
    description: "پوشش استقرار حکمرانی، پوشش تعهدات واحدها، تحلیل بلوغ، سبد موج نخست، خط مبنای شاخص‌ها، ریسک‌ها و پیشنهادها.",
    deliverable: "گزارش ۹۰ روزه (ابلاغی)", sourceRef: "جدول ۱ سند ابلاغی" },
  { refStep: 29, groupKey: "PHASE_90", dueStartDay: 61, dueEndDay: 90, unitCode: "SEC", priority: "HIGH",
    title: "تثبیت نیازهای مالی برنامه در فرایند بودجه‌ریزی سال ۱۴۰۶",
    description: "تکمیل مسیر آغازشده در گام ۷ و تحویل برآوردها و مستندات پشتیبان به مدیریت‌های برنامه‌ریزی تلفیقی و مالی.",
    deliverable: "مستندات نیازهای مالی (تحویل به چرخه بودجه ۱۴۰۶)", sourceRef: "جدول ۱ سند ابلاغی" },
  // ── اقدامات مستمر و چرخه‌ای ──
  { refStep: 30, groupKey: "CONTINUOUS", cycleKey: "MONTHLY", unitCode: "SEC", priority: "HIGH",
    title: "پایش ماهانه شاخص‌های ماهانه برنامه",
    description: "تهیه گزارش داخلی پوشش معرفی رابط و مالک داده (شاخص ۲) و تحقق زمان‌بندی مصوبات و پروژه‌ها (شاخص ۵) و پیگیری کتبی واحدهای تأخیری.",
    deliverable: "گزارش ماهانه پایش (داخلی)", sourceRef: "شاخص‌های ۲ و ۵ جدول ۳ سند ابلاغی" },
  { refStep: 31, groupKey: "CONTINUOUS", cycleKey: "QUARTERLY", unitCode: "SEC", priority: "HIGH",
    title: "اجرای چرخه گزارش‌دهی فصلی",
    description: "دریافت گزارش‌های فصلی واحدها حداکثر پانزده روز پس از پایان هر فصل، بررسی در جلسات شورا و ارائه جمع‌بندی به مدیرعامل؛ نخستین چرخه کامل با گزارش ۹۰ روزه هم‌زمان می‌شود. (فصل ۹ سند ابلاغی)",
    deliverable: "گزارش فصلی تجمیعی دبیرخانه", sourceRef: "فصل ۹ سند ابلاغی" },
  { refStep: 32, groupKey: "CONTINUOUS", cycleKey: "SEMIANNUAL", unitCode: "SEC", priority: "MEDIUM",
    title: "پایش شش‌ماهه تحقق منافع پروژه‌ها",
    description: "سنجش تحقق منافع مصوب پروژه‌ها پس از تعیین خط مبنا و گزارش نتایج به شورا (شاخص ۷).",
    deliverable: "گزارش تحقق منافع", sourceRef: "شاخص ۷ جدول ۳ سند ابلاغی" },
  { refStep: 33, groupKey: "CONTINUOUS", cycleKey: "CONTINUOUS", unitCode: "SEC", priority: "HIGH",
    title: "نگهداشت دفتر مرکزی ثبت کاربردهای هوش مصنوعی",
    description: "پوشش کامل ثبت کاربردهای موجود و جدید و حصول اطمینان از اجرای قاعده «بدون ثبت و ارزیابی، بهره‌برداری ممنوع» (محور ۶-۲ سند ابلاغی؛ شاخص ۳).",
    deliverable: "رکوردهای به‌روز دفتر ثبت", sourceRef: "محور ۶-۲؛ شاخص ۳ سند ابلاغی" },
  { refStep: 34, groupKey: "CONTINUOUS", cycleKey: "CONTINUOUS", unitCode: "SEC", priority: "HIGH",
    title: "پایش ممنوعیت اقدام موازی خارج از چارچوب",
    description: "شناسایی توسعه خدمات دیجیتال جدید خارج از معماری و استانداردهای مصوب، رسیدگی به درخواست‌های مجوز کتبی و پیگیری تصمیم شورا درباره ادغام یا توقف طرح‌های خارج از چارچوب. (فصل ۵ سند ابلاغی — قاعده «عدم اجرای طرح‌های موازی خارج از چارچوب، بدون مجوز کتبی»)",
    deliverable: "فهرست طرح‌های غیرمنطبق + تصمیمات شورا", sourceRef: "فصل ۵ سند ابلاغی" },
  { refStep: 35, groupKey: "CONTINUOUS", cycleKey: "CONTINUOUS", unitCode: "SEC", priority: "MEDIUM",
    title: "پشتیبانی، آموزش و رفع ابهام واحدها",
    description: "پاسخ‌گویی مستمر به استعلام‌ها، به‌روزرسانی پرسش‌های متداول و برگزاری نشست‌های دوره‌ای رابطان برای اجرای یکسان برنامه. (فصل ۱۰ سند ابلاغی)",
    deliverable: "خدمات پشتیبانی مستمر + نشست‌های دوره‌ای", sourceRef: "فصل ۱۰ سند ابلاغی" },
  { refStep: 36, groupKey: "CONTINUOUS", cycleKey: "CONTINUOUS", unitCode: "SEC", priority: "MEDIUM",
    title: "نگهداشت اسناد پشتیبان و پاسخ به درخواست‌های استناد",
    description: "نگهداشت نسخه تفصیلی برنامه، پیش‌نویس منشورها و فرم استاندارد پروژه‌ها و تحویل آن‌ها به واحدهای متقاضی.",
    deliverable: "آرشیو اسناد پشتیبان به‌روز", sourceRef: "فصل ۱۰ سند ابلاغی" },
  { refStep: 37, groupKey: "CONTINUOUS", cycleKey: "CONTINUOUS", unitCode: "SEC", priority: "MEDIUM",
    title: "آمادگی بازنگری برنامه در پی ابلاغ تاپ چارت",
    description: "پایش وضعیت ابلاغ تاپ چارت شرکت از سوی وزارت نفت و نگهداشت سناریوی تعدیل برنامه و اسناد در چارچوب ساختار و مأموریت‌های جدید. (فصل ۱۰ سند ابلاغی)",
    deliverable: "سناریوی آماده بازنگری برنامه", sourceRef: "فصل ۱۰ سند ابلاغی" },
];

async function main() {
  console.log("⟳ پاک‌سازی داده‌های قبلی…");
  await db.auditLog.deleteMany();
  await db.notification.deleteMany();
  await db.report.deleteMany();
  await db.budgetItem.deleteMany();
  await db.decision.deleteMany();
  await db.meeting.deleteMany();
  await db.deviation.deleteMany();
  await db.risk.deleteMany();
  await db.kpiMeasurement.deleteMany();
  await db.kpi.deleteMany();
  await db.aiApplication.deleteMany();
  await db.digitalStatusEntry.deleteMany();
  await db.dataDomain.deleteMany();
  await db.projectScore.deleteMany();
  await db.project.deleteMany();
  await db.documentVersion.deleteMany();
  await db.document.deleteMany();
  await db.actionUpdate.deleteMany();
  await db.action.deleteMany();
  await db.baselineChange.deleteMany();
  await db.setting.deleteMany();
  await db.session.deleteMany();
  await db.userRole.deleteMany();
  await db.role.deleteMany();
  await db.user.deleteMany();
  await db.orgUnit.deleteMany();

  // ── نقش‌ها ──
  console.log("⟳ نقش‌ها…");
  const P = {
    view: ["dashboard:view", "actions:view", "documents:view", "projects:view", "governance:view", "ai_registry:view", "kpis:view", "risks:view", "meetings:view", "budget:view", "reports:view", "org:view", "knowledge:view"],
  };
  const roles = [
    { key: "SYSTEM_ADMIN", name: "مدیر کل سامانه", description: "دسترسی کامل به همه بخش‌ها، کاربران و تنظیمات", isSystem: true,
      permissions: ["*"] },
    { key: "CONFIG_ADMIN", name: "مدیر پیکربندی و راهبری سامانه", description: "مدیریت تنظیمات، تقویم، فرم‌ها و پیکربندی", isSystem: true,
      permissions: [...P.view, "settings:manage", "org:manage", "actions:manage", "documents:manage", "projects:manage", "kpis:manage", "audit:view", "system:health"] },
    { key: "SECRETARIAT_ADMIN", name: "مدیر دبیرخانه", description: "مدیریت عملیاتی کامل دبیرخانه شورا", isSystem: true,
      permissions: [...P.view, "org:manage", "actions:create", "actions:edit", "actions:submit", "actions:approve", "actions:close", "actions:remind", "documents:create", "documents:edit", "documents:submit", "documents:approve", "projects:create", "projects:edit", "projects:score", "projects:submit", "governance:manage", "ai_registry:manage", "kpis:manage", "kpis:measure", "risks:manage", "deviations:manage", "meetings:manage", "decisions:manage", "budget:manage", "reports:create", "reports:export", "audit:view", "notifications:send", "ai_assistant:use", "files:upload", "export:data"] },
    { key: "COUNCIL_SECRETARY", name: "دبیر شورا", description: "دبیری شورای راهبری و پیشبرد صورت‌جلسات و مصوبات", isSystem: true,
      permissions: [...P.view, "actions:create", "actions:edit", "actions:submit", "actions:remind", "meetings:manage", "decisions:manage", "documents:create", "documents:edit", "reports:create", "ai_assistant:use", "files:upload", "export:data"] },
    { key: "COUNCIL_MEMBER", name: "عضو / رئیس شورای راهبری", description: "مشاهده کل برنامه و تأیید مصوبات در جلسات", isSystem: true,
      permissions: [...P.view, "actions:approve", "documents:approve", "projects:approve", "meetings:manage", "reports:view", "ai_assistant:use"] },
    { key: "UNIT_MANAGER", name: "مدیر واحد سازمانی", description: "مدیریت اقدامات و گزارش‌های واحد خود", isSystem: true,
      permissions: [...P.view, "actions:create", "actions:edit", "actions:submit", "documents:create", "projects:create", "projects:edit", "governance:manage", "ai_registry:create", "kpis:measure", "risks:manage", "reports:create", "ai_assistant:use", "files:upload"] },
    { key: "DT_LIAISON", name: "رابط تحول دیجیتال", description: "ثبت وضعیت موجود، پروژه‌ها و هماهنگی با دبیرخانه", isSystem: true,
      permissions: [...P.view, "actions:edit", "actions:submit", "documents:create", "projects:create", "governance:manage", "ai_registry:create", "kpis:measure", "files:upload", "ai_assistant:use"] },
    { key: "DATA_OWNER", name: "مالک داده", description: "مسئولیت حوزه‌های داده و طبقه‌بندی", isSystem: true,
      permissions: [...P.view, "governance:manage", "documents:create", "ai_assistant:use"] },
    { key: "DATA_CUSTODIAN", name: "متولی داده", description: "نگهداشت فنی و کیفیت داده", isSystem: true,
      permissions: [...P.view, "governance:manage", "ai_assistant:use"] },
    { key: "PROJECT_MANAGER", name: "مدیر پروژه", description: "مدیریت پروژه‌های محول‌شده", isSystem: true,
      permissions: [...P.view, "projects:edit", "actions:edit", "risks:manage", "files:upload", "ai_assistant:use"] },
    { key: "EXECUTOR", name: "کارشناس / مجری اقدام", description: "اجرای اقدامات محول‌شده و ثبت پیشرفت", isSystem: true,
      permissions: [...P.view, "actions:edit", "actions:submit", "files:upload", "ai_assistant:use"] },
    { key: "REVIEWER", name: "مسئول بررسی و تأیید", description: "بررسی و تأیید خروجی‌ها و اسناد ارسالی", isSystem: true,
      permissions: [...P.view, "actions:approve", "actions:reject", "documents:approve", "ai_assistant:use"] },
    { key: "AUDITOR", name: "ناظر / حسابرس", description: "مشاهده کامل و سوابق ممیزی بدون حق تغییر", isSystem: true,
      permissions: [...P.view, "audit:view", "export:data"] },
    { key: "REPORT_MANAGER", name: "مدیر گزارش‌ها", description: "تهیه و انتشار گزارش‌های دوره‌ای", isSystem: true,
      permissions: [...P.view, "reports:create", "reports:export", "export:data", "ai_assistant:use"] },
    { key: "VIEWER", name: "کاربر صرفاً مشاهده‌گر", description: "دسترسی فقط‌خواندنی محدود", isSystem: true, permissions: [...P.view] },
    { key: "SUPPORT_ADMIN", name: "مدیر پشتیبانی", description: "پشتیبانی کاربران و رفع ابهام", isSystem: true,
      permissions: [...P.view, "knowledge:manage", "notifications:send", "ai_assistant:use"] },
  ];
  for (const r of roles) {
    await db.role.create({ data: { ...r, permissions: JSON.stringify(r.permissions) } });
  }

  // ── واحدهای سازمانی — مطابق ساختار رسمی شرکت ملی گاز ایران ──
  // (مدیریت‌های ستادی، امور مستقل، شرکت‌های ستادی، شرکت‌های گاز استانی،
  //  شرکت‌های پالایش گاز و مناطق عملیات انتقال گاز)
  console.log("⟳ واحدهای سازمانی (ساختار رسمی شرکت ملی گاز ایران)…");
  const faDigit = (n: number | string) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
  type UnitExtra = Partial<{ managerName: string; dtLiaison: string; dataOwner: string; dataCustodian: string; liaisonReported: boolean; dataOwnerReported: boolean; internalBriefingDone: boolean; statusReportSubmitted: boolean; maturitySubmitted: boolean; projectsSubmitted: boolean; sortOrder: number; parentId: string }>;
  const mkUnit = (code: string, name: string, type: string, extra: UnitExtra = {}) =>
    db.orgUnit.create({ data: { code, name, type, ...extra } });

  // دبیرخانه شورای راهبری و معاونت میزبان برنامه
  const sec = await mkUnit("SEC", "دبیرخانه شورای راهبری تحول دیجیتال و حکمرانی هوشمند", "COMMITTEE", { managerName: "دبیر شورا", sortOrder: 0, internalBriefingDone: true });
  await mkUnit("FTR", "معاونت مطالعات آینده‌پژوهی و آینده‌نگاری", "DEPUTY", { sortOrder: 1 });

  // ۱۴ مدیریت ستادی
  const directorates: [string, string, number][] = [
    ["HRD", "مدیریت توسعه منابع انسانی", 10],
    ["GSC", "مدیریت هماهنگی امور گازرسانی", 11],
    ["RTF", "مدیریت پژوهش و فناوری", 12],
    ["IPG", "مدیریت برنامه‌ریزی تلفیقی", 13],
    ["INT", "مدیریت امور بین‌الملل", 14],
    ["FIN", "مدیریت مالی", 15],
    ["DSP", "مدیریت دیسپچینگ", 16],
    ["ITC", "مدیریت فناوری اطلاعات و ارتباطات", 17],
    ["OSE", "مدیریت مهندسی ساختار", 18],
    ["INV", "مدیریت سرمایه‌گذاری و کسب‌وکار", 19],
    ["PAM", "مدیریت دارایی‌های فیزیکی", 20],
    ["HSE", "مدیریت بهداشت، ایمنی، محیط زیست و پدافند غیرعامل", 21],
    ["ENC", "مدیریت انرژی و کربن", 22],
    ["PRD", "مدیریت هماهنگی و نظارت بر تولید", 23],
  ];
  const units: Record<string, string> = { SEC: sec.id };
  // واحد پایلوت (فاوا) — پاسخ‌های نمونه ثبت‌شده برای آزمون سازوکار پوشش تعهدات
  const itcFlags = { dtLiaison: "معرفی‌شده (نمونه)", dataOwner: "معرفی‌شده (نمونه)", dataCustodian: "معرفی‌شده (نمونه)", liaisonReported: true, dataOwnerReported: true, internalBriefingDone: true, statusReportSubmitted: true, maturitySubmitted: true, projectsSubmitted: true };
  for (const [code, name, sortOrder] of directorates) {
    const u = await mkUnit(code, name, "HQ_DIRECTORATE", { sortOrder, ...(code === "ITC" ? itcFlags : {}) });
    units[code] = u.id;
  }

  // امور مستقل زیر نظر مدیرعامل
  const offices: [string, string, number][] = [
    ["ASM", "امور مجامع", 30],
    ["SLT", "هسته گزینش", 31],
    ["BRD", "امور اجرایی هیأت بدوی رسیدگی به تخلفات اداری", 32],
    ["TRD", "امور تخصصی بازرگانی", 33],
    ["PUB", "روابط عمومی", 34],
    ["PRT", "حراست", 35],
    ["IAD", "حسابرسی داخلی", 36],
    ["INS", "بازرسی و پاسخگویی به شکایات", 37],
    ["LEG", "امور حقوقی", 38],
  ];
  for (const [code, name, sortOrder] of offices) {
    const u = await mkUnit(code, name, "INDEPENDENT_OFFICE", { sortOrder });
    units[code] = u.id;
  }

  // سه شرکت ستادی زیر نظر مدیرعامل و ستاد
  units.EGT = (await mkUnit("EGT", "شرکت مهندسی و توسعه گاز ایران", "STAFF_COMPANY", { sortOrder: 40 })).id;
  units.TGI = (await mkUnit("TGI", "شرکت انتقال گاز ایران", "STAFF_COMPANY", { sortOrder: 41 })).id;
  await mkUnit("IGC", "شرکت بازرگانی گاز ایران", "STAFF_COMPANY", { sortOrder: 42 });

  // ۳۱ شرکت گاز استانی — زیر نظر مدیریت هماهنگی امور گازرسانی
  const provinces: [string, string][] = [
    ["PG-EAZ", "شرکت گاز استان آذربایجان شرقی"], ["PG-WAZ", "شرکت گاز استان آذربایجان غربی"],
    ["PG-ARD", "شرکت گاز استان اردبیل"], ["PG-ESF", "شرکت گاز استان اصفهان"],
    ["PG-ILM", "شرکت گاز استان ایلام"], ["PG-ALZ", "شرکت گاز استان البرز"],
    ["PG-BSH", "شرکت گاز استان بوشهر"], ["PG-THR", "شرکت گاز استان تهران"],
    ["PG-KRM", "شرکت گاز استان کرمان"], ["PG-KHZ", "شرکت گاز استان خوزستان"],
    ["PG-MRK", "شرکت گاز استان مرکزی"], ["PG-HRM", "شرکت گاز استان هرمزگان"],
    ["PG-KRD", "شرکت گاز استان کردستان"], ["PG-FRS", "شرکت گاز استان فارس"],
    ["PG-KSH", "شرکت گاز استان کرمانشاه"], ["PG-KHR", "شرکت گاز استان خراسان رضوی"],
    ["PG-KHN", "شرکت گاز استان خراسان شمالی"], ["PG-KHS", "شرکت گاز استان خراسان جنوبی"],
    ["PG-KGB", "شرکت گاز استان کهگیلویه و بویراحمد"], ["PG-MZN", "شرکت گاز استان مازندران"],
    ["PG-GLS", "شرکت گاز استان گلستان"], ["PG-LRS", "شرکت گاز استان لرستان"],
    ["PG-CHB", "شرکت گاز استان چهارمحال و بختیاری"], ["PG-GIL", "شرکت گاز استان گیلان"],
    ["PG-SMN", "شرکت گاز استان سمنان"], ["PG-HMD", "شرکت گاز استان همدان"],
    ["PG-ZNJ", "شرکت گاز استان زنجان"], ["PG-QOM", "شرکت گاز استان قم"],
    ["PG-YZD", "شرکت گاز استان یزد"], ["PG-SBZ", "شرکت گاز استان سیستان و بلوچستان"],
    ["PG-QZN", "شرکت گاز استان قزوین"],
  ];
  for (let i = 0; i < provinces.length; i++) {
    const u = await mkUnit(provinces[i][0], provinces[i][1], "PROVINCIAL_GAS", { sortOrder: 50 + i, parentId: units.GSC });
    units[provinces[i][0]] = u.id;
  }

  // ۷ شرکت پالایش گاز — زیر نظر مدیریت هماهنگی و نظارت بر تولید
  const refineries: [string, string][] = [
    ["RF-SPG", "شرکت مجتمع گاز پارس جنوبی"], ["RF-JAM", "پالایشگاه گاز فجر جم"],
    ["RF-PRS", "پالایشگاه گاز پارسیان"], ["RF-HSN", "پالایشگاه گاز شهید هاشمی‌نژاد"],
    ["RF-BBL", "پالایشگاه گاز بیدبلند"], ["RF-SKQ", "پالایشگاه گاز سرخون و قشم"],
    ["RF-ILM", "پالایشگاه گاز ایلام"],
  ];
  for (let i = 0; i < refineries.length; i++) {
    const u = await mkUnit(refineries[i][0], refineries[i][1], "REFINERY", { sortOrder: 90 + i, parentId: units.PRD });
    units[refineries[i][0]] = u.id;
  }

  // ۱۱ منطقه عملیات انتقال گاز — زیر نظر شرکت انتقال گاز ایران
  for (let i = 1; i <= 11; i++) {
    await mkUnit(`TO-${String(i).padStart(2, "0")}`, `منطقه ${faDigit(i)} عملیات انتقال گاز`, "OPS_REGION", { sortOrder: 100 + i, parentId: units.TGI });
  }
  console.log(`  ↳ ${await db.orgUnit.count()} واحد سازمانی مطابق ساختار رسمی ایجاد شد.`);

  // ── کاربران نمونه ──
  console.log("⟳ کاربران…");
  const hash = await bcrypt.hash("Nigc@1405", 10);
  // حساب admin فعال می‌ماند؛ سایر حساب‌های نمونه به‌صورت پیش‌فرض غیرفعال‌اند
  // (برای استقرار عملیاتی — راهبر با admin وارد شده و حساب واقعی‌ها را می‌سازد)
  const mkUser = (username: string, fullName: string, roleKeys: string[], orgUnitId?: string, title?: string, isActive = false) =>
    db.user.create({ data: { username, fullName, passwordHash: hash, orgUnitId, title, email: `${username}@nigc-dtg.local`, isActive } })
      .then(async (u) => {
        for (const rk of roleKeys) {
          const role = await db.role.findUnique({ where: { key: rk } });
          if (role) await db.userRole.create({ data: { userId: u.id, roleId: role.id } });
        }
        return u;
      });

  const admin = await mkUser("admin", "مدیر سامانه", ["SYSTEM_ADMIN"], undefined, undefined, true);
  const secAdmin = await mkUser("sec.admin", "مدیر دبیرخانه", ["SECRETARIAT_ADMIN", "CONFIG_ADMIN"], units.SEC, "مدیر دبیرخانه شورا");
  const secretary = await mkUser("secretary", "دبیر شورای راهبری", ["COUNCIL_SECRETARY"], units.SEC, "دبیر شورا");
  await mkUser("council", "رئیس شورای راهبری", ["COUNCIL_MEMBER"], units.FTR, "معاونت مطالعات آینده‌پژوهی و آینده‌نگاری");
  const itcMgr = await mkUser("itc.mgr", "مدیر فاوا", ["UNIT_MANAGER"], units.ITC, "مدیریت فناوری اطلاعات و ارتباطات");
  const itcLiaison = await mkUser("itc.liaison", "رابط تحول دیجیتال فاوا", ["DT_LIAISON"], units.ITC, "کارشناس ارشد");
  await mkUser("auditor", "حسابرس برنامه", ["AUDITOR"]);
  await mkUser("viewer", "مشاهده‌گر", ["VIEWER"]);
  void itcMgr; void itcLiaison;

  // ── تنظیمات ──
  console.log("⟳ تنظیمات…");
  const settings = [
    { key: "org.name", value: "شرکت ملی گاز ایران", category: "branding", description: "نام کامل سازمان" },
    { key: "org.shortName", value: "NIGC-DTG", category: "branding", description: "نام اختصاری سامانه" },
    { key: "program.title", value: "برنامه اجرایی تحول دیجیتال، حاکمیت داده و هوش مصنوعی — نسخه ۲٫۰ (ابلاغی)", category: "program", description: "عنوان برنامه مرجع" },
    { key: "program.baselineDate", value: "2026-10-23", valueType: "date", category: "program", description: "روز صفر — تاریخ ابلاغ سراسری برنامه توسط مدیرعامل (فرض اولیه: ابتدای آبان ۱۴۰۵ — قابل اصلاح با گردش کار تأیید)" },
    { key: "program.timezone", value: "Asia/Tehran", category: "program", description: "منطقه زمانی عملیاتی" },
    { key: "program.currentPhase", value: "1405", category: "program", description: "فاز جاری: ۱۴۰۵ استقرار حکمرانی" },
    { key: "workflow.deadlineReminderDays", value: "7", valueType: "number", category: "workflow", description: "فاصله یادآوری مهلت (روز)" },
    { key: "workflow.quarterlyReportWindowDays", value: "15", valueType: "number", category: "workflow", description: "مهلت دریافت گزارش فصلی واحدها پس از پایان فصل (قاعده سند ابلاغی)" },
    { key: "ai.provider", value: "zai", category: "ai", description: "ارائه‌دهنده مدل زبانی (لایه انتزاعی — قابل تعویض)" },
    { key: "ai.enabled", value: "true", valueType: "boolean", category: "ai", description: "فعال‌بودن دستیار هوشمند دبیرخانه" },
    { key: "ai.confidentialPolicy", value: "ارسال اسناد محرمانه به ارائه‌دهندگان بیرونی به‌صورت پیش‌فرض مجاز نیست", category: "ai", description: "سیاست محرمانگی هوش مصنوعی" },
  ];
  for (const s of settings) await db.setting.create({ data: s });
  await db.baselineChange.create({ data: { oldDate: null, newDate: due(0)!, reason: "تنظیم اولیه مطابق فرض سند مرجع (ابتدای آبان ۱۴۰۵) — تاریخ واقعی ابلاغ نیازمند ثبت رسمی است", approvedBy: "دبیر شورا (فرض اولیه)", createdById: admin.id } });

  // ── ۳۷ گام ──
  console.log("⟳ ۳۷ گام سند مرجع…");
  const today = new Date();
  const dayDiff = Math.floor((today.getTime() - BASELINE.getTime()) / 86400000);

  for (const a of ACTIONS) {
    const status = a.groupKey === "CONTINUOUS" ? "IN_PROGRESS"
      : (a.dueEndDay != null && a.dueEndDay < dayDiff) ? "READY"
      : a.dueStartDay != null && a.dueStartDay > dayDiff ? "READY"
      : "IN_PROGRESS";
    await db.action.create({
      data: {
        refStep: a.refStep,
        code: `NIGC-ACT-${String(a.refStep).padStart(2, "0")}`,
        title: a.title,
        description: a.description,
        groupKey: a.groupKey,
        actionType: a.groupKey === "CONTINUOUS" ? "CONTINUOUS" : (a.refStep === 19 || a.refStep === 25) ? "RESOLUTION" : a.priority === "CRITICAL" ? "CRITICAL" : "ROUTINE",
        sourceRef: a.sourceRef,
        dueStartDay: a.dueStartDay ?? null,
        dueEndDay: a.dueEndDay ?? null,
        cycleKey: a.cycleKey ?? null,
        dueDate: a.dueEndDay != null ? due(a.dueEndDay) : null,
        deliverable: a.deliverable,
        dependencies: a.deps ? JSON.stringify(a.deps) : null,
        responsibleUnitId: units[a.unitCode ?? "SEC"] ?? units.SEC,
        followUpOwnerId: a.refStep <= 9 ? secAdmin.id : secretary.id,
        status,
        priority: a.priority ?? "MEDIUM",
        progress: 0,
      },
    });
  }

  // ثبت اولیه وضعیت‌ها
  const acts = await db.action.findMany();
  for (const act of acts) {
    await db.actionUpdate.create({
      data: { actionId: act.id, userId: secAdmin.id, type: "COMMENT", toStatus: act.status,
        content: `گام ${act.refStep} بر اساس برنامه اقدام دبیرخانه در سامانه ثبت شد. (منبع: ${act.sourceRef ?? "سند مرجع"})` },
    });
  }

  // ── اسناد محوری ──
  console.log("⟳ اسناد محوری…");
  await db.document.create({ data: { code: "NIGC-DOC-001", title: "برنامه اجرایی تحول دیجیتال، حاکمیت داده و هوش مصنوعی (نسخه ۲٫۰ — ابلاغی)", docType: "REFERENCE_PLAN", status: "ISSUED", classification: "INTERNAL", version: "۲٫۰", sourceRef: "سند مرجع ابلاغی مدیرعامل", relatedRefStep: 0, needsUpload: true, ownerUnitId: units.SEC, description: "نسخه ابلاغی سراسری — مبنای همه مهلت‌ها. فایل رسمی نیازمند بارگذاری در سامانه است." } });
  await db.document.create({ data: { code: "NIGC-DOC-002", title: "نسخه تفصیلی برنامه اجرایی (نسخه ۱٫۰ — مهر ۱۴۰۵)", docType: "REFERENCE_PLAN", status: "ISSUED", version: "۱٫۰", needsUpload: true, ownerUnitId: units.SEC, description: "در اختیار سامانه قرار ندارد؛ ثبت به‌عنوان سند پشتیبان نیازمند بارگذاری. — نیازمند تعیین تکلیف" } });
  await db.document.create({ data: { code: "NIGC-DOC-003", title: "منشور حاکمیت داده", docType: "CHARTER", status: "IN_REVIEW", version: "۰٫۲", sourceRef: "گام ۵، ۱۶، ۱۸ و ۱۹ — فصل ۶ سند ابلاغی", relatedRefStep: 18, approvalDueDay: 60, ownerUnitId: units.SEC, description: "در گردش نظر (گام ۱۶)؛ مهلت تصویب: تا روز ۶۰." } });
  await db.document.create({ data: { code: "NIGC-DOC-004", title: "دستورالعمل‌های اجرایی منشور حاکمیت داده (طبقه‌بندی داده، تعیین سطح محرمانگی و کنترل‌های متناسب)", docType: "DIRECTIVE", status: "DRAFT", version: "۰٫۱", sourceRef: "گام ۲۷ — فصل ۵ سند ابلاغی", relatedRefStep: 27, approvalDueDay: 75, ownerUnitId: units.SEC, description: "ابلاغ پیش از پایان مهلت ۹۰ روزه واحدها الزامی است." } });
  await db.document.create({ data: { code: "NIGC-DOC-005", title: "چارچوب حاکمیت هوش مصنوعی", docType: "FRAMEWORK", status: "IN_REVIEW", version: "۰٫۲", sourceRef: "گام ۵، ۱۶، ۱۸ و ۱۹ — فصل ۶ سند ابلاغی", relatedRefStep: 18, approvalDueDay: 60, ownerUnitId: units.SEC } });
  await db.document.create({ data: { code: "NIGC-DOC-006", title: "سازوکار مدیریت سبد پروژه‌ها و مدل امتیازدهی متوازن", docType: "MECHANISM", status: "IN_REVIEW", version: "۰٫۲", sourceRef: "گام ۵، ۱۶، ۱۸ و ۱۹ — محور ۶-۳", relatedRefStep: 18, approvalDueDay: 60, ownerUnitId: units.SEC, description: "مدل پایه: ارزش و منفعت ۴۰ / آمادگی داده ۲۰ / ریسک و امنیت ۲۰ / امکان‌پذیری اجرا ۲۰." } });
  await db.document.create({ data: { code: "NIGC-DOC-007", title: "تفاهم‌نامه مرزبندی مأموریت‌های مدیریت پژوهش و فناوری و مدیریت فاوا", docType: "AGREEMENT", status: "IN_REVIEW", version: "۰٫۱", sourceRef: "گام ۶ و ۲۰ — فصل ۴ سند ابلاغی", relatedRefStep: 20, approvalDueDay: 60, ownerUnitId: units.SEC } });
  await db.document.create({ data: { code: "NIGC-DOC-008", title: "بسته ابزار اجرای الزامات واحدها (فرم‌ها و راهنماها)", docType: "FORM", status: "ISSUED", version: "۱٫۰", sourceRef: "گام ۲ — فصل ۵ سند ابلاغی", relatedRefStep: 2, ownerUnitId: units.SEC } });
  await db.document.create({ data: { code: "NIGC-DOC-009", title: "تقویم اقدامات ۹۰ روزه ابلاغی به واحدها", docType: "REFERENCE_PLAN", status: "ISSUED", version: "۱٫۰", sourceRef: "گام ۳", relatedRefStep: 3, ownerUnitId: units.SEC } });
  await db.document.create({ data: { code: "NIGC-DOC-010", title: "مستندات نیازهای مالی برنامه — بودجه‌ریزی سال ۱۴۰۶", docType: "BUDGET", status: "DRAFT", version: "۰٫۱", sourceRef: "گام ۷ و ۲۹", relatedRefStep: 29, approvalDueDay: 90, ownerUnitId: units.FIN } });
  await db.document.create({ data: { code: "NIGC-DOC-011", title: "گزارش جامع ۹۰ روزه به مدیرعامل", docType: "REPORT", status: "DRAFT", version: "۰٫۱", sourceRef: "گام ۲۸", relatedRefStep: 28, approvalDueDay: 90, ownerUnitId: units.SEC } });

  // ── سه پیشران ──
  console.log("⟳ پروژه‌های پیشران…");
  await db.project.create({ data: { code: "NIGC-PRJ-001", title: "کنتورهای هوشمند گاز", trackKey: "DRIVER", driverKey: "SMART_METERS", proposingUnitId: units.ITC, refStep: 15, sourceRef: "فصل ۷ سند ابلاغی — گام ۱۵", status: "PROPOSED", problem: "نیاز به زیرساخت اندازه‌گیری هوشمند برای دقت داده مصرف، پاسخ‌گویی تقاضا و کشف نشتی", goals: "استقرار پایلوت کنتورهای هوشمند و اتصال داده به سکوی یکپارچه", scope: "پایلوت در ناحیه منتخب — توسعه مقیاس تابع تأیید نتایج و دروازه فاز", successMetrics: "نیازمند تعیین کمی در سند پروژه — تا تصویب شورا «نیازمند تعیین تکلیف»", dataReadiness: "MEDIUM", timeline: "مطابق فازبندی سند پروژه — نیازمند تکمیل" } });
  await db.project.create({ data: { code: "NIGC-PRJ-002", title: "سکوی خدمات یکپارچه دیجیتال گاز (BSS)", trackKey: "DRIVER", driverKey: "BSS_PLATFORM", proposingUnitId: units.ITC, refStep: 15, sourceRef: "فصل ۷ سند ابلاغی — گام ۱۵", status: "PROPOSED", problem: "پراکندگی سامانه‌های مشترکان و نبود سکوی واحد خدمات مشترکان", goals: "ایجاد سکوی یکپارچه BSS به‌عنوان معماری مرجع خدمات دیجیتال گاز", scope: "طراحی معماری، انتخاب راهکار، پایلوت خدمات منتخب", successMetrics: "نیازمند تعیین کمی در سند پروژه — تا تصویب شورا «نیازمند تعیین تکلیف»", dataReadiness: "MEDIUM", timeline: "مطابق فازبندی سند پروژه — نیازمند تکمیل" } });
  await db.project.create({ data: { code: "NIGC-PRJ-003", title: "سبد پروژه‌های سازمانی تحول دیجیتال (DT Portfolio)", trackKey: "DRIVER", driverKey: "DT_PORTFOLIO", proposingUnitId: units.SEC, refStep: 15, sourceRef: "فصل ۷ سند ابلاغی — گام ۱۵", status: "PROPOSED", problem: "نبود نگاه یکپارچه به پروژه‌های دیجیتال شرکت و ریسک اجرای طرح‌های موازی خارج از چارچوب", goals: "تشکیل سبد مرکزی، امتیازدهی متوازن و اولویت‌بندی موج‌های اجرا", scope: "ثبت همه پروژه‌های جاری و پیشنهادی، امتیازدهی، پیشنهاد موج نخست به شورا", successMetrics: "پوشش ثبت کامل پروژه‌ها تا روز ۶۰ (گام ۲۱)؛ امتیازدهی تا روز ۶۰ (گام ۲۳)", dataReadiness: "HIGH", timeline: "مطابق گام‌های ۱۵، ۲۱، ۲۳ و ۲۵" } });

  // ── هشت شاخص کلیدی — ساختار بدون مقدار ساختگی ──
  console.log("⟳ هشت شاخص کلیدی (بدون خط مبنا — نیازمند تعیین تعریف)…");
  const kpis = [
    { code: "KPI-1", name: "شاخص کلیدی ۱ — نیازمند تعیین تعریف", note: "تعریف در اسناد موجود در دسترس نیست؛ تا دریافت جدول ۳ سند ابلاغی، ساختار بدون مقدار نگهداری می‌شود.", cycle: null },
    { code: "KPI-2", name: "پوشش معرفی رابط تحول دیجیتال و مالک / متولی داده", note: "شاخص ماهانه؛ منبع: گام ۱۱ و ۳۰ سند مرجع.", cycle: "MONTHLY" },
    { code: "KPI-3", name: "پوشش ثبت کاربردهای هوش مصنوعی در دفتر مرکزی", note: "منبع: گام ۱۳ و ۳۳؛ محور ۶-۲ سند ابلاغی.", cycle: "QUARTERLY" },
    { code: "KPI-4", name: "شاخص کلیدی ۴ — نیازمند تعیین تعریف", note: "نیازمند جدول ۳ سند ابلاغی.", cycle: null },
    { code: "KPI-5", name: "تحقق زمان‌بندی مصوبات و پروژه‌ها", note: "شاخص ماهانه؛ منبع: گام ۳۰ سند مرجع.", cycle: "MONTHLY" },
    { code: "KPI-6", name: "شاخص کلیدی ۶ — نیازمند تعیین تعریف", note: "نیازمند جدول ۳ سند ابلاغی.", cycle: null },
    { code: "KPI-7", name: "تحقق منافع پروژه‌ها", note: "سنجش پس از تعیین خط مبنا (گام ۲۶)؛ پایش شش‌ماهه از سال ۱۴۰۶ (گام ۳۲).", cycle: "SEMIANNUAL" },
    { code: "KPI-8", name: "شاخص کلیدی ۸ — نیازمند تعیین تعریف", note: "نیازمند جدول ۳ سند ابلاغی.", cycle: null },
  ];
  for (const k of kpis) {
    await db.kpi.create({
      data: { code: k.code, name: k.name, reportingCycle: k.cycle, needsDefinition: true,
        sourceRef: k.note, owner: "دبیرخانه شورا",
        definition: k.code === "KPI-2" ? "درصد واحدهایی که رابط تحول دیجیتال و مالک و متولی داده را به همراه جانشین به دبیرخانه معرفی کرده‌اند." :
                    k.code === "KPI-3" ? "درصد کاربردهای هوش مصنوعی شناسایی‌شده که در دفتر مرکزی ثبت شده‌اند (قاعده: بدون ثبت و ارزیابی، بهره‌برداری ممنوع)." :
                    k.code === "KPI-5" ? "درصد مصوبات و پروژه‌هایی که طبق زمان‌بندی مصوب پیش می‌روند." :
                    k.code === "KPI-7" ? "میزان تحقق منافع مصوب پروژه‌ها نسبت به خط مبنا و هدف." : null },
    });
  }

  // ── جلسه نخست شورا ──
  console.log("⟳ جلسات…");
  await db.meeting.create({
    data: { number: 1, title: "نخستین جلسه رسمی شورای راهبری تحول دیجیتال و حکمرانی هوشمند", meetingType: "STEERING",
      scheduledAt: due(20), agenda: JSON.stringify(["تصویب تقویم جلسات شورا", "تصویب تیم‌های کاری تدوین اسناد محوری", "برنامه تدوین اسناد محوری", "مصوبات پایه"]),
      status: "SCHEDULED", refStep: 10 },
  });

  // ── ریسک‌های مستند‌شده از عوامل حیاتی سند ──
  console.log("⟳ ریسک‌ها…");
  await db.risk.create({ data: { code: "NIGC-RSK-001", title: "تأخیر واحدها در پاسخ به تکالیف ۳۰ روزه (معرفی رابط و وضعیت موجود)", category: "ORGANIZATIONAL", relatedType: "ACTION", relatedTitle: "گام‌های ۱۱ و ۱۲", probability: 4, impact: 4, owner: "دبیرخانه", preventiveAction: "ابلاغ تقویم ۹۰ روزه (گام ۳) و یادآوری کتبی مستمر", responsePlan: "یادآوری کتبی، ارجاع به شورا و ثبت انحراف با اقدام جبرانی", status: "OPEN", sourceRef: "عوامل حیاتی موفقیت سند مرجع — داشبورد پایش و پیگیری کتبی" } });
  await db.risk.create({ data: { code: "NIGC-RSK-002", title: "از دست رفتن فرصت تأمین منابع در چرخه بودجه ۱۴۰۶", category: "BUDGET", relatedType: "ACTION", relatedTitle: "گام‌های ۷ و ۲۹", probability: 3, impact: 5, owner: "دبیرخانه / برنامه‌ریزی تلفیقی و مالی", preventiveAction: "آغاز هماهنگی در روزهای ۵ تا ۱۰ (گام ۷)", responsePlan: "تثبیت نیازها تا روز ۹۰ (گام ۲۹) و پیگیری کتبی", status: "OPEN", sourceRef: "عوامل حیاتی — حفظ زنجیره بودجه ۱۴۰۶" } });
  await db.risk.create({ data: { code: "NIGC-RSK-003", title: "تأخیر در برگزاری نخستین جلسه شورا و لنگرشدن تصویب منشورها", category: "SCHEDULE", relatedType: "ACTION", relatedTitle: "گام‌های ۹، ۱۰ و ۱۹", probability: 3, impact: 4, owner: "دبیر شورا", preventiveAction: "آماده‌سازی بسته جلسه تا روز ۱۰ (گام ۹)", responsePlan: "تعیین زمان قطعی جلسه تا روز ۱۵", status: "OPEN", sourceRef: "عوامل حیاتی — برگزاری به‌موقع نخستین جلسه شورا" } });
  await db.risk.create({ data: { code: "NIGC-RSK-004", title: "ابهام در تغییرات ساختاری ناشی از ابلاغ تاپ چارت جدید", category: "EXTERNAL", relatedType: "GENERAL", relatedTitle: "گام ۳۷", probability: 3, impact: 3, owner: "دبیرخانه", preventiveAction: "نگهداشت سناریوی آماده بازنگری و تعدیل‌پذیری اسناد", responsePlan: "بازنگری برنامه در چارچوب ساختار جدید بدون فروپاشی چرخه جاری", status: "MONITORING", sourceRef: "عوامل حیاتی — تعدیل‌پذیری نسبت به تاپ چارت آتی" } });

  // ── وضعیت موجود نمونه (واحد فاوا — داده نمونه متمایز از واقعی) ──
  console.log("⟳ داده نمونه وضعیت موجود…");
  await db.digitalStatusEntry.create({ data: { orgUnitId: units.ITC, entryType: "INFORMATION_SYSTEM", name: "نمونه — سامانه مدیریت شبکه (داده نمونه)", description: "رکورد نمونه برای آزمون سازوکار ثبت وضعیت موجود؛ داده واقعی پس از دریافت فرم‌ها جایگزین می‌شود.", status: "VALIDATED", validationNote: "داده نمونه — متمایز از داده عملیاتی" } });
  await db.digitalStatusEntry.create({ data: { orgUnitId: units.ITC, entryType: "AI_APPLICATION", name: "نمونه — دستیار پاسخ به سؤالات مشترکان (داده نمونه)", description: "رکورد نمونه جهت آزمون جریان ثبت در دفتر هوش مصنوعی.", status: "SUBMITTED" } });
  await db.dataDomain.create({ data: { name: "حوزه داده مشترکان", code: "DD-CUSTOMER", description: "داده‌های مشترکان گاز — نیازمند تعیین مالک رسمی پس از تصویب منشور حاکمیت داده", ownerUnitId: units.ITC, classification: "CONFIDENTIAL", qualityStatus: "NEEDS_IMPROVEMENT", notes: "داده نمونه ساختاری — مالکیت و طبقه‌بندی نهایی تابع منشور حاکمیت داده" } });

  await db.auditLog.create({ data: { userId: admin.id, username: "admin", action: "CREATE", entityType: "SYSTEM", entityId: "seed", details: "راه‌اندازی اولیه سامانه با داده‌های سند مرجع (seed)" } });

  console.log("✅ seed کامل شد — کاربران: admin / sec.admin / secretary / council / itc.mgr / itc.liaison / auditor / viewer (رمز همه: Nigc@1405)");
}

/** اجرای کامل seed روی کلاینت داده‌شده — توسط CLI و /api/system/bootstrap استفاده می‌شود */
export async function runSeed(client: PrismaClient): Promise<SeedSummary> {
  db = client;
  await main();
  const [users, actions, roles, kpis, settings, documents] = await Promise.all([
    db.user.count(), db.action.count(), db.role.count(), db.kpi.count(), db.setting.count(), db.document.count(),
  ]);
  const demoUsers = (await db.user.findMany({ select: { username: true }, orderBy: { username: "asc" } })).map((u) => u.username);
  return { counts: { users, actions, roles, kpis, settings, documents }, demoUsers, demoPassword: "Nigc@1405" };
}

export interface SeedSummary {
  counts: { users: number; actions: number; roles: number; kpis: number; settings: number; documents: number };
  demoUsers: string[];
  demoPassword: string;
}
