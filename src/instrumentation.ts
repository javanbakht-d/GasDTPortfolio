// Next.js instrumentation — شروع سرویس زمان‌بند سروری هنگام بوت
// این کد مستقل از مرورگر/ورود کاربر اجرا می‌شود: قاعده «یادآوری بدون بازماندن مرورگر»
// در محیط توسعه sandbox، سرور next dev فرایند پایدار است؛ برای استقرار تولید،
// معماری جداگانه (worker/queue) در docs/reminder-engine.md مستند شده است.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // در استقرار Serverless (مثل Vercel) فرایند دائمی وجود ندارد؛ تیک از طریق
  // سرویس cron بیرونی روی /api/system/cron-tick با CRON_SECRET انجام می‌شود
  // (راهنما: docs/deploy-guide.md)
  if (process.env.VERCEL === "1") return;

  const g = globalThis as unknown as { __nigcSchedulerStarted?: boolean };
  if (g.__nigcSchedulerStarted) return;
  g.__nigcSchedulerStarted = true;

  setTimeout(async () => {
    try {
      const { runFullTick } = await import("@/lib/scheduler-engine");
      const { getReminderSettings } = await import("@/lib/assistant-settings");
      const settings = await getReminderSettings();
      const intervalMs = Math.max(30, settings.tickIntervalSec) * 1000;
      const loop = async () => {
        try {
          await runFullTick();
        } catch (e) {
          console.error("[scheduler-loop]", (e as Error).message?.slice(0, 200));
        }
      };
      await loop();
      setInterval(loop, intervalMs);
      console.log(`[scheduler] موتور یادآوری سروری فعال شد — تیک هر ${settings.tickIntervalSec} ثانیه`);
    } catch (e) {
      console.error("[scheduler] شروع موتور یادآوری ناموفق:", (e as Error).message);
    }
  }, 10_000);
}
