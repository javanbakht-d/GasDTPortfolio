"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { api, ApiClientError } from "@/lib/api-client";
import { ModuleHeader, LoadingState, ErrorState, EmptyState, AiStatusBadge } from "@/components/app/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppStore } from "@/store/app-store";
import { faNum } from "@/lib/persian-date-format";
import { DOC_CLASSIFICATIONS, RISK_LEVELS } from "@/lib/constants";
import {
  Database, Building2, CircleCheck, XCircle, Plus, ShieldCheck, Info, Bot,
  ArrowLeft, Users, FileCheck2, GraduationCap, ClipboardList, Landmark, Boxes,
} from "lucide-react";

type DataDomain = {
  id: string; code: string; name: string; description: string | null;
  ownerUnit: { name: string } | null; dataOwnerName: string | null; dataCustodianName: string | null;
  classification: string; systems: string | null; qualityStatus: string | null; notes: string | null;
};

type OrgUnitRow = {
  id: string; code: string; name: string; type: string;
  managerName: string | null; dtLiaison: string | null; dataOwner: string | null; dataCustodian: string | null;
  liaisonReported: boolean; dataOwnerReported: boolean; internalBriefingDone: boolean;
  statusReportSubmitted: boolean; maturitySubmitted: boolean; projectsSubmitted: boolean;
  isActive: boolean;
};

type AiAppRow = {
  id: string; code: string; title: string; ownerUnit: { name: string } | null;
  useType: string | null; status: string; riskLevel: string; isRegisteredForOperation: boolean;
};

const UNIT_TYPE_LABELS: Record<string, string> = {
  HQ_DIRECTORATE: "دبیرخانه/ستاد",
  SUBSIDIARY: "شرکت تابعه",
  COMMITTEE: "کمیته",
};

/** شش تعهد اسنادی واحدها بر پایه فرم‌های گام ۲ */
const OBLIGATIONS: { key: keyof OrgUnitRow; label: string; icon: React.ReactNode }[] = [
  { key: "liaisonReported", label: "معرفی رابط تحول دیجیتال (فرم معرفی رابط)", icon: <Users className="h-3.5 w-3.5" /> },
  { key: "dataOwnerReported", label: "معرفی مالک و متولی داده", icon: <Database className="h-3.5 w-3.5" /> },
  { key: "internalBriefingDone", label: "ابلاغ داخلی و جلسه توجیهی", icon: <GraduationCap className="h-3.5 w-3.5" /> },
  { key: "statusReportSubmitted", label: "ارسال گزارش وضعیت موجود (فرم ثبت وضعیت موجود)", icon: <ClipboardList className="h-3.5 w-3.5" /> },
  { key: "maturitySubmitted", label: "خودارزیابی بلوغ دیجیتال", icon: <Landmark className="h-3.5 w-3.5" /> },
  { key: "projectsSubmitted", label: "ارسال فهرست پروژه‌ها (فرم استاندارد پروژه)", icon: <FileCheck2 className="h-3.5 w-3.5" /> },
];

const QUALITY_LABELS: Record<string, { label: string; cls: string }> = {
  GOOD: { label: "مطلوب", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  NEEDS_IMPROVEMENT: { label: "نیازمند بهبود", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  POOR: { label: "ضعیف", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};

export function GovernanceModule() {
  return (
    <div className="p-4 lg:p-6">
      <ModuleHeader
        title="حکمرانی داده و وضعیت موجود"
        description="حوزه‌های داده، پوشش تعهدات اسنادی واحدها (فرم‌های گام ۲) و کاربردهای هوش مصنوعی شناسایی‌شده از وضعیت موجود واحدها — مبنای ثبت در دفتر مرکزی هوش مصنوعی."
      />
      <Tabs defaultValue="domains" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="domains" className="gap-1.5"><Database className="h-4 w-4" /> حوزه‌های داده</TabsTrigger>
          <TabsTrigger value="coverage" className="gap-1.5"><Building2 className="h-4 w-4" /> پوشش تعهدات واحدها</TabsTrigger>
          <TabsTrigger value="ai-apps" className="gap-1.5"><Bot className="h-4 w-4" /> کاربردهای شناسایی‌شده</TabsTrigger>
        </TabsList>

        <TabsContent value="domains"><DomainsTab /></TabsContent>
        <TabsContent value="coverage"><CoverageTab /></TabsContent>
        <TabsContent value="ai-apps"><AiAppsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ───────────── تب ۱: حوزه‌های داده ─────────────
function DomainsTab() {
  const hasPerm = useAppStore((s) => s.hasPerm);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<{ domains: DataDomain[] }>({
    queryKey: ["data-domains"],
    queryFn: () => api.get("/api/data-domains"),
  });

  const domains = data?.domains ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {faNum(domains.length)} حوزه داده ثبت شده — مالک، متولی و طبقه‌بندی هر حوزه باید مشخص و به‌روز باشد.
        </div>
        {hasPerm("governance:manage") && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 ml-1" /> حوزه داده جدید
          </Button>
        )}
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="خطا در دریافت حوزه‌های داده" onRetry={() => refetch()} />}
      {!isLoading && !isError && domains.length === 0 && (
        <EmptyState
          title="حوزه داده‌ای ثبت نشده است"
          hint="حوزه‌های داده کلیدی (مشترکان، شبکه، مالی، …) با مالک و متولی مشخص ثبت شوند."
          action={hasPerm("governance:manage") ? <Button size="sm" onClick={() => setCreateOpen(true)}>ثبت نخستین حوزه</Button> : undefined}
        />
      )}

      {domains.length > 0 && (
        <div className="rounded-lg border bg-white max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-right">کد</TableHead>
                <TableHead className="text-right">نام حوزه</TableHead>
                <TableHead className="text-right">واحد مالک</TableHead>
                <TableHead className="text-right">مالک داده</TableHead>
                <TableHead className="text-right">متولی داده</TableHead>
                <TableHead className="text-right">طبقه‌بندی</TableHead>
                <TableHead className="text-right">کیفیت داده</TableHead>
                <TableHead className="text-right">سامانه‌ها</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((d) => {
                const q = d.qualityStatus ? QUALITY_LABELS[d.qualityStatus] : null;
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-[10px] whitespace-nowrap">{d.code}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{d.name}</div>
                      {d.description && <div className="text-xs text-muted-foreground line-clamp-1">{d.description}</div>}
                    </TableCell>
                    <TableCell className="text-xs">{d.ownerUnit?.name ?? "—"}</TableCell>
                    <TableCell className="text-xs">{d.dataOwnerName ?? <span className="text-amber-700">تعیین نشده</span>}</TableCell>
                    <TableCell className="text-xs">{d.dataCustodianName ?? <span className="text-amber-700">تعیین نشده</span>}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{DOC_CLASSIFICATIONS[d.classification] ?? d.classification}</Badge></TableCell>
                    <TableCell>
                      {q ? <Badge className={`border ${q.cls} text-[10px]`}>{q.label}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs max-w-40"><span className="line-clamp-2">{d.systems ?? "—"}</span></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {createOpen && <NewDomainDialog onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function NewDomainDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "", description: "", ownerUnitId: "none", dataOwnerName: "", dataCustodianName: "",
    classification: "INTERNAL", systems: "",
  });

  const { data: unitsData } = useQuery<{ units: OrgUnitRow[] }>({
    queryKey: ["org-units"],
    queryFn: () => api.get("/api/org-units"),
  });

  const create = useMutation({
    mutationFn: () => api.post("/api/data-domains", {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      ownerUnitId: form.ownerUnitId === "none" ? undefined : form.ownerUnitId,
      dataOwnerName: form.dataOwnerName.trim() || undefined,
      dataCustodianName: form.dataCustodianName.trim() || undefined,
      classification: form.classification,
      systems: form.systems.trim() || undefined,
    }),
    onSuccess: () => {
      toast({ title: "حوزه داده ثبت شد", description: "مالک و متولی داده را در صورت تغییر، به‌روز نگه دارید." });
      qc.invalidateQueries({ queryKey: ["data-domains"] });
      onClose();
    },
    onError: (e) => toast({ title: "خطا در ثبت حوزه داده", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ثبت حوزه داده جدید</DialogTitle>
          <DialogDescription>هر حوزه داده باید مالک (تصمیم‌گیر مسئول داده) و متولی (نگهدارنده عملیاتی) مشخص داشته باشد.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>نام حوزه *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="مثال: داده‌های مشترکان گاز" />
          </div>
          <div className="space-y-1.5">
            <Label>شرح</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="دامنه و محتوای حوزه…" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>واحد مالک</Label>
              <Select value={form.ownerUnitId} onValueChange={(v) => set("ownerUnitId", v)}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="انتخاب واحد" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">واحد کاربر جاری (پیش‌فرض)</SelectItem>
                  {(unitsData?.units ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>طبقه‌بندی</Label>
              <Select value={form.classification} onValueChange={(v) => set("classification", v)}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_CLASSIFICATIONS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>مالک داده (نام)</Label>
              <Input value={form.dataOwnerName} onChange={(e) => set("dataOwnerName", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>متولی داده (نام)</Label>
              <Input value={form.dataCustodianName} onChange={(e) => set("dataCustodianName", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>سامانه‌ها / پایگاه‌های داده مرتبط</Label>
            <Input value={form.systems} onChange={(e) => set("systems", e.target.value)} placeholder="مثال: سامانه مشترکان، پایگاه قراردادها" />
          </div>
        </div>
        <div className="flex justify-start gap-2 mt-2">
          <Button size="sm" disabled={!form.name.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "در حال ثبت…" : "ثبت حوزه"}
          </Button>
          <Button size="sm" variant="outline" onClick={onClose} disabled={create.isPending}>انصراف</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── تب ۲: پوشش تعهدات واحدها (فرم‌های گام ۲) ─────────────
function CoverageTab() {
  const hasPerm = useAppStore((s) => s.hasPerm);
  const [registerOpen, setRegisterOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<{ units: OrgUnitRow[] }>({
    queryKey: ["org-units"],
    queryFn: () => api.get("/api/org-units"),
  });

  const units = (data?.units ?? []).filter((u) => u.isActive);
  const obligationDone = (key: keyof OrgUnitRow) => units.filter((u) => u[key] === true).length;
  const allComplete = units.filter((u) => OBLIGATIONS.every((o) => u[o.key] === true)).length;

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-slate-50 border p-3 text-xs text-muted-foreground flex gap-1.5">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        شش تعهد اسنادی هر واحد بر پایه فرم‌های استاندارد گام ۲ پایش می‌شود (معرفی رابط، مالک/متولی داده، توجیه داخلی، وضعیت موجود، خودارزیابی بلوغ، فهرست پروژه‌ها). اعتبارسنجی ورودی‌های وضعیت موجود از طریق سازوکار تأیید دبیرخانه (ورودی SUBMITTED | VALIDATED | NEEDS_INFO) انجام می‌گیرد.
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge className="bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CircleCheck className="h-3 w-3 ml-1" /> {faNum(allComplete)} از {faNum(units.length)} واحد هر ۶ تعهد را کامل کرده است
          </Badge>
          {OBLIGATIONS.map((o) => (
            <Badge key={o.key} variant="outline" className="gap-1">
              {o.icon} {faNum(obligationDone(o.key))}/{faNum(units.length)}
            </Badge>
          ))}
        </div>
        {hasPerm("ai_registry:create") && (
          <Button size="sm" variant="outline" onClick={() => setRegisterOpen(true)}>
            <Bot className="h-4 w-4 ml-1" /> ثبت کاربرد هوش مصنوعی از وضعیت موجود
          </Button>
        )}
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="خطا در دریافت اطلاعات واحدها" onRetry={() => refetch()} />}
      {!isLoading && !isError && units.length === 0 && <EmptyState title="واحدی یافت نشد" />}

      {units.length > 0 && (
        <div className="rounded-lg border bg-white max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-right sticky right-0 bg-slate-50 min-w-48">واحد سازمانی</TableHead>
                <TableHead className="text-right">نوع</TableHead>
                {OBLIGATIONS.map((o) => (
                  <TableHead key={o.key} className="text-center" title={o.label}>
                    <span className="inline-flex items-center justify-center">{o.icon}</span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((u) => {
                const complete = OBLIGATIONS.every((o) => u[o.key] === true);
                return (
                  <TableRow key={u.id}>
                    <TableCell className="sticky right-0 bg-white">
                      <div className="text-sm font-medium leading-5">{u.name}</div>
                      <div className="text-[10px] text-muted-foreground leading-4">
                        مدیر: {u.managerName ?? "—"}
                        {u.dtLiaison && <> · رابط تحول: {u.dtLiaison}</>}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{UNIT_TYPE_LABELS[u.type] ?? u.type}</Badge></TableCell>
                    {OBLIGATIONS.map((o) => {
                      const done = u[o.key] === true;
                      return (
                        <TableCell key={o.key} className="text-center">
                          <span
                            title={`${o.label}: ${done ? "انجام شده" : "انجام نشده"}`}
                            className={`inline-flex ${done ? "text-emerald-600" : "text-rose-400"}`}
                          >
                            {done ? <CircleCheck className="h-4.5 w-4.5" /> : <XCircle className="h-4.5 w-4.5" />}
                          </span>
                        </TableCell>
                      );
                    })}
                    {complete && (
                      <TableCell className="w-1">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {units.length > 0 && (
        <div className="text-[11px] text-muted-foreground leading-5">
          ستون‌های تعهد به ترتیب: {OBLIGATIONS.map((o) => o.label.split(" (")[0]).join("، ")}.
        </div>
      )}

      {registerOpen && <RegisterAiAppDialog onClose={() => setRegisterOpen(false)} />}
    </div>
  );
}

// ───────────── تب ۳: کاربردهای شناسایی‌شده ─────────────
function AiAppsTab() {
  const setModule = useAppStore((s) => s.setModule);
  const { data, isLoading, isError, refetch } = useQuery<{ applications: AiAppRow[]; stats: { total: number; highRisk: number; withoutOperationApproval: number } }>({
    queryKey: ["ai-applications"],
    queryFn: () => api.get("/api/ai-applications"),
  });

  const apps = data?.applications ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">{faNum(apps.length)} کاربرد شناسایی‌شده</Badge>
          {data?.stats && (
            <>
              <Badge className="bg-rose-50 text-rose-700 border border-rose-200">پرریسک: {faNum(data.stats.highRisk)}</Badge>
              <Badge className="bg-amber-50 text-amber-800 border border-amber-200">بدون مجوز بهره‌برداری: {faNum(data.stats.withoutOperationApproval)}</Badge>
            </>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => setModule("ai-registry")}>
          مدیریت دفتر هوش مصنوعی <ArrowLeft className="h-4 w-4 mr-1" />
        </Button>
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="خطا در دریافت کاربردهای هوش مصنوعی" onRetry={() => refetch()} />}
      {!isLoading && !isError && apps.length === 0 && (
        <EmptyState
          title="کاربردی ثبت نشده است"
          hint="کاربردهای شناسایی‌شده از وضعیت موجود واحدها باید در دفتر مرکزی هوش مصنوعی ثبت شوند (گام ۱۳)."
        />
      )}

      {apps.length > 0 && (
        <div className="rounded-lg border bg-white max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-right">کد</TableHead>
                <TableHead className="text-right">عنوان</TableHead>
                <TableHead className="text-right">واحد مالک</TableHead>
                <TableHead className="text-right">نوع کاربرد</TableHead>
                <TableHead className="text-right">وضعیت</TableHead>
                <TableHead className="text-right">ریسک</TableHead>
                <TableHead className="text-right">مجوز بهره‌برداری</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-[10px] whitespace-nowrap">{a.code}</TableCell>
                  <TableCell className="font-medium text-sm">{a.title}</TableCell>
                  <TableCell className="text-xs">{a.ownerUnit?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs">{a.useType ?? "—"}</TableCell>
                  <TableCell><AiStatusBadge status={a.status} /></TableCell>
                  <TableCell>
                    <Badge className={`border text-[10px] ${a.riskLevel === "HIGH" || a.riskLevel === "CRITICAL" ? "bg-rose-50 text-rose-700 border-rose-200" : a.riskLevel === "MEDIUM" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-emerald-50 text-emerald-800 border-emerald-200"}`}>
                      {RISK_LEVELS[a.riskLevel] ?? a.riskLevel}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {a.isRegisteredForOperation
                      ? <span className="text-emerald-700 text-xs inline-flex items-center gap-1"><CircleCheck className="h-3.5 w-3.5" /> صادر شده</span>
                      : <span className="text-amber-700 text-xs inline-flex items-center gap-1"><XCircle className="h-3.5 w-3.5" /> صادر نشده</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ───────────── دیالوگ ثبت کاربرد هوش مصنوعی از وضعیت موجود ─────────────
function RegisterAiAppDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "", problem: "", useType: "تحلیل داده", providerModel: "",
    inputData: "", outputData: "", dataSources: "", classification: "INTERNAL",
    riskLevel: "MEDIUM", humanOversight: "",
  });

  const create = useMutation({
    mutationFn: () => api.post("/api/ai-applications", {
      title: form.title.trim(),
      problem: form.problem.trim() || undefined,
      useType: form.useType,
      providerModel: form.providerModel.trim() || undefined,
      inputData: form.inputData.trim() || undefined,
      outputData: form.outputData.trim() || undefined,
      dataSources: form.dataSources.trim() || undefined,
      classification: form.classification,
      riskLevel: form.riskLevel,
      humanOversight: form.humanOversight.trim() || undefined,
    }),
    onSuccess: () => {
      toast({
        title: "کاربرد هوش مصنوعی ثبت شد",
        description: "کاربرد در دفتر مرکزی ثبت و در وضعیت «پیشنهادی» قرار گرفت؛ بهره‌برداری رسمی نیازمند ثبت و ارزیابی است.",
      });
      qc.invalidateQueries({ queryKey: ["ai-applications"] });
      onClose();
    },
    onError: (e) => toast({ title: "خطا در ثبت کاربرد", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const USE_TYPES = ["تحلیل داده", "دستیار هوشمند", "بینایی ماشین", "پردازش زبان طبیعی", "خودکارسازی", "سایر"];

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Boxes className="h-5 w-5" /> ثبت کاربرد هوش مصنوعی از وضعیت موجود</DialogTitle>
          <DialogDescription>
            کاربردهای هوش مصنوعی شناسایی‌شده در واحدها باید در دفتر مرکزی ثبت شوند (گام ۱۳) — قاعده «بدون ثبت و ارزیابی، بهره‌برداری ممنوع».
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>عنوان کاربرد *</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="مثال: پیش‌بینی نشتی شبکه با یادگیری ماشین" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>نوع کاربرد</Label>
              <Select value={form.useType} onValueChange={(v) => set("useType", v)}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>{USE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>مدل / ارائه‌دهنده</Label>
              <Input value={form.providerModel} onChange={(e) => set("providerModel", e.target.value)} placeholder="مثال: مدل داخلی — تیم علوم داده" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>مسئله / هدف کاربرد</Label>
            <Textarea value={form.problem} onChange={(e) => set("problem", e.target.value)} rows={2} placeholder="چه مسئله‌ای را حل می‌کند؟" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>داده‌های ورودی</Label>
              <Input value={form.inputData} onChange={(e) => set("inputData", e.target.value)} placeholder="مثال: داده‌های حسگرهای شبکه" />
            </div>
            <div className="space-y-1.5">
              <Label>خروجی‌ها</Label>
              <Input value={form.outputData} onChange={(e) => set("outputData", e.target.value)} placeholder="مثال: احتمال نشتی به تفکیک ناحیه" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>منابع داده</Label>
            <Input value={form.dataSources} onChange={(e) => set("dataSources", e.target.value)} placeholder="سامانه‌ها یا پایگاه‌های مرجع داده…" />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>طبقه‌بندی</Label>
              <Select value={form.classification} onValueChange={(v) => set("classification", v)}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(DOC_CLASSIFICATIONS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>سطح ریسک</Label>
              <Select value={form.riskLevel} onValueChange={(v) => set("riskLevel", v)}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(RISK_LEVELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>نظارت انسانی</Label>
              <Input value={form.humanOversight} onChange={(e) => set("humanOversight", e.target.value)} placeholder="مثال: تأیید کارشناس پیش از اقدام" />
            </div>
          </div>
        </div>
        <div className="flex justify-start gap-2 mt-2">
          <Button size="sm" disabled={!form.title.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "در حال ثبت…" : "ثبت در دفتر هوش مصنوعی"}
          </Button>
          <Button size="sm" variant="outline" onClick={onClose} disabled={create.isPending}>انصراف</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
