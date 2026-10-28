"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { api, ApiClientError } from "@/lib/api-client";
import { ModuleHeader, LoadingState, ErrorState, EmptyState } from "@/components/app/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/store/app-store";
import { faNum, faDate } from "@/lib/persian-date-format";
import { REPORT_TYPES } from "@/lib/constants";
import { CalendarRange, Eye, Plus, FileText, Timer } from "lucide-react";

type ReportRow = {
  id: string; code: string; title: string; reportType: string; period: string | null;
  status: string; summary: string | null; content: string | null; refStep: number | null; createdAt: string;
};
type Schedule = {
  quarterlyWindowDays: number; report90DueDay: number; currentProgramDay: number; report90Status: string;
};

const reportTypeBadge = (t: string) => {
  switch (t) {
    case "MONTHLY": return "bg-teal-50 text-teal-800 border-teal-200";
    case "QUARTERLY": return "bg-violet-50 text-violet-800 border-violet-200";
    case "90DAY": return "bg-amber-50 text-amber-900 border-amber-300";
    case "ANNUAL": return "bg-emerald-50 text-emerald-800 border-emerald-200";
    default: return "bg-slate-100 text-slate-600 border-slate-200";
  }
};
const statusBadge = (s: string) => {
  switch (s) {
    case "DRAFT": return "bg-stone-100 text-stone-700 border-stone-200";
    case "SUBMITTED": return "bg-amber-50 text-amber-800 border-amber-200";
    case "FINAL": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    default: return "bg-slate-100 text-slate-500 border-slate-200";
  }
};
const statusLabel = (s: string) => (s === "DRAFT" ? "پیش‌نویس" : s === "SUBMITTED" ? "ارائه‌شده" : s === "FINAL" ? "نهایی" : s === "NOT_CREATED" ? "ثبت نشده" : s);

export function ReportsModule() {
  const hasPerm = useAppStore((s) => s.hasPerm);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<ReportRow | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<{ reports: ReportRow[]; schedule: Schedule }>({
    queryKey: ["reports"],
    queryFn: () => api.get("/api/reports"),
  });

  const reports = data?.reports ?? [];
  const schedule = data?.schedule;

  return (
    <div className="p-4 lg:p-6">
      <ModuleHeader
        title="گزارش‌های دوره‌ای"
        description="گزارش‌های ماهانه پایش، فصلی، جامع ۹۰روزه و سالانه عملکرد — بر اساس مواعد سند ابلاغی (گام‌های ۲۸، ۳۰ و ۳۱)."
      >
        {hasPerm("reports:create") && (
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 ml-1" /> گزارش جدید</Button>
        )}
      </ModuleHeader>

      {/* تقویم گزارش‌دهی */}
      {schedule && (
        <Card className="mb-5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium">
              <CalendarRange className="h-4 w-4 text-emerald-700" /> تقویم گزارش‌دهی برنامه
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border bg-slate-50/60 p-3">
                <div className="text-[11px] text-muted-foreground">گزارش جامع ۹۰روزه</div>
                <div className="text-sm font-medium mt-1 leading-6">سررسید: روز {faNum(schedule.report90DueDay)} برنامه</div>
                <div className="mt-1.5">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${schedule.report90Status === "NOT_CREATED" ? "bg-amber-50 text-amber-800 border-amber-200" : statusBadge(schedule.report90Status)}`}>
                    {statusLabel(schedule.report90Status)}
                  </span>
                </div>
              </div>
              <div className="rounded-lg border bg-slate-50/60 p-3">
                <div className="text-[11px] text-muted-foreground">گزارش فصلی (گام ۳۱)</div>
                <div className="text-sm font-medium mt-1 leading-6">پنجره ثبت: {faNum(schedule.quarterlyWindowDays)} روز پس از پایان هر فصل</div>
                <div className="text-[11px] text-muted-foreground mt-1.5">در غیر این صورت، تأخیر نیازمند ثبت انحراف است.</div>
              </div>
              <div className="rounded-lg border bg-slate-50/60 p-3">
                <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Timer className="h-3 w-3" /> روز جاری برنامه</div>
                <div className="text-2xl font-bold mt-1 text-emerald-700">{faNum(schedule.currentProgramDay)}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">از تاریخ مبنای ابلاغ (روز صفر)</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="خطا در دریافت گزارش‌ها" onRetry={() => refetch()} />}
      {!isLoading && !isError && reports.length === 0 && (
        <EmptyState title="گزارشی ثبت نشده است" hint="اولین گزارش ماهانه پایش در پایان ماه اول برنامه ثبت می‌شود." />
      )}

      {reports.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <ScrollArea className="max-h-[32rem]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>کد</TableHead>
                    <TableHead>عنوان</TableHead>
                    <TableHead>نوع</TableHead>
                    <TableHead>دوره</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>تاریخ ثبت</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-[11px]" dir="ltr">{r.code}</TableCell>
                      <TableCell className="text-xs font-medium max-w-64"><div className="truncate" title={r.title}>{r.title}</div></TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${reportTypeBadge(r.reportType)}`}>
                          {REPORT_TYPES[r.reportType] ?? r.reportType}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">{r.period?.trim() || "—"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadge(r.status)}`}>
                          {statusLabel(r.status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{faDate(r.createdAt)}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setViewTarget(r)}><Eye className="h-3.5 w-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {viewTarget && <ViewReportDialog report={viewTarget} onClose={() => setViewTarget(null)} />}
      {createOpen && <CreateReportDialog onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function ViewReportDialog({ report, onClose }: { report: ReportRow; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle className="text-base leading-7">{report.title}</DialogTitle>
              <DialogDescription className="mt-1">
                <span dir="ltr" className="font-mono text-[11px]">{report.code}</span>
                {" · "}{REPORT_TYPES[report.reportType] ?? report.reportType}
                {report.period ? ` · دوره: ${report.period}` : ""}
                {" · ثبت: "}{faDate(report.createdAt)}
              </DialogDescription>
            </div>
            <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadge(report.status)}`}>
              {statusLabel(report.status)}
            </span>
          </div>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-190px)] px-6 pb-6">
          <div className="space-y-3">
            {report.summary?.trim() && (
              <div className="rounded-lg bg-slate-50 border p-3 text-xs leading-6 text-slate-700">
                <b>خلاصه مدیریتی:</b> {report.summary}
              </div>
            )}
            {report.content?.trim() ? (
              <div className="text-sm leading-7 whitespace-pre-wrap text-slate-800">{report.content}</div>
            ) : (
              <div className="text-sm text-muted-foreground italic">متن کامل گزارش ثبت نشده است.</div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function CreateReportDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", reportType: "MONTHLY", period: "", summary: "", content: "" });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => api.post("/api/reports", form),
    onSuccess: () => {
      toast({ title: "گزارش ثبت شد (پیش‌نویس)", description: "وضعیت «پیش‌نویس» تا نهایی‌شدن با مرجع مجاز حفظ می‌شود." });
      qc.invalidateQueries({ queryKey: ["reports"] });
      onClose();
    },
    onError: (e) => toast({ title: "خطا در ثبت گزارش", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> ثبت گزارش جدید</DialogTitle>
          <DialogDescription>گزارش با وضعیت «پیش‌نویس» ثبت می‌شود — فقط محتوای واقعی و مستند وارد کنید.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rpt-title">عنوان گزارش</Label>
            <Input id="rpt-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="مثال: گزارش ماهانه پایش — مهر ۱۴۰۵" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>نوع گزارش</Label>
              <Select value={form.reportType} onValueChange={(v) => set("reportType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(REPORT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rpt-period">دوره</Label>
              <Input id="rpt-period" value={form.period} onChange={(e) => set("period", e.target.value)} placeholder="مثال: فصل اول ۱۴۰۵ یا ۱۴۰۵-۰۸" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rpt-summary">خلاصه مدیریتی</Label>
            <Textarea id="rpt-summary" rows={3} value={form.summary} onChange={(e) => set("summary", e.target.value)} placeholder="جمع‌بندی وضعیت، ریسک‌های اصلی و موارد نیازمند تصمیم…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rpt-content">متن گزارش</Label>
            <Textarea id="rpt-content" rows={8} value={form.content} onChange={(e) => set("content", e.target.value)} placeholder="متن کامل گزارش…" />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim()}>
            {save.isPending ? "در حال ثبت…" : "ثبت گزارش"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
