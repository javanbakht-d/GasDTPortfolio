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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/store/app-store";
import { faNum, faDate, faDateTime } from "@/lib/persian-date-format";
import { cn } from "@/lib/utils";
import {
  Activity, AlertTriangle, Bell, BellRing, CalendarClock, ClipboardList, Clock, Database,
  Globe, HeartPulse, History, Mail, Play, RefreshCw, Save, ShieldAlert, SlidersHorizontal,
  Sparkles, ChevronRight, ChevronLeft,
} from "lucide-react";

type SettingRow = { key: string; value: string; valueType: string; category: string; description: string | null; updatedAt: string };
type BaselineChangeRow = { oldDate: string | null; newDate: string; reason: string; approvedBy: string; createdAt: string };
type AuditLogRow = {
  id: string; username: string; user: { fullName: string } | null;
  action: string; entityType: string | null; entityId: string | null;
  details: string | null; ip: string | null; createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "ایجاد", UPDATE: "ویرایش", DELETE: "حذف", LOGIN: "ورود", LOGOUT: "خروج",
  SETTING_CHANGE: "تغییر تنظیمات", STATUS_CHANGE: "تغییر وضعیت", ASSIGN: "محول‌کردن", REMIND: "یادآوری",
};
const ENTITY_LABELS: Record<string, string> = {
  USER: "کاربر", ROLE: "نقش", ORG_UNIT: "واحد سازمانی", ACTION: "اقدام", KPI: "شاخص",
  RISK: "ریسک", DEVIATION: "انحراف", MEETING: "جلسه", DECISION: "مصوبه", REPORT: "گزارش",
  BUDGET_ITEM: "قلم بودجه", SETTINGS: "تنظیمات", BASELINE_DATE: "تاریخ مبنا", DOCUMENT: "سند",
  PROJECT: "پروژه", SESSION: "نشست", NOTIFICATION: "اعلان",
};

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

// ───────────── تنظیمات موتور یادآوری، گزارش‌های خودکار و مدل اولویت ─────────────

type WeightKey = "urgency" | "importance" | "dependency" | "risk" | "waiting";
type RemKeyMeta = {
  key: string; label: string; type: "boolean" | "number" | "string";
  category: string; group: "engine" | "policy" | "digest";
  min?: number; max?: number; placeholder?: string; weekday?: boolean; hint?: string;
};

const REMINDER_GROUPS: { id: RemKeyMeta["group"]; title: string; desc: string }[] = [
  {
    id: "engine",
    title: "موتور یادآوری و آستانه‌ها",
    desc: "زمان‌بند سروری مستقل از مرورگر کاربر اجرا می‌شود (قاعده «یادآوری بدون بازماندن مرورگر») — تغییرات از چرخه بعدی اعمال می‌گردد.",
  },
  {
    id: "policy",
    title: "ساعات سکوت و سیاست اعلان‌ها",
    desc: "اعلان‌های عادی در ساعات سکوت (به وقت تهران) ارسال نمی‌شوند؛ موارد بحرانی طبق سیاست می‌توانند مستثنا شوند.",
  },
  {
    id: "digest",
    title: "گزارش‌های خودکار (صبحگاهی، پایان روز، هفتگی)",
    desc: "خلاصه‌های خودکار دبیرخانه — ساعت‌ها به وقت تهران و با قالب HH:MM است.",
  },
];

const REMINDER_KEYS: RemKeyMeta[] = [
  { key: "reminders.enabled", label: "فعال‌بودن موتور یادآوری سروری", type: "boolean", category: "reminders", group: "engine" },
  { key: "reminders.tickIntervalSec", label: "فاصله چرخه یادآوری (ثانیه)", type: "number", category: "reminders", group: "engine", min: 30, hint: "حداقل ۳۰ ثانیه — موتور سروری است و برای اجرای آن نیازی به باز بودن مرورگر نیست" },
  { key: "reminders.preDueCriticalDays", label: "یادآوری پیش از سررسید — بحرانی (روز)", type: "number", category: "reminders", group: "engine", min: 0 },
  { key: "reminders.preDueHighDays", label: "یادآوری پیش از سررسید — مهم (روز)", type: "number", category: "reminders", group: "engine", min: 0 },
  { key: "reminders.preDueNormalDays", label: "یادآوری پیش از سررسید — عادی (روز)", type: "number", category: "reminders", group: "engine", min: 0 },
  { key: "reminders.dueDayNotify", label: "اطلاع‌رسانی در روز سررسید", type: "boolean", category: "reminders", group: "engine" },
  { key: "reminders.overdueEscalateDays", label: "تشدید موارد تأخیری پس از (روز)", type: "number", category: "reminders", group: "engine", min: 1 },
  { key: "reminders.followUpDefaultDays", label: "پیش‌فرض فاصله پیگیری بعدی (روز)", type: "number", category: "reminders", group: "engine", min: 1 },
  { key: "reminders.quietStart", label: "شروع ساعات سکوت (ساعت — تهران)", type: "number", category: "reminders", group: "policy", min: 0, max: 23 },
  { key: "reminders.quietEnd", label: "پایان ساعات سکوت (ساعت — تهران)", type: "number", category: "reminders", group: "policy", min: 0, max: 23 },
  { key: "reminders.quietBypassCritical", label: "موارد بحرانی از سکوت مستثنا شوند", type: "boolean", category: "reminders", group: "policy" },
  { key: "reminders.healthAlertToAdmin", label: "هشدار به مدیر در صورت شکست زمان‌بند", type: "boolean", category: "reminders", group: "policy" },
  { key: "digest.morningEnabled", label: "گزارش صبحگاهی فعال باشد", type: "boolean", category: "digest", group: "digest" },
  { key: "digest.morningTime", label: "ساعت گزارش صبحگاهی (HH:MM)", type: "string", category: "digest", group: "digest", placeholder: "07:30" },
  { key: "digest.eodEnabled", label: "خلاصه پایان روز فعال باشد", type: "boolean", category: "digest", group: "digest" },
  { key: "digest.eodTime", label: "ساعت خلاصه پایان روز (HH:MM)", type: "string", category: "digest", group: "digest", placeholder: "18:00" },
  { key: "digest.weeklyEnabled", label: "خلاصه هفتگی فعال باشد", type: "boolean", category: "digest", group: "digest" },
  { key: "digest.weeklyDay", label: "روز ارسال خلاصه هفتگی", type: "number", category: "digest", group: "digest", weekday: true },
  { key: "digest.weeklyTime", label: "ساعت خلاصه هفتگی (HH:MM)", type: "string", category: "digest", group: "digest", placeholder: "16:00" },
];

// مقادیر پیش‌فرض «پیشنهادی» موتور — وقتی کلید در پایگاه داده ذخیره نشده باشد
const REMINDER_DEFAULTS: Record<string, string> = {
  "reminders.enabled": "true",
  "reminders.tickIntervalSec": "60",
  "reminders.preDueCriticalDays": "7",
  "reminders.preDueHighDays": "5",
  "reminders.preDueNormalDays": "3",
  "reminders.dueDayNotify": "true",
  "reminders.overdueEscalateDays": "3",
  "reminders.followUpDefaultDays": "3",
  "reminders.quietStart": "21",
  "reminders.quietEnd": "7",
  "reminders.quietBypassCritical": "true",
  "reminders.healthAlertToAdmin": "true",
  "digest.morningEnabled": "true",
  "digest.morningTime": "07:30",
  "digest.eodEnabled": "true",
  "digest.eodTime": "18:00",
  "digest.weeklyEnabled": "true",
  "digest.weeklyDay": "4",
  "digest.weeklyTime": "16:00",
};

const WEEKDAY_LABELS: Record<string, string> = {
  "0": "یکشنبه", "1": "دوشنبه", "2": "سه‌شنبه", "3": "چهارشنبه", "4": "پنجشنبه", "5": "جمعه", "6": "شنبه",
};

const DEFAULT_WEIGHTS: Record<WeightKey, number> = { urgency: 35, importance: 25, dependency: 15, risk: 15, waiting: 10 };
const WEIGHT_FIELDS: { key: WeightKey; label: string }[] = [
  { key: "urgency", label: "فوریت (فاصله تا سررسید)" },
  { key: "importance", label: "اهمیت خروجی" },
  { key: "dependency", label: "تأثیر بر وابستگان" },
  { key: "risk", label: "ریسک باز مرتبط" },
  { key: "waiting", label: "مدت انتظار پاسخ" },
];
const WEIGHT_LABELS: Record<string, string> = { urgency: "فوریت", importance: "اهمیت", dependency: "وابستگی", risk: "ریسک", waiting: "انتظار" };

function parseWeights(raw: string | undefined): Record<WeightKey, number> {
  try {
    const p = raw ? (JSON.parse(raw) as Partial<Record<WeightKey, number>>) : {};
    const n = (v: number | undefined, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
    return {
      urgency: n(p.urgency, DEFAULT_WEIGHTS.urgency),
      importance: n(p.importance, DEFAULT_WEIGHTS.importance),
      dependency: n(p.dependency, DEFAULT_WEIGHTS.dependency),
      risk: n(p.risk, DEFAULT_WEIGHTS.risk),
      waiting: n(p.waiting, DEFAULT_WEIGHTS.waiting),
    };
  } catch {
    return { ...DEFAULT_WEIGHTS };
  }
}

// ───────────── سلامت و قابلیت اعتماد دستیار (GET/POST /api/scheduler) ─────────────

type LastRunDto = {
  jobKey: string; startedAt: string; finishedAt: string | null; status: string;
  created: number; skipped: number; failed: number; error: string | null; durationMs: number | null;
};
type RunRowDto = { jobKey: string; startedAt: string; status: string; created: number; skipped: number; failed: number; durationMs: number | null };
type TickResultDto = { jobKey: string; processed?: number; created: number; skipped: number; failed: number; error?: string };
type SchedulerHealth = {
  scheduler: {
    enabled: boolean; alive: boolean; tickIntervalSec: number;
    lastRun: LastRunDto | null; failedLast24h: number; recentRuns: RunRowDto[];
  };
  notifications: { pendingQuiet: number };
  emailChannel: { configured: "no" | "partial"; pending: number; note: string };
  assistant: { enabled: boolean; lastErrorAt: string | null };
  infrastructure: { dbConnected: boolean; timezone: string; serverTime: string };
  priorityModel: { version: string; weights: Partial<Record<WeightKey, number>>; note: string };
};

const JOB_KEY_LABELS: Record<string, string> = {
  REMINDER_TICK: "چرخه یادآوری",
  MORNING_DIGEST: "گزارش صبحگاهی",
  EOD_DIGEST: "خلاصه پایان روز",
  WEEKLY_DIGEST: "خلاصه هفتگی",
  CLEANUP: "پاکسازی سوابق",
  PENDING: "در صف",
  UNKNOWN: "نامشخص",
};

const RUN_STATUS: Record<string, { label: string; cls: string }> = {
  SUCCESS: { label: "موفق", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  PARTIAL: { label: "ناقص", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  FAILED: { label: "ناموفق", cls: "bg-rose-50 text-rose-800 border-rose-200" },
  RUNNING: { label: "در حال اجرا", cls: "bg-slate-50 text-slate-700 border-slate-200" },
};

type Tone = "ok" | "warn" | "bad" | "neutral";
const TONE_CARD: Record<Tone, string> = {
  ok: "border-emerald-200 bg-emerald-50/50",
  warn: "border-amber-200 bg-amber-50/50",
  bad: "border-rose-200 bg-rose-50/50",
  neutral: "border-slate-200 bg-slate-50/60",
};
const TONE_DOT: Record<Tone, string> = {
  ok: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-rose-500", neutral: "bg-slate-400",
};

const fmtDuration = (ms: number | null | undefined) => {
  if (ms == null) return "—";
  if (ms < 1000) return `${faNum(ms)} میلی‌ثانیه`;
  return `${faNum(Math.round(ms / 100) / 10)} ثانیه`;
};

export function SettingsModule() {
  const qc = useQueryClient();
  const hasPerm = useAppStore((s) => s.hasPerm);
  const setBaselineDate = useAppStore((s) => s.setBaselineDate);
  const canManage = hasPerm("settings:manage");
  const canAudit = hasPerm("audit:view");

  const [tab, setTab] = useState("config");
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [baselineOpen, setBaselineOpen] = useState(false);
  const [auditPage, setAuditPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery<{
    settings: SettingRow[]; baseline: string | null; baselineChanges: BaselineChangeRow[];
  }>({
    queryKey: ["settings"],
    queryFn: () => api.get("/api/settings"),
  });

  const settings = data?.settings ?? [];
  const baseline = data?.baseline ?? null;
  const baselineChanges = data?.baselineChanges ?? [];

  const settingMap = useMemo(() => {
    const m: Record<string, SettingRow> = {};
    for (const s of settings) m[s.key] = s;
    return m;
  }, [settings]);

  const aiProvider = settingMap["ai.provider"]?.value?.trim();
  const timezone = settingMap["program.timezone"]?.value?.trim() || "Asia/Tehran";
  const programTitle = settingMap["program.title"]?.value?.trim();

  const saveChanges = useMutation({
    mutationFn: () => api.put("/api/settings", {
      settings: Object.entries(changes).map(([key, value]) => ({ key, value })),
    }),
    onSuccess: () => {
      toast({ title: "تنظیمات ذخیره شد", description: `تعداد ${faNum(Object.keys(changes).length)} کلید به‌روزرسانی شد.` });
      setChanges({});
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => toast({ title: "خطا در ذخیره تنظیمات", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  const changeCount = Object.keys(changes).length;

  return (
    <div className="p-4 lg:p-6">
      <ModuleHeader
        title="تنظیمات و پیکربندی سامانه"
        description={programTitle ?? "پیکربندی برنامه، تاریخ مبنای ابلاغ (روز صفر) و سوابق ممیزی سامانه."}
      />

      {/* سلامت سامانه */}
      <Card className="mb-5">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-medium">
            <ShieldAlert className="h-4 w-4 text-emerald-700" /> سلامت سامانه
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border bg-slate-50/60 p-3 flex items-start gap-2.5">
              <Database className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-medium">پایگاه داده</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {isLoading ? "در حال بررسی…" : isError ? <span className="text-rose-600">خطا در اتصال</span> : <span className="text-emerald-700">متصل — دریافت تنظیمات موفق</span>}
                </div>
              </div>
            </div>
            <div className="rounded-lg border bg-slate-50/60 p-3 flex items-start gap-2.5">
              <Globe className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-medium">منطقه زمانی عملیاتی</div>
                <div className="text-[11px] text-muted-foreground mt-0.5" dir="ltr">{timezone}</div>
              </div>
            </div>
            <div className="rounded-lg border bg-slate-50/60 p-3 flex items-start gap-2.5">
              <Sparkles className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-medium">سرویس هوش مصنوعی</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {aiProvider ? <span dir="ltr">provider: {aiProvider}</span> : "پیکربندی نشده"}
                  {settingMap["ai.enabled"]?.value === "false" && <span className="text-amber-700"> — غیرفعال</span>}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 h-auto max-w-full flex-wrap">
          <TabsTrigger value="config">پیکربندی برنامه</TabsTrigger>
          <TabsTrigger value="reminders" className="gap-1.5"><BellRing className="h-4 w-4" /> یادآوری‌ها و گزارش‌های خودکار</TabsTrigger>
          <TabsTrigger value="health" className="gap-1.5"><HeartPulse className="h-4 w-4" /> سلامت و قابلیت اعتماد دستیار</TabsTrigger>
          <TabsTrigger value="baseline" className="gap-1.5"><CalendarClock className="h-4 w-4" /> تاریخ مبنای برنامه</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><History className="h-4 w-4" /> سوابق ممیزی</TabsTrigger>
        </TabsList>

        {/* ─────────── تب پیکربندی ─────────── */}
        <TabsContent value="config">
          {!canManage && (
            <div className="rounded-xl bg-slate-50 border p-3 text-xs text-muted-foreground mb-4">
              برای ویرایش تنظیمات، مجوز «مدیریت تنظیمات» لازم است — مقادیر به‌صورت فقط‌خواندنی نمایش داده می‌شوند.
            </div>
          )}
          {isLoading && <LoadingState />}
          {isError && <ErrorState message="خطا در دریافت تنظیمات" onRetry={() => refetch()} />}
          {!isLoading && !isError && settings.length === 0 && <EmptyState title="تنظیماتی ثبت نشده است" />}

          {settings.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="max-h-[34rem] overflow-y-auto divide-y">
                  {settings.map((s) => {
                    const isBaseline = s.key === "program.baselineDate";
                    const current = changes[s.key] ?? s.value;
                    return (
                      <div key={s.key} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <div className="sm:w-80 shrink-0">
                          <div className="text-xs font-mono text-slate-700" dir="ltr">{s.key}</div>
                          {s.description && <div className="text-[11px] text-muted-foreground leading-4 mt-0.5">{s.description}</div>}
                          <div className="text-[10px] text-slate-400 mt-0.5">آخرین تغییر: {faDateTime(s.updatedAt)}</div>
                        </div>
                        <div className="flex-1 flex items-center gap-2">
                          {isBaseline ? (
                            <div className="flex items-center gap-2 flex-1">
                              <Input value={faDate(s.value)} readOnly className="max-w-40 bg-slate-50" />
                              <Button variant="link" size="sm" className="text-xs px-0" onClick={() => setTab("baseline")}>
                                تغییر با گردش کار تأیید ←
                              </Button>
                            </div>
                          ) : s.valueType === "boolean" ? (
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={current === "true"}
                                disabled={!canManage}
                                onCheckedChange={(v) => setChanges((c) => ({ ...c, [s.key]: v ? "true" : "false" }))}
                              />
                              <span className="text-xs text-muted-foreground">{current === "true" ? "فعال" : "غیرفعال"}</span>
                            </div>
                          ) : (
                            <Input
                              value={current}
                              disabled={!canManage}
                              dir={s.valueType === "date" || s.valueType === "number" ? "ltr" : undefined}
                              type={s.valueType === "date" ? "date" : s.valueType === "number" ? "number" : "text"}
                              onChange={(e) => setChanges((c) => ({ ...c, [s.key]: e.target.value }))}
                              className="max-w-md"
                            />
                          )}
                          {changes[s.key] !== undefined && changes[s.key] !== s.value && (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200 shrink-0">تغییر کرده</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {canManage && (
                  <>
                    <Separator className="my-3" />
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        {changeCount > 0 ? `${faNum(changeCount)} کلید تغییر کرده — برای اعمال ذخیره کنید.` : "تغییری برای ذخیره وجود ندارد."}
                      </div>
                      <Button size="sm" disabled={changeCount === 0 || saveChanges.isPending} onClick={() => saveChanges.mutate()}>
                        <Save className="h-4 w-4 ml-1" /> {saveChanges.isPending ? "در حال ذخیره…" : "ذخیره تغییرات"}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─────────── تب یادآوری‌ها و گزارش‌های خودکار ─────────── */}
        <TabsContent value="reminders">
          <RemindersTab rows={settings} canManage={canManage} isLoading={isLoading} isError={isError} onRetry={() => refetch()} />
        </TabsContent>

        {/* ─────────── تب سلامت و قابلیت اعتماد دستیار ─────────── */}
        <TabsContent value="health">
          <HealthTab canManage={canManage} />
        </TabsContent>

        {/* ─────────── تب تاریخ مبنا ─────────── */}
        <TabsContent value="baseline" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0"><CalendarClock className="h-5 w-5" /></div>
                  <div>
                    <div className="text-sm font-medium">تاریخ مبنای برنامه (روز صفر)</div>
                    <div className="text-xs text-muted-foreground mt-0.5 leading-5">
                      تمام مهلت‌های نسبی ۳۷ گام از این تاریخ محاسبه می‌شوند — تغییر آن همه سررسیدها را بازمحاسبه می‌کند.
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold">{faDate(baseline)}</div>
                  {canManage && (
                    <Button size="sm" onClick={() => setBaselineOpen(true)}>تغییر تاریخ مبنا</Button>
                  )}
                </div>
              </div>
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-900 leading-5">
                تغییر تاریخ مبنا یک تصمیم حاکمیتی است: نیازمند ثبت <b>علت</b> و <b>مرجع تأیید</b> است، همه مهلت‌های مصوب بازمحاسبه می‌شوند و در <b>سوابق ممیزی</b> با هویت تغییردهنده ثبت می‌گردد.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-sm font-medium mb-3 flex items-center gap-2"><History className="h-4 w-4 text-slate-500" /> تاریخچه تغییرات مبنا</div>
              {baselineChanges.length === 0 ? (
                <div className="text-xs text-muted-foreground py-4 text-center">تغییری در تاریخ مبنا ثبت نشده است.</div>
              ) : (
                <ScrollArea className="max-h-72">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>از تاریخ</TableHead>
                        <TableHead>به تاریخ</TableHead>
                        <TableHead>علت</TableHead>
                        <TableHead>مرجع تأیید</TableHead>
                        <TableHead>زمان ثبت</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {baselineChanges.map((c, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{faDate(c.oldDate)}</TableCell>
                          <TableCell className="text-xs font-medium">{faDate(c.newDate)}</TableCell>
                          <TableCell className="text-xs max-w-64"><div className="leading-5">{c.reason}</div></TableCell>
                          <TableCell className="text-xs">{c.approvedBy}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{faDateTime(c.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────── تب سوابق ممیزی ─────────── */}
        <TabsContent value="audit">
          {!canAudit ? (
            <EmptyState title="دسترسی لازم را ندارید" hint="مشاهده سوابق ممیزی نیازمند مجوز «مشاهده ممیزی» است." />
          ) : (
            <AuditTable page={auditPage} setPage={setAuditPage} />
          )}
        </TabsContent>
      </Tabs>

      {baselineOpen && (
        <BaselineChangeDialog
          current={baseline}
          onClose={() => setBaselineOpen(false)}
          onSaved={(newDate) => {
            setBaselineDate(newDate);
            qc.invalidateQueries(); // بازمحاسبه همه سررسیدها — کل داده‌های وابسته تازه شود
            setBaselineOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ───────────── جدول ممیزی با صفحه‌بندی ─────────────
function AuditTable({ page, setPage }: { page: number; setPage: (p: number) => void }) {
  const { data, isLoading, isError, refetch } = useQuery<{ logs: AuditLogRow[]; total: number; page: number; pages: number }>({
    queryKey: ["audit", page],
    queryFn: () => api.get(`/api/audit?page=${page}`),
  });

  const logs = data?.logs ?? [];

  return (
    <Card>
      <CardContent className="p-4">
        {isLoading && <LoadingState label="در حال دریافت سوابق ممیزی…" />}
        {isError && <ErrorState message="خطا در دریافت سوابق ممیزی" onRetry={() => refetch()} />}
        {!isLoading && !isError && logs.length === 0 && <EmptyState title="رکورد ممیزی یافت نشد" />}

        {logs.length > 0 && (
          <>
            <ScrollArea className="max-h-[32rem]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>زمان</TableHead>
                    <TableHead>کاربر</TableHead>
                    <TableHead>عملیات</TableHead>
                    <TableHead>موجودیت</TableHead>
                    <TableHead>جزئیات</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs whitespace-nowrap">{faDateTime(l.createdAt)}</TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">{l.user?.fullName ?? "—"}</div>
                        <div className="text-[10px] text-muted-foreground font-mono" dir="ltr">{l.username}</div>
                      </TableCell>
                      <TableCell className="text-xs">{ACTION_LABELS[l.action] ?? l.action}</TableCell>
                      <TableCell className="text-xs">
                        {l.entityType ? ENTITY_LABELS[l.entityType] ?? l.entityType : "—"}
                        {l.entityId && <div className="text-[10px] text-slate-400 font-mono" dir="ltr">{truncate(l.entityId, 14)}</div>}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground max-w-72">
                        <div dir="ltr" className="font-mono leading-4 truncate" title={l.details ?? ""}>
                          {l.details ? truncate(l.details, 90) : "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground font-mono" dir="ltr">{l.ip ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <div className="flex items-center justify-between gap-3 mt-3">
              <div className="text-xs text-muted-foreground">
                {faNum(data?.total ?? 0)} رکورد — صفحه {faNum(data?.page ?? page)} از {faNum(data?.pages ?? 1)}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronRight className="h-4 w-4" /> قبلی
                </Button>
                <Button variant="outline" size="sm" disabled={(data?.pages ?? 1) <= page} onClick={() => setPage(page + 1)}>
                  بعدی <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ───────────── دیالوگ تغییر تاریخ مبنا ─────────────
function BaselineChangeDialog({ current, onClose, onSaved }: {
  current: string | null; onClose: () => void; onSaved: (newDate: string) => void;
}) {
  const [date, setDate] = useState(current ?? "");
  const [reason, setReason] = useState("");
  const [approvedBy, setApprovedBy] = useState("");

  const save = useMutation({
    mutationFn: () => api.put("/api/settings", {
      settings: [{ key: "program.baselineDate", value: date }],
      baselineReason: reason, baselineApprovedBy: approvedBy,
    }),
    onSuccess: () => {
      toast({ title: "تاریخ مبنا تغییر کرد", description: "همه مهلت‌های نسبی بازمحاسبه شد و در سوابق ممیزی ثبت گردید." });
      onSaved(date);
    },
    onError: (e) => toast({ title: "خطا در تغییر تاریخ مبنا", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">تغییر تاریخ مبنای برنامه (روز صفر)</DialogTitle>
          <DialogDescription>تاریخ فعلی: {faDate(current)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-900 leading-5">
            هشدار: با ثبت تاریخ جدید، <b>همه سررسیدهای ۳۷ گام به‌صورت خودکار بازمحاسبه می‌شوند</b>. این عمل نیازمند مجوز رسمی است، علت و مرجع تأیید الزامی است و در سوابق ممیزی باقی می‌ماند.
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bl-date">تاریخ جدید</Label>
            <Input id="bl-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" className="max-w-48" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bl-reason">علت تغییر (الزامی)</Label>
            <Textarea id="bl-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="شرح دقیق علت تغییر روز صفر و مستند مرتبط…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bl-approve">مرجع تأیید (الزامی)</Label>
            <Input id="bl-approve" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} placeholder="مثال: مصوبه هیئت‌مدیره شماره … / ابلاغ مدیرعامل" />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !date || !reason.trim() || !approvedBy.trim() || date === current}>
            {save.isPending ? "در حال ثبت…" : "ثبت تغییر با بازمحاسبه مهلت‌ها"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── تب یادآوری‌ها و گزارش‌های خودکار ─────────────
function RemindersTab({ rows, canManage, isLoading, isError, onRetry }: {
  rows: SettingRow[]; canManage: boolean; isLoading: boolean; isError: boolean; onRetry: () => void;
}) {
  const qc = useQueryClient();
  const [remChanges, setRemChanges] = useState<Record<string, string>>({});
  const [weightDraft, setWeightDraft] = useState<Record<WeightKey, number> | null>(null);

  const rowMap = useMemo(() => {
    const m: Record<string, SettingRow> = {};
    for (const r of rows) m[r.key] = r;
    return m;
  }, [rows]);

  const weightsRaw = rowMap["priority.weights"]?.value;
  const defaultWeights = useMemo(() => parseWeights(weightsRaw), [weightsRaw]);
  const canonicalWeightsJson = useMemo(() => JSON.stringify(parseWeights(weightsRaw)), [weightsRaw]);

  const originalOf = (key: string) => rowMap[key]?.value ?? REMINDER_DEFAULTS[key] ?? "";
  const currentOf = (key: string) => (remChanges[key] !== undefined ? remChanges[key] : originalOf(key));

  const effectiveWeights = weightDraft ?? defaultWeights;
  const weightsSum = WEIGHT_FIELDS.reduce((acc, f) => acc + (effectiveWeights[f.key] || 0), 0);
  const weightsChanged = weightDraft !== null && JSON.stringify(weightDraft) !== canonicalWeightsJson;

  const changedKeys = REMINDER_KEYS.filter((m) => remChanges[m.key] !== undefined && remChanges[m.key] !== originalOf(m.key)).map((m) => m.key);
  const changeCount = changedKeys.length + (weightsChanged ? 1 : 0);
  const weightsInvalid = weightsChanged && weightsSum !== 100;

  const saveRem = useMutation({
    mutationFn: async () => {
      const entries = [
        ...changedKeys.map((key) => {
          const meta = REMINDER_KEYS.find((m) => m.key === key)!;
          return { key, value: remChanges[key], valueType: meta.type, category: meta.category };
        }),
        ...(weightsChanged
          ? [{ key: "priority.weights", value: JSON.stringify(weightDraft), valueType: "string", category: "priority" }]
          : []),
      ];
      await api.put("/api/settings", { settings: entries });
      return entries.length;
    },
    onSuccess: (count) => {
      toast({
        title: "تنظیمات یادآوری ذخیره شد",
        description: `تعداد ${faNum(count)} کلید به‌روزرسانی شد — موتور یادآوری از چرخه بعدی مقادیر جدید را اعمال می‌کند.`,
      });
      setRemChanges({});
      setWeightDraft(null);
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["assistant-health"] });
    },
    onError: (e) => toast({ title: "خطا در ذخیره تنظیمات یادآوری", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      {!canManage && (
        <div className="rounded-xl bg-slate-50 border p-3 text-xs text-muted-foreground">
          برای ویرایش تنظیمات یادآوری، مجوز «مدیریت تنظیمات» لازم است — مقادیر به‌صورت فقط‌خواندنی نمایش داده می‌شوند.
        </div>
      )}
      {isLoading && <LoadingState label="در حال دریافت تنظیمات یادآوری…" />}
      {isError && <ErrorState message="خطا در دریافت تنظیمات" onRetry={onRetry} />}
      {!isLoading && !isError && (
        <>
          {REMINDER_GROUPS.map((g) => (
            <Card key={g.id}>
              <CardContent className="p-4">
                <div className="text-sm font-medium flex items-center gap-2">
                  {g.id === "engine" && <BellRing className="h-4 w-4 text-teal-700" />}
                  {g.id === "policy" && <Clock className="h-4 w-4 text-amber-600" />}
                  {g.id === "digest" && <ClipboardList className="h-4 w-4 text-emerald-700" />}
                  {g.title}
                </div>
                <p className="text-[11px] text-muted-foreground leading-5 mt-1 mb-2">{g.desc}</p>
                <div className="divide-y">
                  {REMINDER_KEYS.filter((m) => m.group === g.id).map((m) => {
                    const changed = remChanges[m.key] !== undefined && remChanges[m.key] !== originalOf(m.key);
                    const current = currentOf(m.key);
                    return (
                      <div key={m.key} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <div className="sm:w-80 shrink-0">
                          <div className="text-xs font-medium">{m.label}</div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5" dir="ltr">{m.key}</div>
                        </div>
                        <div className="flex-1 flex flex-wrap items-center gap-2">
                          {m.type === "boolean" ? (
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={current === "true"}
                                disabled={!canManage}
                                aria-label={m.label}
                                onCheckedChange={(v) => setRemChanges((c) => ({ ...c, [m.key]: v ? "true" : "false" }))}
                              />
                              <span className="text-xs text-muted-foreground">{current === "true" ? "فعال" : "غیرفعال"}</span>
                            </div>
                          ) : m.weekday ? (
                            <Select
                              value={current || "4"}
                              disabled={!canManage}
                              onValueChange={(v) => setRemChanges((c) => ({ ...c, [m.key]: v }))}
                            >
                              <SelectTrigger className="w-44" aria-label={m.label}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(WEEKDAY_LABELS).map(([v, label]) => (
                                  <SelectItem key={v} value={v}>{label} ({faNum(v)})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={current}
                              disabled={!canManage}
                              dir="ltr"
                              type={m.type === "number" ? "number" : "text"}
                              min={m.min}
                              max={m.max}
                              maxLength={m.type === "number" ? undefined : 5}
                              placeholder={m.placeholder}
                              aria-label={m.label}
                              onChange={(e) => setRemChanges((c) => ({ ...c, [m.key]: e.target.value }))}
                              className="max-w-24"
                            />
                          )}
                          {changed && (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200 shrink-0">تغییر کرده</Badge>
                          )}
                          {!rowMap[m.key] && (
                            <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200 shrink-0">پیش‌فرض پیشنهادی — ذخیره نشده</Badge>
                          )}
                          {m.hint && <div className="text-[10px] text-muted-foreground w-full leading-4">{m.hint}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* مدل اولویت‌بندی — پنج وزن با جمع ۱۰۰ */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-teal-700" /> مدل اولویت‌بندی وظایف (پیشنهادی)</div>
                <div className={cn("text-xs font-medium", weightsSum === 100 ? "text-emerald-700" : "text-amber-700")}>
                  جمع وزن‌ها: {faNum(weightsSum)} از ۱۰۰
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-5 mt-1 mb-3">
                وزن معیارها در محاسبه اولویت پیشنهادی — خروجی صرفاً برای مرتب‌سازی نمایشی است و تا تصویب شورا جایگزین اولویت مصوب رکوردها نمی‌شود.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {WEIGHT_FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label htmlFor={`w-${f.key}`} className="text-xs">{f.label}</Label>
                    <Input
                      id={`w-${f.key}`}
                      type="number"
                      dir="ltr"
                      min={0}
                      max={100}
                      disabled={!canManage}
                      value={String(effectiveWeights[f.key] ?? 0)}
                      aria-label={`وزن ${f.label}`}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setWeightDraft({ ...(weightDraft ?? defaultWeights), [f.key]: Number.isFinite(n) ? n : 0 });
                      }}
                    />
                  </div>
                ))}
              </div>
              {weightsInvalid && (
                <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-900 leading-5">
                  جمع وزن‌ها باید دقیقاً ۱۰۰ باشد تا دکمه ذخیره فعال شود.
                </div>
              )}
            </CardContent>
          </Card>

          {canManage && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    {changeCount > 0 ? `${faNum(changeCount)} کلید تغییر کرده — برای اعمال ذخیره کنید.` : "تغییری برای ذخیره وجود ندارد."}
                  </div>
                  <Button size="sm" disabled={changeCount === 0 || weightsInvalid || saveRem.isPending} onClick={() => saveRem.mutate()}>
                    <Save className="h-4 w-4 ml-1" /> {saveRem.isPending ? "در حال ذخیره…" : "ذخیره تغییرات"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ───────────── تب سلامت و قابلیت اعتماد دستیار ─────────────
function HealthCard({ tone, icon, title, sub, children }: {
  tone: Tone; icon: React.ReactNode; title: string; sub?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border p-4 flex flex-col gap-2", TONE_CARD[tone])}>
      <div className="flex items-center gap-2 text-xs font-medium text-slate-700">{icon}<span>{title}</span></div>
      <div className="text-sm leading-6">{children}</div>
      {sub && <div className="text-[11px] text-muted-foreground leading-5">{sub}</div>}
    </div>
  );
}

function HealthDot({ tone }: { tone: Tone }) {
  return <span aria-hidden="true" className={cn("inline-block h-2 w-2 rounded-full shrink-0", TONE_DOT[tone])} />;
}

function RunStatusChip({ status }: { status: string }) {
  const s = RUN_STATUS[status] ?? { label: status, cls: "bg-slate-50 text-slate-700 border-slate-200" };
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium", s.cls)}>{s.label}</span>;
}

function HealthTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [confirmRun, setConfirmRun] = useState(false);

  const { data: d, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useQuery<SchedulerHealth>({
    queryKey: ["assistant-health"],
    queryFn: () => api.get("/api/scheduler"),
    enabled: canManage,
    refetchInterval: 30000,
    retry: 1,
  });

  const runTick = useMutation({
    mutationFn: () => api.post<{ ok: boolean; results: TickResultDto[] }>("/api/scheduler"),
    onSuccess: (res) => {
      const summary = (res.results ?? [])
        .map((r) => `${JOB_KEY_LABELS[r.jobKey] ?? r.jobKey}: ${faNum(r.created)} ایجاد، ${faNum(r.skipped)} رد، ${faNum(r.failed)} ناموفق`)
        .join(" • ");
      toast({
        title: "چرخه زمان‌بند اجرا شد",
        description: summary || "هیچ وظیفه‌ای اجرا نشد — گزارش‌های خودکار فقط در بازه زمانی تنظیم‌شده اجرا می‌شوند.",
      });
      qc.invalidateQueries({ queryKey: ["assistant-health"] });
    },
    onError: (e) => toast({ title: "خطا در اجرای دستی زمان‌بند", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  if (!canManage) {
    return (
      <EmptyState
        title="دسترسی مدیریتی لازم است"
        hint="مشاهده سلامت زمان‌بند و دستیار نیازمند مجوز «مدیریت تنظیمات» (settings:manage) است."
      />
    );
  }

  if (isError) {
    if (error instanceof ApiClientError && error.status === 403) {
      return <EmptyState title="دسترسی مدیریتی لازم است" hint="این بخش فقط برای دارندگان مجوز «مدیریت تنظیمات» قابل مشاهده است." />;
    }
    return <ErrorState message="خطا در دریافت وضعیت سلامت سامانه" onRetry={() => refetch()} />;
  }

  if (isLoading || !d) {
    return <LoadingState label="در حال دریافت وضعیت سلامت…" />;
  }

  const lastRun = d.scheduler.lastRun;
  const lastRunTone: Tone = !d.scheduler.alive ? "bad" : lastRun ? (lastRun.status === "SUCCESS" ? "ok" : lastRun.status === "PARTIAL" ? "warn" : "bad") : "neutral";
  const failedTone: Tone = d.scheduler.failedLast24h === 0 ? "ok" : "bad";
  const emailTone: Tone = d.emailChannel.configured === "no" ? "warn" : "neutral";
  const assistantTone: Tone = !d.assistant.enabled ? "neutral" : d.assistant.lastErrorAt ? "warn" : "ok";

  return (
    <div className="space-y-4">
      {/* هشدارهای وضعیت */}
      {d.scheduler.enabled === false && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900 [&>svg]:text-amber-600">
          <AlertTriangle />
          <AlertTitle>موتور یادآوری غیرفعال است</AlertTitle>
          <AlertDescription>در تب «یادآوری‌ها و گزارش‌های خودکار» می‌توانید آن را فعال کنید؛ تا آن زمان هیچ یادآوری یا گزارش خودکاری اجرا نمی‌شود.</AlertDescription>
        </Alert>
      )}
      {d.scheduler.alive === false && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900 [&>svg]:text-amber-600">
          <AlertTriangle />
          <AlertTitle>زمان‌بند پاسخگو نیست</AlertTitle>
          <AlertDescription>از آخرین اجرا بیش از چند برابر فاصله تیک گذشته است — فرایند سروری (instrumentation) را بررسی کنید. برای آزمون می‌توانید چرخه را دستی اجرا کنید.</AlertDescription>
        </Alert>
      )}
      {d.scheduler.failedLast24h > 0 && (
        <Alert variant="destructive" className="border-rose-200 bg-rose-50 [&>svg]:text-rose-600">
          <AlertTriangle />
          <AlertTitle>{faNum(d.scheduler.failedLast24h)} اجرای ناموفق در ۲۴ ساعت گذشته</AlertTitle>
          <AlertDescription>جزئیات در جدول «اجرای‌های اخیر» آمده است؛ در صورت فعال‌بودن گزینه هشدار، به مدیران نیز اعلان صادر شده است.</AlertDescription>
        </Alert>
      )}

      {/* نوار فرمان */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
              <HeartPulse className="h-4 w-4 text-rose-600" /> وضعیت لحظه‌ای موتور یادآوری و دستیار
              {dataUpdatedAt > 0 && (
                <span className="text-[11px] font-normal text-muted-foreground">— آخرین به‌روزرسانی: {faDateTime(new Date(dataUpdatedAt))} (بازخوانی خودکار هر ۳۰ ثانیه)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" aria-label="بازخوانی وضعیت سلامت" disabled={isFetching} onClick={() => refetch()}>
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              </Button>
              <Button size="sm" disabled={runTick.isPending} onClick={() => setConfirmRun(true)}>
                <Play className="h-4 w-4 ml-1" /> اجرای دستی چرخه زمان‌بند
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* کارت‌های وضعیت */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <HealthCard
          tone={lastRunTone}
          icon={<Activity className="h-4 w-4 text-teal-700" />}
          title="آخرین اجرای زمان‌بند"
          sub={lastRun?.error ? <span className="text-rose-700">خطا: {truncate(lastRun.error, 90)}</span> : undefined}
        >
          {lastRun ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{JOB_KEY_LABELS[lastRun.jobKey] ?? lastRun.jobKey}</span>
                <RunStatusChip status={lastRun.status} />
              </div>
              <div className="text-[11px] text-muted-foreground">
                شروع: {faDateTime(lastRun.startedAt)} — مدت: {fmtDuration(lastRun.durationMs)}
                {lastRun.created > 0 && <> — ایجاد: {faNum(lastRun.created)}</>}
              </div>
            </>
          ) : (
            <span className="text-muted-foreground text-xs">هنوز اجرایی ثبت نشده است — زمان‌بند در نخستین تیک رکورد می‌سازد.</span>
          )}
          <div className="flex items-center gap-1.5 text-[11px]">
            <HealthDot tone={d.scheduler.alive ? "ok" : "bad"} />
            <span className={d.scheduler.alive ? "text-emerald-800" : "text-rose-800"}>
              {d.scheduler.alive ? "زمان‌بند زنده است — تیک خودکار فعال" : "زمان‌بند پاسخگو نیست"}
            </span>
            <span className="text-muted-foreground" dir="ltr">(tick: {faNum(d.scheduler.tickIntervalSec)}s)</span>
          </div>
        </HealthCard>

        <HealthCard
          tone={failedTone}
          icon={<AlertTriangle className={cn("h-4 w-4", d.scheduler.failedLast24h > 0 ? "text-rose-600" : "text-emerald-600")} />}
          title="اجراهای ناموفق ۲۴ ساعت"
          sub="وضعیت PARTIAL یا FAILED در بازه ۲۴ ساعت گذشته"
        >
          <div className="flex items-center gap-2">
            <HealthDot tone={failedTone} />
            <span className={cn("text-2xl font-bold", d.scheduler.failedLast24h > 0 ? "text-rose-700" : "text-emerald-700")}>{faNum(d.scheduler.failedLast24h)}</span>
            <span className="text-xs text-muted-foreground">{d.scheduler.failedLast24h > 0 ? "نیازمند بررسی" : "بدون شکست"}</span>
          </div>
        </HealthCard>

        <HealthCard tone={emailTone} icon={<Mail className="h-4 w-4 text-teal-700" />} title="صف ایمیل" sub={d.emailChannel.note}>
          <div className="flex items-center gap-2">
            <HealthDot tone={emailTone} />
            <span className="text-xl font-bold">{faNum(d.emailChannel.pending)}</span>
            <span className="text-xs text-muted-foreground">ایمیل در صف</span>
          </div>
          <div className="text-[11px] text-muted-foreground leading-5">
            {d.emailChannel.configured === "no"
              ? "بدون پیکربندی SMTP سازمانی ارسال نمی‌شود — سامانه ایمیل جعل نمی‌کند و صف فقط انباره صادقانه است."
              : "پیکربندی جزئی — بخشی از صف مسدود است؛ ارسال فقط پس از تنظیم SMTP سازمانی انجام می‌شود."}
          </div>
        </HealthCard>

        <HealthCard
          tone={d.infrastructure.dbConnected ? "ok" : "bad"}
          icon={<Database className={cn("h-4 w-4", d.infrastructure.dbConnected ? "text-emerald-600" : "text-rose-600")} />}
          title="اتصال پایگاه داده"
          sub={`منطقه زمانی عملیاتی: ${d.infrastructure.timezone}`}
        >
          <div className="flex items-center gap-2">
            <HealthDot tone={d.infrastructure.dbConnected ? "ok" : "bad"} />
            <span className={d.infrastructure.dbConnected ? "text-emerald-800" : "text-rose-800"}>{d.infrastructure.dbConnected ? "متصل" : "قطع — پاسخگو نیست"}</span>
          </div>
          <div className="text-[11px] text-muted-foreground">زمان سرور: {faDateTime(d.infrastructure.serverTime)}</div>
        </HealthCard>

        <HealthCard
          tone={assistantTone}
          icon={<Sparkles className="h-4 w-4 text-amber-600" />}
          title="وضعیت دستیار هوشمند"
          sub={d.assistant.lastErrorAt ? <span className="text-amber-800">آخرین خطای ثبت‌شده: {faDateTime(d.assistant.lastErrorAt)}</span> : "خطای اخیری ثبت نشده است"}
        >
          <div className="flex items-center gap-2">
            <HealthDot tone={assistantTone} />
            <span>{d.assistant.enabled ? "فعال" : "غیرفعال"}</span>
            <span className="text-[11px] text-muted-foreground">— پرس‌وجوی دستیار در پنل دبیرخانه</span>
          </div>
        </HealthCard>

        <HealthCard
          tone={d.notifications.pendingQuiet > 0 ? "warn" : "ok"}
          icon={<Bell className={cn("h-4 w-4", d.notifications.pendingQuiet > 0 ? "text-amber-600" : "text-emerald-600")} />}
          title="اعلان‌های در صف نمایش"
          sub="اعلان‌های درون‌برنامه‌ای ثبت‌شده که هنوز به کاربران نمایش داده نشده‌اند (از جمله موارد نگه‌داشته‌شده در ساعات سکوت)"
        >
          <div className="flex items-center gap-2">
            <HealthDot tone={d.notifications.pendingQuiet > 0 ? "warn" : "ok"} />
            <span className="text-xl font-bold">{faNum(d.notifications.pendingQuiet)}</span>
            <span className="text-xs text-muted-foreground">{d.notifications.pendingQuiet > 0 ? "در انتظار" : "صف خالی"}</span>
          </div>
        </HealthCard>
      </div>

      {/* جزئیات تکمیلی */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <HealthCard
          tone="neutral"
          icon={<SlidersHorizontal className="h-4 w-4 text-teal-700" />}
          title="مدل اولویت‌بندی فعال"
          sub={d.priorityModel.note}
        >
          <div className="text-[11px] font-mono text-slate-600 mb-2" dir="ltr">{d.priorityModel.version}</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(d.priorityModel.weights ?? {}).map(([k, v]) => (
              <Badge key={k} variant="outline" className="text-[10px] bg-white/70">{WEIGHT_LABELS[k] ?? k}: {faNum(v)}٪</Badge>
            ))}
          </div>
        </HealthCard>

        {/* جدول اجراهای اخیر */}
        <Card className="border">
          <CardContent className="p-4">
            <div className="text-sm font-medium flex items-center gap-2 mb-3"><History className="h-4 w-4 text-slate-500" /> ۱۰ اجرای اخیر زمان‌بند</div>
            {d.scheduler.recentRuns.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">هیچ اجرایی ثبت نشده است.</div>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>زمان شروع</TableHead>
                      <TableHead>وظیفه</TableHead>
                      <TableHead>وضعیت</TableHead>
                      <TableHead className="text-center">ایجاد</TableHead>
                      <TableHead className="text-center">رد</TableHead>
                      <TableHead className="text-center">ناموفق</TableHead>
                      <TableHead>مدت</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.scheduler.recentRuns.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs whitespace-nowrap">{faDateTime(r.startedAt)}</TableCell>
                        <TableCell className="text-xs">{JOB_KEY_LABELS[r.jobKey] ?? r.jobKey}</TableCell>
                        <TableCell><RunStatusChip status={r.status} /></TableCell>
                        <TableCell className="text-xs text-center">{faNum(r.created)}</TableCell>
                        <TableCell className="text-xs text-center">{faNum(r.skipped)}</TableCell>
                        <TableCell className={cn("text-xs text-center", r.failed > 0 && "text-rose-700 font-medium")}>{faNum(r.failed)}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDuration(r.durationMs)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* دیالوگ تأیید اجرای دستی */}
      <AlertDialog open={confirmRun} onOpenChange={setConfirmRun}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Play className="h-5 w-5 text-teal-700" /> اجرای دستی چرخه زمان‌بند</AlertDialogTitle>
            <AlertDialogDescription>
              وظیفه «چرخه یادآوری» بلافاصله اجرا می‌شود؛ گزارش‌های خودکار فقط در بازه زمانی تنظیم‌شده‌شان اجرا می‌شوند و در غیر این صورت «رد» خواهند شد. نتیجه در سوابق ممیزی با هویت شما ثبت می‌گردد.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-teal-700 text-white hover:bg-teal-800"
              onClick={() => {
                setConfirmRun(false);
                runTick.mutate();
              }}
            >
              اجرا کن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
