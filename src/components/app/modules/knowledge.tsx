"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { ModuleHeader, DocStatusBadge, LoadingState, ErrorState } from "@/components/app/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppStore } from "@/store/app-store";
import { faDate, faNum } from "@/lib/persian-date-format";
import { ACTION_GROUPS } from "@/lib/constants";
import {
  ClipboardList, FileCheck2, Gauge, PenLine, CalendarClock,
  ShieldAlert, Ban, BookOpenText, ArrowLeft, Users, GraduationCap, Landmark, Info,
} from "lucide-react";

type IssuedDoc = {
  id: string; code: string; title: string; status: string; version: string;
  docType: string; fileUrl: string | null;
};

// ───────────── پنج ابزار اجرایی گام ۲ (محتوای مستند و مبتنی بر سند مرجع) ─────────────
const STEP2_TOOLS = [
  {
    icon: <Users className="h-5 w-5" />,
    title: "فرم معرفی رابط تحول دیجیتال و مالک/متولی داده",
    target: "همه واحدها",
    purpose: "هر واحد باید رابط تحول دیجیتال و مالک و متولی داده خود را به‌صورت رسمی به دبیرخانه شورا معرفی کند؛ این معرفی مبنای ارتباط، پیگیری و امضای تعهدات اسنادی است.",
    output: "نام و مشخصات رابط واحد + مالک و متولی داده (قابل مشاهده در ماژول سازمان و حکمرانی).",
  },
  {
    icon: <ClipboardList className="h-5 w-5" />,
    title: "فرم ثبت وضعیت موجود",
    target: "همه واحدها",
    purpose: "ثبت کامل سامانه‌های اطلاعاتی، پایگاه‌های داده و کاربردهای هوش مصنوعی موجود در واحد به همراه طبقه‌بندی و هدف؛ مبنای شناسایی کاربردهای هوش مصنوعی برای ثبت در دفتر مرکزی (گام ۱۳).",
    output: "فهرست وضعیت موجود واحد — پس از اعتبارسنجی دبیرخانه به وضعیت VALIDATED می‌رسد.",
  },
  {
    icon: <FileCheck2 className="h-5 w-5" />,
    title: "فرم استاندارد پروژه",
    target: "همه واحدها",
    purpose: "پرونده یکسان برای هر پروژه پیشنهادی: مسئله، اهداف، محدوده، شاخص‌های موفقیت، آمادگی داده و منافع مورد انتظار؛ ورودی چرخه امتیازدهی سبد پروژه‌ها.",
    output: "پروژه ثبت‌شده در سبد پروژه‌ها با وضعیت «ثبت پیشنهاد».",
  },
  {
    icon: <Gauge className="h-5 w-5" />,
    title: "الگوی خودارزیابی بلوغ دیجیتال",
    target: "همه واحدها",
    purpose: "سنجش خوداظهاری سطح بلوغ دیجیتال واحد در ابعاد داده، فناوری، فرایند و مهارت؛ مبنای تحلیل شکاف و اولویت‌گذاری برنامه‌های توانمندسازی.",
    output: "نتیجه خودارزیابی واحد — داده اولیه تحلیل بلوغ سازمانی.",
  },
  {
    icon: <PenLine className="h-5 w-5" />,
    title: "فرم درخواست مجوز کتبی برای اقدام موازی",
    target: "واحدهای دارای پروژه/قرارداد خارج از چارچوب",
    purpose: "طبق قاعده «ممنوعیت اقدام موازی خارج از چارچوب»، هر اقدام یا خرید مرتبط با تحول دیجیتال خارج از سبد مصوب، نیازمند درخواست مجوز کتبی از مرجع مجاز است.",
    output: "مجوز یا رد کتبی — بدون مجوز، اقدام موازی تخلف حاکمیتی محسوب می‌شود.",
  },
];

const FAQ_ITEMS = [
  {
    q: "تاریخ مبدأ (روز صفر) چیست و همه مهلت‌ها چگونه از آن محاسبه می‌شوند؟",
    a: "تاریخ مبدأ، روز ابلاغ رسمی برنامه و آغاز شمارش مهلت‌های ۳۷ گام است. تمام مهلت‌های سند مرجع به‌صورت نسبی (روز X تا روز Y از ابلاغ) تعریف شده‌اند و سامانه آن‌ها را نسبت به تاریخ مبدأ تبدیل به تاریخ شمسی مشخص می‌کند. هرگونه تغییر این تاریخ فقط با مصوبه شورا، ثبت دلیل و تأیید رسمی در بخش تنظیمات انجام می‌شود و مهلت‌ها به‌صورت خودکار بازمحاسبه می‌شوند.",
  },
  {
    q: "گزارش فصلی واحدها چه زمانی و به چه شکلی ارسال می‌شود؟",
    a: "بر پایه سند مرجع، گزارش‌های فصلی پایش پیشرفت باید حداکثر تا ۱۵ روز پس از پایان هر فصل به دبیرخانه شورا ارسال شود. تأخیر در ارسال در جلسات شورا پیگیری و در گزارش دبیرخانه منعکس می‌شود.",
  },
  {
    q: "آیا هر واحد می‌تواند مستقیم پروژه یا خرید تحول دیجیتال را شروع کند؟",
    a: "خیر. قاعده «ممنوعیت اقدام موازی خارج از چارچوب» برقرار است: هر پروژه باید با فرم استاندارد پروژه ثبت، امتیازدهی و توسط شورای راهبری تصویب شود. اقدام خارج از چارچوب فقط با مجوز کتبی مرجع مجاز (فرم درخواست مجوز کتبی) امکان‌پذیر است.",
  },
  {
    q: "یک کاربرد هوش مصنوعی چه زمانی می‌تواند عملیاتی شود؟",
    a: "سه شرط دارد: (۱) ثبت در دفتر مرکزی کاربردهای هوش مصنوعی، (۲) ثبت نتایج ارزیابی معتبر، و (۳) صدور مجوز بهره‌برداری رسمی. برای کاربردهای پرریسک، تأیید انسانی مستند نیز الزامی است — سامانه قاعده «بدون ثبت و ارزیابی، بهره‌برداری ممنوع» را در سطح سرور اعمال می‌کند.",
  },
  {
    q: "مدل امتیازدهی سبد پروژه‌ها چگونه است و چه کسی تصمیم نهایی می‌گیرد؟",
    a: "مدل متوازن نسخه v1.0-ابلاغی با چهار معیار به کار می‌رود: ارزش و منفعت (۴۰)، آمادگی داده (۲۰)، ریسک و امنیت (۲۰) و امکان‌پذیری اجرا (۲۰) — مجموع ۱۰۰. هر امتیاز باید همراه دلیل و شواهد ثبت شود. امتیازها ورودی تصمیم‌سازی هستند و تصویب نهایی ورود پروژه به سبد در صلاحیت شورای راهبری است.",
  },
  {
    q: "مالک داده و متولی داده چه تفاوتی دارند؟",
    a: "مالک داده، مدیر تصمیم‌گیر مسئول کیفیت و مجوزهای دسترسی داده است؛ متولی داده، مسئول فنی نگهداری روزمره و اجرای سیاست‌های داده است. هر دو باید برای هر حوزه داده (مانند داده مشترکان، شبکه، مالی) به‌صورت مشخص معرفی شده باشند.",
  },
  {
    q: "خروجی گام‌ها و اسناد رسمی کجا نگهداری می‌شوند؟",
    a: "همه اسناد حاکمیتی (منشور، دستورالعمل، سازوکارها و فرم‌ها) در ماژول «اسناد و مدارک» با نسخه‌بندی و تاریخچه نگهداری می‌شوند. تنها اسناد با وضعیت «ابلاغ‌شده» قابل استناد رسمی هستند و تغییر اسناد مصوب فقط با ثبت نسخه جدید مجاز است.",
  },
];

export function KnowledgeModule() {
  const baselineDate = useAppStore((s) => s.baselineDate);
  const setModule = useAppStore((s) => s.setModule);

  const { data, isLoading, isError, refetch } = useQuery<{ documents: IssuedDoc[] }>({
    queryKey: ["documents"],
    queryFn: () => api.get("/api/documents"),
  });

  const issuedDocs = (data?.documents ?? []).filter((d) => d.status === "ISSUED");

  return (
    <div className="p-4 lg:p-6">
      <ModuleHeader
        title="دانش‌نامه و راهنمای اجرا"
        description="مرجع یکپارچه قواعد، ابزارها و تقویم اجرای برنامه بر پایه سند ابلاغی — ابزارهای استاندارد گام ۲، قواعد حاکمیتی، گروه‌های زمانی ۳۷ گام و پاسخ پرسش‌های متداول."
      />

      <div className="space-y-6">
        {/* ابزارهای گام ۲ */}
        <section>
          <SectionTitle icon={<ClipboardList className="h-4 w-4" />} title="ابزارهای اجرایی گام ۲ — فرم‌های استاندارد تحویل از واحدها" />
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {STEP2_TOOLS.map((t) => (
              <Card key={t.title} className="bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-start gap-2 leading-6">
                    <span className="text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5">{t.icon}</span>
                    {t.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <p className="text-foreground leading-5">{t.purpose}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px]">مخاطب: {t.target}</Badge>
                  </div>
                  <div className="rounded-lg bg-muted/60 border p-2 leading-5 text-muted-foreground">خروجی: {t.output}</div>
                </CardContent>
              </Card>
            ))}
            <Card className="border-dashed bg-transparent">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center gap-2 text-xs text-muted-foreground">
                <Info className="h-5 w-5" />
                نسخه‌های رسمی و ابلاغ‌شده این فرم‌ها پس از طی گردش تصویب، در بخش «اسناد و مدارک» قابل استناد خواهند بود.
              </CardContent>
            </Card>
          </div>
        </section>

        {/* تقویم گزارش‌دهی و مبنای زمانی */}
        <section>
          <SectionTitle icon={<CalendarClock className="h-4 w-4" />} title="تقویم گزارش‌دهی و مبنای زمانی برنامه" />
          <div className="grid md:grid-cols-2 gap-3">
            <Card className="bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><BookOpenText className="h-4 w-4 text-emerald-700 dark:text-emerald-400" /> گزارش فصلی پایش پیشرفت</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-3 text-amber-900 dark:text-amber-300 font-medium leading-6">
                  مهلت ارسال: حداکثر ۱۵ روز پس از پایان هر فصل
                </div>
                <p className="text-xs text-muted-foreground leading-5">
                  واحدها وضعیت اقدامات، پروژه‌ها و شاخص‌های خود را با فرم‌های استاندارد به دبیرخانه شورا گزارش می‌کنند؛ دبیرخانه گزارش جامع را برای جلسه شورا آماده می‌کند.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Landmark className="h-4 w-4 text-emerald-700 dark:text-emerald-400" /> تاریخ مبدأ (روز صفر) برنامه</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-3 text-emerald-900 font-medium leading-6">
                  تاریخ مبدأ فعلی: {baselineDate ? faDate(baselineDate) : "ثبت نشده"}
                </div>
                <p className="text-xs text-muted-foreground leading-5">
                  کلیه مهلت‌های ۳۷ گام به‌صورت نسبی نسبت به این تاریخ محاسبه می‌شود (روز X از ابلاغ). تغییر این تاریخ فقط با مصوبه شورا، ثبت دلیل و تأیید رسمی انجام می‌شود و همه مهلت‌ها خودکار بازمحاسبه می‌شوند.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* گروه‌های زمانی ۳۷ گام */}
        <section>
          <SectionTitle icon={<GraduationCap className="h-4 w-4" />} title="گروه‌های زمانی ۳۷ گام سند مرجع" />
          <Card className="bg-card">
            <CardContent className="p-4">
              <div className="rounded-lg border max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60">
                      <TableHead className="text-right">گروه</TableHead>
                      <TableHead className="text-right">گام‌ها</TableHead>
                      <TableHead className="text-right">بازه زمانی از روز صفر</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ACTION_GROUPS.map((g) => {
                      const [range, focus] = g.sub.split("—").map((s) => s.trim());
                      return (
                        <TableRow key={g.key}>
                          <TableCell className="font-medium text-sm whitespace-nowrap">
                            {g.label}
                            {focus && <div className="text-[11px] text-muted-foreground font-normal mt-0.5">{focus}</div>}
                          </TableCell>
                          <TableCell><Badge variant="outline" className="font-mono text-[10px]">گام {faNum(g.steps)}</Badge></TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{range}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setModule("actions")}>
                  مشاهده ۳۷ گام در ماژول اقدامات <ArrowLeft className="h-4 w-4 mr-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* قواعد حاکمیتی کلیدی */}
        <section>
          <SectionTitle icon={<ShieldAlert className="h-4 w-4" />} title="قواعد حاکمیتی کلیدی (قابل اعمال در سطح سامانه)" />
          <div className="grid md:grid-cols-2 gap-3">
            <Card className="border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/40">
              <CardContent className="p-4 flex gap-3">
                <Ban className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-rose-800 text-sm">بدون ثبت و ارزیابی، بهره‌برداری ممنوع</div>
                  <p className="text-xs text-rose-700 dark:text-rose-400 leading-5">
                    هیچ کاربرد هوش مصنوعی بدون ثبت در دفتر مرکزی و ثبت نتایج ارزیابی معتبر، مجاز به بهره‌برداری رسمی نیست. کاربردهای پرریسک نیازمند تأیید انسانی مستند هستند (گام ۱۳).
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/40">
              <CardContent className="p-4 flex gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-amber-900 dark:text-amber-300 text-sm">ممنوعیت اقدام موازی خارج از چارچوب</div>
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-5">
                    هیچ واحدی مجاز به آغاز پروژه، خرید یا قرارداد مرتبط با تحول دیجیتال خارج از سبد مصوب شورا نیست؛ تنها استثنا، دریافت مجوز کتبی از مرجع مجاز (فرم درخواست مجوز کتبی) است.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* اسناد مرجع قابل استناد (داده واقعی از ماژول اسناد) */}
        <section>
          <SectionTitle icon={<FileCheck2 className="h-4 w-4" />} title="اسناد مرجع قابل استناد (ابلاغ‌شده)" />
          {isLoading && <LoadingState label="در حال دریافت اسناد ابلاغ‌شده…" />}
          {isError && <ErrorState message="خطا در دریافت اسناد" onRetry={() => refetch()} />}
          {!isLoading && !isError && issuedDocs.length === 0 && (
            <Card className="border-dashed bg-transparent">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                در حال حاضر سند ابلاغ‌شده‌ای ثبت نشده است — پس از طی گردش تصویب و ابلاغ، اسناد در این بخش قابل استناد می‌شوند.
              </CardContent>
            </Card>
          )}
          {issuedDocs.length > 0 && (
            <div className="rounded-lg border bg-card max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60">
                    <TableHead className="text-right">کد</TableHead>
                    <TableHead className="text-right">عنوان سند</TableHead>
                    <TableHead className="text-right">نسخه</TableHead>
                    <TableHead className="text-right">وضعیت</TableHead>
                    <TableHead className="text-right">فایل رسمی</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issuedDocs.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-[10px] whitespace-nowrap">{d.code}</TableCell>
                      <TableCell className="font-medium text-sm">{d.title}</TableCell>
                      <TableCell className="text-xs">نسخه {d.version}</TableCell>
                      <TableCell><DocStatusBadge status={d.status} /></TableCell>
                      <TableCell className="text-xs">
                        {d.fileUrl
                          ? <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-emerald-700 dark:text-emerald-400 underline break-all" dir="ltr">{d.fileUrl}</a>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        {/* پرسش‌های متداول */}
        <section>
          <SectionTitle icon={<BookOpenText className="h-4 w-4" />} title="پرسش‌های متداول" />
          <Accordion type="single" collapsible className="bg-card border rounded-xl px-4">
            {FAQ_ITEMS.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-sm text-right leading-6">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-7">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
      <span className="text-emerald-700 dark:text-emerald-400">{icon}</span>
      {title}
    </h2>
  );
}
