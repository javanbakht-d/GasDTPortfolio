/**
 * Seed مکمل ارتقا — تنظیمات موتور یادآوری/گزارش‌های خودکار/اولویت‌بندی
 * اجرا: bun scripts/seed-upgrade.ts  (additive — داده موجود را تغییر نمی‌دهد)
 */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const SETTINGS: { key: string; value: string; valueType: string; category: string; description: string }[] = [
  { key: "reminders.enabled", value: "true", valueType: "boolean", category: "reminders", description: "فعال‌بودن موتور یادآوری سروری (مستقل از مرورگر)" },
  { key: "reminders.tickIntervalSec", value: "60", valueType: "number", category: "reminders", description: "فاصله اجرای چرخه یادآوری (ثانیه)" },
  { key: "reminders.preDueCriticalDays", value: "7", valueType: "number", category: "reminders", description: "یادآوری پیش از سررسید — اولویت بحرانی (روز)" },
  { key: "reminders.preDueHighDays", value: "5", valueType: "number", category: "reminders", description: "یادآوری پیش از سررسید — اولویت زیاد (روز)" },
  { key: "reminders.preDueNormalDays", value: "3", valueType: "number", category: "reminders", description: "یادآوری پیش از سررسید — سایر اولویت‌ها (روز)" },
  { key: "reminders.dueDayNotify", value: "true", valueType: "boolean", category: "reminders", description: "اطلاع‌رسانی در روز سررسید" },
  { key: "reminders.overdueEscalateDays", value: "3", valueType: "number", category: "reminders", description: "تشدید/ارجاع موارد تأخیری به دبیرخانه پس از این تعداد روز" },
  { key: "reminders.followUpDefaultDays", value: "3", valueType: "number", category: "reminders", description: "پیش‌فرض فاصله پیگیری بعدی (روز)" },
  { key: "reminders.quietStart", value: "21", valueType: "number", category: "reminders", description: "شروع ساعات سکوت اعلان‌های عادی (ساعت تهران)" },
  { key: "reminders.quietEnd", value: "7", valueType: "number", category: "reminders", description: "پایان ساعات سکوت (ساعت تهران)" },
  { key: "reminders.quietBypassCritical", value: "true", valueType: "boolean", category: "reminders", description: "موارد بحرانی طبق سیاست از سکوت مستثنا شوند" },
  { key: "reminders.healthAlertToAdmin", value: "true", valueType: "boolean", category: "reminders", description: "هشدار به مدیر سامانه در صورت شکست اجرای زمان‌بند" },
  { key: "digest.morningEnabled", value: "true", valueType: "boolean", category: "digest", description: "گزارش صبحگاهی دبیر شورا" },
  { key: "digest.morningTime", value: "07:30", valueType: "string", category: "digest", description: "ساعت ارسال گزارش صبحگاهی (تهران)" },
  { key: "digest.eodEnabled", value: "true", valueType: "boolean", category: "digest", description: "خلاصه پایان روز" },
  { key: "digest.eodTime", value: "18:00", valueType: "string", category: "digest", description: "ساعت خلاصه پایان روز (تهران)" },
  { key: "digest.weeklyEnabled", value: "true", valueType: "boolean", category: "digest", description: "خلاصه هفتگی وضعیت و ریسک‌ها" },
  { key: "digest.weeklyDay", value: "4", valueType: "number", category: "digest", description: "روز هفته خلاصه (۰=یکشنبه … ۴=پنجشنبه)" },
  { key: "digest.weeklyTime", value: "16:00", valueType: "string", category: "digest", description: "ساعت خلاصه هفتگی (تهران)" },
  { key: "priority.weights", value: '{"urgency":35,"importance":25,"dependency":15,"risk":15,"waiting":10}', valueType: "string", category: "priority", description: "وزن‌های مدل اولویت‌بندی پیشنهادی v0.1 (جمع ۱۰۰)" },
  { key: "assistant.about", value: "طراح و معمار برنامه: داود جوانبخت — معاون مطالعات آینده‌پژوهی و آینده‌نگاری و دبیر شورای راهبری تحول دیجیتال و حکمرانی هوشمند", valueType: "string", category: "general", description: "اطلاعات بخش درباره" },
];

async function main() {
  let created = 0, kept = 0;
  for (const s of SETTINGS) {
    const existing = await db.setting.findUnique({ where: { key: s.key } });
    if (existing) { kept++; continue; }
    await db.setting.create({ data: s });
    created++;
  }
  console.log(`seed-upgrade: ${created} تنظیم جدید، ${kept} موجود حفظ شد`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
