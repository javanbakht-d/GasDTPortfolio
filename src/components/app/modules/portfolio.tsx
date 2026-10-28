"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { api, ApiClientError } from "@/lib/api-client";
import { ModuleHeader, ProjectStatusBadge, LoadingState, ErrorState, EmptyState } from "@/components/app/shared";
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
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/store/app-store";
import { faNum, faDate } from "@/lib/persian-date-format";
import { PROJECT_STATUSES } from "@/lib/constants";
import {
  Search, Plus, FolderKanban, Gavel, Pencil, Gauge, Link2, Building2,
  UserCheck, Target, TrendingUp, Info, CircleCheck, XCircle,
} from "lucide-react";

type ScoreRow = {
  id: string; criterion: string; maxScore: number; score: number;
  rationale: string | null; evidence: string | null; assessor: string | null;
  assessedAt: string; modelVersion: string;
};

type ProjectRow = {
  id: string; code: string; title: string; trackKey: string; driverKey: string | null;
  proposingUnit: { name: string } | null; status: string; scoreTotal: number | null;
  refStep: number | null; sourceRef: string | null;
  businessOwner: string | null; projectManager: string | null;
  problem: string | null; goals: string | null; scope: string | null;
  successMetrics: string | null; dataReadiness: string | null; timeline: string | null;
  scores: ScoreRow[];
};

type ProjectDetail = ProjectRow & {
  deliverables: string | null;
  benefitBaseline: string | null; benefitTarget: string | null; benefitActual: string | null;
};

const TRACK_LABELS: Record<string, string> = {
  DRIVER: "پیشران مصوب",
  UNIT: "پروژه واحد",
  PROPOSED: "پیشنهاد جدید",
};

const DRIVER_LABELS: Record<string, string> = {
  SMART_METERS: "کنتورهای هوشمند",
  BSS_PLATFORM: "سکوی خدمات کسب‌وکار (BSS)",
  DT_PORTFOLIO: "سبد پروژه‌های تحول دیجیتال",
};

/** مدل امتیازدهی متوازن — نسخه v1.0-ابلاغی (هماهنگ با سرور) */
const SCORE_MODEL = [
  { criterion: "VALUE", maxScore: 40, label: "ارزش و منفعت", hint: "منفعت مالی، مشتری، کارایی و هم‌راستایی با پیشران‌های مصوب" },
  { criterion: "DATA_READINESS", maxScore: 20, label: "آمادگی داده", hint: "کیفیت، دسترس‌پذیری و حکمرانی داده‌های موردنیاز" },
  { criterion: "RISK_SECURITY", maxScore: 20, label: "ریسک و امنیت", hint: "سطح ریسک اجرایی، امنیتی و انطباق" },
  { criterion: "FEASIBILITY", maxScore: 20, label: "امکان‌پذیری اجرا", hint: "توان اجرا، منابع، فناوری و زمان‌بندی" },
] as const;

export function PortfolioModule() {
  const hasPerm = useAppStore((s) => s.hasPerm);
  const [q, setQ] = useState("");
  const [track, setTrack] = useState("all");
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<{ projects: ProjectRow[] }>({
    queryKey: ["projects"],
    queryFn: () => api.get("/api/projects"),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.projects.filter((p) =>
      (track === "all" || p.trackKey === track) &&
      (status === "all" || p.status === status) &&
      (!q.trim() || p.title.includes(q) || p.code.includes(q) || (p.problem ?? "").includes(q))
    );
  }, [data, track, status, q]);

  const stats = useMemo(() => {
    const ps = data?.projects ?? [];
    return {
      total: ps.length,
      driver: ps.filter((p) => p.trackKey === "DRIVER").length,
      unit: ps.filter((p) => p.trackKey === "UNIT").length,
      proposed: ps.filter((p) => p.trackKey === "PROPOSED").length,
      scored: ps.filter((p) => p.scoreTotal != null).length,
    };
  }, [data]);

  return (
    <div className="p-4 lg:p-6">
      <ModuleHeader
        title="سبد پروژه‌های تحول دیجیتال"
        description="ثبت، ارزیابی و انتخاب پروژه‌ها بر پایه مدل امتیازدهی متوازن (v1.0-ابلاغی) — پیشران‌های مصوب، پروژه‌های واحدها و پیشنهادهای جدید؛ تصویب نهایی در صلاحیت شورای راهبری است."
      >
        {hasPerm("projects:create") && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 ml-1" /> ثبت پروژه جدید
          </Button>
        )}
      </ModuleHeader>

      {/* آمار */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <StatCard label="کل پروژه‌ها" value={stats.total} />
        <StatCard label="پیشران‌های مصوب" value={stats.driver} />
        <StatCard label="پروژه‌های واحدها" value={stats.unit} />
        <StatCard label="پیشنهادهای جدید" value={stats.proposed} />
        <StatCard label="امتیازدهی‌شده" value={stats.scored} />
      </div>

      {/* نوار فیلتر */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جست‌وجوی عنوان، کد یا مسئله…" className="pr-9 bg-white" />
        </div>
        <Select value={track} onValueChange={setTrack}>
          <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="سويه" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه سویه‌ها</SelectItem>
            {Object.entries(TRACK_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48 bg-white"><SelectValue placeholder="وضعیت" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه وضعیت‌ها</SelectItem>
            {Object.entries(PROJECT_STATUSES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{faNum(filtered.length)} پروژه</span>
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="خطا در دریافت پروژه‌ها" onRetry={() => refetch()} />}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState title="پروژه‌ای مطابق فیلترها یافت نشد" hint="فیلترها را تغییر دهید یا پروژه جدیدی ثبت کنید." />
      )}

      <div className="space-y-2">
        {filtered.map((p) => (
          <button
            key={p.id}
            onClick={() => setDetailId(p.id)}
            className="w-full text-right rounded-xl border bg-white p-4 transition-all hover:shadow-sm hover:border-emerald-600/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  <FolderKanban className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm leading-6">{p.title}</div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                    <span className="font-mono text-[10px]">{p.code}</span>
                    <span>· {TRACK_LABELS[p.trackKey] ?? p.trackKey}</span>
                    {p.driverKey && <span>· پیشران: {DRIVER_LABELS[p.driverKey] ?? p.driverKey}</span>}
                    {p.proposingUnit && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{p.proposingUnit.name}</span>}
                    {p.sourceRef && <span className="inline-flex items-center gap-1"><Link2 className="h-3 w-3" />{p.sourceRef}</span>}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <ProjectStatusBadge status={p.status} />
                <div className="flex items-center gap-2 text-xs">
                  <Gauge className="h-3.5 w-3.5 text-slate-500" />
                  {p.scoreTotal != null ? (
                    <span className="font-medium text-slate-700">{faNum(p.scoreTotal)} از {faNum(100)}</span>
                  ) : (
                    <span className="text-muted-foreground">امتیازی ثبت نشده</span>
                  )}
                </div>
              </div>
            </div>
            {p.scoreTotal != null && (
              <div className="flex items-center gap-3 mt-3">
                <Progress value={p.scoreTotal} className="h-1.5 flex-1" />
                <span className="text-xs text-muted-foreground shrink-0">{faNum(p.scoreTotal)}٪ از سقف ۱۰۰</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {createOpen && <NewProjectDialog onClose={() => setCreateOpen(false)} />}
      {detailId && <ProjectDetailDialog id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-2xl font-bold text-slate-900">{faNum(value)}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

// ───────────── دیالوگ ثبت پروژه جدید ─────────────
function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", problem: "", goals: "", scope: "", successMetrics: "", dataReadiness: "", trackKey: "UNIT" });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/api/projects", body),
    onSuccess: () => {
      toast({ title: "پروژه با موفقیت ثبت شد", description: "پروژه در وضعیت «ثبت پیشنهاد» ایجاد شد و وارد چرخه بررسی و امتیازدهی می‌شود." });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: (e) => toast({ title: "خطا در ثبت پروژه", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ثبت پروژه جدید</DialogTitle>
          <DialogDescription>پرونده استاندارد پروژه (فرم گام ۲) — پس از ثبت، دبیرخانه وارد چرخه بررسی، امتیازدهی و تصویب شورا می‌کند.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>عنوان پروژه *</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="مثال: داشبورد یکپارچه پایش شبکه" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>سویه پروژه</Label>
              <Select value={form.trackKey} onValueChange={(v) => set("trackKey", v)}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNIT">پروژه واحد</SelectItem>
                  <SelectItem value="PROPOSED">پیشنهاد جدید</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>آمادگی داده</Label>
              <Input value={form.dataReadiness} onChange={(e) => set("dataReadiness", e.target.value)} placeholder="مثال: متوسط — داده مرجع مشترکان ناقص است" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>مسئله / مسئله‌محوری پروژه</Label>
            <Textarea value={form.problem} onChange={(e) => set("problem", e.target.value)} rows={2} placeholder="چه مسئله‌ای حل می‌شود؟" />
          </div>
          <div className="space-y-1.5">
            <Label>اهداف</Label>
            <Textarea value={form.goals} onChange={(e) => set("goals", e.target.value)} rows={2} placeholder="اهداف کمی و قابل سنجش…" />
          </div>
          <div className="space-y-1.5">
            <Label>محدوده</Label>
            <Textarea value={form.scope} onChange={(e) => set("scope", e.target.value)} rows={2} placeholder="در محدوده / خارج از محدوده…" />
          </div>
          <div className="space-y-1.5">
            <Label>شاخص‌های موفقیت</Label>
            <Textarea value={form.successMetrics} onChange={(e) => set("successMetrics", e.target.value)} rows={2} placeholder="چگونه موفقیت سنجیده می‌شود؟" />
          </div>
        </div>
        <div className="flex justify-start gap-2 mt-2">
          <Button size="sm" disabled={!form.title.trim() || create.isPending}
            onClick={() => create.mutate({
              title: form.title.trim(),
              trackKey: form.trackKey,
              problem: form.problem.trim() || undefined,
              goals: form.goals.trim() || undefined,
              scope: form.scope.trim() || undefined,
              successMetrics: form.successMetrics.trim() || undefined,
              dataReadiness: form.dataReadiness.trim() || undefined,
            })}>
            {create.isPending ? "در حال ثبت…" : "ثبت پروژه"}
          </Button>
          <Button size="sm" variant="outline" onClick={onClose} disabled={create.isPending}>انصراف</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── دیالوگ جزئیات پروژه — چرخه حیات، ویرایش، امتیازدهی ─────────────
function ProjectDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const hasPerm = useAppStore((s) => s.hasPerm);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<{ project: ProjectDetail; allowedTransitions: string[] }>({
    queryKey: ["project", id],
    queryFn: () => api.get(`/api/projects/${id}`),
  });

  const p = data?.project;

  const transition = useMutation({
    mutationFn: (status: string) => api.patch(`/api/projects/${id}`, { status }),
    onSuccess: (_d, status) => {
      toast({ title: "وضعیت پروژه تغییر کرد", description: `وضعیت جدید: ${PROJECT_STATUSES[status]?.label ?? status}` });
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast({ title: "خطا در تغییر وضعیت", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogTitle className="sr-only">جزئیات پروژه</DialogTitle>
        {isLoading || !p ? (
          <div className="p-8">
            {isError ? <ErrorState message="خطا در دریافت جزئیات پروژه" onRetry={() => refetch()} /> : <LoadingState />}
          </div>
        ) : (
          <>
            <DialogHeader className="p-6 pb-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <FolderKanban className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-base leading-7">{p.title}</DialogTitle>
                  <DialogDescription className="mt-1">
                    <span className="font-mono text-[10px]">{p.code}</span> · {TRACK_LABELS[p.trackKey] ?? p.trackKey}
                    {p.driverKey && <> · پیشران: {DRIVER_LABELS[p.driverKey] ?? p.driverKey}</>}
                    {p.proposingUnit && <> · واحد پیشنهاددهنده: {p.proposingUnit.name}</>}
                  </DialogDescription>
                </div>
                <ProjectStatusBadge status={p.status} />
              </div>
            </DialogHeader>

            <ScrollArea className="max-h-[calc(90vh-190px)] px-6 pb-6">
              <div className="space-y-4">
                {/* پرونده استاندارد پروژه */}
                <Card>
                  <CardContent className="p-4 space-y-3 text-sm">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <MetaItem icon={<UserCheck className="h-4 w-4 text-emerald-700" />} label="مالک کسب‌وکار">{p.businessOwner ?? "—"}</MetaItem>
                      <MetaItem icon={<Gauge className="h-4 w-4 text-emerald-700" />} label="مدیر پروژه">{p.projectManager ?? "—"}</MetaItem>
                      <MetaItem icon={<Link2 className="h-4 w-4 text-emerald-700" />} label="مرجع">
                        {p.sourceRef ?? "—"}{p.refStep != null && <> · گام {faNum(p.refStep)}</>}
                      </MetaItem>
                      <MetaItem icon={<Target className="h-4 w-4 text-emerald-700" />} label="آمادگی داده">{p.dataReadiness ?? "ثبت نشده"}</MetaItem>
                      <MetaItem icon={<TrendingUp className="h-4 w-4 text-emerald-700" />} label="زمان‌بندی">{p.timeline ?? "—"}</MetaItem>
                      <MetaItem icon={<Gauge className="h-4 w-4 text-emerald-700" />} label="امتیاز کل">
                        {p.scoreTotal != null ? `${faNum(p.scoreTotal)} از ${faNum(100)}` : "امتیازی ثبت نشده"}
                      </MetaItem>
                    </div>
                    <Separator />
                    <SectionBlock title="مسئله">{p.problem}</SectionBlock>
                    <SectionBlock title="اهداف">{p.goals}</SectionBlock>
                    <SectionBlock title="محدوده">{p.scope}</SectionBlock>
                    <SectionBlock title="شاخص‌های موفقیت">{p.successMetrics}</SectionBlock>
                    <Separator />
                    <div className="grid sm:grid-cols-3 gap-3">
                      <MetaItem icon={<TrendingUp className="h-4 w-4 text-emerald-700" />} label="مبنای منفعت (Baseline)">{p.benefitBaseline ?? "—"}</MetaItem>
                      <MetaItem icon={<TrendingUp className="h-4 w-4 text-emerald-700" />} label="هدف منفعت">{p.benefitTarget ?? "—"}</MetaItem>
                      <MetaItem icon={<TrendingUp className="h-4 w-4 text-emerald-700" />} label="منفعت محقق‌شده">{p.benefitActual ?? "—"}</MetaItem>
                    </div>
                  </CardContent>
                </Card>

                {/* امتیازها */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Gauge className="h-4 w-4" /> امتیازدهی مدل متوازن
                        <Badge variant="outline" className="text-[10px] font-normal">مدل v1.0-ابلاغی</Badge>
                      </CardTitle>
                      {hasPerm("projects:score") && (
                        <Button size="sm" variant="outline" onClick={() => setScoreOpen(true)}>
                          {p.scores.length > 0 ? "بازبینی / ویرایش امتیازها" : "ثبت امتیاز"}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {p.scores.length === 0 ? (
                      <div className="text-sm text-muted-foreground">امتیازی برای این پروژه ثبت نشده است. ثبت کامل چهار معیار، وضعیت را به «امتیازدهی‌شده» ارتقا می‌دهد.</div>
                    ) : (
                      <div className="space-y-2">
                        {SCORE_MODEL.map((m) => {
                          const s = p.scores.find((x) => x.criterion === m.criterion);
                          return (
                            <div key={m.criterion} className="rounded-lg border p-3">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-xs font-medium text-slate-700">{m.label}</span>
                                <span className={`text-xs font-bold ${s ? "text-emerald-700" : "text-muted-foreground"}`}>
                                  {s ? `${faNum(s.score)} از ${faNum(s.maxScore)}` : "ثبت نشده"}
                                </span>
                              </div>
                              {s?.rationale && <div className="text-xs text-muted-foreground leading-5 mt-1">دلیل: {s.rationale}</div>}
                              {s?.evidence && <div className="text-xs text-slate-500 leading-5 mt-0.5">شواهد: {s.evidence}</div>}
                              {s && (
                                <div className="text-[10px] text-slate-400 mt-1">
                                  ارزیاب: {s.assessor ?? "—"} · {faDate(s.assessedAt)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="rounded-lg bg-slate-50 border p-2.5 text-xs text-muted-foreground flex gap-1.5 mt-3">
                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      امتیازها صرفاً ورودی تصمیم‌سازی هستند؛ تصویب نهایی ورود پروژه به سبد در صلاحیت شورای راهبری است.
                    </div>
                  </CardContent>
                </Card>

                {/* چرخه حیات پروژه */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><Gavel className="h-4 w-4" /> چرخه حیات پروژه</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!hasPerm("projects:edit") ? (
                      <div className="text-xs text-muted-foreground">برای تغییر وضعیت نیازمند نقش مجاز (projects:edit) هستید.</div>
                    ) : data.allowedTransitions.length === 0 ? (
                      <div className="text-xs text-muted-foreground">این پروژه در وضعیت پایانی است و انتقالی ندارد.</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {data.allowedTransitions.map((s) => {
                          const needsApprove = s === "APPROVED" || s === "REJECTED";
                          const disabled = needsApprove && !hasPerm("projects:approve");
                          return (
                            <button
                              key={s}
                              disabled={disabled}
                              onClick={() => transition.mutate(s)}
                              title={disabled ? "تصویب/رد پروژه فقط در اختیار شورای راهبری است (projects:approve)." : undefined}
                              className={`rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${needsApprove ? "border-emerald-600 text-emerald-800 hover:bg-emerald-50" : "hover:border-slate-300"}`}
                            >
                              {PROJECT_STATUSES[s]?.label ?? s}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="rounded-lg bg-slate-50 border p-2.5 text-xs text-muted-foreground flex gap-1.5">
                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      تصویب/رد نهایی صرفاً با نقش شورا (projects:approve) انجام می‌شود؛ انتقال‌های نامعتبر توسط سرور رد می‌شوند.
                    </div>
                  </CardContent>
                </Card>

                {/* ویرایش پرونده پروژه */}
                {hasPerm("projects:edit") && (
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <CardTitle className="text-sm flex items-center gap-2"><Pencil className="h-4 w-4" /> ویرایش پرونده پروژه</CardTitle>
                        <Button size="sm" variant="outline" onClick={() => setEditOpen((v) => !v)}>
                          {editOpen ? "بستن فرم" : "باز کردن فرم ویرایش"}
                        </Button>
                      </div>
                    </CardHeader>
                    {editOpen && <EditProjectForm project={p} onDone={() => setEditOpen(false)} />}
                  </Card>
                )}
              </div>
            </ScrollArea>

            {scoreOpen && <ScoreDialog project={p} onClose={() => setScoreOpen(false)} />}
          </>
        )}
      </DialogContent>
    </Dialog>
  );

}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-600 mb-1">{title}</div>
      <div className="text-sm text-slate-700 leading-6 whitespace-pre-wrap">{children || "—"}</div>
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

// ───────────── فرم ویرایش پرونده پروژه ─────────────
function EditProjectForm({ project, onDone }: { project: ProjectDetail; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    businessOwner: project.businessOwner ?? "",
    projectManager: project.projectManager ?? "",
    problem: project.problem ?? "",
    goals: project.goals ?? "",
    scope: project.scope ?? "",
    timeline: project.timeline ?? "",
    successMetrics: project.successMetrics ?? "",
    dataReadiness: project.dataReadiness ?? "",
    benefitBaseline: project.benefitBaseline ?? "",
    benefitTarget: project.benefitTarget ?? "",
    benefitActual: project.benefitActual ?? "",
  });

  const save = useMutation({
    mutationFn: () => api.patch(`/api/projects/${project.id}`, form),
    onSuccess: () => {
      toast({ title: "پرونده پروژه به‌روزرسانی شد" });
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      onDone();
    },
    onError: (e) => toast({ title: "خطا در ذخیره", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <CardContent className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="مالک کسب‌وکار"><Input value={form.businessOwner} onChange={(e) => set("businessOwner", e.target.value)} /></Field>
        <Field label="مدیر پروژه"><Input value={form.projectManager} onChange={(e) => set("projectManager", e.target.value)} /></Field>
      </div>
      <Field label="مسئله"><Textarea value={form.problem} onChange={(e) => set("problem", e.target.value)} rows={2} /></Field>
      <Field label="اهداف"><Textarea value={form.goals} onChange={(e) => set("goals", e.target.value)} rows={2} /></Field>
      <Field label="محدوده"><Textarea value={form.scope} onChange={(e) => set("scope", e.target.value)} rows={2} /></Field>
      <Field label="شاخص‌های موفقیت"><Textarea value={form.successMetrics} onChange={(e) => set("successMetrics", e.target.value)} rows={2} /></Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="زمان‌بندی"><Input value={form.timeline} onChange={(e) => set("timeline", e.target.value)} /></Field>
        <Field label="آمادگی داده"><Input value={form.dataReadiness} onChange={(e) => set("dataReadiness", e.target.value)} /></Field>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="مبنای منفعت"><Input value={form.benefitBaseline} onChange={(e) => set("benefitBaseline", e.target.value)} /></Field>
        <Field label="هدف منفعت"><Input value={form.benefitTarget} onChange={(e) => set("benefitTarget", e.target.value)} /></Field>
        <Field label="منفعت محقق‌شده"><Input value={form.benefitActual} onChange={(e) => set("benefitActual", e.target.value)} /></Field>
      </div>
      <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? "در حال ذخیره…" : "ذخیره تغییرات"}
      </Button>
    </CardContent>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

// ───────────── دیالوگ امتیازدهی — مدل متوازن ۴۰/۲۰/۲۰/۲۰ ─────────────
function ScoreDialog({ project, onClose }: { project: ProjectDetail; onClose: () => void }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Record<string, { score: string; rationale: string; evidence: string }>>(
    Object.fromEntries(
      SCORE_MODEL.map((m) => {
        const existing = project.scores.find((s) => s.criterion === m.criterion);
        return [m.criterion, { score: existing ? String(existing.score) : "", rationale: existing?.rationale ?? "", evidence: existing?.evidence ?? "" }];
      })
    )
  );

  const total = SCORE_MODEL.reduce((sum, m) => {
    const raw = rows[m.criterion]?.score ?? "";
    const n = Number(raw);
    if (raw === "" || isNaN(n)) return sum;
    return sum + Math.max(0, Math.min(m.maxScore, n));
  }, 0);

  const allFilled = SCORE_MODEL.every((m) => {
    const raw = rows[m.criterion]?.score ?? "";
    return raw !== "" && !isNaN(Number(raw)) && (rows[m.criterion]?.rationale ?? "").trim() !== "";
  });

  const save = useMutation({
    mutationFn: () => api.post(`/api/projects/${project.id}/scores`, {
      scores: SCORE_MODEL.map((m) => ({
        criterion: m.criterion,
        score: Math.max(0, Math.min(m.maxScore, Number(rows[m.criterion].score))),
        rationale: rows[m.criterion].rationale.trim(),
        evidence: rows[m.criterion].evidence.trim() || undefined,
      })),
    }),
    onSuccess: () => {
      toast({ title: "امتیازها با موفقیت ثبت شد", description: "پس از تکمیل هر چهار معیار، وضعیت پروژه به «امتیازدهی‌شده» ارتقا می‌یابد." });
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      onClose();
    },
    onError: (e) => toast({ title: "خطا در ثبت امتیازها", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            امتیازدهی پروژه <Badge variant="outline" className="text-[10px] font-normal">مدل v1.0-ابلاغی</Badge>
          </DialogTitle>
          <DialogDescription>{project.title} — هر معیار نیازمند ثبت امتیاز و دلیل (قابل ممیزی) است.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {SCORE_MODEL.map((m) => {
            const raw = rows[m.criterion].score;
            const n = raw === "" ? null : Number(raw);
            const invalid = n != null && (isNaN(n) || n < 0 || n > m.maxScore);
            return (
              <div key={m.criterion} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-sm font-medium text-slate-800">{m.label}</div>
                  <Badge variant="outline" className="text-[10px]">سقف: {faNum(m.maxScore)} امتیاز</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{m.hint}</div>
                <div className="flex items-center gap-2">
                  <Input
                    dir="ltr"
                    inputMode="numeric"
                    className="w-28"
                    value={raw}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d]/g, "");
                      setRows((r) => ({ ...r, [m.criterion]: { ...r[m.criterion], score: v } }));
                    }}
                    placeholder={`۰ تا ${faNum(m.maxScore)}`}
                  />
                  {invalid && <span className="text-xs text-rose-600 inline-flex items-center gap-1"><XCircle className="h-3.5 w-3.5" /> خارج از سقف معیار</span>}
                  {!invalid && n != null && n >= 0 && n <= m.maxScore && (
                    <span className="text-xs text-emerald-700 inline-flex items-center gap-1"><CircleCheck className="h-3.5 w-3.5" /> معتبر</span>
                  )}
                </div>
                <Textarea
                  value={rows[m.criterion].rationale}
                  onChange={(e) => setRows((r) => ({ ...r, [m.criterion]: { ...r[m.criterion], rationale: e.target.value } }))}
                  rows={2}
                  placeholder="دلیل امتیاز (الزامی)…"
                />
                <Input
                  value={rows[m.criterion].evidence}
                  onChange={(e) => setRows((r) => ({ ...r, [m.criterion]: { ...r[m.criterion], evidence: e.target.value } }))}
                  placeholder="شواهد و مستندات (اختیاری)…"
                />
              </div>
            );
          })}
        </div>
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-center justify-between gap-2 mt-3">
          <div className="text-sm font-medium text-emerald-900">مجموع امتیاز</div>
          <div className="text-lg font-bold text-emerald-800">{faNum(total)} از {faNum(100)}</div>
        </div>
        <div className="rounded-lg bg-slate-50 border p-2.5 text-xs text-muted-foreground flex gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          امتیازها ورودی تصمیم‌سازی هستند؛ تصویب نهایی ورود پروژه به سبد در صلاحیت شورای راهبری است و سرور این قاعده را اعمال می‌کند.
        </div>
        <div className="flex justify-start gap-2 mt-1">
          <Button size="sm" disabled={!allFilled || save.isPending}
            onClick={() => save.mutate()}
            title={allFilled ? undefined : "ثبت امتیاز و دلیل برای هر چهار معیار الزامی است"}>
            {save.isPending ? "در حال ثبت…" : "ثبت امتیازها"}
          </Button>
          <Button size="sm" variant="outline" onClick={onClose} disabled={save.isPending}>انصراف</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
