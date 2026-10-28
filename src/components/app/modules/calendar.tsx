"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { ModuleHeader, LoadingState, ErrorState, ActionStatusBadge } from "@/components/app/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppStore } from "@/store/app-store";
import { faNum, faDate, faDateTime, daysUntil, programDay } from "@/lib/persian-date-format";
import { ACTION_GROUPS, CYCLES } from "@/lib/constants";
import { CalendarDays, Flag, CircleDot } from "lucide-react";

type ActionRow = {
  id: string; refStep: number; code: string; title: string; groupKey: string;
  dueStartDay: number | null; dueEndDay: number | null; dueDate: string | null; cycleKey: string | null;
  status: string; progress: number; isOverdue: boolean; isDueSoon: boolean; responsibleUnit: { name: string } | null;
};

type MeetingRow = { id: string; number: number | null; title: string; scheduledAt: string | null; status: string };

export function CalendarModule() {
  const openAction = useAppStore((s) => s.openAction);
  const { data, isLoading, isError, refetch } = useQuery<{ actions: ActionRow[]; baselineDate: string; programDay: number }>({
    queryKey: ["actions"],
    queryFn: () => api.get("/api/actions"),
  });
  const { data: meetingsData } = useQuery<{ meetings: MeetingRow[] }>({
    queryKey: ["meetings"],
    queryFn: () => api.get("/api/meetings"),
  });

  const baseline = data?.baselineDate;

  // تایم‌لاین ۱۲۰ روز از مبنای ابلاغ
  const timelineDays = useMemo(() => {
    const from = -5, to = 120;
    return Array.from({ length: to - from }, (_, i) => from + i);
  }, []);

  if (isLoading) return <div className="p-6"><LoadingState /></div>;
  if (isError || !data) return <div className="p-6"><ErrorState message="خطا در دریافت تقویم" onRetry={() => refetch()} /></div>;

  const pDay = programDay(baseline);
  const scheduledActions = data.actions.filter((a) => a.dueDate);
  const continuousActions = data.actions.filter((a) => a.cycleKey);
  const todayIdx = timelineDays.indexOf(Math.min(120, Math.max(-5, pDay)));

  return (
    <div className="p-4 lg:p-6">
      <ModuleHeader
        title="تقویم، مهلت‌ها و گانت"
        description="مهلت‌های نسبی سند مرجع روی خط زمان ابلاغ — «روز صفر» تاریخ ابلاغ سراسری است و با تغییر تاریخ مبنا، همه سررسیدها بازمحاسبه می‌شوند."
      />

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">خط زمان ۹۰ روزه</TabsTrigger>
          <TabsTrigger value="deadlines">فهرست سررسیدها</TabsTrigger>
          <TabsTrigger value="cyclical">اقدامات چرخه‌ای</TabsTrigger>
          <TabsTrigger value="meetings">جلسات</TabsTrigger>
        </TabsList>

        {/* گانت خط زمان */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Flag className="h-4 w-4 text-emerald-700" />
                خط زمان برنامه — روز صفر تا ۱۲۰ از تاریخ ابلاغ (امروز: روز {faNum(pDay)})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TooltipProvider delayDuration={100}>
                <div className="overflow-x-auto pb-2">
                  <div className="min-w-[900px]">
                    {/* محور روزها */}
                    <div className="flex mb-2 ms-28" dir="ltr">
                      {timelineDays.map((d, i) => (
                        <div key={d} className="flex-1 text-center">
                          {(d % 10 === 0 || d === 0) && (
                            <div className={`text-[9px] ${d === pDay ? "text-emerald-700 font-bold" : "text-muted-foreground"}`}>
                              {d === 0 ? "روز صفر" : `روز ${faNum(d)}`}
                            </div>
                          )}
                          {d === pDay && <div className="h-3 w-0.5 bg-emerald-600 mx-auto -mt-0.5" />}
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      {scheduledActions.map((a) => {
                        const start = Math.max(-5, (a.dueStartDay ?? (a.dueEndDay ?? 0)) - 3);
                        const end = Math.min(120, a.dueEndDay ?? (a.dueStartDay ?? 0) + 3);
                        const leftPct = ((start + 5) / 125) * 100;
                        const widthPct = Math.max(1.2, ((end - start) / 125) * 100);
                        const color = a.isOverdue ? "#e11d48" : a.status === "COMPLETED" || a.status === "APPROVED" || a.status === "CLOSED" ? "#059669" : a.isDueSoon ? "#f59e0b" : "#64748b";
                        return (
                          <Tooltip key={a.id}>
                            <TooltipTrigger asChild>
                              <button onClick={() => openAction(a.id)} className="w-full flex items-center gap-2 text-right hover:bg-slate-50 rounded px-1 py-0.5">
                                <span className="w-28 shrink-0 text-[10px] font-mono text-muted-foreground truncate">گام {faNum(a.refStep)}</span>
                                <span className="flex-1 relative h-4 bg-slate-50 rounded gantt-track">
                                  <span
                                    className="absolute top-0.5 h-3 rounded-full"
                                    style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: color }}
                                    dir="ltr"
                                  />
                                </span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-72">
                              <div className="text-xs font-medium">{a.title}</div>
                              <div className="text-[10px] mt-1">
                                {a.dueStartDay != null && a.dueEndDay != null ? `روز ${faNum(a.dueStartDay)}–${faNum(a.dueEndDay)}` : ""} · سررسید {faDate(a.dueDate)} · {a.responsibleUnit?.name ?? "دبیرخانه"}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </TooltipProvider>
              <div className="flex flex-wrap gap-4 mt-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded bg-slate-500" /> آماده/در حال انجام</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded bg-amber-500" /> سررسید نزدیک</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded bg-rose-600" /> معوق</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded bg-emerald-600" /> تکمیل‌شده</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deadlines">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y max-h-[560px] overflow-y-auto">
                {scheduledActions
                  .sort((a, b) => new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime())
                  .map((a) => {
                    const d = daysUntil(a.dueDate);
                    return (
                      <button key={a.id} onClick={() => openAction(a.id)} className="w-full text-right px-4 py-3 hover:bg-slate-50 flex items-center gap-3">
                        <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${a.isOverdue ? "bg-rose-500" : a.isDueSoon ? "bg-amber-500" : "bg-slate-300"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium line-clamp-1">گام {faNum(a.refStep)} — {a.title}</div>
                          <div className="text-xs text-muted-foreground">{ACTION_GROUPS.find((g) => g.key === a.groupKey)?.label} · {a.responsibleUnit?.name ?? "دبیرخانه"}</div>
                        </div>
                        <div className="text-left shrink-0">
                          <div className="text-sm font-medium">{faDate(a.dueDate)}</div>
                          <div className={`text-xs ${a.isOverdue ? "text-rose-600" : a.isDueSoon ? "text-amber-600" : "text-muted-foreground"}`}>
                            {d != null && d < 0 ? `${faNum(-d)} روز تأخیر` : `${faNum(d ?? 0)} روز مانده`}
                          </div>
                        </div>
                        <ActionStatusBadge status={a.status} className="shrink-0" />
                      </button>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cyclical">
          <div className="grid sm:grid-cols-2 gap-3">
            {continuousActions.map((a) => (
              <button key={a.id} onClick={() => openAction(a.id)} className="text-right rounded-xl border bg-white p-4 hover:border-emerald-600/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge variant="outline" className="text-[10px]">گام {faNum(a.refStep)}</Badge>
                  <Badge className="bg-teal-50 text-teal-700 border-transparent text-[10px]">چرخه {CYCLES[a.cycleKey ?? ""] ?? "مستمر"}</Badge>
                  <ActionStatusBadge status={a.status} />
                </div>
                <div className="text-sm font-medium leading-6">{a.title}</div>
              </button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="meetings">
          <div className="space-y-2">
            {(meetingsData?.meetings ?? []).map((m) => (
              <Card key={m.id} className="shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-teal-700 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium line-clamp-1">
                      {m.number ? `جلسه ${faNum(m.number)} — ` : ""}{m.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{m.scheduledAt ? faDateTime(m.scheduledAt) : "زمان‌بندی نشده"}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === "HELD" ? "bg-emerald-50 text-emerald-700" : m.status === "CANCELED" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                    {m.status === "HELD" ? "برگزارشده" : m.status === "CANCELED" ? "لغوشده" : "برنامه‌ریزی‌شده"}
                  </span>
                </CardContent>
              </Card>
            ))}
            {(meetingsData?.meetings ?? []).length === 0 && <div className="text-sm text-muted-foreground p-4">جلسه‌ای ثبت نشده است.</div>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
