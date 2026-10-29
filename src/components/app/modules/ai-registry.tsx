"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { api, ApiClientError } from "@/lib/api-client";
import { ModuleHeader, AiStatusBadge, LoadingState, ErrorState, EmptyState } from "@/components/app/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/store/app-store";
import { faNum, faDate, faDateTime } from "@/lib/persian-date-format";
import { AI_APP_STATUSES, DOC_CLASSIFICATIONS, RISK_LEVELS } from "@/lib/constants";
import {
  Search, Plus, Bot, ShieldAlert, ShieldCheck, Ban, FileQuestion, History,
  CircleCheck, XCircle, Info, Eye, Building2, Cpu, Database, Landmark,
} from "lucide-react";

type AiApp = {
  id: string; code: string; title: string; ownerUnit: { name: string } | null;
  businessOwner: string | null; problem: string | null; useType: string | null;
  businessProcess: string | null; status: string; providerModel: string | null;
  inputData: string | null; outputData: string | null; dataSources: string | null;
  classification: string; riskLevel: string; humanOversight: string | null;
  evaluationResults: string | null; isRegisteredForOperation: boolean;
  lastReviewAt: string | null; constraints: string | null; successMetrics: string | null;
  refStep: number | null; createdAt: string;
};

type AiStats = {
  total: number; byStatus: Record<string, number>; highRisk: number;
  withoutOperationApproval: number; notAssessed: number; needsReview: number;
};

/** چرخه حیات کاربرد هوش مصنوعی — هماهنگ با سرور */
const AI_FLOW: Record<string, string[]> = {
  PROPOSED: ["EVALUATING", "STOPPED"],
  EVALUATING: ["PILOT", "APPROVED", "STOPPED"],
  PILOT: ["APPROVED", "OPERATIONAL", "STOPPED"],
  APPROVED: ["OPERATIONAL", "STOPPED"],
  OPERATIONAL: ["STOPPED", "RETIRED"],
  STOPPED: ["RETIRED"],
  RETIRED: [],
};

const RISK_BADGE: Record<string, string> = {
  LOW: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  MEDIUM: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  HIGH: "bg-orange-50 text-orange-800 border-orange-200",
  CRITICAL: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900",
};

export function AiRegistryModule() {
  const hasPerm = useAppStore((s) => s.hasPerm);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [risk, setRisk] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<{ applications: AiApp[]; stats: AiStats }>({
    queryKey: ["ai-applications"],
    queryFn: () => api.get("/api/ai-applications"),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.applications.filter((a) =>
      (status === "all" || a.status === status) &&
      (risk === "all" || a.riskLevel === risk) &&
      (!q.trim() || a.title.includes(q) || a.code.includes(q) || (a.problem ?? "").includes(q))
    );
  }, [data, status, risk, q]);

  const detailApp = detailId ? data?.applications.find((x) => x.id === detailId) ?? null : null;

  const stats = data?.stats;

  return (
    <div className="p-4 lg:p-6">
      <ModuleHeader
        title="دفتر مرکزی کاربردهای هوش مصنوعی"
        description="ثبت، ارزیابی و صدور مجوز بهره‌برداری کاربردهای هوش مصنوعی (گام ۱۳) — چرخه حیات کنترل‌شده با قواعد حاکمیتی: نظارت انسانی برای کاربردهای پرریسک و ممنوعیت بهره‌برداری بدون ارزیابی."
      >
        {hasPerm("ai_registry:create") && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 ml-1" /> ثبت کاربرد جدید
          </Button>
        )}
      </ModuleHeader>

      {/* قاعده حاکمیتی */}
      <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 mb-4 flex gap-3">
        <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-rose-800 text-sm">بدون ثبت و ارزیابی، بهره‌برداری ممنوع</div>
          <div className="text-xs text-rose-700 dark:text-rose-400 leading-5 mt-1">
            هیچ کاربرد هوش مصنوعی بدون ثبت در این دفتر و ثبت نتایج ارزیابی معتبر نمی‌تواند عملیاتی شود؛ کاربردهای پرریسک علاوه بر ارزیابی، نیازمند تأیید انسانی مستند هستند.
          </div>
        </div>
      </div>

      {/* آمار */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <StatCard label="کل کاربردها" value={stats.total} tone="slate" />
          <StatCard label="پرریسک (زیاد/بحرانی)" value={stats.highRisk} tone="rose" />
          <StatCard label="بدون مجوز بهره‌برداری" value={stats.withoutOperationApproval} tone="amber" hint="در وضعیت آزمایشی/عملیاتی" />
          <StatCard label="ارزیابی‌نشده" value={stats.notAssessed} tone="amber" />
          <StatCard label="بدون بازنگی ثبت‌شده" value={stats.needsReview} tone="slate" />
        </div>
      )}

      {/* توزیع وضعیت */}
      {stats && stats.total > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Landmark className="h-4 w-4" /> توزیع وضعیت کاربردها</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(AI_APP_STATUSES).map(([k, v]) => {
              const count = stats.byStatus[k] ?? 0;
              if (count === 0) return null;
              return (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-32 text-xs text-muted-foreground shrink-0">{v.label}</span>
                  <Progress value={(count / stats.total) * 100} className="h-2 flex-1" />
                  <span className="w-8 text-xs font-medium text-foreground text-left shrink-0">{faNum(count)}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* نوار فیلتر */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جست‌وجوی عنوان، کد یا مسئله…" className="pr-9 bg-card" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44 bg-card"><SelectValue placeholder="وضعیت" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه وضعیت‌ها</SelectItem>
            {Object.entries(AI_APP_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={risk} onValueChange={setRisk}>
          <SelectTrigger className="w-36 bg-card"><SelectValue placeholder="ریسک" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه ریسک‌ها</SelectItem>
            {Object.entries(RISK_LEVELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{faNum(filtered.length)} کاربرد</span>
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="خطا در دریافت کاربردهای هوش مصنوعی" onRetry={() => refetch()} />}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState title="کاربردی مطابق فیلترها یافت نشد" hint="فیلترها را تغییر دهید یا کاربرد جدیدی ثبت کنید." />
      )}

      {filtered.length > 0 && (
        <div className="rounded-lg border bg-card max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 sticky top-0">
              <tr className="text-right text-xs text-muted-foreground">
                <th className="p-3 font-medium">کد</th>
                <th className="p-3 font-medium">عنوان</th>
                <th className="p-3 font-medium">واحد مالک</th>
                <th className="p-3 font-medium">نوع کاربرد</th>
                <th className="p-3 font-medium">ریسک</th>
                <th className="p-3 font-medium">وضعیت</th>
                <th className="p-3 font-medium">آخرین بازنگی</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setDetailId(a.id)}
                  className="border-t cursor-pointer hover:bg-emerald-50/40 dark:hover:bg-emerald-950/40 transition-colors"
                >
                  <td className="p-3 font-mono text-[10px] whitespace-nowrap">{a.code}</td>
                  <td className="p-3">
                    <div className="font-medium leading-5 flex items-center gap-2">
                      {a.title}
                      {!a.isRegisteredForOperation && ["PILOT", "OPERATIONAL"].includes(a.status) && (
                        <Badge className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900 text-[10px]">نیازمند مجوز بهره‌برداری</Badge>
                      )}
                    </div>
                    {a.useType && <div className="text-xs text-muted-foreground">{a.useType}</div>}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{a.ownerUnit?.name ?? "—"}</td>
                  <td className="p-3 text-xs">{a.useType ?? "—"}</td>
                  <td className="p-3">
                    <Badge className={`border text-[10px] ${RISK_BADGE[a.riskLevel] ?? ""}`}>{RISK_LEVELS[a.riskLevel] ?? a.riskLevel}</Badge>
                  </td>
                  <td className="p-3"><AiStatusBadge status={a.status} /></td>
                  <td className="p-3 text-xs whitespace-nowrap">
                    {a.lastReviewAt ? (
                      <span className="text-muted-foreground">{faDate(a.lastReviewAt)}</span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400 inline-flex items-center gap-1"><FileQuestion className="h-3.5 w-3.5" /> بدون بازنگی</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && <NewAiAppDialog onClose={() => setCreateOpen(false)} />}
      {detailId && detailApp && <AiAppDetailDialog app={detailApp} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function StatCard({ label, value, tone, hint }: { label: string; value: number; tone: "slate" | "rose" | "amber"; hint?: string }) {
  const color = tone === "rose" ? "text-rose-700 dark:text-rose-400" : tone === "amber" ? "text-amber-700 dark:text-amber-400" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`text-2xl font-bold ${color}`}>{faNum(value)}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
        {hint && <div className="text-[10px] text-muted-foreground/70 mt-0.5">{hint}</div>}
      </CardContent>
    </Card>
  );
}

// ───────────── دیالوگ ثبت کاربرد جدید ─────────────
const USE_TYPES = ["تحلیل داده", "دستیار هوشمند", "بینایی ماشین", "پردازش زبان طبیعی", "خودکارسازی", "سایر"];

function NewAiAppDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "", problem: "", useType: USE_TYPES[0], providerModel: "",
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
      toast({ title: "کاربرد با موفقیت ثبت شد", description: "کاربرد در وضعیت «پیشنهادی» ثبت شد و وارد چرخه ارزیابی می‌شود." });
      qc.invalidateQueries({ queryKey: ["ai-applications"] });
      onClose();
    },
    onError: (e) => toast({ title: "خطا در ثبت کاربرد", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bot className="h-5 w-5" /> ثبت کاربرد هوش مصنوعی</DialogTitle>
          <DialogDescription>ثبت در دفتر مرکزی شرط هرگونه بهره‌برداری است (گام ۱۳ — «بدون ثبت و ارزیابی، بهره‌برداری ممنوع»).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>عنوان کاربرد *</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="مثال: دستیار هوشمند پاسخ به مشترکان" />
          </div>
          <div className="space-y-1.5">
            <Label>مسئله / هدف کاربرد</Label>
            <Textarea value={form.problem} onChange={(e) => set("problem", e.target.value)} rows={2} placeholder="چه مسئله‌ای را حل می‌کند؟" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>نوع کاربرد</Label>
              <Select value={form.useType} onValueChange={(v) => set("useType", v)}>
                <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>{USE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>مدل / ارائه‌دهنده</Label>
              <Input value={form.providerModel} onChange={(e) => set("providerModel", e.target.value)} dir="ltr" placeholder="مثال: LLM داخلی / مدل متن‌باز" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>داده‌های ورودی</Label>
              <Input value={form.inputData} onChange={(e) => set("inputData", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>خروجی‌ها</Label>
              <Input value={form.outputData} onChange={(e) => set("outputData", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>منابع داده</Label>
            <Input value={form.dataSources} onChange={(e) => set("dataSources", e.target.value)} placeholder="سامانه‌ها یا پایگاه‌های مرجع…" />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>طبقه‌بندی</Label>
              <Select value={form.classification} onValueChange={(v) => set("classification", v)}>
                <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(DOC_CLASSIFICATIONS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>سطح ریسک</Label>
              <Select value={form.riskLevel} onValueChange={(v) => set("riskLevel", v)}>
                <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(RISK_LEVELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>نظارت انسانی</Label>
              <Input value={form.humanOversight} onChange={(e) => set("humanOversight", e.target.value)} placeholder="سازوکار تأیید انسانی…" />
            </div>
          </div>
        </div>
        <div className="flex justify-start gap-2 mt-2">
          <Button size="sm" disabled={!form.title.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "در حال ثبت…" : "ثبت کاربرد"}
          </Button>
          <Button size="sm" variant="outline" onClick={onClose} disabled={create.isPending}>انصراف</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── دیالوگ جزئیات کاربرد — چرخه حیات، ارزیابی، بازنگی ─────────────
// توجه: سرویس فهرست همه فیلدها را برمی‌گرداند و نقطه پایانی GET برای رکورد تکی وجود ندارد — داده از فهرست عبور می‌کند.
function AiAppDetailDialog({ app, onClose }: { app: AiApp; onClose: () => void }) {
  const qc = useQueryClient();
  const hasPerm = useAppStore((s) => s.hasPerm);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [humanApprovalNote, setHumanApprovalNote] = useState("");
  const [manageForm, setManageForm] = useState<{
    riskLevel: string; humanOversight: string; evaluationResults: string;
    constraints: string; successMetrics: string;
  } | null>(null);

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/api/ai-applications/${app.id}`, body),
    onSuccess: (_d, vars) => {
      const v = vars as { status?: string; markReviewed?: boolean };
      if (v.markReviewed) toast({ title: "بازنگی ثبت شد", description: "تاریخ آخرین بازنگی به‌روزرسانی شد." });
      else if (v.status) toast({ title: "وضعیت کاربرد تغییر کرد", description: `وضعیت جدید: ${AI_APP_STATUSES[v.status]?.label ?? v.status}` });
      else toast({ title: "تغییرات ثبت شد" });
      setSelectedStatus(""); setHumanApprovalNote("");
      qc.invalidateQueries({ queryKey: ["ai-applications"] });
    },
    onError: (e) => toast({ title: "خطا در ثبت تغییرات", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  const a = app;
  const nextStatuses = AI_FLOW[a.status] ?? [];
  const selectedIsOperational = selectedStatus === "OPERATIONAL";
  const selectedNeedsApproval = selectedIsOperational && (a.riskLevel === "HIGH" || a.riskLevel === "CRITICAL");
  const operationalBlocked = selectedIsOperational && !a.evaluationResults;

  // مقداردهی اولیه فرم مدیریت از داده فهرست — تا پیش از ویرایش کاربر همگام می‌ماند
  const manageValue = manageForm ?? {
    riskLevel: a.riskLevel, humanOversight: a.humanOversight ?? "",
    evaluationResults: a.evaluationResults ?? "", constraints: a.constraints ?? "",
    successMetrics: a.successMetrics ?? "",
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <>
          <DialogHeader className="p-6 pb-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-base leading-7">{a.title}</DialogTitle>
                  <DialogDescription className="mt-1">
                    <span className="font-mono text-[10px]">{a.code}</span> · {a.useType ?? "—"}
                    {a.ownerUnit && <> · مالک: {a.ownerUnit.name}</>}
                    {a.refStep != null && <> · گام {faNum(a.refStep)}</>}
                  </DialogDescription>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <AiStatusBadge status={a.status} />
                  <Badge className={`border text-[10px] ${RISK_BADGE[a.riskLevel] ?? ""}`}>ریسک {RISK_LEVELS[a.riskLevel] ?? a.riskLevel}</Badge>
                </div>
              </div>
            </DialogHeader>

            <ScrollArea className="max-h-[calc(90vh-190px)] px-6 pb-6">
              <div className="space-y-4">
                {/* پرونده کامل کاربرد */}
                <Card>
                  <CardContent className="p-4 space-y-3 text-sm">
                    <SectionBlock title="مسئله / هدف">{a.problem}</SectionBlock>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <MetaItem icon={<Cpu className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />} label="مدل / ارائه‌دهنده">{a.providerModel ?? "—"}</MetaItem>
                      <MetaItem icon={<Building2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />} label="مالک کسب‌وکار">{a.businessOwner ?? "—"}</MetaItem>
                      <MetaItem icon={<Database className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />} label="داده‌های ورودی">{a.inputData ?? "—"}</MetaItem>
                      <MetaItem icon={<Database className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />} label="خروجی‌ها">{a.outputData ?? "—"}</MetaItem>
                      <MetaItem icon={<Database className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />} label="منابع داده">{a.dataSources ?? "—"}</MetaItem>
                      <MetaItem icon={<Landmark className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />} label="طبقه‌بندی">{DOC_CLASSIFICATIONS[a.classification] ?? a.classification}</MetaItem>
                    </div>
                    <Separator />
                    <div className="grid sm:grid-cols-2 gap-3">
                      <MetaItem icon={<Eye className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />} label="نظارت انسانی">
                        {a.humanOversight ?? <span className="text-amber-700 dark:text-amber-400">ثبت نشده</span>}
                      </MetaItem>
                      <MetaItem icon={<ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />} label="مجوز بهره‌برداری رسمی">
                        {a.isRegisteredForOperation
                          ? <span className="text-emerald-700 dark:text-emerald-400 font-medium inline-flex items-center gap-1"><CircleCheck className="h-3.5 w-3.5" /> صادر شده</span>
                          : <span className="text-amber-700 dark:text-amber-400 font-medium inline-flex items-center gap-1"><XCircle className="h-3.5 w-3.5" /> صادر نشده</span>}
                      </MetaItem>
                      <MetaItem icon={<History className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />} label="آخرین بازنگی">
                        {a.lastReviewAt ? faDateTime(a.lastReviewAt) : <span className="text-amber-700 dark:text-amber-400">بدون بازنگی</span>}
                      </MetaItem>
                      <MetaItem icon={<FileQuestion className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />} label="نتایج ارزیابی">
                        {a.evaluationResults ?? <span className="text-amber-700 dark:text-amber-400">ثبت نشده</span>}
                      </MetaItem>
                    </div>
                    <SectionBlock title="محدودیت‌ها">{a.constraints}</SectionBlock>
                    <SectionBlock title="شاخص‌های موفقیت">{a.successMetrics}</SectionBlock>
                  </CardContent>
                </Card>

                {/* چرخه حیات */}
                {hasPerm("ai_registry:manage") && nextStatuses.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> چرخه حیات کاربرد</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {nextStatuses.map((s) => (
                          <button
                            key={s}
                            onClick={() => setSelectedStatus(s)}
                            className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${selectedStatus === s ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-medium" : "hover:border-border"}`}
                          >
                            {AI_APP_STATUSES[s]?.label ?? s}
                          </button>
                        ))}
                      </div>
                      {selectedStatus && (
                        <div className="space-y-2">
                          {operationalBlocked && (
                            <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-2.5 text-xs text-rose-800 flex gap-1.5">
                              <Ban className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                              بهره‌برداری رسمی نیازمند ثبت نتایج ارزیابی معتبر است — ابتدا نتایج ارزیابی را در بخش مدیریت ثبت کنید («بدون ثبت و ارزیابی، بهره‌برداری ممنوع»).
                            </div>
                          )}
                          {selectedNeedsApproval && !operationalBlocked && (
                            <div className="space-y-1.5">
                              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-2.5 text-xs text-amber-900 dark:text-amber-300 flex gap-1.5">
                                <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                کاربرد پرریسک نیازمند ثبت تأیید انسانی مستند پیش از بهره‌برداری است.
                              </div>
                              <Textarea
                                value={humanApprovalNote}
                                onChange={(e) => setHumanApprovalNote(e.target.value)}
                                rows={2}
                                placeholder="شرح تأیید انسانی (مرجع تأیید، تاریخ، مستندات)… *"
                              />
                            </div>
                          )}
                          <Button
                            size="sm"
                            disabled={patch.isPending || operationalBlocked || (selectedNeedsApproval && !humanApprovalNote.trim())}
                            onClick={() => patch.mutate({
                              status: selectedStatus,
                              ...(selectedNeedsApproval && humanApprovalNote.trim() ? { humanApprovalNote: humanApprovalNote.trim(), humanOversight: humanApprovalNote.trim() } : {}),
                            })}>
                            {patch.isPending ? "در حال ثبت…" : `ثبت انتقال به «${AI_APP_STATUSES[selectedStatus]?.label ?? selectedStatus}»`}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* مدیریت و ارزیابی */}
                {hasPerm("ai_registry:manage") && manageValue && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2"><FileQuestion className="h-4 w-4" /> ارزیابی، ریسک و مجوز بهره‌برداری</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">سطح ریسک</Label>
                          <Select value={manageValue.riskLevel} onValueChange={(v) => setManageForm({ ...manageValue, riskLevel: v })}>
                            <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                            <SelectContent>{Object.entries(RISK_LEVELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">نظارت انسانی</Label>
                          <Input value={manageValue.humanOversight} onChange={(e) => setManageForm({ ...manageValue, humanOversight: e.target.value })} placeholder="سازوکار تأیید انسانی…" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">نتایج ارزیابی (پیش‌نیاز بهره‌برداری رسمی)</Label>
                        <Textarea value={manageValue.evaluationResults} onChange={(e) => setManageForm({ ...manageValue, evaluationResults: e.target.value })} rows={3} placeholder="خلاصه ارزیابی دقت، اثرات جانبی، نتایج آزمایش…" />
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">محدودیت‌ها</Label>
                          <Textarea value={manageValue.constraints} onChange={(e) => setManageForm({ ...manageValue, constraints: e.target.value })} rows={2} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">شاخص‌های موفقیت</Label>
                          <Textarea value={manageValue.successMetrics} onChange={(e) => setManageForm({ ...manageValue, successMetrics: e.target.value })} rows={2} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <div className="text-sm font-medium">مجوز بهره‌برداری رسمی</div>
                          <div className="text-xs text-muted-foreground">تنها با ثبت نتایج ارزیابی معتبر قابل صدور است — سرور این قاعده را اعمال می‌کند.</div>
                        </div>
                        <Switch
                          checked={a.isRegisteredForOperation}
                          disabled={patch.isPending}
                          onCheckedChange={(v) => patch.mutate({ isRegisteredForOperation: v })}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" disabled={patch.isPending || manageForm === null}
                          onClick={() => manageForm && patch.mutate(manageForm)}>
                          {patch.isPending ? "در حال ثبت…" : "ذخیره تغییرات"}
                        </Button>
                        <Button size="sm" variant="outline" disabled={patch.isPending}
                          onClick={() => patch.mutate({ markReviewed: true })}>
                          <History className="h-4 w-4 ml-1" /> ثبت بازنگی امروز
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!hasPerm("ai_registry:manage") && (
                  <div className="rounded-lg bg-muted/60 border p-2.5 text-xs text-muted-foreground flex gap-1.5">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    مدیریت وضعیت، ارزیابی و صدور مجوز نیازمند نقش مجاز (ai_registry:manage) است.
                  </div>
                )}
              </div>
            </ScrollArea>
        </>
      </DialogContent>
    </Dialog>
  );
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1">{title}</div>
      <div className="text-sm text-foreground leading-6 whitespace-pre-wrap">{children || "—"}</div>
    </div>
  );
}

function MetaItem({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="font-medium">{label}</div>
        <div className="text-muted-foreground text-xs leading-5 break-words">{children}</div>
      </div>
    </div>
  );
}
