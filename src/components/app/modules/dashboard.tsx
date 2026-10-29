"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { ModuleHeader, LoadingState, ErrorState } from "@/components/app/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { faNum, faDate } from "@/lib/persian-date-format";
import { ACTION_GROUPS } from "@/lib/constants";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  RadialBarChart, RadialBar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { CheckCircle2, ListChecks, AlertOctagon, Clock3, FileText, Bot, Briefcase, ShieldAlert, Gavel, TrendingUp, Info } from "lucide-react";

type UnitObligations = {
  liaisonReported: boolean; dataOwnerReported: boolean; internalBriefingDone: boolean;
  statusReportSubmitted: boolean; maturitySubmitted: boolean; projectsSubmitted: boolean;
};

type Dashboard = {
  scope: "GLOBAL" | "UNIT";
  unitName: string | null;
  programDay: number;
  baselineDate: string;
  counts: { total: number; completed: number; inProgress: number; notStarted: number; overdue: number; dueIn7: number; dueIn30: number };
  percentages: { completionPct: number; onTimePct: number | null };
  groups: { group: string; total: number; done: number; active: number; avgProgress: number }[];
  coverage: { liaisonCover: number; dataOwnerCover: number; briefingCover: number; statusReportCover: number; maturityCover: number; projectsCover: number; unitCount: number } | null;
  unitObligations: UnitObligations | null;
  docStatus: { total: number; issued: number; inReview: number; draft: number; approved: number; needsUpload: number };
  aiStatus: { total: number; operational: number; notAssessed: number; highRisk: number; withoutOperationApproval: number };
  projStatus: { total: number; drivers: number; approved: number; scored: number; pending: number };
  riskStatus: { total: number; open: number; high: number; monitoring: number } | null;
  decisionStatus: { total: number; pending: number; overdue: number; done: number } | null;
  milestones: { label: string; day: number; date: string; passed: boolean }[];
};

const GROUP_COLORS: Record<string, string> = {
  IMMEDIATE: "#f59e0b", PHASE_30: "#10b981", PHASE_60: "#0d9488", PHASE_90: "#0f766e", CONTINUOUS: "#64748b",
};

const chartTooltip = {
  contentStyle: { direction: "rtl" as const, fontFamily: "Vazirmatn, Tahoma", borderRadius: 10, fontSize: 12 },
  formatter: (v: number | string) => faNum(v),
};

export function DashboardModule() {
  const { data, isLoading, isError, refetch } = useQuery<Dashboard>({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/api/dashboard"),
  });

  if (isLoading) return <div className="p-6"><LoadingState label="در حال محاسبه شاخص‌ها از پایگاه داده…" /></div>;
  if (isError || !data) return <div className="p-6"><ErrorState message="خطا در دریافت داده‌های داشبورد" onRetry={() => refetch()} /></div>;

  const c = data.counts;
  const groupData = data.groups.map((g) => ({ ...g, label: ACTION_GROUPS.find((x) => x.key === g.group)?.label ?? g.group }));
  const isUnitScope = data.scope === "UNIT";

  const kpiCards = [
    { label: isUnitScope ? "اقدامات در محدوده واحد شما" : "کل گام‌های برنامه", value: c.total, icon: ListChecks, sub: isUnitScope ? "اقدامات واحد یا محول‌شده به شما" : "۳۷ گام سند مرجع + اقدامات افزوده", tone: "bg-muted text-foreground" },
    { label: "تکمیل‌شده", value: c.completed, icon: CheckCircle2, sub: "تأیید، تکمیل یا بسته‌شده", tone: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" },
    { label: "در حال اجرا", value: c.inProgress, icon: TrendingUp, sub: "شامل در حال بررسی و منتظر اطلاعات", tone: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400" },
    { label: "معوق", value: c.overdue, icon: AlertOctagon, sub: "گذشته از سررسید بدون بستن", tone: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400" },
  ];

  return (
    <div className="p-4 lg:p-6">
      <ModuleHeader
        title="داشبورد راهبری کلان"
        description={
          isUnitScope
            ? `نمای محدوده واحد${data.unitName ? ` — ${data.unitName}` : ""} — شاخص‌ها فقط از داده‌های حوزه وظایف شما محاسبه می‌شوند (بدون دسترسی به اطلاعات سایر واحدها).`
            : "نمای کلان برنامه برای مدیرعامل، شورای راهبری و دبیرخانه — همه شاخص‌ها به‌صورت زنده از پایگاه داده محاسبه می‌شوند (بدون مقدار ثابت در کد)."
        }
      />

      {/* اطلاع‌رسانی محدوده داده برای نقش‌های واحد */}
      {isUnitScope && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-300">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="leading-6">
            این داشبورد بر اساس <b>شرح وظایف و واحد سازمانی شما</b> فیلتر شده است — اطلاعات و اقدامات سایر واحدها نمایش داده نمی‌شود. تقویم عمومی برنامه (عطف‌های زمانی) برای همه نقش‌ها مشترک است.
          </div>
        </div>
      )}

      {/* کارت‌های اصلی */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {kpiCards.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${k.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="text-3xl font-bold mt-3">{faNum(k.value)}</div>
                <div className="text-sm font-medium mt-0.5">{k.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{k.sub}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* درصد تحقق و به‌موقع */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              درصد تحقق برنامه
              <UITooltip>
                <TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                <TooltipContent>میانگین پیشرفت ثبت‌شده همه اقدامات (قاعده محاسبه قابل ردیابی — فرمول شاخص در ماژول شاخص‌ها)</TooltipContent>
              </UITooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-28 w-28 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ value: data.percentages.completionPct, fill: "#059669" }]} startAngle={90} endAngle={-270}>
                    <RadialBar background dataKey="value" cornerRadius={12} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center text-xl font-bold">{faNum(data.percentages.completionPct)}٪</div>
              </div>
              <div className="text-sm space-y-1.5">
                <div className="flex items-center justify-between gap-6"><span className="text-muted-foreground">درصد تحقق به‌موقع</span><span className="font-bold">{data.percentages.onTimePct != null ? `${faNum(data.percentages.onTimePct)}٪` : "نیازمند داده"}</span></div>
                <div className="flex items-center justify-between gap-6"><span className="text-muted-foreground">سررسید ۷ روز آینده</span><span className="font-bold text-amber-700 dark:text-amber-400">{faNum(c.dueIn7)}</span></div>
                <div className="flex items-center justify-between gap-6"><span className="text-muted-foreground">سررسید ۳۰ روز آینده</span><span className="font-bold">{faNum(c.dueIn30)}</span></div>
                <div className="flex items-center justify-between gap-6"><span className="text-muted-foreground">روز جاری برنامه</span><span className="font-bold">{faNum(data.programDay)}</span></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* عطف‌های زمانی */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">عطف‌های زمانی کلیدی (گروه‌های پنجگانه سند)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.milestones.map((m) => (
              <div key={m.label} className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${m.passed ? "bg-emerald-500" : "bg-muted"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium line-clamp-1">{m.label}</div>
                  <div className="text-xs text-muted-foreground">روز {faNum(m.day)} — {faDate(m.date)}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${m.passed ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                  {m.passed ? "گذشته" : "پیش‌رو"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="groups" className="space-y-4">
        <TabsList>
          <TabsTrigger value="groups">وضعیت گروه‌های زمانی</TabsTrigger>
          <TabsTrigger value="coverage">{isUnitScope ? "تعهدات واحد شما" : "پوشش تعهدات واحدها"}</TabsTrigger>
          <TabsTrigger value="pillars">ارکان حکمرانی</TabsTrigger>
        </TabsList>

        <TabsContent value="groups">
          <Card>
            <CardContent className="pt-6">
              <div className="h-72" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupData} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tickFormatter={(v) => faNum(v)} allowDecimals={false} />
                    <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 11 }} />
                    <ReTooltip {...chartTooltip} />
                    <Legend formatter={(v) => (v === "done" ? "تکمیل‌شده" : v === "active" ? "فعال" : String(v))} wrapperStyle={{ direction: "rtl", fontFamily: "Vazirmatn", fontSize: 12 }} />
                    <Bar dataKey="done" name="تکمیل‌شده" stackId="a" fill="#059669" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="active" name="فعال" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 mt-4">
                {data.groups.map((g) => (
                  <div key={g.group} className="rounded-lg border p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <span className="h-2 w-2 rounded-full" style={{ background: GROUP_COLORS[g.group] }} />
                      {ACTION_GROUPS.find((x) => x.key === g.group)?.label}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{ACTION_GROUPS.find((x) => x.key === g.group)?.sub}</div>
                    <div className="text-sm mt-2 font-bold">{faNum(g.done)} از {faNum(g.total)}</div>
                    <Progress value={g.avgProgress} className="h-1.5 mt-1.5" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coverage">
          {data.coverage && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">پوشش تعهدات {faNum(data.coverage.unitCount)} واحد سازمانی (گام‌های ۱۱، ۱۲، ۱۴ و ۲۱/۲۲)</CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                {[
                  { label: "معرفی رابط تحول دیجیتال", v: data.coverage.liaisonCover, ref: "شاخص ۲" },
                  { label: "معرفی مالک / متولی داده", v: data.coverage.dataOwnerCover, ref: "شاخص ۲" },
                  { label: "ابلاغ داخلی و جلسه توجیهی", v: data.coverage.briefingCover, ref: "گام ۱۴" },
                  { label: "ارسال وضعیت موجود دیجیتال", v: data.coverage.statusReportCover, ref: "گام ۱۲" },
                  { label: "خودارزیابی بلوغ دیجیتال", v: data.coverage.maturityCover, ref: "گام ۲۲" },
                  { label: "ارسال فهرست پروژه‌ها", v: data.coverage.projectsCover, ref: "گام ۲۱" },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span>{row.label} <span className="text-[10px] text-muted-foreground">({row.ref})</span></span>
                      <span className="font-bold">{faNum(row.v)}٪</span>
                    </div>
                    <Progress value={row.v} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {isUnitScope && data.unitObligations && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">وضعیت شش تعهد مستندشده واحد شما{data.unitName ? ` — ${data.unitName}` : ""} (گام ۱۱)</CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                {[
                  { label: "معرفی رابط تحول دیجیتال", ok: data.unitObligations.liaisonReported, ref: "شاخص ۲" },
                  { label: "معرفی مالک / متولی داده", ok: data.unitObligations.dataOwnerReported, ref: "شاخص ۲" },
                  { label: "ابلاغ داخلی و جلسه توجیهی", ok: data.unitObligations.internalBriefingDone, ref: "گام ۱۴" },
                  { label: "ارسال وضعیت موجود دیجیتال", ok: data.unitObligations.statusReportSubmitted, ref: "گام ۱۲" },
                  { label: "خودارزیابی بلوغ دیجیتال", ok: data.unitObligations.maturitySubmitted, ref: "گام ۲۲" },
                  { label: "ارسال فهرست پروژه‌ها", ok: data.unitObligations.projectsSubmitted, ref: "گام ۲۱" },
                ].map((row) => (
                  <div key={row.label} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${row.ok ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300" : "border-border bg-muted/40 text-muted-foreground"}`}>
                    {row.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <Clock3 className="h-4 w-4 shrink-0" />}
                    <span className="flex-1">{row.label}</span>
                    <span className="text-[10px] text-muted-foreground">({row.ref})</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pillars">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm font-medium mb-3"><FileText className="h-4 w-4 text-teal-700" /> اسناد محوری</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">ابلاغ‌شده</span><b>{faNum(data.docStatus.issued)}</b></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">در بررسی</span><b>{faNum(data.docStatus.inReview)}</b></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">پیش‌نویس</span><b>{faNum(data.docStatus.draft)}</b></div>
                  <div className="flex justify-between text-amber-700 dark:text-amber-400"><span>نیازمند بارگذاری نسخه رسمی</span><b>{faNum(data.docStatus.needsUpload)}</b></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm font-medium mb-3"><Bot className="h-4 w-4 text-teal-700" /> کاربردهای هوش مصنوعی</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">ثبت‌شده در دفتر</span><b>{faNum(data.aiStatus.total)}</b></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">عملیاتی</span><b>{faNum(data.aiStatus.operational)}</b></div>
                  <div className="flex justify-between text-amber-700 dark:text-amber-400"><span>فاقد ارزیابی معتبر</span><b>{faNum(data.aiStatus.notAssessed)}</b></div>
                  <div className="flex justify-between text-rose-700 dark:text-rose-400"><span>ریسک بالا بدون مجوز بهره‌برداری</span><b>{faNum(data.aiStatus.withoutOperationApproval)}</b></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm font-medium mb-3"><Briefcase className="h-4 w-4 text-teal-700" /> سبد پروژه‌ها</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">کل پروژه‌ها</span><b>{faNum(data.projStatus.total)}</b></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">پیشران‌ها</span><b>{faNum(data.projStatus.drivers)}</b></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">امتیازدهی‌شده</span><b>{faNum(data.projStatus.scored)}</b></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">مصوب/در اجرا</span><b>{faNum(data.projStatus.approved)}</b></div>
                </div>
              </CardContent>
            </Card>
            {data.riskStatus && data.decisionStatus && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm font-medium mb-3"><ShieldAlert className="h-4 w-4 text-teal-700" /> ریسک‌ها و مصوبات</div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">ریسک باز</span><b>{faNum(data.riskStatus.open)}</b></div>
                    <div className="flex justify-between text-rose-700 dark:text-rose-400"><span>ریسک شدید (امتیاز ≥۱۵)</span><b>{faNum(data.riskStatus.high)}</b></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">مصوبات در انتظار اقدام</span><b>{faNum(data.decisionStatus.pending)}</b></div>
                    <div className="flex justify-between text-rose-700 dark:text-rose-400"><span>مصوبات معوق</span><b>{faNum(data.decisionStatus.overdue)}</b></div>
                  </div>
                </CardContent>
              </Card>
            )}
            {!data.riskStatus && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm font-medium mb-3"><ShieldAlert className="h-4 w-4 text-teal-700" /> ریسک‌ها و مصوبات</div>
                  <p className="text-xs text-muted-foreground leading-6">سجل ریسک‌ها و مصوبات شورای راهبری در محدوده اطلاعاتی نقش‌های دبیرخانه و شوراست — بر اساس شرح وظایف شما نمایش داده نمی‌شود.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
