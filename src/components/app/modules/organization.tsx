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
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/store/app-store";
import { faNum } from "@/lib/persian-date-format";
import { CheckCircle2, XCircle, Pencil, Building2, ShieldCheck } from "lucide-react";

type OrgUnitRow = {
  id: string; code: string; name: string; type: string;
  managerName: string | null; dtLiaison: string | null; dataOwner: string | null; dataCustodian: string | null;
  liaisonReported: boolean; dataOwnerReported: boolean; internalBriefingDone: boolean;
  statusReportSubmitted: boolean; maturitySubmitted: boolean; projectsSubmitted: boolean;
  isActive: boolean;
  parent: { name: string } | null;
  _count: { users: number; actions: number; projects: number };
};

const UNIT_TYPES: Record<string, string> = {
  COMMITTEE: "دبیرخانه شورای راهبری",
  DEPUTY: "معاونت",
  HQ_DIRECTORATE: "مدیریت ستادی",
  INDEPENDENT_OFFICE: "امور مستقل",
  STAFF_COMPANY: "شرکت ستادی",
  PROVINCIAL_GAS: "شرکت گاز استانی",
  REFINERY: "شرکت پالایش گاز",
  OPS_REGION: "منطقه عملیات انتقال گاز",
  SUBSIDIARY: "شرکت تابعه",
};

/** ترتیب گروه‌های ساختار رسمی شرکت ملی گاز ایران */
const UNIT_TYPE_ORDER = ["COMMITTEE", "DEPUTY", "HQ_DIRECTORATE", "INDEPENDENT_OFFICE", "STAFF_COMPANY", "PROVINCIAL_GAS", "REFINERY", "OPS_REGION", "SUBSIDIARY"];

/** شش تعهد پوشش هر واحد — گردآوری ۹ پرچم مدل داده در ۶ تعهد سند ابلاغی (گام ۱۱) */
const OBLIGATIONS: { key: string; label: string; check: (u: OrgUnitRow) => boolean }[] = [
  { key: "liaison", label: "معرفی رابط تحول", check: (u) => !!u.dtLiaison?.trim() },
  { key: "dataOwners", label: "مالک و متولی داده", check: (u) => !!u.dataOwner?.trim() && !!u.dataCustodian?.trim() },
  { key: "briefing", label: "توجیه داخلی", check: (u) => u.internalBriefingDone },
  { key: "reports", label: "گزارش معرفی‌ها", check: (u) => u.liaisonReported && u.dataOwnerReported },
  { key: "status", label: "گزارش وضعیت موجود", check: (u) => u.statusReportSubmitted },
  { key: "maturityProjects", label: "خودارزیابی بلوغ و فهرست پروژه‌ها", check: (u) => u.maturitySubmitted && u.projectsSubmitted },
];

const coverageOf = (u: OrgUnitRow) => OBLIGATIONS.reduce((n, o) => n + (o.check(u) ? 1 : 0), 0);

export function OrganizationModule() {
  const hasPerm = useAppStore((s) => s.hasPerm);
  const [editing, setEditing] = useState<OrgUnitRow | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const { data, isLoading, isError, refetch } = useQuery<{ units: OrgUnitRow[] }>({
    queryKey: ["org-units"],
    queryFn: () => api.get("/api/org-units"),
  });

  const units = data?.units ?? [];
  const fullCoverage = units.filter((u) => coverageOf(u) === OBLIGATIONS.length).length;
  const activeCount = units.filter((u) => u.isActive).length;

  // فیلتر نوع واحد + گروه‌بندی مطابق ساختار رسمی NIGC
  const filtered = typeFilter === "ALL" ? units : units.filter((u) => u.type === typeFilter);
  const grouped = UNIT_TYPE_ORDER
    .map((t) => ({ type: t, items: filtered.filter((u) => u.type === t) }))
    .filter((g) => g.items.length > 0);
  const typesPresent = UNIT_TYPE_ORDER.filter((t) => units.some((u) => u.type === t));

  return (
    <div className="p-4 lg:p-6">
      <ModuleHeader
        title="چارت سازمانی و حکمرانی داده"
        description="واحدهای سازمانی، نقش‌های حکمرانی داده (رابط تحول، مالک داده، متولی داده) و پایش شش تعهد مستندشده هر واحد در سند ابلاغی — بدون درج نام‌های فرضی."
      >
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <ShieldCheck className="h-4 w-4 ml-1" /> بازخوانی
        </Button>
      </ModuleHeader>

      {/* خلاصه پوشش */}
      {!isLoading && !isError && units.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">تعداد واحدها</div>
            <div className="text-2xl font-bold mt-1">{faNum(units.length)}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">واحدهای فعال</div>
            <div className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">{faNum(activeCount)}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">پوشش کامل ۶ تعهد</div>
            <div className="text-2xl font-bold mt-1 text-teal-700">{faNum(fullCoverage)} <span className="text-sm font-normal text-muted-foreground">از {faNum(units.length)}</span></div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">رابط تحول معرفی‌شده</div>
            <div className="text-2xl font-bold mt-1">{faNum(units.filter((u) => !!u.dtLiaison?.trim()).length)}</div>
          </CardContent></Card>
        </div>
      )}

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="خطا در دریافت واحدهای سازمانی" onRetry={() => refetch()} />}
      {!isLoading && !isError && units.length === 0 && (
        <EmptyState title="واحدی ثبت نشده است" hint="واحدهای سازمانی در زمان استقرار سامانه بارگذاری می‌شوند." />
      )}

      {/* فیلتر گروه‌های ساختاری */}
      {!isLoading && !isError && units.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setTypeFilter("ALL")}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${typeFilter === "ALL" ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}
          >
            همه واحدها ({faNum(units.length)})
          </button>
          {typesPresent.map((t) => {
            const n = units.filter((u) => u.type === t).length;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${typeFilter === t ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}
              >
                {UNIT_TYPES[t] ?? t} ({faNum(n)})
              </button>
            );
          })}
        </div>
      )}

      {grouped.map((g) => (
        <div key={g.type} className="space-y-3 mb-6">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold">{UNIT_TYPES[g.type] ?? g.type}</h3>
            <Badge variant="outline" className="text-[10px] font-normal">{faNum(g.items.length)} واحد</Badge>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {g.items.map((u) => {
              const cov = coverageOf(u);
              return (
            <Card key={u.id} className={!u.isActive ? "opacity-70" : ""}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0"><Building2 className="h-4 w-4 text-muted-foreground" /></div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm leading-6">{u.name}</div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        <Badge variant="outline" className="font-mono text-[10px]">{u.code}</Badge>
                        <span>{UNIT_TYPES[u.type] ?? u.type}</span>
                        {u.parent && <span>· تابع: {u.parent.name}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge className={
                      cov === OBLIGATIONS.length ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900" :
                      cov >= 3 ? "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900" : "bg-muted text-muted-foreground border-border"
                    } variant="outline">
                      پوشش تعهدات: {faNum(cov)}/{faNum(OBLIGATIONS.length)}
                    </Badge>
                    {!u.isActive && <Badge variant="outline" className="text-[10px] bg-zinc-100 text-zinc-600">غیرفعال</Badge>}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div><span className="text-muted-foreground">مدیر: </span><span className="font-medium">{u.managerName?.trim() || <span className="text-muted-foreground/80">— ثبت نشده</span>}</span></div>
                  <div><span className="text-muted-foreground">رابط تحول: </span><span className="font-medium">{u.dtLiaison?.trim() || <span className="text-muted-foreground/80">— ثبت نشده</span>}</span></div>
                  <div><span className="text-muted-foreground">مالک داده: </span><span className="font-medium">{u.dataOwner?.trim() || <span className="text-muted-foreground/80">— ثبت نشده</span>}</span></div>
                  <div><span className="text-muted-foreground">متولی داده: </span><span className="font-medium">{u.dataCustodian?.trim() || <span className="text-muted-foreground/80">— ثبت نشده</span>}</span></div>
                </div>

                <div className="rounded-lg border bg-muted/60 p-2.5">
                  <div className="text-[11px] font-medium text-muted-foreground mb-2">شش تعهد مستندشده (گام ۱۱)</div>
                  <div className="grid sm:grid-cols-2 gap-x-3 gap-y-1.5">
                    {OBLIGATIONS.map((o) => {
                      const ok = o.check(u);
                      return (
                        <div key={o.key} className={`flex items-center gap-1.5 text-[11px] ${ok ? "text-emerald-800 dark:text-emerald-300" : "text-muted-foreground/80"}`}>
                          {ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
                          <span className="leading-4">{o.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] text-muted-foreground">
                    کاربران {faNum(u._count.users)} · اقدامات {faNum(u._count.actions)} · پروژه‌ها {faNum(u._count.projects)}
                  </div>
                  {hasPerm("org:manage") && (
                    <Button size="sm" variant="outline" onClick={() => setEditing(u)}>
                      <Pencil className="h-3.5 w-3.5 ml-1" /> ویرایش واحد
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
              );
            })}
          </div>
        </div>
      ))}

      {editing && <EditUnitDialog unit={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EditUnitDialog({ unit, onClose }: { unit: OrgUnitRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: unit.name, managerName: unit.managerName ?? "", dtLiaison: unit.dtLiaison ?? "",
    dataOwner: unit.dataOwner ?? "", dataCustodian: unit.dataCustodian ?? "",
    liaisonReported: unit.liaisonReported, dataOwnerReported: unit.dataOwnerReported,
    internalBriefingDone: unit.internalBriefingDone, statusReportSubmitted: unit.statusReportSubmitted,
    maturitySubmitted: unit.maturitySubmitted, projectsSubmitted: unit.projectsSubmitted,
    isActive: unit.isActive,
  });
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => api.patch(`/api/org-units/${unit.id}`, form),
    onSuccess: () => {
      toast({ title: "اطلاعات واحد ذخیره شد", description: "تغییرات در سوابق ممیزی ثبت می‌شود." });
      qc.invalidateQueries({ queryKey: ["org-units"] });
      onClose();
    },
    onError: (e) => toast({ title: "خطا در ذخیره واحد", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  const flagRows: { key: keyof typeof form; label: string }[] = [
    { key: "liaisonReported", label: "گزارش معرفی رابط تحول ثبت شده است" },
    { key: "dataOwnerReported", label: "گزارش معرفی مالک داده ثبت شده است" },
    { key: "internalBriefingDone", label: "ابلاغ داخلی و جلسه توجیهی برگزار شده است" },
    { key: "statusReportSubmitted", label: "گزارش وضعیت موجود ارسال شده است" },
    { key: "maturitySubmitted", label: "خودارزیابی بلوغ دیجیتال ارسال شده است" },
    { key: "projectsSubmitted", label: "فهرست پیشنهادهای پروژه ارسال شده است" },
    { key: "isActive", label: "واحد فعال است" },
  ];

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-base">ویرایش واحد — {unit.name}</DialogTitle>
          <DialogDescription>نقش‌های حکمرانی داده و وضعیت شش تعهد (گام ۱۱) — ثبت نام بدون مدرک ممنوع؛ تنها اسامی واقعی وارد شود.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-180px)] px-6 pb-4">
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="u-name">نام واحد</Label>
                <Input id="u-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-mgr">نام مدیر واحد</Label>
                <Input id="u-mgr" value={form.managerName} onChange={(e) => set("managerName", e.target.value)} placeholder="در صورت نبود، خالی بماند" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-liaison">رابط تحول دیجیتال</Label>
                <Input id="u-liaison" value={form.dtLiaison} onChange={(e) => set("dtLiaison", e.target.value)} placeholder="نام رابط تحول" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-owner">مالک داده</Label>
                <Input id="u-owner" value={form.dataOwner} onChange={(e) => set("dataOwner", e.target.value)} placeholder="نام مالک داده" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-cust">متولی (امین) داده</Label>
                <Input id="u-cust" value={form.dataCustodian} onChange={(e) => set("dataCustodian", e.target.value)} placeholder="نام متولی داده" />
              </div>
            </div>
            <Separator />
            <div className="space-y-2.5">
              {flagRows.map((r) => (
                <div key={r.key} className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
                  <span className="text-xs leading-5">{r.label}</span>
                  <Switch checked={Boolean(form[r.key])} onCheckedChange={(v) => set(r.key, v)} />
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="p-4 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>
            {save.isPending ? "در حال ذخیره…" : "ذخیره تغییرات"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
