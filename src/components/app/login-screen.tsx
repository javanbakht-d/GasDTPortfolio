"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, AlertCircle, User, Lock, Flame, BarChart3, Workflow, Database, Bot, CalendarDays } from "lucide-react";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { api, ApiClientError } from "@/lib/api-client";
import { useAppStore, type SessionUser } from "@/store/app-store";

const FEATURES = [
  { icon: Workflow, text: "رهگیری ۳۷ گام برنامه اجرایی" },
  { icon: CalendarDays, text: "تقویم شمسی و مهلت‌های نسبی" },
  { icon: ShieldCheck, text: "گردش کار تأیید و مصوبات" },
  { icon: BarChart3, text: "سبد پروژه‌ها و امتیازدهی متوازن" },
  { icon: Database, text: "حاکمیت داده و دفتر وضعیت موجود" },
  { icon: Bot, text: "دستیار هوشمند مستند‌محور" },
];

export function LoginScreen() {
  const setUser = useAppStore((s) => s.setUser);
  const setBaselineDate = useAppStore((s) => s.setBaselineDate);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post<{ user: SessionUser; expiresAt: string }>("/api/auth/login", { username, password });
      const me = await api.get<{ user: SessionUser; baselineDate: string }>("/api/auth/me");
      setUser(me.user);
      setBaselineDate(me.baselineDate);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "خطا در برقراری ارتباط با سامانه");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row" dir="rtl">
      {/* ── معرفی سامانه — پنل برند ── */}
      <div
        className="hidden md:flex flex-1 flex-col justify-between p-10 relative overflow-hidden text-slate-50"
        style={{ background: "linear-gradient(215deg, #052e2a 0%, #0a443c 42%, #0b3546 100%)" }}
      >
        {/* هاله‌های تزئینی */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 22%, rgba(245,158,11,0.16) 0, transparent 38%), radial-gradient(circle at 82% 78%, rgba(16,185,129,0.2) 0, transparent 46%), radial-gradient(circle at 55% 10%, rgba(45,212,191,0.1) 0, transparent 30%)",
          }}
        />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full border border-emerald-300/10 pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 h-52 w-52 rounded-full border border-emerald-300/15 pointer-events-none" />

        <div className="relative flex items-center gap-3">
          <div className="h-14 w-14 rounded-xl bg-white flex items-center justify-center overflow-hidden shadow-lg shadow-black/20">
            <img src="/nigc-logo.png" alt="لوگوی شرکت ملی گاز ایران" className="h-12 w-12 object-contain" />
          </div>
          <div>
            <div className="text-lg font-bold leading-6">شرکت ملی گاز ایران</div>
            <div className="text-xs text-teal-200/70 tracking-wide">NIGC Digital Transformation &amp; Intelligent Governance</div>
          </div>
        </div>

        <div className="relative space-y-6 max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs text-teal-100">
            <Flame className="h-3.5 w-3.5 text-amber-300" />
            نسخه ۲٫۰ برنامه اجرایی ابلاغی
          </div>
          <h1 className="text-[2rem] font-bold leading-[1.7]">
            سامانه یکپارچه راهبری تحول دیجیتال
            <span className="text-teal-300"> و حکمرانی هوشمند</span>
          </h1>
          <p className="text-teal-100/75 leading-8 text-[15px]">
            ابزار عملیاتی دبیرخانه شورای راهبری برای مدیریت، پایش و گزارش‌دهی برنامه اجرایی
            تحول دیجیتال، حاکمیت داده، هوشمندسازی و هوش مصنوعی — بر پایه ۳۷ گام برنامه اقدام
            و پنج گروه زمانی سند مرجع.
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-teal-50/90">
                <span className="h-7 w-7 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center shrink-0">
                  <Icon className="h-3.5 w-3.5 text-teal-300" />
                </span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative space-y-1.5 text-xs text-teal-100/50">
          <div>
            طراح و معمار: <span className="text-teal-200/80">داود جوانبخت</span> — معاون مطالعات آینده‌پژوهی و آینده‌نگاری و دبیر شورای راهبری تحول دیجیتال و حکمرانی هوشمند
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            دسترسی محدود به کاربران مجاز — همه فعالیت‌ها ثبت و ممیزی می‌شود.
          </div>
        </div>
      </div>

      {/* ── فرم ورود ── */}
      <div className="relative w-full md:w-[460px] flex items-center justify-center p-6 bg-background">
        <div className="absolute top-4 left-4 z-10">
          <ThemeToggle />
        </div>

        {/* نوار برند موبایل */}
        <div
          className="md:hidden absolute inset-x-0 top-0 h-28"
          style={{ background: "linear-gradient(200deg, #052e2a 0%, #0a443c 100%)" }}
        >
          <div className="h-full flex items-center justify-center gap-2.5 text-slate-50">
            <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center overflow-hidden">
              <img src="/nigc-logo.png" alt="لوگوی شرکت ملی گاز ایران" className="h-8 w-8 object-contain" />
            </div>
            <div className="text-sm font-bold leading-5">شرکت ملی گاز ایران</div>
          </div>
        </div>

        <Card className="w-full max-w-sm border-none shadow-xl shadow-emerald-950/5 mt-20 md:mt-0 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <CardHeader className="text-center space-y-2 pb-2">
            <CardTitle className="text-2xl font-bold">ورود به سامانه</CardTitle>
            <CardDescription>با حساب سازمانی خود وارد شوید</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">نام کاربری</Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="نام کاربری سازمانی"
                    required
                    dir="ltr"
                    className="text-left pr-9 h-11"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">گذرواژه</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    required
                    dir="ltr"
                    className="text-left pr-9 h-11"
                  />
                </div>
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 text-[15px] bg-gradient-to-l from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 text-white shadow-md shadow-emerald-700/20"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                ورود به سامانه
              </Button>
            </form>
            <p className="mt-6 text-center text-[11px] leading-5 text-muted-foreground">
              در صورت فراموشی گذرواژه با مدیر سامانه تماس بگیرید.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
