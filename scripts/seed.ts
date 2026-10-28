/**
 * Seed — NIGC-DTG (CLI)
 * داده‌های اولیه: ۳۷ گام سند مرجع، واحدها، نقش‌ها، کاربران نمونه، اسناد محوری،
 * هشت شاخص کلیدی (بدون مقدار ساختگی)، سه پیشران، جلسه نخست شورا، تنظیمات.
 *
 * اجرا: bun scripts/seed.ts
 * منطق اصلی: src/lib/seed-core.ts (همان کد توسط /api/system/bootstrap روی ابر اجرا می‌شود)
 */
import { PrismaClient } from "@prisma/client";
import { runSeed } from "../src/lib/seed-core";

const db = new PrismaClient();

runSeed(db)
  .then((summary) => {
    console.log("✅ seed کامل شد —", JSON.stringify(summary.counts));
    console.log("کاربران نمونه:", summary.demoUsers.join(" / "), "— رمز همه:", summary.demoPassword);
    return db.$disconnect();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
