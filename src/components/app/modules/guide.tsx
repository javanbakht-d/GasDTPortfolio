"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ModuleHeader } from "@/components/app/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ModuleKey } from "@/store/app-store";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { faNum } from "@/lib/persian-date-format";
import {
  Home, LayoutDashboard, ListChecks, CalendarRange, Gauge, ShieldAlert, FileText, Briefcase,
  Database, Bot, Gavel, Wallet, Building2, FileBarChart2, BookOpen, Users, Settings,
  Sparkles, Bell, Search, Sun, CircleHelp, Rocket, ChevronLeft,
  Eye, EyeOff, Lock, Globe, Landmark, BookMarked, MessagesSquare,
  ClipboardCheck, Lightbulb, ArrowDown, Crown, Building, UserCheck,
} from "lucide-react";

// ═══════════════════════════════ داده‌های راهنما ═══════════════════════════════

type GuideTab = "start" | "modules" | "features" | "roles" | "glossary" | "faq";

type ModuleGuide = {
  id: string;
  tabId: string;
  icon: React.ElementType;
  title: string;
  purpose: string;
  whoSee: string;
  steps: string[];
  tips?: string[];
  jump?: ModuleKey;
};

const MODULE_GUIDES: ModuleGuide[] = [
  {
    id: "g-my-desk", tabId: "modules", icon: Home, title: "میزکار روزانه",
    purpose: "صفحه نخست شما پس از ورود؛ فهرست کاری امروز بر اساس نقش و واحد سازمانی شما، به‌صورت خودکار آماده می‌شود.",
    whoSee: "همه کاربران — هرکس فقط کارهای حوزه خودش را می‌بیند",
    steps: [
      "عنوان صفحه به شما می‌گوید امروز به چه مواردی باید رسیدگی کنید.",
      "برای بازکردن جزئیات هر مورد، روی آن کلیک کنید؛ صفحه اقدام مرتبط باز می‌شود.",
      "در نوار بالای صفحه، شماره روز برنامه و تاریخ مبنای محاسبه مهلت‌ها نمایش داده می‌شود.",
      "بنر «محدوده داده شما» نشان می‌دهد چه دامنه‌ای از اطلاعات برای شما قابل مشاهده است.",
    ],
    tips: [
      "هر روز ابتدای کار، این صفحه را ببینید تا از موارد فوری و نزدیک به سررسید غافل نشوید.",
      "با دکمه «دستیار هوشمند» در همین صفحه می‌توانید درباره هر مورد پرسش بپرسید.",
    ],
    jump: "my-desk",
  },
  {
    id: "g-dashboard", tabId: "modules", icon: LayoutDashboard, title: "داشبورد راهبری کلان",
    purpose: "نمای کلان برنامه: درصد تحقق، گام‌های معوق، سررسیدهای نزدیک و عطف‌های زمانی پنج‌گانه سند مرجع.",
    whoSee: "همه کاربران — نقش‌های دبیرخانه/شورا کل برنامه، سایر نقش‌ها فقط داده واحد خود",
    steps: [
      "کارت‌های بالا خلاصه وضعیت را نشان می‌دهند: کل گام‌ها، تکمیل‌شده، در حال اجرا و معوق.",
      "نمودار «درصد تحقق برنامه» روند پیشرفت را در برابر زمان نشان می‌دهد.",
      "با تب‌های سه‌گانه پایین می‌توانید وضعیت گروه‌های زمانی، پوشش تعهدات واحدها و ارکان حکمرانی را ببینید.",
      "برای دیدن جزئیات هر گروه، روی عطف‌های زمانی کلیک کنید.",
    ],
    tips: ["اگر کارت ریسک یا مصوبات شورا را نمی‌بینید، این بخش‌ها فقط برای نقش‌های دبیرخانه و شورا فعال است."],
    jump: "dashboard",
  },
  {
    id: "g-actions", tabId: "modules", icon: ListChecks, title: "اقدامات و تعهدات",
    purpose: "قلب برنامه: ۳۷ گام سند ابلاغی به‌همراه اقدامات افزوده، با چرخه وضعیت کامل از ثبت تا تأیید و بستن.",
    whoSee: "کاربران دارای مجوز — نقش‌های واحدی فقط اقدامات واحد خود یا اقدامات محول‌شده شخصی",
    steps: [
      "با فیلترها اقدامات را بر اساس گروه زمانی، وضعیت یا واحد مسئول جست‌وجو کنید.",
      "برای ثبت پیشرفت، اقدام را باز کنید، درصد پیشرفت و توضیح را وارد و ثبت کنید.",
      "خروجی اقدام با دکمه «ارسال برای بررسی» به مسئول بررسی می‌رود.",
      "مسئول بررسی آن را تأیید می‌کند یا با ذکر دلیل رد می‌کند؛ اقدام ردشده برای اصلاح برمی‌گردد.",
      "بستن اقدام فقط پس از تأیید نهایی امکان‌پذیر است.",
    ],
    tips: [
      "ثبت وضعیت «معوق» بدون ذکر علت تأخیر پذیرفته نمی‌شود — سامانه صادق‌گزارشی را اجباری می‌کند.",
      "شماره هر گام (مثلاً گام ۱۳) از یک تا ۳۷ در همه سامانه یکسان است؛ در جست‌وجوی سراسری می‌توانید شماره را تایپ کنید.",
    ],
    jump: "actions",
  },
  {
    id: "g-calendar", tabId: "modules", icon: CalendarRange, title: "تقویم، مهلت‌ها و گانت",
    purpose: "همه مهلت‌های برنامه در یک نگاه؛ مهلت‌ها به‌صورت نسبی (روز X از ابلاغ) نسبت به تاریخ مبدأ محاسبه می‌شوند.",
    whoSee: "همه کاربران — مهلت‌های محدوده دسترسی خود",
    steps: [
      "نمای گانت، گروه‌های پنج‌گانه ۳۷ گام را روی خط زمان نشان می‌دهد.",
      "فهرست سررسیدهای نزدیک، نزدیک‌ترین مهلت‌ها را با رنگ هشدار مرتب می‌کند.",
      "روی هر مورد کلیک کنید تا مستقیماً به اقدام مربوط بروید.",
    ],
    tips: ["اگر تاریخ مبدأ توسط شورا تغییر کند، همه مهلت‌ها به‌صورت خودکار بازمحاسبه می‌شوند — نیازی به کار دستی نیست."],
    jump: "calendar",
  },
  {
    id: "g-kpis", tabId: "modules", icon: Gauge, title: "شاخص‌ها و سنجش عملکرد",
    purpose: "شاخص‌های کلیدی برنامه و ثبت مقدار دوره‌ای آن‌ها برای پایش عینی پیشرفت.",
    whoSee: "دارای مجوز مشاهده شاخص‌ها — ثبت مقدار نیازمند مجوز سنجش",
    steps: [
      "شاخص موردنظر را انتخاب کنید تا تعریف، واحد و هدف آن را ببینید.",
      "با «ثبت مقدار»، عدد دوره جدید را به‌همراه دوره زمانی ثبت کنید.",
      "نمودار روند، مقادیر ثبت‌شده را در برابر هدف نمایش می‌دهد.",
    ],
    tips: ["دقت در ثبت به‌موقع مقادیر، شرط گزارش‌های معتبر فصلی است."],
    jump: "kpis",
  },
  {
    id: "g-risks", tabId: "modules", icon: ShieldAlert, title: "ریسک‌ها، انحرافات و اقدامات جبرانی",
    purpose: "ثبت ریسک‌های برنامه و انحراف‌ها و پیگیری اقدامات جبرانی تا بسته‌شدن.",
    whoSee: "دارای مجوز مشاهده ریسک‌ها — ثبت و مدیریت نیازمند مجوز ریسک",
    steps: [
      "ریسک جدید را با توضیح احتمال، اثر و مسئول ثبت کنید.",
      "انحراف مشاهده‌شده در اجرای اقدامات را ثبت کنید تا قابل پیگیری شود.",
      "برای هر انحراف، اقدام جبرانی مشخص کنید و وضعیت آن را تا برطرف‌شدن به‌روز نگه دارید.",
    ],
    jump: "risks",
  },
  {
    id: "g-documents", tabId: "modules", icon: FileText, title: "مدیریت اسناد و مصوبات",
    purpose: "کتابخانه رسمی اسناد حاکمیتی با نسخه‌بندی و گردش تصویب؛ تنها اسناد «ابلاغ‌شده» قابل استناد رسمی‌اند.",
    whoSee: "دارای مجوز مشاهده اسناد — اسناد محرمانه فقط برای واحد مالک و نقش‌های سراسری",
    steps: [
      "سند جدید را ایجاد کنید؛ عنوان، نوع و نسخه را وارد کنید.",
      "متن سند را ویرایش و در صورت آمادگی، برای تصویب ارسال کنید.",
      "مرجع تصویب، سند را تأیید و ابلاغ می‌کند؛ از این پس سند قابل استناد است.",
      "تغییر سند ابلاغ‌شده فقط با ثبت نسخه جدید امکان‌پذیر است — تاریخچه همیشه حفظ می‌شود.",
    ],
    tips: ["اگر سندی را نمی‌بینید، ممکن است محرمانه باشد و واحد شما مالک آن نباشد."],
    jump: "documents",
  },
  {
    id: "g-portfolio", tabId: "modules", icon: Briefcase, title: "سبد پروژه‌های تحول دیجیتال",
    purpose: "ثبت، امتیازدهی متوازن و تصویب پروژه‌ها؛ هیچ پروژه‌ای بدون عبور از این چرخه مجاز به اجرا نیست.",
    whoSee: "دارای مجوز مشاهده پروژه‌ها — نقش‌های واحدی پروژه‌های واحد خود و پیشران‌های برنامه ابلاغی",
    steps: [
      "پروژه پیشنهادی را با «فرم استاندارد پروژه» ثبت کنید: مسئله، اهداف، محدوده، شاخص موفقیت و آمادگی داده.",
      "ارزیاب‌ها امتیاز را در چهار معیار ثبت می‌کنند: ارزش و منفعت (۴۰)، آمادگی داده (۲۰)، ریسک و امنیت (۲۰) و امکان‌پذیری اجرا (۲۰).",
      "هر امتیاز باید دلیل و شواهد داشته باشد.",
      "ورود نهایی پروژه به سبد، در صلاحیت شورای راهبری است.",
    ],
    tips: ["اقدام یا خرید خارج از سبد مصوب، بدون مجوز کتبی مرجع مجاز، تخلف حاکمیتی محسوب می‌شود."],
    jump: "portfolio",
  },
  {
    id: "g-governance", tabId: "modules", icon: Database, title: "حاکمیت داده",
    purpose: "فهرست حوزه‌های داده سازمان، مالک و متولی داده هر حوزه و طبقه‌بندی آن‌ها.",
    whoSee: "دارای مجوز مشاهده حاکمیت داده — حوزه‌های محرمانه فقط برای مالک",
    steps: [
      "حوزه‌های داده را مرور کنید؛ برای هر حوزه، مالک (تصمیم‌گیر) و متولی (مسئول فنی) مشخص است.",
      "وضعیت هر حوزه (مانند طبقه‌بندی و سطح آمادگی) در کارت آن نمایش داده می‌شود.",
      "تغییرات مالکیت داده با هماهنگی دبیرخانه در این ماژول ثبت می‌شود.",
    ],
    tips: ["اگر واحد شما هنوز مالک و متولی داده ندارد، ثبت «فرم معرفی رابط و مالک/متولی داده» (گام ۲) فراموش نشود."],
    jump: "governance",
  },
  {
    id: "g-ai-registry", tabId: "modules", icon: Bot, title: "دفتر ثبت کاربردهای هوش مصنوعی",
    purpose: "دفتر مرکزی کاربردهای هوش مصنوعی: ثبت، ارزیابی ریسک و صدور مجوز بهره‌برداری.",
    whoSee: "دارای مجوز مشاهده دفتر — ثبت نیازمند مجوز مربوط",
    steps: [
      "کاربرد هوش مصنوعی جدید را با توضیح هدف، حوزه داده و راه‌حل ثبت کنید.",
      "ارزیابی ریسک و اعتبار آن را ثبت کنید (دقت، خطا، شرایط آزمون).",
      "پس از ثبت ارزیابی معتبر، درخواست مجوز بهره‌برداری صادر و توسط مرجع مجاز تعیین‌تکلیف می‌شود.",
      "کاربردهای پرریسک حتماً به تأیید انسانی مستند نیاز دارند.",
    ],
    tips: ["قاعده طلایی: «بدون ثبت و ارزیابی، بهره‌برداری ممنوع» — سامانه این قاعده را در سطح سرور اعمال می‌کند."],
    jump: "ai-registry",
  },
  {
    id: "g-meetings", tabId: "modules", icon: Gavel, title: "جلسات، صورت‌جلسات و تصمیم‌ها",
    purpose: "مدیریت جلسات شورای راهبری: دستور جلسه، صورت‌جلسه، مصوبات و پیگیری اجرای آن‌ها.",
    whoSee: "دارای مجوز مشاهده جلسات — مدیریت جلسات نیازمند مجوز مربوط",
    steps: [
      "جلسه جدید با دستور کار ایجاد کنید و مدارک موردنیاز را پیوست کنید.",
      "پس از جلسه، صورت‌جلسه و تصمیم‌ها (مصوبات) را ثبت کنید.",
      "هر مصوبه به‌صورت خودکار قابل تبدیل به اقدام با مسئول و مهلت است.",
      "وضعیت اجرای مصوبات در فهرست پیگیری قابل مشاهده است.",
    ],
    tips: ["مصوبات تأییدشده در داشبورد راهبری برای نقش‌های مجاز نمایش داده می‌شود."],
    jump: "meetings",
  },
  {
    id: "g-budget", tabId: "modules", icon: Wallet, title: "بودجه و منابع",
    purpose: "تخصیص بودجه به اقدامات و پروژه‌ها و پایش مصرف نسبت به تخصیص.",
    whoSee: "دارای مجوز مشاهده بودجه — مدیریت نیازمند مجوز بودجه",
    steps: [
      "برای اقدام یا پروژه، تخصیص بودجه ثبت کنید (مبلغ و منبع).",
      "مصرف هر ردیف را ثبت کنید تا درصد مصرف در برابر تخصیص دیده شود.",
      "گزارش نماکارت‌ها وضعیت کلی بودجه برنامه را خلاصه می‌کند.",
    ],
    jump: "budget",
  },
  {
    id: "g-organization", tabId: "modules", icon: Building2, title: "سازمان‌ها و واحدها",
    purpose: "نقشه رسمی سازمان: ۷۷ واحد مطابق ساختار شرکت ملی گاز ایران با روابط والد-فرزند و مشخصات رابط تحول و مالک/متولی داده هر واحد.",
    whoSee: "همه کاربران — چارچوب سازمانی غیرمحرمانه است",
    steps: [
      "با چیپ‌های فیلتر بالای صفحه، فقط گروه دلخواه را ببینید: مدیریت‌های ستادی (۱۴)، امور مستقل (۹)، شرکت‌های ستادی (۳)، شرکت‌های گاز استانی (۳۱)، شرکت‌های پالایش گاز (۷) و مناطق عملیات انتقال گاز (۱۱).",
      "روی کارت هر واحد کلیک کنید تا جزئیات، مدیر، رابط تحول دیجیتال و وضعیت تعهدات آن را ببینید.",
      "پرچم‌های وضعیت (معرفی رابط، تبیین داخلی، گزارش وضعیت موجود و…) تکمیل obligations هر واحد را نشان می‌دهد.",
    ],
    tips: ["واحد شما در نوار بالای سامانه و منوی کاربر نمایش داده می‌شود؛ مبنای محدوده دید داده‌ای شماست."],
    jump: "organization",
  },
  {
    id: "g-reports", tabId: "modules", icon: FileBarChart2, title: "گزارش‌ها و تحلیل‌های هوشمند",
    purpose: "ساخت گزارش‌های دوره‌ای و تحلیل پیشرفت برنامه برای جلسات شورا و گزارش‌دهی فصلی.",
    whoSee: "دارای مجوز مشاهده گزارش‌ها — تهیه و خروجی نیازمند مجوز گزارش",
    steps: [
      "نوع گزارش را انتخاب کنید (پیشرفت گام‌ها، وضعیت واحدها، بودجه و…).",
      "پارامترهای دوره و محدوده را تعیین و گزارش را بسازید.",
      "خروجی قابل دانلود برای ارسال رسمی به دبیرخانه استفاده می‌شود.",
    ],
    tips: ["یادآور مهلت: گزارش فصلی حداکثر تا ۱۵ روز پس از پایان هر فصل باید به دبیرخانه برسد."],
    jump: "reports",
  },
  {
    id: "g-knowledge", tabId: "modules", icon: BookOpen, title: "مرکز دانش و پشتیبانی",
    purpose: "دانش‌نامه اجرایی برنامه: ابزارهای استاندارد گام ۲، قواعد حاکمیتی، گروه‌های زمانی ۳۷ گام و اسناد ابلاغ‌شده.",
    whoSee: "همه کاربران",
    steps: [
      "ابزارهای گام ۲ (فرم‌های استاندارد) را مرور کنید تا بدانید از واحد شما چه چیزی تحویل دبیرخانه می‌شود.",
      "قواعد حاکمیتی کلیدی را ببینید؛ این قواعد در سطح سامانه هم اعمال می‌شوند.",
      "فهرست اسناد «ابلاغ‌شده» مرجع رسمی استناد شماست.",
    ],
    jump: "knowledge",
  },
  {
    id: "g-users", tabId: "modules", icon: Users, title: "مدیریت کاربران و دسترسی‌ها",
    purpose: "ایجاد کاربران، تخصیص نقش از میان ۱۶ نقش رسمی و واحد سازمانی، فعال/غیرفعال‌سازی و بازنشانی گذرواژه.",
    whoSee: "فقط مدیران سامانه و دبیرخانه",
    steps: [
      "با دکمه «ایجاد کاربر»، نام، نام کاربری و واحد سازمانی را وارد کنید.",
      "نقش یا نقش‌های کاربر را انتخاب کنید؛ مجموع مجوزهای نقش، منوها و داده‌های قابل مشاهده او را تعیین می‌کند.",
      "کاربر غیرفعال نمی‌تواند وارد شود؛ برای خروج از سازمان، کاربر را غیرفعال کنید نه حذف.",
      "در صورت فراموشی گذرواژه، مدیر با «بازنشانی گذرواژه» رمز موقت صادر می‌کند.",
    ],
    tips: [
      "هر تغییری در کاربران در سوابق ممیزی ثبت می‌شود.",
      "برای درک اینکه هر نقش چه می‌بیند، تب «نقش‌ها و دسترسی» همین راهنما را ببینید.",
    ],
    jump: "users",
  },
  {
    id: "g-settings", tabId: "modules", icon: Settings, title: "تنظیمات و راهبری سامانه",
    purpose: "تنظیمات کلیدی سامانه: تاریخ مبدأ (روز صفر)، یادآوری‌های خودکار، پیکربندی، سلامت سامانه و سوابق ممیزی.",
    whoSee: "فقط مدیر پیکربندی و مدیر کل سامانه",
    steps: [
      "تب «تاریخ مبنا» برای مشاهده یا (با مصوبه شورا) تغییر روز صفر برنامه است؛ تغییر آن همه مهلت‌ها را بازمحاسبه می‌کند.",
      "تب «یادآوری‌ها و گزارش‌های خودکار» موتور یادآور سامانه را کنترل می‌کند.",
      "تب «سلامت سامانه» وضعیت پایگاه داده، زمان‌بند و صف اعلان را نشان می‌دهد.",
      "تب «سوابق ممیزی» رخدادهای حساس را با جست‌وجو فهرست می‌کند.",
    ],
    tips: ["تغییر تاریخ مبدأ بدون مصوبه، ثبت دلیل و تأیید رسمی امکان‌پذیر نیست."],
    jump: "settings",
  },
];

type FeatureGuide = { id: string; icon: React.ElementType; title: string; text: string; steps: string[] };

const FEATURE_GUIDES: FeatureGuide[] = [
  {
    id: "f-ai", icon: Sparkles, title: "دستیار هوشمند دبیرخانه",
    text: "دستیار مبتنی بر اسناد برنامه که به پرسش‌های شما درباره گام‌ها، مهلت‌ها، قواعد و وضعیت برنامه پاسخ می‌دهد.",
    steps: [
      "دکمه «دستیار هوشمند دبیرخانه» را از پایین منوی کناری (یا دکمه پنل بازشو) بزنید.",
      "پرسش خود را به زبان ساده فارسی بنویسید و Enter بزنید.",
      "پاسخ مبتنی بر اسناد و داده‌های سامانه دریافت می‌کنید؛ از دستیار نتیجه اجرایی بخواهید.",
    ],
  },
  {
    id: "f-notif", icon: Bell, title: "اعلان‌ها",
    text: "یادآورهای مهلت، وضعیت اقدامات و رخدادهای مهم به‌صورت خودکار برای شما صادر می‌شود.",
    steps: [
      "روی آیکن زنگ در نوار بالا کلیک کنید؛ نقطه قرمز یعنی اعلان نخوانده دارید.",
      "روی هر اعلان کلیک کنید تا خوانده شود؛ با «خواندن همه» همه را خوانده کنید.",
      "رنگ نقطه اهمیت را نشان می‌دهد: قرمز بحرانی، کهربایی مهم، سبز عادی.",
    ],
  },
  {
    id: "f-search", icon: Search, title: "جست‌وجوی سراسری",
    text: "سریع‌ترین راه رسیدن به هر بخش؛ منوها و گام‌های شماره‌دار را جست‌وجو می‌کند.",
    steps: [
      "کادر جست‌وجو در نوار بالا را کلیک کنید یا تایپ را شروع کنید.",
      "نام ماژول را بنویسید (مثلاً «بودجه») یا شماره گام را (مثلاً ۱۳ یا 13).",
      "روی نتیجه کلیک کنید تا مستقیماً به همان بخش بروید.",
    ],
  },
  {
    id: "f-theme", icon: Sun, title: "حالت روشن و تاریک",
    text: "سامانه دو تم دارد و انتخاب شما به‌خاطر سپرده می‌شود.",
    steps: [
      "دکمه خورشید/ماه در نوار بالا را بزنید.",
      "در حالت «سیستم»، تم با تنظیمات دستگاه شما هم‌گام می‌شود.",
    ],
  },
  {
    id: "f-scope", icon: Lock, title: "محدوده داده‌ای هر کاربر (حریم نقش)",
    text: "هر کاربر فقط اطلاعات حوزه وظایف و نقش خود را می‌بیند؛ این قاعده در سرور اعمال می‌شود، نه فقط در ظاهر صفحه.",
    steps: [
      "نقش‌های دبیرخانه، شورا، حسابرس و گزارش‌ها «دید سراسری» دارند و کل برنامه را می‌بینند.",
      "سایر نقش‌ها فقط داده‌های واحد سازمانی خود یا اقدامات محول‌شده شخصی را می‌بینند.",
      "بنر «محدوده داده شما» در داشبورد، دامنه دید فعلی را توضیح می‌دهد.",
      "تلاش برای دسترسی مستقیم به داده خارج از محدوده، با پیام ۴۰۳ رد و در سوابق ممیزی ثبت می‌شود.",
    ],
  },
];

type RoleGuide = { key: string; name: string; desc: string; scope: "global" | "unit"; can: string };

const ROLE_GUIDES: RoleGuide[] = [
  { key: "SYSTEM_ADMIN", name: "مدیر کل سامانه", desc: "دسترسی کامل به همه بخش‌ها، کاربران و تنظیمات", scope: "global", can: "ایجاد کاربر، تنظیمات سامانه، همه ماژول‌ها" },
  { key: "SECRETARIAT_ADMIN", name: "مدیر دبیرخانه", desc: "مدیریت عملیاتی کامل دبیرخانه شورا", scope: "global", can: "ایجاد و تأیید اقدامات و اسناد، مدیریت همه بخش‌های اجرایی" },
  { key: "CONFIG_ADMIN", name: "مدیر پیکربندی و راهبری سامانه", desc: "مدیریت تنظیمات، تقویم، فرم‌ها و پیکربندی", scope: "global", can: "تنظیمات، تاریخ مبدأ، سلامت سامانه، سوابق ممیزی" },
  { key: "COUNCIL_SECRETARY", name: "دبیر شورا", desc: "دبیری شورای راهبری و پیشبرد صورت‌جلسات و مصوبات", scope: "global", can: "ایجاد جلسه و صورت‌جلسه، ثبت مصوبات، ارسال یادآور" },
  { key: "COUNCIL_MEMBER", name: "عضو / رئیس شورای راهبری", desc: "مشاهده کل برنامه و تأیید مصوبات در جلسات", scope: "global", can: "تأیید اقدامات، اسناد و ورود پروژه به سبد" },
  { key: "AUDITOR", name: "ناظر / حسابرس", desc: "مشاهده کامل و سوابق ممیزی بدون حق تغییر", scope: "global", can: "دیدن همه داده‌ها + خروجی داده؛ بدون هیچ دکمه تغییر" },
  { key: "REPORT_MANAGER", name: "مدیر گزارش‌ها", desc: "تهیه و انتشار گزارش‌های دوره‌ای", scope: "global", can: "ساخت و انتشار گزارش، خروجی داده" },
  { key: "UNIT_MANAGER", name: "مدیر واحد سازمانی", desc: "مدیریت اقدامات و گزارش‌های واحد خود", scope: "unit", can: "ایجاد و ثبت اقدامات، اسناد و پروژه‌های واحد خود" },
  { key: "DT_LIAISON", name: "رابط تحول دیجیتال", desc: "ثبت وضعیت موجود، پروژه‌ها و هماهنگی با دبیرخانه", scope: "unit", can: "ثبت وضعیت موجود، ثبت پروژه پیشنهادی، به‌روزرسانی اقدامات واحد" },
  { key: "DATA_OWNER", name: "مالک داده", desc: "مسئولیت حوزه‌های داده و طبقه‌بندی", scope: "unit", can: "مدیریت حاکمیت داده حوزه خود، ایجاد سند" },
  { key: "DATA_CUSTODIAN", name: "متولی داده", desc: "نگهداشت فنی و کیفیت داده", scope: "unit", can: "مشاهده و به‌روزرسانی فنی حوزه داده خود" },
  { key: "PROJECT_MANAGER", name: "مدیر پروژه", desc: "مدیریت پروژه‌های محول‌شده", scope: "unit", can: "ویرایش پروژه‌های خود، ثبت ریسک، پیوست مدارک" },
  { key: "EXECUTOR", name: "کارشناس / مجری اقدام", desc: "اجرای اقدامات محول‌شده و ثبت پیشرفت", scope: "unit", can: "ثبت پیشرفت و ارسال خروجی اقدامات محول‌شده" },
  { key: "REVIEWER", name: "مسئول بررسی و تأیید", desc: "بررسی و تأیید خروجی‌ها و اسناد ارسالی", scope: "unit", can: "تأیید یا رد خروجی اقدامات و اسناد ارسالی" },
  { key: "SUPPORT_ADMIN", name: "مدیر پشتیبانی", desc: "پشتیبانی کاربران و رفع ابهام", scope: "unit", can: "مدیریت دانش‌نامه، ارسال اعلان راهنما" },
  { key: "VIEWER", name: "کاربر صرفاً مشاهده‌گر", desc: "دسترسی فقط‌خواندنی محدود", scope: "unit", can: "فقط مشاهده داده‌های محدوده خود؛ بدون هیچ دکمه ثبت" },
];

const GLOSSARY: { term: string; def: string }[] = [
  { term: "شورای راهبری تحول دیجیتال و حکمرانی هوشمند", def: "مرجع تصمیم‌گیری برنامه؛ تصویب اسناد محوری، ورود پروژه‌ها به سبد و تعیین‌تکلیف مصوبات." },
  { term: "دبیرخانه شورا", def: "واحد پشتیبانی و پیشران شورا؛ پیگیری ۳۷ گام، ابلاغ یادآورها و تهیه گزارش‌ها در این سامانه." },
  { term: "سند مرجع (برنامه اجرایی ابلاغی)", def: "سند مادر برنامه با ۳۷ گام؛ همه اقدامات، مهلت‌ها و ابزارهای سامانه از آن مشتق شده است." },
  { term: "گام", def: "هر یک از ۳۷ اقدام شماره‌دار سند مرجع؛ شماره گام در همه سامانه یکسان و قابل جست‌وجوست." },
  { term: "اقدام", def: "کار قابل پیگیری با مسئول، مهلت و چرخه وضعیت؛ هم شامل گام‌های ۳۷گانه است و هم اقدامات افزوده." },
  { term: "تاریخ مبدأ (روز صفر)", def: "روز ابلاغ رسمی برنامه؛ مبنای محاسبه همه مهلت‌های نسبی. تغییر آن فقط با مصوبه شورا." },
  { term: "مهلت نسبی", def: "بازمانی مانند «روز ۳۰ تا ۴۵ از ابلاغ» که سامانه آن را به تاریخ شمسی مشخص تبدیل می‌کند." },
  { term: "سبد پروژه‌ها", def: "چارچوب واحد ثبت، امتیازدهی و تصویب همه پروژه‌های تحول دیجیتال؛ خارج از آن اقدام ممنوع است." },
  { term: "امتیازدهی متوازن", def: "مدل ۱۰۰ امتیازی اولویت‌بندی پروژه‌ها: ارزش و منفعت ۴۰، آمادگی داده ۲۰، ریسک و امنیت ۲۰، امکان‌پذیری ۲۰." },
  { term: "حاکمیت داده", def: "چارچوب مالکیت، طبقه‌بندی، کیفیت و مجوزهای دسترسی داده‌های سازمان." },
  { term: "مالک داده", def: "مدیر تصمیم‌گیر مسئول کیفیت داده و مجوزهای دسترسی یک حوزه داده." },
  { term: "متولی داده", def: "مسئول فنی نگهداری روزمره و اجرای سیاست‌های داده یک حوزه." },
  { term: "دفتر ثبت کاربردهای هوش مصنوعی", def: "مرکز ثبت همه کاربردهای AI سازمان؛ پیش‌نیاز ارزیابی و صدور مجوز بهره‌برداری." },
  { term: "رابط تحول دیجیتال", def: "نماینده رسمی هر واحد برای ارتباط با دبیرخانه و پیشبرد تعهدات تحول دیجیتال." },
  { term: "وضعیت موجود", def: "ثبت سامانه‌ها، پایگاه‌های داده و کاربردهای AI فعلی هر واحد؛ ورودی گام ۱۳ (دفتر AI)." },
  { term: "بلوغ دیجیتال", def: "سطح آمادگی واحد در چهار بعد داده، فناوری، فرایند و مهارت؛ با الگوی خودارزیابی سنجیده می‌شود." },
  { term: "سوابق ممیزی", def: "ثبت خودکار رخدادهای حساس سامانه (ورود، تغییر، تأیید، رد دسترسی) برای شفافیت و پاسخ‌گویی." },
  { term: "کنترل دسترسی مبتنی بر نقش (RBAC)", def: "قاعده «پیش‌فرض رد»؛ هر کاربر فقط مجوزها و داده‌های مرتبط با نقش و واحد خود را دارد." },
];

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "برای شروع کار در سامانه، اولین کاری که باید بکنم چیست؟",
    a: "پس از ورود با حساب سازمانی، یک‌بار «میزکار روزانه» را مرور کنید تا ببینید امروز چه چیزی به شما مربوط است. سپس با تب «ماژول‌ها» در همین راهنما، با بخش‌هایی که در منوی خود می‌بینید آشنا شوید. اگر منویی ندارید یعنی در شأن و وظایف شما نیست و نیازی به آن ندارید.",
  },
  {
    q: "چرا بعضی منوها را نمی‌بینم ولی همکارم می‌بیند؟",
    a: "منوها بر اساس نقش شما نمایش داده می‌شوند. هر نقش مجموعه‌ای از مجوزها دارد و فقط ماژول‌های مرتبط با وظایف شما برای شما ظاهر می‌شود. این قاعده عمدی است: به شما چیزی خارج از شرح وظایف‌تان نشان داده نمی‌شود. اگر فکر می‌کنید مجوزی کم دارید، با دبیرخانه یا مدیر سامانه تماس بگیرید.",
  },
  {
    q: "چگونه پیشرفت یک اقدام را ثبت کنم؟",
    a: "به «اقدامات و تعهدات» بروید (یا از میزکار روزانه روی مورد کلیک کنید)، اقدام را باز کنید، درصد پیشرفت و توضیح را وارد و ثبت کنید. اگر خروجی مستند دارید، فایل شواهد را پیوست و اقدام را برای بررسی ارسال کنید.",
  },
  {
    q: "چرا در داشبورد فقط اطلاعات واحد خودم را می‌بینم؟",
    a: "چون نقش شما «دید واحدی» دارد و سامانه داده‌ها را به محدوده وظایف شما محدود می‌کند. بنر «محدوده داده شما» در بالای داشبورد توضیح می‌دهد چه چیزی در دید شماست. نقش‌های دبیرخانه، شورا، حسابرس و گزارش‌ها دید سراسری دارند.",
  },
  {
    q: "مهلت‌ها چگونه محاسبه می‌شوند و کجا ببینم؟",
    a: "همه مهلت‌ها «نسبی» هستند (روز X تا Y از ابلاغ) و نسبت به تاریخ مبدأ به تاریخ شمسی تبدیل می‌شوند. در نوار بالای سامانه شماره روز فعلی برنامه و در ماژول «تقویم، مهلت‌ها و گانت» همه سررسیدها را می‌بینید.",
  },
  {
    q: "چگونه از دستیار هوشمند استفاده کنم؟",
    a: "دکمه «دستیار هوشمند دبیرخانه» در پایین منوی کناری (یا دکمه پنل بازشو) را بزنید و پرسش خود را به زبان ساده بنویسید؛ مثلاً «مهلت گام ۵ چیست؟» یا «قاعده امتیازدهی سبد پروژه‌ها را توضیح بده». پاسخ بر اساس اسناد و داده‌های سامانه است.",
  },
  {
    q: "چگونه پروژه جدید ثبت کنم؟",
    a: "از ماژول «سبد پروژه‌های تحول دیجیتال» با فرم استاندارد پروژه، مسئله، اهداف، محدوده، شاخص موفقیت و آمادگی داده را ثبت کنید. پس از امتیازدهی متوازن توسط ارزیاب‌ها، ورود به سبد در جلسه شورا تصویب می‌شود. بدون تصویب، اجرای پروژه مجاز نیست.",
  },
  {
    q: "چرا سند یا داده‌ای که دنبالش هستم را نمی‌بینم؟",
    a: "دو دلیل رایج دارد: ۱) سند «محرمانه» است و فقط واحد مالک و نقش‌های سراسری آن را می‌بینند؛ ۲) داده خارج از محدوده نقش شماست. اگر به آن نیاز کاری دارید، از دبیرخانه بخواهید دسترسی را بررسی کند — درخواست شما ثبت و پاسخ داده می‌شود.",
  },
  {
    q: "گذرواژه‌ام را فراموش کرده‌ام؛ چه کنم؟",
    a: "با مدیر سامانه یا دبیرخانه تماس بگیرید. مدیر در ماژول «مدیریت کاربران» گذرواژه شما را بازنشانی می‌کند و رمز موقت به شما تحویل می‌شود. به‌دلایل امنیتی بازیابی خودکار گذرواژه در سامانه وجود ندارد.",
  },
  {
    q: "کاربرد هوش مصنوعی جدید در واحد من چگونه مجاز می‌شود؟",
    a: "سه مرحله دارد: ۱) ثبت در «دفتر ثبت کاربردهای هوش مصنوعی»، ۲) ثبت نتایج ارزیابی معتبر، ۳) صدور مجوز بهره‌برداری رسمی. کاربردهای پرریسک به تأیید انسانی مستند نیاز دارند. بدون این چرخه، بهره‌برداری ممنوع است و سامانه آن را نمی‌پذیرد.",
  },
  {
    q: "گزارش فصلی واحد را کجا و چطور ارسال کنم؟",
    a: "از ماژول «گزارش‌ها و تحلیل‌های هوشمند» گزارش دوره را بسازید و خروجی بگیرید؛ سپس طبق رویه سازمانی برای دبیرخانه ارسال کنید. مهلت: حداکثر ۱۵ روز پس از پایان هر فصل.",
  },
  {
    q: "اعلان‌های سامانه از کجا می‌آیند و چطور مدیریت می‌شوند؟",
    a: "اعلان‌ها خودکار صادر می‌شوند: نزدیک‌شدن مهلت، تأخیر، ارسال برای بررسی و رخدادهای مرتبط با نقش شما. با آیکن زنگ در نوار بالا فهرست اعلان‌ها را ببینید؛ کلیک روی هر اعلان آن را خوانده می‌کند و «خواندن همه» همه را پاک می‌کند.",
  },
  {
    q: "آیا کارهای من ثبت و قابل پیگیری است؟",
    a: "بله. همه فعالیت‌های حساس (ورود، تغییر وضعیت، تأیید، رد دسترسی و…) در «سوابق ممیزی» ثبت می‌شود؛ مدیران می‌توانند هر رخداد را با زمان و کاربر جست‌وجو کنند.",
  },
  {
    q: "تم روشن و تاریک چگونه تغییر می‌کند؟",
    a: "دکمه خورشید/ماه در نوار بالا. انتخاب شما ذخیره می‌شود و در ورود بعدی هم اعمال است. در حالت «سیستم» با تنظیم دستگاه شما هم‌گام است.",
  },
];

const QUICK_START: { title: string; text: string; module?: ModuleKey }[] = [
  { title: "۱) ورود به سامانه", text: "با نام کاربری و گذرواژه سازمانی وارد شوید. صفحه ورود سامانه فقط با حساب رسمی کار می‌کند." },
  { title: "۲) دیدن میزکار روزانه", text: "اولین صفحه، فهرست کاری امروز شماست؛ بر اساس نقش و واحد سازمانی‌تان خودکار ساخته می‌شود.", module: "my-desk" },
  { title: "۳) آشنایی با ۳۷ گام برنامه", text: "در «اقدامات و تعهدات» گام‌های سند ابلاغی و وضعیت هر یک را ببینید.", module: "actions" },
  { title: "۴) تنظیم ظاهر دلخواه", text: "با دکمه خورشید/ماه، تم روشن یا تاریک را انتخاب کنید؛ انتخاب شما ذخیره می‌شود." },
  { title: "۵) آشنایی با دستیار هوشمند", text: "هر سؤالی درباره برنامه دارید از دستیار دبیرخانه بپرسید؛ پاسخ مبتنی بر اسناد است." },
];

// ───────────── شاخص جست‌وجو ─────────────
type SearchEntry = { tab: GuideTab; anchor: string; title: string; text: string; kind: string };

const CHECKLIST_KEY = "nigc-guide-firststeps";

// ───────────── چک‌لیست شروع سریع — ذخیره‌سازی محلی بدون اثر ری‌اکتیو ─────────────
// useSyncExternalStore: خواندن بی‌نقص از localStorage (سازگار با SSR و بدون hydration mismatch)
let cachedRaw: string | null = null;
let cachedValue = "[]";
const checklistListeners = new Set<() => void>();

function readChecklist(): string {
  try {
    const raw = localStorage.getItem(CHECKLIST_KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedValue = raw ?? "[]";
    }
  } catch { /* بی‌اثر */ }
  return cachedValue;
}

function subscribeChecklist(cb: () => void): () => void {
  checklistListeners.add(cb);
  return () => { checklistListeners.delete(cb); };
}

function writeChecklist(next: number[]): void {
  const v = JSON.stringify(next);
  try { localStorage.setItem(CHECKLIST_KEY, v); } catch { /* بی‌اثر */ }
  cachedRaw = v;
  cachedValue = v;
  checklistListeners.forEach((l) => l());
}

export function GuideModule() {
  const setModule = useAppStore((s) => s.setModule);
  const [tab, setTab] = useState<GuideTab>("start");
  const [query, setQuery] = useState("");
  const checklistRaw = useSyncExternalStore(subscribeChecklist, readChecklist, () => "[]");
  const checked = useMemo<number[]>(() => {
    try { return JSON.parse(checklistRaw) as number[]; } catch { return []; }
  }, [checklistRaw]);

  const toggleCheck = (i: number) => {
    writeChecklist(checked.includes(i) ? checked.filter((x) => x !== i) : [...checked, i]);
  };

  const index: SearchEntry[] = useMemo(() => {
    const entries: SearchEntry[] = [];
    for (const m of MODULE_GUIDES) {
      entries.push({ tab: "modules", anchor: m.id, title: m.title, text: `${m.purpose} ${m.whoSee} ${m.steps.join(" ")}`, kind: "ماژول" });
    }
    for (const f of FEATURE_GUIDES) entries.push({ tab: "features", anchor: f.id, title: f.title, text: `${f.text} ${f.steps.join(" ")}`, kind: "قابلیت" });
    for (const r of ROLE_GUIDES) entries.push({ tab: "roles", anchor: `r-${r.key}`, title: r.name, text: `${r.desc} ${r.can}`, kind: "نقش" });
    for (const g of GLOSSARY) entries.push({ tab: "glossary", anchor: `gl-${g.term}`, title: g.term, text: g.def, kind: "واژه" });
    for (const f of FAQ_ITEMS) entries.push({ tab: "faq", anchor: `faq-${FAQ_ITEMS.indexOf(f)}`, title: f.q, text: f.a, kind: "پرسش" });
    for (const q of QUICK_START) entries.push({ tab: "start", anchor: `qs-${QUICK_START.indexOf(q)}`, title: q.title, text: q.text, kind: "شروع سریع" });
    return entries;
  }, []);

  const results = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    return index.filter((e) => e.title.includes(q) || e.text.includes(q)).slice(0, 12);
  }, [query, index]);

  const goTo = (t: GuideTab, anchor: string) => {
    setTab(t);
    setQuery("");
    // پس از تعویض تب، اسکرول نرم به بخش هدف با هایلایت کوتاه
    setTimeout(() => {
      const el = document.getElementById(anchor);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("ring-2", "ring-emerald-500/60", "rounded-xl");
        setTimeout(() => el.classList.remove("ring-2", "ring-emerald-500/60", "rounded-xl"), 2200);
      }
    }, 120);
  };

  const donePct = Math.round((checked.length / QUICK_START.length) * 100);

  return (
    <div className="p-4 lg:p-6">
      <ModuleHeader
        title="راهنمای سامانه"
        description="راهنمای گام‌به‌گام، ساده و تصویری تمام بخش‌ها و قابلیت‌های سامانه — برای همه نقش‌ها. هر بخشی را که لازم دارید باز کنید؛ همه‌چیز همین‌جا و بدون نیاز به خروج از برنامه است."
      >
        <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900 gap-1.5 py-1.5 px-3">
          <CircleHelp className="h-3.5 w-3.5" /> برای همه نقش‌ها
        </Badge>
      </ModuleHeader>

      {/* جست‌وجوی راهنما */}
      <div className="relative max-w-2xl mb-6">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجو در راهنما… مثلاً «گذرواژه»، «ثبت پیشرفت»، «مهلت»، «محرمانه»"
          className="pr-9 h-11 rounded-xl"
          aria-label="جست‌وجو در راهنما"
        />
        {query && results.length > 0 && (
          <div className="absolute top-13 inset-x-0 z-30 mt-1.5 bg-card rounded-xl shadow-lg border overflow-hidden">
            <ScrollArea className="max-h-80">
              <div className="p-1.5">
                {results.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(r.tab, r.anchor)}
                    className="w-full text-right px-3 py-2.5 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] shrink-0">{r.kind}</Badge>
                      <span className="text-sm font-medium line-clamp-1">{r.title}</span>
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{r.text}</div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
        {query && results.length === 0 && query.trim().length >= 2 && (
          <div className="absolute top-13 inset-x-0 z-30 mt-1.5 bg-card rounded-xl shadow-lg border p-4 text-sm text-muted-foreground">
            نتیجه‌ای یافت نشد — عبارت کوتاه‌تری را امتحان کنید.
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as GuideTab)}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/70 p-1 rounded-xl mb-6 w-full justify-start">
          <TabsTrigger value="start" className="gap-1.5 data-[state=active]:bg-background"><Rocket className="h-4 w-4" /> شروع سریع</TabsTrigger>
          <TabsTrigger value="modules" className="gap-1.5 data-[state=active]:bg-background"><BookOpen className="h-4 w-4" /> ماژول‌ها (۱۷)</TabsTrigger>
          <TabsTrigger value="features" className="gap-1.5 data-[state=active]:bg-background"><Sparkles className="h-4 w-4" /> قابلیت‌ها</TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5 data-[state=active]:bg-background"><UserCheck className="h-4 w-4" /> نقش‌ها و دسترسی</TabsTrigger>
          <TabsTrigger value="glossary" className="gap-1.5 data-[state=active]:bg-background"><BookMarked className="h-4 w-4" /> واژه‌نامه</TabsTrigger>
          <TabsTrigger value="faq" className="gap-1.5 data-[state=active]:bg-background"><MessagesSquare className="h-4 w-4" /> پرسش‌های متداول</TabsTrigger>
        </TabsList>

        {/* ─────────── تب ۱: شروع سریع ─────────── */}
        <TabsContent value="start" className="space-y-6">
          <Card className="bg-gradient-to-l from-emerald-50 to-transparent dark:from-emerald-950/30 border-emerald-200/60 dark:border-emerald-900/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Landmark className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                این سامانه چیست؟
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-foreground/90">
              سامانه یکپارچه <b>راهبری تحول دیجیتال و حکمرانی هوشمند شرکت ملی گاز ایران (NIGC-DTG)</b> است؛ همه‌چیزِ برنامه اجرایی ابلاغی را یک‌جا جمع می‌کند:
              رهگیری <b>۳۷ گام</b> سند مرجع، پیگیری اقدامات و مهلت‌ها، مدیریت اسناد و مصوبات، سبد پروژه‌ها، حاکمیت داده، دفتر کاربردهای هوش مصنوعی و گزارش‌های هوشمند.
              <div className="mt-3 grid sm:grid-cols-3 gap-2">
                <div className="rounded-lg bg-background/80 border p-3 text-xs leading-5"><b className="text-emerald-700 dark:text-emerald-400">۱. ببینید</b> — هر روز میزکار خود را مرور کنید تا بدانید چه چیزی به شما مربوط است.</div>
                <div className="rounded-lg bg-background/80 border p-3 text-xs leading-5"><b className="text-emerald-700 dark:text-emerald-400">۲. انجام دهید</b> — پیشرفت، شواهد و خروجی‌ها را همان‌جا ثبت کنید.</div>
                <div className="rounded-lg bg-background/80 border p-3 text-xs leading-5"><b className="text-emerald-700 dark:text-emerald-400">۳. پیگیری شوید</b> — سامانه یادآور می‌دهد، مسئول بررسی تأیید می‌کند و شورا نتیجه را می‌بیند.</div>
              </div>
            </CardContent>
          </Card>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-bold flex items-center gap-2"><Rocket className="h-4 w-4 text-emerald-700 dark:text-emerald-400" /> پنج قدم اول — این‌ها را به‌ترتیب انجام دهید</h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-1.5 w-28 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${donePct}%` }} />
                </div>
                {faNumPct(donePct)} تکمیل
              </div>
            </div>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {QUICK_START.map((s, i) => {
                const done = checked.includes(i);
                return (
                  <Card key={i} id={`qs-${i}`} className={cn("bg-card transition-colors", done && "border-emerald-300 dark:border-emerald-800")}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={done}
                          onCheckedChange={() => toggleCheck(i)}
                          aria-label={`انجام شد: ${s.title}`}
                          className="mt-0.5 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                        />
                        <div className="min-w-0 space-y-1.5">
                          <div className={cn("font-bold text-sm", done && "line-through text-muted-foreground")}>{s.title}</div>
                          <p className="text-xs text-muted-foreground leading-5">{s.text}</p>
                          {s.module && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setModule(s.module!)}>
                              برو به بخش <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <Card className="bg-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber-500" /> سه نکته طلایی</CardTitle></CardHeader>
              <CardContent className="text-xs space-y-2.5 leading-6">
                <p>• <b>هرکس فقط کار خودش را می‌بیند:</b> منوها و داده‌ها بر اساس نقش و واحد شما فیلتر می‌شوند؛ این محدودیت عمدی است، نقص نیست.</p>
                <p>• <b>مهلت‌ها نسبی‌اند:</b> «روز ۳۰ از ابلاغ» یعنی ۳۰ روز پس از تاریخ مبدأ؛ در نوار بالا شماره روز امروز برنامه را می‌بینید.</p>
                <p>• <b>ثبت به‌موقع = گزارش معتبر:</b> هر تأخیر را با علت ثبت کنید؛ سامانه صادق‌گزارشی را اجباری می‌کند.</p>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ArrowDown className="h-4 w-4 text-emerald-700 dark:text-emerald-400" /> به کدام تب بروم؟</CardTitle></CardHeader>
              <CardContent className="text-xs space-y-2.5 leading-6">
                <p>• <b>ماژول‌ها:</b> توضیح تک‌تک منوهای سامانه — چون هست، چه‌کسی می‌بیند، چطور استفاده کند.</p>
                <p>• <b>قابلیت‌ها:</b> دستیار هوشمند، اعلان‌ها، جست‌وجو، تم و محدوده داده.</p>
                <p>• <b>نقش‌ها و دسترسی:</b> ۱۶ نقش رسمی و دقیقاً هرکدام چه می‌بیند و چه می‌تواند بکند.</p>
                <p>• <b>واژه‌نامه:</b> معنی اصطلاح‌های تخصصی برنامه.</p>
                <p>• <b>پرسش‌های متداول:</b> پاسخ کاربردی به سؤال‌های رایج («چگونه…؟»، «چرا…؟»).</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─────────── تب ۲: ماژول‌ها ─────────── */}
        <TabsContent value="modules" className="space-y-3">
          <p className="text-sm text-muted-foreground leading-6 mb-1">
            توضیح ساده هر ۱۷ ماژول سامانه: کاربرد آن، چه‌کسی آن را می‌بیند، قدم‌به‌قدم استفاده و نکته‌های کاربردی. روی هر کارت کلیک کنید تا باز شود.
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            {MODULE_GUIDES.map((m) => {
              const Icon = m.icon;
              return (
                <Card key={m.id} id={m.id} className="bg-card">
                  <Accordion type="single" collapsible>
                    <AccordionItem value={m.id} className="border-0">
                      <AccordionTrigger className="px-4 py-3.5 hover:no-underline">
                        <div className="flex items-center gap-3 text-right w-full">
                          <span className="h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <Icon className="h-[18px] w-[18px]" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-bold">{m.title}</div>
                            <div className="text-[11px] text-muted-foreground font-normal line-clamp-1">{m.purpose}</div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 space-y-3">
                        <div className="text-xs leading-6 text-foreground/90">{m.purpose}</div>
                        <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
                          {m.whoSee.startsWith("همه") ? <Eye className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <EyeOff className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
                          <span><b>چه‌کسی می‌بیند:</b> {m.whoSee}</span>
                        </div>
                        <div>
                          <div className="text-xs font-bold mb-1.5 flex items-center gap-1.5"><ClipboardCheck className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" /> قدم‌به‌قدم</div>
                          <ol className="space-y-1.5">
                            {m.steps.map((s, i) => (
                              <li key={i} className="flex gap-2 text-xs leading-6 text-muted-foreground">
                                <span className="h-5 w-5 rounded-full bg-muted text-foreground text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">{faNum(i + 1)}</span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                        {m.tips && m.tips.length > 0 && (
                          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/70 p-2.5 space-y-1">
                            {m.tips.map((t, i) => (
                              <p key={i} className="text-[11px] leading-5 text-amber-900 dark:text-amber-300 flex gap-1.5">
                                <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {t}
                              </p>
                            ))}
                          </div>
                        )}
                        {m.jump && (
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setModule(m.jump!)}>
                            رفتن به این بخش <ChevronLeft className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ─────────── تب ۳: قابلیت‌ها ─────────── */}
        <TabsContent value="features" className="space-y-3">
          <p className="text-sm text-muted-foreground leading-6 mb-1">
            قابلیت‌های همیشگی که در همه بخش‌های سامانه همراه شما هستند.
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            {FEATURE_GUIDES.map((f) => {
              const Icon = f.icon;
              return (
                <Card key={f.id} id={f.id} className="bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2.5">
                      <span className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4" />
                      </span>
                      {f.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    <p className="text-xs leading-6 text-muted-foreground">{f.text}</p>
                    <ol className="space-y-1.5">
                      {f.steps.map((s, i) => (
                        <li key={i} className="flex gap-2 text-xs leading-6 text-muted-foreground">
                          <span className="h-5 w-5 rounded-full bg-muted text-foreground text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">{faNum(i + 1)}</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ─────────── تب ۴: نقش‌ها و دسترسی ─────────── */}
        <TabsContent value="roles" className="space-y-5">
          <Card className="bg-card border-emerald-200/60 dark:border-emerald-900/60">
            <CardContent className="p-4 flex flex-col sm:flex-row items-start gap-3">
              <span className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Lock className="h-5 w-5" />
              </span>
              <div className="text-sm leading-7">
                <b>قاعده اصلی دسترسی در سامانه: «پیش‌فرض رد»</b> — هر کاربر فقط اطلاعاتی را می‌بیند که به حوزه وظایف و نقش او مربوط است؛ نه منوی اضافه، نه داده اضافه.
                این قاعده هم در منوها و هم در سطح سرور اعمال می‌شود و تلاش برای دسترسی خارج از محدوده، رد و ثبت می‌گردد.
              </div>
            </CardContent>
          </Card>

          <div>
            <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><Globe className="h-4 w-4 text-emerald-700 dark:text-emerald-400" /> نقش‌های با دید سراسری — کل برنامه را می‌بینند</h2>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {ROLE_GUIDES.filter((r) => r.scope === "global").map((r) => (
                <RoleCard key={r.key} role={r} />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><Building className="h-4 w-4 text-amber-600 dark:text-amber-400" /> نقش‌های با دید واحد سازمانی — فقط حوزه خودشان را می‌بینند</h2>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {ROLE_GUIDES.filter((r) => r.scope === "unit").map((r) => (
                <RoleCard key={r.key} role={r} />
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ─────────── تب ۵: واژه‌نامه ─────────── */}
        <TabsContent value="glossary" className="space-y-3">
          <p className="text-sm text-muted-foreground leading-6 mb-1">
            معنی ساده اصطلاح‌های تخصصی برنامه — به‌ترتیب الفبا.
          </p>
          <Accordion type="single" collapsible className="bg-card border rounded-xl px-4">
            {GLOSSARY.map((g) => (
              <AccordionItem key={g.term} value={`gl-${g.term}`} className="last:border-0">
                <AccordionTrigger id={`gl-${g.term}`} className="text-sm text-right leading-6 hover:no-underline">
                  <span className="flex items-center gap-2">
                    <BookMarked className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    {g.term}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-7">{g.def}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        {/* ─────────── تب ۶: پرسش‌های متداول ─────────── */}
        <TabsContent value="faq" className="space-y-3">
          <p className="text-sm text-muted-foreground leading-6 mb-1">
            پاسخ کاربردی به رایج‌ترین سؤال‌ها — اگر پاسخ شما این‌جا نیست، از دستیار هوشمند بپرسید یا با دبیرخانه تماس بگیرید.
          </p>
          <Accordion type="single" collapsible className="bg-card border rounded-xl px-4">
            {FAQ_ITEMS.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="last:border-0">
                <AccordionTrigger id={`faq-${i}`} className="text-sm text-right leading-6 hover:no-underline">
                  <span className="flex items-start gap-2 text-right">
                    <CircleHelp className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                    {f.q}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-7">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <Card className="bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-900/60">
            <CardContent className="p-4 flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-sm leading-6">
                پاسخ سؤال‌تان را پیدا نکردید؟ <b>دستیار هوشمند دبیرخانه</b> در پایین منوی کناری آماده پاسخ است؛ یا با دبیرخانه شورا تماس بگیرید.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RoleCard({ role }: { role: RoleGuide }) {
  const global = role.scope === "global";
  return (
    <Card id={`r-${role.key}`} className="bg-card">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
              global ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"
            )}>
              {global ? <Crown className="h-4 w-4" /> : <Building className="h-4 w-4" />}
            </span>
            <div className="text-sm font-bold leading-5">{role.name}</div>
          </div>
          <Badge variant="outline" className={cn("text-[10px] shrink-0",
            global ? "border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400" : "border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400")}>
            {global ? "دید سراسری" : "دید واحدی"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-5">{role.desc}</p>
        <div className="rounded-lg bg-muted/60 border p-2 text-[11px] leading-5 text-muted-foreground">
          <b className="text-foreground">توانایی‌ها:</b> {role.can}
        </div>
      </CardContent>
    </Card>
  );
}

function faNumPct(n: number): string {
  return `${faNum(n)}٪`;
}
