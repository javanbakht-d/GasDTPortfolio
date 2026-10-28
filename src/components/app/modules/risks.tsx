"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { api, ApiClientError } from "@/lib/api-client";
import { ModuleHeader, LoadingState, ErrorState, EmptyState } from "@/components/app/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/store/app-store";
import { faNum, faDate } from "@/lib/persian-date-format";
import { PRIORITIES } from "@/lib/constants";
import { Grid3X3, Plus, Pencil, AlertTriangle, ArrowLeftRight, ShieldAlert } from "lucide-react";

// ───────────── انواع ─────────────
type RiskRow = {
  id: string; code: string; title: string; category: string;
  relatedType: string | null; relatedTitle: string | null;
  probability: number; impact: number; owner: string | null;
  preventiveAction: string | null; responsePlan: string | null;
  dueDate: string | null; status: string; sourceRef: string | null;
};

type DeviationRow = {
  id: string; code: string; relatedType: string; relatedId: string; relatedTitle: string;
  cause: string; responsible: string | null; severity: string;
  remedialAction: string | null; remedialDueDate: string | null;
  status: string; detectedAt: string;
};

type PickItem = { id: string; title: string; label: string };

const RISK_CATEGORIES: Record<string, string> = {
  SCHEDULE: "برنامه‌ای", BUDGET: "بودجه‌ای", DATA: "داده", TECHNOLOGY: "فناوری",
  ORGANIZATIONAL: "سازمانی", EXTERNAL: "خارجی",
};
const RISK_STATUSES: Record<string, { label: string; color: string }> = {
  OPEN: { label: "باز", color: "bg-rose-50 text-rose-700 border-rose-200" },
  MONITORING: { label: "در حال پایش", color: "bg-amber-50 text-amber-800 border-amber-200" },
  MITIGATED: { label: "کاهش‌یافته", color: "bg-teal-50 text-teal-800 border-teal-200" },
  CLOSED: { label: "بسته‌شده", color: "bg-slate-100 text-slate-600 border-slate-200" },
};
const RELATED_TYPES: Record<string, string> = { ACTION: "اقدام", PROJECT: "پروژه", DOCUMENT: "سند", GENERAL: "عمومی" };
const DEV_STATUSES: Record<string, { label: string; color: string }> = {
  OPEN: { label: "باز", color: "bg-rose-50 text-rose-700 border-rose-200" },
  REMEDIAL_IN_PROGRESS: { label: "در حال اقدام جبرانی", color: "bg-amber-50 text-amber-800 border-amber-200" },
  RESOLVED: { label: "رفع‌شده", color: "bg-teal-50 text-teal-800 border-teal-200" },
  CLOSED: { label: "بسته‌شده", color: "bg-slate-100 text-slate-600 border-slate-200" },
};

const scoreBand = (score: number) =>
  score >= 15 ? { label: "بحرانی", cls: "bg-rose-100 text-rose-800 border-rose-300", cell: "bg-rose-100/80" } :
  score >= 10 ? { label: "زیاد", cls: "bg-orange-100 text-orange-800 border-orange-300", cell: "bg-orange-100/70" } :
  score >= 5 ? { label: "متوسط", cls: "bg-amber-100 text-amber-800 border-amber-300", cell: "bg-amber-100/70" } :
  { label: "کم", cls: "bg-emerald-50 text-emerald-800 border-emerald-200", cell: "bg-emerald-50/80" };

export function RisksModule() {
  const hasPerm = useAppStore((s) => s.hasPerm);
  const [tab, setTab] = useState("risks");
  const [createRisk, setCreateRisk] = useState(false);
  const [editRisk, setEditRisk] = useState<RiskRow | null>(null);
  const [createDev, setCreateDev] = useState(false);
  const [editDev, setEditDev] = useState<DeviationRow | null>(null);

  const risksQ = useQuery<{ risks: RiskRow[] }>({ queryKey: ["risks"], queryFn: () => api.get("/api/risks") });
  const devsQ = useQuery<{ deviations: DeviationRow[] }>({ queryKey: ["deviations"], queryFn: () => api.get("/api/deviations") });

  const risks = risksQ.data?.risks ?? [];
  const openRisks = risks.filter((r) => r.status !== "CLOSED");
  const critical = risks.filter((r) => r.probability * r.impact >= 15 && r.status !== "CLOSED");

  // ماتریس ۵×۵ — احتمال (سطر، از ۵ به ۱) × اثر (ستون، ۱ تا ۵)
  const matrix = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of risksQ.data?.risks ?? []) {
      if (r.status === "CLOSED") continue;
      const key = `${r.probability}-${r.impact}`;
      m[key] = (m[key] ?? 0) + 1;
    }
    return m;
  }, [risksQ.data]);

  const deviations = devsQ.data?.deviations ?? [];
  const openDevs = deviations.filter((d) => d.status === "OPEN" || d.status === "REMEDIAL_IN_PROGRESS");

  return (
    <div className="p-4 lg:p-6">
      <ModuleHeader
        title="ریسک‌ها و انحرافات"
        description="ثبت و پایش ریسک‌های برنامه با ماتریس احتمال × اثر، و پیگیری انحرافات مهلت‌ها با علت، مسئول، شدت اثر و اقدام جبرانی الزامی."
      >
        {tab === "risks" && hasPerm("risks:manage") && (
          <Button size="sm" onClick={() => setCreateRisk(true)}><Plus className="h-4 w-4 ml-1" /> ریسک جدید</Button>
        )}
        {tab === "deviations" && hasPerm("deviations:manage") && (
          <Button size="sm" onClick={() => setCreateDev(true)}><Plus className="h-4 w-4 ml-1" /> ثبت انحراف</Button>
        )}
      </ModuleHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="risks" className="gap-1.5"><ShieldAlert className="h-4 w-4" /> ریسک‌ها {risksQ.data && <span className="text-[10px] text-muted-foreground">({faNum(risks.length)})</span>}</TabsTrigger>
          <TabsTrigger value="deviations" className="gap-1.5"><ArrowLeftRight className="h-4 w-4" /> انحرافات {devsQ.data && <span className="text-[10px] text-muted-foreground">({faNum(deviations.length)})</span>}</TabsTrigger>
        </TabsList>

        {/* ─────────── تب ریسک‌ها ─────────── */}
        <TabsContent value="risks" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium">
                <Grid3X3 className="h-4 w-4 text-emerald-700" /> ماتریس ریسک — احتمال × اثر ({faNum(openRisks.length)} ریسک باز)
              </div>
              <div className="overflow-x-auto">
                <div className="inline-grid gap-1 min-w-[480px]" style={{ gridTemplateColumns: "3rem repeat(5, minmax(4.2rem, 1fr))" }}>
                  <div />
                  {[1, 2, 3, 4, 5].map((imp) => (
                    <div key={imp} className="text-center text-[11px] font-medium text-muted-foreground pb-1">اثر {faNum(imp)}</div>
                  ))}
                  {[5, 4, 3, 2, 1].map((prob) => (
                    <div key={prob} className="contents">
                      <div className="flex items-center justify-end text-[11px] font-medium text-muted-foreground pl-1">احتمال {faNum(prob)}</div>
                      {[1, 2, 3, 4, 5].map((imp) => {
                        const score = prob * imp;
                        const band = scoreBand(score);
                        const count = matrix[`${prob}-${imp}`] ?? 0;
                        return (
                          <div key={imp} title={`احتمال ${prob} × اثر ${imp} — ${band.label}`}
                            className={`h-11 rounded-md border border-white flex items-center justify-center text-sm font-bold ${band.cell} ${count > 0 ? "ring-2 ring-slate-700/70 text-slate-900" : "text-slate-400"}`}>
                            {count > 0 ? faNum(count) : "·"}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-3 w-4 rounded bg-emerald-50 border border-emerald-200" /> کم (۱–۴)</span>
                <span className="flex items-center gap-1"><span className="h-3 w-4 rounded bg-amber-100 border border-amber-300" /> متوسط (۵–۹)</span>
                <span className="flex items-center gap-1"><span className="h-3 w-4 rounded bg-orange-100 border border-orange-300" /> زیاد (۱۰–۱۴)</span>
                <span className="flex items-center gap-1"><span className="h-3 w-4 rounded bg-rose-100 border border-rose-300" /> بحرانی (۱۵–۲۵)</span>
                {critical.length > 0 && <span className="text-rose-700 font-medium">· {faNum(critical.length)} ریسک بحرانی باز</span>}
              </div>
            </CardContent>
          </Card>

          {risksQ.isLoading && <LoadingState />}
          {risksQ.isError && <ErrorState message="خطا در دریافت ریسک‌ها" onRetry={() => risksQ.refetch()} />}
          {!risksQ.isLoading && !risksQ.isError && risks.length === 0 && (
            <EmptyState title="ریسکی ثبت نشده است" hint="ریسک‌های مستند در سند ابلاغی و ریسک‌های جدید در همین ماژول ثبت می‌شوند." />
          )}

          {risks.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <ScrollArea className="max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>کد</TableHead>
                        <TableHead>عنوان</TableHead>
                        <TableHead>دسته</TableHead>
                        <TableHead>مرتبط با</TableHead>
                        <TableHead className="text-center">احتمال</TableHead>
                        <TableHead className="text-center">اثر</TableHead>
                        <TableHead className="text-center">نمره</TableHead>
                        <TableHead>مسئول</TableHead>
                        <TableHead>وضعیت</TableHead>
                        <TableHead>مهلت</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {risks.map((r) => {
                        const score = r.probability * r.impact;
                        const band = scoreBand(score);
                        const st = RISK_STATUSES[r.status];
                        return (
                          <TableRow key={r.id} className={r.status !== "CLOSED" && score >= 15 ? "bg-rose-50/50" : ""}>
                            <TableCell className="font-mono text-[11px]" dir="ltr">{r.code}</TableCell>
                            <TableCell className="max-w-52"><div className="truncate text-xs" title={r.title}>{r.title}</div></TableCell>
                            <TableCell className="text-xs">{RISK_CATEGORIES[r.category] ?? r.category}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-32">
                              <div className="truncate">{r.relatedTitle || (r.relatedType ? (RELATED_TYPES[r.relatedType] ?? r.relatedType) : "—")}</div>
                            </TableCell>
                            <TableCell className="text-center text-xs">{faNum(r.probability)}</TableCell>
                            <TableCell className="text-center text-xs">{faNum(r.impact)}</TableCell>
                            <TableCell className="text-center">
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${band.cls}`}>{faNum(score)}</span>
                            </TableCell>
                            <TableCell className="text-xs">{r.owner?.trim() || <span className="text-slate-400">—</span>}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${st?.color ?? ""}`}>{st?.label ?? r.status}</span>
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{faDate(r.dueDate)}</TableCell>
                            <TableCell>
                              {hasPerm("risks:manage") && (
                                <Button size="sm" variant="ghost" onClick={() => setEditRisk(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─────────── تب انحرافات ─────────── */}
        <TabsContent value="deviations" className="space-y-4">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex gap-2 leading-5">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>هر انحراف از مهلت باید دارای <b>علت</b>، <b>مسئول</b>، <b>شدت اثر</b> و <b>اقدام جبرانی</b> باشد — ثبت انحراف بدون این چهار رکن پذیرفته نیست.</span>
          </div>

          {devsQ.isLoading && <LoadingState />}
          {devsQ.isError && <ErrorState message="خطا در دریافت انحرافات" onRetry={() => devsQ.refetch()} />}
          {!devsQ.isLoading && !devsQ.isError && deviations.length === 0 && (
            <EmptyState title="انحرافی ثبت نشده است" hint="در صورت انحراف از مهلت اقدامات، انحراف با ذکر علت و اقدام جبرانی ثبت کنید." />
          )}

          <div className="space-y-3">
            {deviations.map((d) => {
              const st = DEV_STATUSES[d.status];
              const sev = PRIORITIES[d.severity];
              const overdueRemedial = d.remedialDueDate && d.status !== "RESOLVED" && d.status !== "CLOSED" && new Date(d.remedialDueDate) < new Date();
              return (
                <Card key={d.id} className={d.status === "OPEN" ? "border-rose-200" : ""}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <div className="h-8 px-2 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-bold shrink-0" dir="ltr">{d.code}</div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium leading-6">{d.relatedTitle}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {d.relatedType === "ACTION" ? "اقدام" : d.relatedType === "PROJECT" ? "پروژه" : "گزارش"} · شناسایی: {faDate(d.detectedAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {sev && <span className="text-xs font-medium">{sev.label}</span>}
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${st?.color ?? ""}`}>{st?.label ?? d.status}</span>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <div className="sm:col-span-2"><span className="text-muted-foreground">علت انحراف: </span><span className="leading-5">{d.cause}</span></div>
                      <div><span className="text-muted-foreground">مسئول رفع: </span><span className="font-medium">{d.responsible?.trim() || <span className="text-rose-600">— ثبت نشده</span>}</span></div>
                      <div>
                        <span className="text-muted-foreground">مهلت اقدام جبرانی: </span>
                        <span className={`font-medium ${overdueRemedial ? "text-rose-600" : ""}`}>{faDate(d.remedialDueDate)}{overdueRemedial ? " (گذشته)" : ""}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-muted-foreground">اقدام جبرانی: </span>
                        {d.remedialAction?.trim() ? <span className="leading-5">{d.remedialAction}</span> : <span className="text-amber-700 font-medium">ثبت نشده — الزامی است</span>}
                      </div>
                    </div>
                    {hasPerm("deviations:manage") && (
                      <div className="flex justify-end pt-1">
                        <Button size="sm" variant="outline" onClick={() => setEditDev(d)}><Pencil className="h-3.5 w-3.5 ml-1" /> پیگیری و اقدام جبرانی</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {createRisk && <CreateRiskDialog onClose={() => setCreateRisk(false)} />}
      {editRisk && <EditRiskDialog risk={editRisk} onClose={() => setEditRisk(null)} />}
      {createDev && <CreateDeviationDialog onClose={() => setCreateDev(false)} />}
      {editDev && <EditDeviationDialog deviation={editDev} onClose={() => setEditDev(null)} />}
    </div>
  );
}

// ───────────── ایجاد ریسک ─────────────
function CreateRiskDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "", category: "SCHEDULE", relatedType: "GENERAL", relatedTitle: "",
    probability: "3", impact: "3", owner: "", preventiveAction: "", responsePlan: "", dueDate: "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => api.post("/api/risks", {
      ...form, probability: Number(form.probability), impact: Number(form.impact),
      dueDate: form.dueDate || undefined, relatedTitle: form.relatedTitle || undefined, owner: form.owner || undefined,
    }),
    onSuccess: () => {
      toast({ title: "ریسک ثبت شد", description: "ریسک جدید در ماتریس و فهرست نمایش داده می‌شود." });
      qc.invalidateQueries({ queryKey: ["risks"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      onClose();
    },
    onError: (e) => toast({ title: "خطا در ثبت ریسک", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">ثبت ریسک جدید</DialogTitle>
          <DialogDescription>ریسک با مختصات احتمال (۱–۵) و اثر (۱–۵) ثبت و در ماتریس قرار می‌گیرد.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="r-title">عنوان ریسک</Label>
            <Input id="r-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="شرح ریسک…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>دسته ریسک</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(RISK_CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>مرتبط با</Label>
              <Select value={form.relatedType} onValueChange={(v) => set("relatedType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(RELATED_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-rel">عنوان مورد مرتبط</Label>
              <Input id="r-rel" value={form.relatedTitle} onChange={(e) => set("relatedTitle", e.target.value)} placeholder="اختیاری — اقدام یا پروژه" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-owner">مسئول ریسک</Label>
              <Input id="r-owner" value={form.owner} onChange={(e) => set("owner", e.target.value)} placeholder="نام یا واحد مسئول" />
            </div>
            <div className="space-y-1.5">
              <Label>احتمال (۱–۵)</Label>
              <Select value={form.probability} onValueChange={(v) => set("probability", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{faNum(n)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>اثر (۱–۵)</Label>
              <Select value={form.impact} onValueChange={(v) => set("impact", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{faNum(n)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-due">مهلت اقدام پاسخ</Label>
              <Input id="r-due" type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} dir="ltr" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="r-prev">اقدام پیشگیرانه</Label>
              <Textarea id="r-prev" rows={2} value={form.preventiveAction} onChange={(e) => set("preventiveAction", e.target.value)} placeholder="اقدام برای کاهش احتمال وقوع…" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="r-resp">طرح پاسخ</Label>
              <Textarea id="r-resp" rows={2} value={form.responsePlan} onChange={(e) => set("responsePlan", e.target.value)} placeholder="واکنش در صورت وقوع ریسک…" />
            </div>
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim()}>{save.isPending ? "در حال ثبت…" : "ثبت ریسک"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── ویرایش ریسک ─────────────
function EditRiskDialog({ risk, onClose }: { risk: RiskRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    status: risk.status, probability: String(risk.probability), impact: String(risk.impact),
    owner: risk.owner ?? "", preventiveAction: risk.preventiveAction ?? "", responsePlan: risk.responsePlan ?? "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => api.patch(`/api/risks/${risk.id}`, {
      status: form.status, probability: Number(form.probability), impact: Number(form.impact),
      owner: form.owner || undefined, preventiveAction: form.preventiveAction || undefined, responsePlan: form.responsePlan || undefined,
    }),
    onSuccess: () => {
      toast({ title: "ریسک به‌روزرسانی شد" });
      qc.invalidateQueries({ queryKey: ["risks"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      onClose();
    },
    onError: (e) => toast({ title: "خطا در به‌روزرسانی ریسک", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">ویرایش ریسک — {risk.title}</DialogTitle>
          <DialogDescription>{risk.code} · تغییر وضعیت یا مختصات ماتریس</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>وضعیت</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(RISK_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="re-owner">مسئول ریسک</Label>
              <Input id="re-owner" value={form.owner} onChange={(e) => set("owner", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>احتمال (۱–۵)</Label>
              <Select value={form.probability} onValueChange={(v) => set("probability", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{faNum(n)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>اثر (۱–۵)</Label>
              <Select value={form.impact} onValueChange={(v) => set("impact", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{faNum(n)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="re-prev">اقدام پیشگیرانه</Label>
            <Textarea id="re-prev" rows={2} value={form.preventiveAction} onChange={(e) => set("preventiveAction", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="re-resp">طرح پاسخ</Label>
            <Textarea id="re-resp" rows={2} value={form.responsePlan} onChange={(e) => set("responsePlan", e.target.value)} />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "در حال ذخیره…" : "ذخیره تغییرات"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── ثبت انحراف ─────────────
function CreateDeviationDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [relatedType, setRelatedType] = useState("ACTION");
  const [relatedId, setRelatedId] = useState("");
  const [form, setForm] = useState({ cause: "", responsible: "", severity: "MEDIUM", remedialAction: "", remedialDueDate: "" });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const actionsQ = useQuery<{ actions: PickItem[] }>({
    queryKey: ["deviation-actions"],
    queryFn: async () => {
      const d = await api.get<{ actions: { id: string; title: string; refStep: number; code: string }[] }>("/api/actions");
      return { actions: d.actions.map((a) => ({ id: a.id, title: a.title, label: `گام ${faNum(a.refStep)} — ${a.title}` })) };
    },
    enabled: relatedType === "ACTION",
  });
  const projectsQ = useQuery<{ projects: PickItem[] }>({
    queryKey: ["deviation-projects"],
    queryFn: async () => {
      const d = await api.get<{ projects: { id: string; title: string; code: string }[] }>("/api/projects");
      return { projects: d.projects.map((p) => ({ id: p.id, title: p.title, label: `${p.code} — ${p.title}` })) };
    },
    enabled: relatedType === "PROJECT",
  });
  const reportsQ = useQuery<{ reports: PickItem[] }>({
    queryKey: ["deviation-reports"],
    queryFn: async () => {
      const d = await api.get<{ reports: { id: string; title: string; code: string }[] }>("/api/reports");
      return { reports: d.reports.map((r) => ({ id: r.id, title: r.title, label: `${r.code} — ${r.title}` })) };
    },
    enabled: relatedType === "REPORT",
  });

  const items = relatedType === "ACTION" ? (actionsQ.data?.actions ?? []) : relatedType === "PROJECT" ? (projectsQ.data?.projects ?? []) : (reportsQ.data?.reports ?? []);
  const selected = items.find((i) => i.id === relatedId);
  const listLoading = relatedType === "ACTION" ? actionsQ.isLoading : relatedType === "PROJECT" ? projectsQ.isLoading : reportsQ.isLoading;

  const save = useMutation({
    mutationFn: () => api.post("/api/deviations", {
      relatedType, relatedId, relatedTitle: selected?.title ?? "",
      cause: form.cause, responsible: form.responsible || undefined, severity: form.severity,
      remedialAction: form.remedialAction || undefined, remedialDueDate: form.remedialDueDate || undefined,
    }),
    onSuccess: () => {
      toast({ title: "انحراف ثبت شد", description: "انحراف در سوابق اقدام مرتبط نیز درج می‌شود." });
      qc.invalidateQueries({ queryKey: ["deviations"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      onClose();
    },
    onError: (e) => toast({ title: "خطا در ثبت انحراف", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">ثبت انحراف از مهلت</DialogTitle>
          <DialogDescription>علت، مسئول، شدت اثر و اقدام جبرانی — چهار رکن الزامی هر انحراف.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>نوع مورد مرتبط</Label>
              <Select value={relatedType} onValueChange={(v) => { setRelatedType(v); setRelatedId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTION">اقدام</SelectItem>
                  <SelectItem value="PROJECT">پروژه</SelectItem>
                  <SelectItem value="REPORT">گزارش</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>مورد مرتبط</Label>
              <Select value={relatedId} onValueChange={setRelatedId} disabled={listLoading}>
                <SelectTrigger><SelectValue placeholder={listLoading ? "در حال بارگذاری…" : "انتخاب کنید…"} /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {items.map((i) => <SelectItem key={i.id} value={i.id}><span className="truncate block max-w-72">{i.label}</span></SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>شدت اثر</Label>
              <Select value={form.severity} onValueChange={(v) => set("severity", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PRIORITIES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-resp">مسئول رفع انحراف</Label>
              <Input id="d-resp" value={form.responsible} onChange={(e) => set("responsible", e.target.value)} placeholder="نام یا واحد مسئول" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-cause">علت انحراف (الزامی)</Label>
            <Textarea id="d-cause" rows={2} value={form.cause} onChange={(e) => set("cause", e.target.value)} placeholder="شرح دقیق علت انحراف از مهلت…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-remedial">اقدام جبرانی</Label>
            <Textarea id="d-remedial" rows={2} value={form.remedialAction} onChange={(e) => set("remedialAction", e.target.value)} placeholder="اقدام جبرانی برای جبران تأخیر…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-due">مهلت اقدام جبرانی</Label>
            <Input id="d-due" type="date" value={form.remedialDueDate} onChange={(e) => set("remedialDueDate", e.target.value)} dir="ltr" className="w-48" />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !relatedId || !form.cause.trim()}>
            {save.isPending ? "در حال ثبت…" : "ثبت انحراف"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── پیگیری انحراف ─────────────
function EditDeviationDialog({ deviation, onClose }: { deviation: DeviationRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    status: deviation.status, responsible: deviation.responsible ?? "", severity: deviation.severity,
    remedialAction: deviation.remedialAction ?? "",
    remedialDueDate: deviation.remedialDueDate ? deviation.remedialDueDate.slice(0, 10) : "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => api.patch(`/api/deviations/${deviation.id}`, {
      status: form.status, responsible: form.responsible || undefined, severity: form.severity,
      remedialAction: form.remedialAction || undefined, remedialDueDate: form.remedialDueDate || undefined,
    }),
    onSuccess: () => {
      toast({ title: "پیگیری انحراف ذخیره شد" });
      qc.invalidateQueries({ queryKey: ["deviations"] });
      onClose();
    },
    onError: (e) => toast({ title: "خطا در ذخیره انحراف", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">پیگیری انحراف — {deviation.relatedTitle}</DialogTitle>
          <DialogDescription>{deviation.code} · علت ثبت‌شده: {deviation.cause}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>وضعیت</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(DEV_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>شدت اثر</Label>
              <Select value={form.severity} onValueChange={(v) => set("severity", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PRIORITIES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="de-resp">مسئول رفع</Label>
              <Input id="de-resp" value={form.responsible} onChange={(e) => set("responsible", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="de-due">مهلت اقدام جبرانی</Label>
              <Input id="de-due" type="date" value={form.remedialDueDate} onChange={(e) => set("remedialDueDate", e.target.value)} dir="ltr" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="de-action">اقدام جبرانی</Label>
            <Textarea id="de-action" rows={3} value={form.remedialAction} onChange={(e) => set("remedialAction", e.target.value)} placeholder="شرح اقدام جبرانی…" />
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
