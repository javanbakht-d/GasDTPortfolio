"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { useAppStore, type SessionUser } from "@/store/app-store";

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
      const res = await api.post<{ user: SessionUser; expiresAt: string }>("/api/auth/login", { username, password });
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
      {/* معرفی سامانه */}
      <div className="hidden md:flex flex-1 bg-slate-900 text-slate-50 flex-col justify-between p-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, #f59e0b 0, transparent 40%), radial-gradient(circle at 80% 70%, #10b981 0, transparent 45%)" }} />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-xl bg-white flex items-center justify-center overflow-hidden">
              <img src="/nigc-logo.png" alt="لوگوی شرکت ملی گاز ایران" className="h-12 w-12 object-contain" />
            </div>
            <div>
              <div className="text-lg font-bold leading-6">شرکت ملی گاز ایران</div>
              <div className="text-sm text-slate-300">NIGC Digital Transformation &amp; Intelligent Governance</div>
            </div>
          </div>
        </div>
        <div className="relative space-y-6 max-w-lg">
          <h1 className="text-3xl font-bold leading-relaxed">
            سامانه یکپارچه راهبری تحول دیجیتال و حکمرانی هوشمند
          </h1>
          <p className="text-slate-300 leading-8">
            ابزار عملیاتی دبیرخانه شورای راهبری برای مدیریت، راهبری، پایش و گزارش‌دهی
            برنامه اجرایی تحول دیجیتال، حاکمیت داده، هوشمندسازی و هوش مصنوعی —
            بر پایه ۳۷ گام برنامه اقدام و پنج گروه زمانی سند مرجع.
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              "رهگیری ۳۷ گام برنامه",
              "تقویم شمسی و مهلت‌های نسبی",
              "گردش کار تأیید و مصوبات",
              "سبد پروژه‌ها و امتیازدهی متوازن",
              "دفتر ثبت کاربردهای هوش مصنوعی",
              "دستیار هوشمند مستند‌محور",
            ].map((t) => (
              <div key={t} className="flex items-center gap-2 text-slate-200">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-slate-400">
          دسترسی به سامانه محدود به کاربران مجاز است و همه فعالیت‌ها ثبت و ممیزی می‌شود.
        </div>
      </div>

      {/* فرم ورود */}
      <div className="w-full md:w-[460px] flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-sm border-none shadow-lg">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-white border flex items-center justify-center mb-2 md:hidden overflow-hidden">
              <img src="/nigc-logo.png" alt="لوگوی شرکت ملی گاز ایران" className="h-11 w-11 object-contain" />
            </div>
            <CardTitle className="text-xl">ورود به سامانه</CardTitle>
            <CardDescription>با حساب سازمانی خود وارد شوید</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">نام کاربری</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: sec.admin"
                  required
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">گذرواژه</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  dir="ltr"
                  className="text-left"
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                ورود به سامانه
              </Button>
            </form>
            <div className="mt-6 rounded-lg bg-muted p-3 text-xs text-muted-foreground leading-6">
              <div className="font-medium text-foreground mb-1">حساب‌های نمونه (داده اولیه آزمون):</div>
              <div dir="ltr" className="text-left font-mono">admin / sec.admin / secretary / council / itc.mgr / auditor / viewer</div>
              <div dir="ltr" className="text-left font-mono">گذرواژه همه: Nigc@1405</div>
              <div className="mt-1">پس از استقرار عملیاتی، حساب‌های نمونه باید غیرفعال شوند.</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
