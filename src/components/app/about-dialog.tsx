"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bot } from "lucide-react";

/** گفت‌وگوی «درباره سامانه» — معرفی سامانه و طراح/معمار برنامه */
export function AboutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <img src="/nigc-logo.png" alt="لوگوی شرکت ملی گاز ایران" className="h-8 w-8 object-contain" />
            سامانه یکپارچه راهبری تحول دیجیتال و حکمرانی هوشمند
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm leading-7 text-foreground">
          <p>
            این سامانه ابزار عملیاتی <span className="font-medium">دبیرخانه شورای راهبری تحول دیجیتال و حکمرانی هوشمند شرکت ملی گاز ایران</span> است؛
            برای راهبری، پایش و گزارش‌دهی برنامه اجرایی تحول دیجیتال، حاکمیت داده، هوشمندسازی و هوش مصنوعی بر پایه ۳۷ گام سند مرجع و پنج گروه زمانی آن ساخته شده است.
          </p>
          <Separator />
          <div className="rounded-xl border bg-muted/60 p-4">
            <div className="text-xs font-semibold text-muted-foreground mb-2">طراح و معمار برنامه</div>
            <div className="font-bold text-foreground">داود جوانبخت</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="font-normal">معاون مطالعات آینده‌پژوهی و آینده‌نگاری</Badge>
              <Badge className="bg-slate-900 text-white font-normal hover:bg-slate-900">دبیر شورای راهبری تحول دیجیتال و حکمرانی هوشمند</Badge>
            </div>
          </div>
          <Separator />
          <div className="space-y-2 text-xs text-muted-foreground leading-5">
            <p className="flex items-start gap-1.5"><Bot className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-400" /> دستیار هوشمند سامانه، پیش‌نویس‌ها و تحلیل‌ها را فقط از داده‌های مجاز شما تولید می‌کند و جایگزین تصمیم رسمی نیست.</p>
            <p>همه فعالیت‌ها در سوابق ممیزی ثبت می‌شود. منطقه زمانی سامانه: تهران (Asia/Tehran).</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
