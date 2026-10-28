/**
 * Seed مکمل ارتقا — تنظیمات موتور یادآوری/گزارش‌های خودکار/اولویت‌بندی
 * اجرا: bun scripts/seed-upgrade.ts  (additive — داده موجود را تغییر نمی‌دهد)
 * منطق اصلی: src/lib/seed-upgrade-core.ts
 */
import { PrismaClient } from "@prisma/client";
import { runUpgradeSeed } from "../src/lib/seed-upgrade-core";

const db = new PrismaClient();

runUpgradeSeed(db)
  .then((r) => {
    console.log(`✅ seed-upgrade: ${r.created} تنظیم جدید، ${r.kept} موجود حفظ شد`);
    return db.$disconnect();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
