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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/store/app-store";
import { faNum, faDateTime } from "@/lib/persian-date-format";
import { CYCLES } from "@/lib/constants";
import { AlertTriangle, Pencil, Ruler, Target, History, RefreshCw } from "lucide-react";

type Measurement = { id: string; period: string; value: string; note: string | null; recordedAt: string };
type KpiRow = {
  id: string; code: string; name: string;
  definition: string | null; formula: string | null; unit: string | null; dataSource: string | null;
  owner: string | null; baseline: string | null; target: string | null;
  reportingCycle: string | null; dataQuality: string | null;
  needsDefinition: boolean; sourceRef: string | null; lastUpdatedAt: string | null;
  measurements: Measurement[];
};

export function KpisModule() {
  const hasPerm = useAppStore((s) => s.hasPerm);
  const [editTarget, setEditTarget] = useState<KpiRow | null>(null);
  const [baselineTarget, setBaselineTarget] = useState<KpiRow | null>(null);
  const [measureTarget, setMeasureTarget] = useState<KpiRow | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<{ kpis: KpiRow[] }>({
    queryKey: ["kpis"],
    queryFn: () => api.get("/api/kpis"),
  });

  const kpis = data?.kpis ?? [];
  const pending = kpis.filter((k) => k.needsDefinition);
  const withBaseline = kpis.filter((k) => !!k.baseline?.trim());

  return (
    <div className="p-4 lg:p-6">
      <ModuleHeader
        title="شاخص‌های کلیدی عملکرد"
        description="هشت شاخص جدول ۳ سند ابلاغی — تا تعیین تعریف و خط مبنای مصوب، هیچ مقدار فرضی نمایش داده نمی‌شود (قاعده ۲.۵.۹). خط مبنا فقط با مصوبه ثبت می‌شود (گام ۲۶)."
      >
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 ml-1" /> بازخوانی
        </Button>
      </ModuleHeader>

      {!isLoading && !isError && kpis.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">تعداد شاخص‌ها</div>
            <div className="text-2xl font-bold mt-1">{faNum(kpis.length)}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">نیازمند تعریف/مبنا</div>
            <div className="text-2xl font-bold mt-1 text-amber-700 dark:text-amber-400">{faNum(pending.length)}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">خط مبنای مصوب</div>
            <div className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">{faNum(withBaseline.length)}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">اندازه‌گیری ثبت‌شده</div>
            <div className="text-2xl font-bold mt-1">{faNum(kpis.reduce((n, k) => n + k.measurements.length, 0))}</div>
          </CardContent></Card>
        </div>
      )}

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="خطا در دریافت شاخص‌ها" onRetry={() => refetch()} />}
      {!isLoading && !isError && kpis.length === 0 && (
        <EmptyState title="شاخصی ثبت نشده است" hint="شاخص‌های جدول ۳ سند ابلاغی در زمان استقرار بارگذاری می‌شوند." />
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {kpis.map((k) => (
          <Card key={k.id} className={k.needsDefinition ? "border-amber-300 dark:border-amber-800" : ""}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="h-8 px-2 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[11px] font-bold shrink-0" dir="ltr">{k.code}</div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm leading-6">{k.name}</div>
                    {k.sourceRef && <div className="text-[11px] text-muted-foreground mt-0.5">منبع: {k.sourceRef}</div>}
                  </div>
                </div>
                {k.needsDefinition && (
                  <Badge className="bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800 shrink-0">
                    <AlertTriangle className="h-3 w-3 ml-1" /> نیازمند تعیین تعریف یا خط مبنا
                  </Badge>
                )}
              </div>

              <p className={`text-xs leading-6 ${k.definition?.trim() ? "text-foreground" : "text-muted-foreground/80 italic"}`}>
                {k.definition?.trim() || "تعریف ثبت نشده است — تا تعیین تعریف مصوب، شاخص قابل اندازه‌گیری نیست."}
              </p>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <InfoLine label="فرمول محاسبه" value={k.formula} />
                <InfoLine label="واحد" value={k.unit} />
                <InfoLine label="منبع داده" value={k.dataSource} />
                <InfoLine label="مسئول شاخص" value={k.owner} />
                <InfoLine label="چرخه گزارش" value={k.reportingCycle ? (CYCLES[k.reportingCycle] ?? k.reportingCycle) : null} />
                <InfoLine label="کیفیت/اعتبار داده" value={k.dataQuality} />
                <InfoLine label="هدف" value={k.target} />
                <div>
                  <span className="text-muted-foreground">خط مبنا: </span>
                  {k.baseline?.trim()
                    ? <span className="font-medium text-emerald-800 dark:text-emerald-300">{k.baseline}</span>
                    : <span className="text-amber-700 dark:text-amber-400 font-medium">ثبت نشده — نیازمند مصوبه</span>}
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground">آخرین به‌روزرسانی: {k.lastUpdatedAt ? faDateTime(k.lastUpdatedAt) : "—"}</div>

              {k.measurements.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground mb-1.5">
                      <History className="h-3.5 w-3.5" /> اندازه‌گیری‌های اخیر ({faNum(k.measurements.length)})
                    </div>
                    <div className="max-h-32 overflow-y-auto rounded-lg border bg-muted/60 divide-y">
                      {k.measurements.map((m) => (
                        <div key={m.id} className="px-2.5 py-1.5 text-[11px] flex items-center justify-between gap-2">
                          <span className="font-medium shrink-0">{m.period}</span>
                          <span dir="ltr" className="font-bold text-foreground shrink-0">{m.value}{k.unit ? ` ${k.unit}` : ""}</span>
                          <span className="text-muted-foreground truncate">{m.note || "—"}</span>
                          <span className="text-[10px] text-muted-foreground/80 shrink-0">{faDateTime(m.recordedAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {hasPerm("kpis:manage") && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setEditTarget(k)}>
                      <Pencil className="h-3.5 w-3.5 ml-1" /> ویرایش تعریف
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setBaselineTarget(k)}>
                      <Target className="h-3.5 w-3.5 ml-1" /> تعیین خط مبنا
                    </Button>
                  </>
                )}
                {hasPerm("kpis:measure") && (
                  <Button size="sm" variant="outline" onClick={() => setMeasureTarget(k)}>
                    <Ruler className="h-3.5 w-3.5 ml-1" /> ثبت اندازه‌گیری
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editTarget && <DefinitionDialog kpi={editTarget} onClose={() => setEditTarget(null)} />}
      {baselineTarget && <BaselineDialog kpi={baselineTarget} onClose={() => setBaselineTarget(null)} />}
      {measureTarget && <MeasureDialog kpi={measureTarget} onClose={() => setMeasureTarget(null)} />}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      {value?.trim() ? <span className="font-medium">{value}</span> : <span className="text-muted-foreground/80">—</span>}
    </div>
  );
}

function DefinitionDialog({ kpi, onClose }: { kpi: KpiRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    definition: kpi.definition ?? "", formula: kpi.formula ?? "", unit: kpi.unit ?? "",
    dataSource: kpi.dataSource ?? "", owner: kpi.owner ?? "", target: kpi.target ?? "", dataQuality: kpi.dataQuality ?? "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => api.patch(`/api/kpis/${kpi.id}`, form),
    onSuccess: () => {
      toast({ title: "تعریف شاخص ذخیره شد", description: "تغییرات در سوابق ممیزی ثبت می‌شود." });
      qc.invalidateQueries({ queryKey: ["kpis"] });
      onClose();
    },
    onError: (e) => toast({ title: "خطا در ذخیره تعریف", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base">ویرایش تعریف — {kpi.name}</DialogTitle>
          <DialogDescription>تعریف، فرمول و منبع داده شاخص (گام ۲۶). ثبت تعریف بدون مستند ممنوع است.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="k-def">تعریف شاخص</Label>
            <Textarea id="k-def" rows={3} value={form.definition} onChange={(e) => set("definition", e.target.value)} placeholder="تعریف دقیق و قابل اندازه‌گیری…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="k-formula">فرمول محاسبه</Label>
            <Textarea id="k-formula" rows={2} value={form.formula} onChange={(e) => set("formula", e.target.value)} placeholder="مثال: (تعداد سامانه‌های یکپارچه / کل) × ۱۰۰" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="k-unit">واحد</Label>
              <Input id="k-unit" value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="درصد / عدد / …" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-quality">کیفیت/اعتبار داده</Label>
              <Input id="k-quality" value={form.dataQuality} onChange={(e) => set("dataQuality", e.target.value)} placeholder="مثال: گزارش رسمی ماهانه" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-src">منبع داده</Label>
              <Input id="k-src" value={form.dataSource} onChange={(e) => set("dataSource", e.target.value)} placeholder="سامانه یا گزارش مرجع" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-owner">مسئول شاخص</Label>
              <Input id="k-owner" value={form.owner} onChange={(e) => set("owner", e.target.value)} placeholder="نام یا واحد مسئول" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-target">هدف</Label>
              <Input id="k-target" value={form.target} onChange={(e) => set("target", e.target.value)} placeholder="مقدار هدف تا پایان برنامه" />
            </div>
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "در حال ذخیره…" : "ذخیره"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BaselineDialog({ kpi, onClose }: { kpi: KpiRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [baseline, setBaseline] = useState(kpi.baseline ?? "");
  const [approvalRef, setApprovalRef] = useState("");

  const save = useMutation({
    mutationFn: () => api.patch(`/api/kpis/${kpi.id}`, { baseline, baselineApprovalRef: approvalRef }),
    onSuccess: () => {
      toast({ title: "خط مبنا با مرجع تأیید ثبت شد", description: "تعیین خط مبنا تصمیم حاکمیتی است و در سوابق ممیزی ثبت می‌شود." });
      qc.invalidateQueries({ queryKey: ["kpis"] });
      onClose();
    },
    onError: (e) => toast({ title: "خطا در ثبت خط مبنا", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">تعیین خط مبنا — {kpi.name}</DialogTitle>
          <DialogDescription>خط مبنا فقط با مصوبه ثبت می‌شود — گام ۲۶. بدون مرجع تأیید، ثبت ممکن نیست.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-900 dark:text-amber-300 leading-5">
            تعیین یا تغییر خط مبنا یک تصمیم حاکمیتی است؛ شماره مصوبه (صورت‌جلسه شورا یا ابلاغ) باید در فیلد مرجع تأیید ثبت شود و در سوابق ممیزی باقی می‌ماند.
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="k-baseline">خط مبنا</Label>
            <Input id="k-baseline" value={baseline} onChange={(e) => setBaseline(e.target.value)} placeholder="مقدار یا شرح خط مبنا مصوب" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="k-approval">مرجع تأیید (الزامی)</Label>
            <Input id="k-approval" value={approvalRef} onChange={(e) => setApprovalRef(e.target.value)} placeholder="مثال: مصوبه جلسه شورای راهبری شماره ۳" />
          </div>
          {kpi.baseline?.trim() && (
            <div className="text-xs text-muted-foreground">خط مبنای فعلی: <span className="font-medium text-foreground">{kpi.baseline}</span></div>
          )}
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !baseline.trim() || !approvalRef.trim()}>
            {save.isPending ? "در حال ثبت…" : "ثبت با مرجع تأیید"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MeasureDialog({ kpi, onClose }: { kpi: KpiRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [period, setPeriod] = useState("");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");

  const save = useMutation({
    mutationFn: () => api.post(`/api/kpis/${kpi.id}/measurements`, { period, value, note }),
    onSuccess: () => {
      toast({ title: "اندازه‌گیری ثبت شد" });
      qc.invalidateQueries({ queryKey: ["kpis"] });
      onClose();
    },
    onError: (e) => toast({ title: "خطا در ثبت اندازه‌گیری", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">ثبت اندازه‌گیری — {kpi.name}</DialogTitle>
          <DialogDescription>مقدار واقعی اندازه‌گیری‌شده با ذکر دوره — ثبت مقدار فرضی ممنوع است.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="m-period">دوره</Label>
            <Input id="m-period" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="مثال: ۱۴۰۵-۰۸ یا فصل اول ۱۴۰۵" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-value">مقدار</Label>
            <Input id="m-value" value={value} onChange={(e) => setValue(e.target.value)} dir="ltr" placeholder={kpi.unit ? `مقدار (${kpi.unit})` : "مقدار"} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-note">توضیح</Label>
            <Input id="m-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="توضیح اختیاری — منبع داده یا نکات" />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !period.trim() || !value.trim()}>
            {save.isPending ? "در حال ثبت…" : "ثبت اندازه‌گیری"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
