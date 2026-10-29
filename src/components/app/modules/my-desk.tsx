"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { LoadingState, ErrorState, EmptyState, ActionStatusBadge } from "@/components/app/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/store/app-store";
import { faNum, faDate, faDateTime } from "@/lib/persian-date-format";
import { toast } from "@/hooks/use-toast";
import {
  ChevronDown, ChevronUp, Eye, MessageSquareText, FileText, ArrowLeftRight,
  CalendarClock, AlertOctagon, Clock3, Hourglass, Sparkles, Loader2, Send,
  RefreshCw, Info, Flame, Users, Gavel, Bot, Database,
} from "lucide-react";

// ───────────── میزکار روزانه دبیر شورا (دستور §۴) ─────────────
// پنج ناحیه: خلاصه مدیریتی روز / اقدامات امروز / تعهدات در معرض خطر /
// منتظر اقدام دیگران / دستیار هوشمند — همه از داده واقعی /api/desk

type DeskItem = {
  id: string; refStep: number; code: string; title: string; status: string; progress: number;
  dueDate: string | null; unit: string | null; score: number; band: string; reasons: string[];
  nextStep: string; daysLeft: number | null; waitingDays: number; lastUpdate: string | null;
};
type DeskData = {
  generatedAt: string; programDay: number; baselineLabel: string;
  summary: {
    programHealth: string; topConcern: string;
    counts: { urgent: number; overdue: number; awaitingDecision: number; unanswered: number };
    changesSinceLastVisit: { actionCode: string; actionTitle: string; content: string; at: string }[];
    dataFreshness: string; morningDigestAt: string | null;
  };
  focus: DeskItem[]; risk: DeskItem[]; waiting: DeskItem[];
  awaitingDecision: { id: string; code: string; content: string; responsible: string | null; dueDate: string | null }[];
  meetings: { id: string; number: number | null; title: string; scheduledAt: string | null }[];
  dataGaps: string[];
  briefing: { summary: string; counts: { urgent: number; overdue: number; awaitingDecision: number; unanswered: number }; generatedAt: string } | null;
  priorityModelNote: string;
};

const bandStyle: Record<string, string> = {
  CRITICAL: "bg-rose-100 dark:bg-rose-900/40 text-rose-800 border-rose-300",
  HIGH: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800",
  MEDIUM: "bg-muted text-foreground border-border",
  LOW: "bg-stone-100 text-stone-600 border-stone-200",
};
const bandLabel: Record<string, string> = { CRITICAL: "بحرانی", HIGH: "بالا", MEDIUM: "متوسط", LOW: "پایین" };

function urgencyText(d: DeskItem): string {
  if (d.daysLeft == null) return "مستمر";
  if (d.daysLeft < 0) return `${faNum(-d.daysLeft)} روز تأخیر`;
  if (d.daysLeft === 0) return "سررسید امروز";
  return `${faNum(d.daysLeft)} روز مانده`;
}

function Section({ id, title, icon: Icon, count, children, defaultOpen = true, tone = "default" }: {
  id: string; title: string; icon: React.ElementType; count?: number; children: React.ReactNode; defaultOpen?: boolean; tone?: "default" | "rose" | "amber";
}) {
  const [open, setOpen] = useState(defaultOpen);
  const border = tone === "rose" ? "border-rose-200 dark:border-rose-900" : tone === "amber" ? "border-amber-200 dark:border-amber-900" : "border-border";
  return (
    <Card className={`border ${border}`}>
      <CardHeader className="pb-2">
        <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-right" aria-expanded={open}>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Icon className={`h-4 w-4 ${tone === "rose" ? "text-rose-600 dark:text-rose-400" : tone === "amber" ? "text-amber-600 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`} />
            {title}
            {count != null && count > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone === "rose" ? "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400" : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300"}`}>{faNum(count)}</span>
            )}
          </CardTitle>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground/80" /> : <ChevronDown className="h-4 w-4 text-muted-foreground/80" />}
        </button>
      </CardHeader>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

export function MyDeskModule() {
  const user = useAppStore((s) => s.user);
  const setModule = useAppStore((s) => s.setModule);
  const openAction = useAppStore((s) => s.openAction);
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery<DeskData>({
    queryKey: ["desk"],
    queryFn: () => api.get("/api/desk"),
  });

  const [draftFor, setDraftFor] = useState<DeskItem | null>(null);
  const [draftKind, setDraftKind] = useState<"followup" | "delay_notice" | "progress_summary">("followup");
  const [draftText, setDraftText] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [followUpFor, setFollowUpFor] = useState<DeskItem | null>(null);
  const [followUpDate, setFollowUpDate] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  if (isLoading) return <div className="p-6"><LoadingState label="در حال آماده‌سازی میزکار روزانه…" /></div>;
  if (isError || !data) return <div className="p-6"><ErrorState message="خطا در دریافت میزکار روزانه" onRetry={() => refetch()} /></div>;

  const s = data.summary;

  const generateDraft = async (item: DeskItem, kind: typeof draftKind) => {
    setDraftFor(item); setDraftKind(kind); setDraftText(null); setDraftLoading(true);
    try {
      const res = await api.post<{ ok: boolean; draft?: string; message?: string }>("/api/assistant/draft", { kind, refId: item.id });
      if (res.ok && res.draft) setDraftText(res.draft);
      else toast({ title: "پیش‌نویس تولید نشد", description: res.message ?? "اتصال مدل زبانی در دسترس نیست.", variant: "destructive" });
    } catch {
      toast({ title: "خطا در تهیه پیش‌نویس", variant: "destructive" });
    } finally { setDraftLoading(false); }
  };

  const saveDraft = async () => {
    if (!draftFor || !draftText) return;
    setBusyId(draftFor.id);
    try {
      await api.post(`/api/actions/${draftFor.id}/updates`, { type: "DRAFT", content: `[پیش‌نویس پیگیری] ${draftText.slice(0, 1500)}` });
      toast({ title: "پیش‌نویس در پرونده اقدام ثبت شد", description: "پیش از استفاده رسمی بازبینی کنید." });
      setDraftFor(null);
    } catch { toast({ title: "ثبت پیش‌نویس ناموفق بود", variant: "destructive" }); }
    finally { setBusyId(null); }
  };

  const quickFollowUp = async () => {
    if (!followUpFor) return;
    setBusyId(followUpFor.id);
    try {
      await api.post(`/api/actions/${followUpFor.id}/updates`, { type: "FOLLOWUP", content: `پیگیری انجام شد — یادآوری به واحد مسئول.${followUpDate ? ` زمان پیگیری بعدی: ${followUpDate}` : ""}` });
      if (followUpDate) {
        await api.patch(`/api/actions/${followUpFor.id}`, { nextFollowUpAt: new Date(followUpDate).toISOString() });
      }
      toast({ title: "پیگیری ثبت شد", description: followUpDate ? "زمان پیگیری بعدی تعیین شد." : undefined });
      setFollowUpFor(null); setFollowUpDate("");
      qc.invalidateQueries({ queryKey: ["desk"] });
    } catch { toast({ title: "ثبت پیگیری ناموفق بود", variant: "destructive" }); }
    finally { setBusyId(null); }
  };

  const referForDecision = async (item: DeskItem) => {
    setBusyId(item.id);
    try {
      await api.post(`/api/actions/${item.id}/updates`, { type: "DECISION", content: "ارجاع برای تصمیم‌گیری دبیر شورا/شورای راهبری." });
      toast({ title: "برای تصمیم ارجاع شد", description: "در پرونده اقدام ثبت و قابل ردیابی است." });
      qc.invalidateQueries({ queryKey: ["desk"] });
    } catch { toast({ title: "ارجاع ناموفق بود", variant: "destructive" }); }
    finally { setBusyId(null); }
  };

  const ItemRow = ({ item, showWaiting }: { item: DeskItem; showWaiting?: boolean }) => (
    <div className="rounded-xl border p-3.5 hover:border-emerald-600/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <button onClick={() => openAction(item.id)} className="min-w-0 text-right group">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="shrink-0 font-mono text-[10px]">گام {faNum(item.refStep)}</Badge>
            <span className="text-sm font-medium group-hover:text-emerald-800 dark:text-emerald-300 line-clamp-1">{item.title}</span>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${bandStyle[item.band]}`}>{bandLabel[item.band]} · {faNum(item.score)}</span>
          <ActionStatusBadge status={item.status} />
        </div>
      </div>
      {/* دلیل اولویت — شفافیت الزامی دستور */}
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
        <Info className="ml-0.5 inline h-3 w-3 text-muted-foreground/80" />
        {item.reasons.length ? item.reasons.join(" · ") : "در بازه زمانی خود — بدون ریسک ثبت‌شده"}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className={item.daysLeft != null && item.daysLeft < 0 ? "font-medium text-rose-600 dark:text-rose-400" : "flex items-center gap-1"}>
          <Clock3 className="h-3 w-3" />{urgencyText(item)}
        </span>
        {item.unit && <span>· {item.unit}</span>}
        {showWaiting && item.waitingDays > 0 && <span className="text-orange-600">· {faNum(item.waitingDays)} روز بی‌پاسخ</span>}
        <Progress value={item.progress} className="h-1 w-16" />
        <span>{faNum(item.progress)}٪</span>
      </div>
      {/* اقدام بعدی پیشنهادی */}
      <p className="mt-1.5 text-xs text-emerald-800 dark:text-emerald-300"><ArrowLeftRight className="ml-0.5 inline h-3 w-3" /> اقدام بعدی: {item.nextStep}</p>
      {/* دکمه‌های اقدام — واضح اما غیرمزاحم */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => openAction(item.id)}>
          <Eye className="h-3 w-3" /> مشاهده
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" disabled={busyId === item.id} onClick={() => { setFollowUpFor(item); }}>
          <MessageSquareText className="h-3 w-3" /> پیگیری
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" disabled={busyId === item.id} onClick={() => generateDraft(item, item.daysLeft != null && item.daysLeft < 0 ? "delay_notice" : "followup")}>
          <FileText className="h-3 w-3" /> تهیه پیش‌نویس
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs text-muted-foreground" disabled={busyId === item.id} onClick={() => referForDecision(item)}>
          <Gavel className="h-3 w-3" /> ارجاع برای تصمیم
        </Button>
      </div>
    </div>
  );

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* ─── ناحیه ۱: خلاصه مدیریتی روز ─── */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge className="bg-slate-900 text-white hover:bg-slate-900">میزکار روزانه</Badge>
              <span>روز {faNum(data.programDay)} برنامه · مبنا: {data.baselineLabel}</span>
            </div>
            <h1 className="mt-2 text-lg font-bold text-foreground leading-7">سلام {user?.fullName} — امروز به این موارد رسیدگی کنید</h1>
          </div>
          <div className="text-left text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1 justify-end"><RefreshCw className="h-3 w-3" /> آخرین به‌روزرسانی: {faDateTime(data.generatedAt)}</div>
            {s.morningDigestAt && <div className="mt-0.5">گزارش صبحگاهی امروز: {faDateTime(s.morningDigestAt)}</div>}
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-foreground">
          <span className="font-medium">وضعیت کلی برنامه:</span> {s.programHealth}.{" "}
          <span className="font-medium">مهم‌ترین موضوع امروز:</span> {s.topConcern}
        </p>

        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: "فوری امروز", value: s.counts.urgent, icon: Flame, cls: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400" },
            { label: "تأخیری", value: s.counts.overdue, icon: AlertOctagon, cls: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400" },
            { label: "منتظر تصمیم", value: s.counts.awaitingDecision, icon: Gavel, cls: "bg-muted text-foreground" },
            { label: "بی‌پاسخ از واحدها", value: s.counts.unanswered, icon: Hourglass, cls: "bg-orange-50 text-orange-700" },
          ].map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="flex items-center gap-2.5 rounded-xl border p-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${c.cls}`}><Icon className="h-4.5 w-4.5" /></div>
                <div><div className="text-xl font-bold leading-6">{faNum(c.value)}</div><div className="text-[11px] text-muted-foreground">{c.label}</div></div>
              </div>
            );
          })}
        </div>

        {(s.changesSinceLastVisit.length > 0 || data.dataGaps.length > 0) && (
          <details className="mt-3 rounded-xl border bg-muted/60 p-3">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              تغییرات از آخرین مراجعه ({faNum(s.changesSinceLastVisit.length)}) و کمبودهای داده ({faNum(data.dataGaps.length)})
            </summary>
            <div className="mt-2 space-y-1.5">
              {s.changesSinceLastVisit.map((c, i) => (
                <div key={i} className="text-xs text-muted-foreground leading-5">
                  <span className="font-mono text-[10px] text-muted-foreground/80">{c.actionCode}</span> — {c.content}
                </div>
              ))}
              {data.dataGaps.map((g, i) => (
                <div key={`g${i}`} className="text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1"><Database className="h-3 w-3" />{g}</div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* ─── ناحیه ۲: اقداماتی که امروز به توجه من نیاز دارند ─── */}
      <Section id="focus" title="اقداماتی که امروز به توجه من نیاز دارند" icon={Flame} count={data.focus.length}>
        {data.focus.length === 0
          ? <EmptyState title="مورد فوری‌ای برای امروز نیست" hint="اقدامات با اولویت بالا یا نزدیک به سررسید اینجا نمایش داده می‌شوند." />
          : <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">{data.focus.map((i) => <ItemRow key={i.id} item={i} />)}</div>}
      </Section>

      {/* ─── ناحیه ۳: تعهدات در معرض خطر ─── */}
      <Section id="risk" title="تعهدات در معرض خطر (بدون تأخیر قطعی)" icon={AlertOctagon} count={data.risk.length} tone="amber" defaultOpen={data.focus.length === 0}>
        <p className="mb-2 text-[11px] text-muted-foreground">فقط مواردی که شواهد کافی برای خطر تأخیر دارند — با توضیح دلیل. خطر پیش‌بینی‌شده با تأخیر قطعی یکسان دیده نمی‌شود.</p>
        {data.risk.length === 0
          ? <EmptyState title="تعهدی با شواهد خطر تأخیر یافت نشد" hint="با نزدیک شدن مهلت‌ها یا ثبت وابستگی‌ها، موارد اینجا ظاهر می‌شوند." />
          : <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">{data.risk.map((i) => <ItemRow key={i.id} item={i} />)}</div>}
      </Section>

      {/* ─── ناحیه ۴: منتظر اقدام دیگران ─── */}
      <Section id="waiting" title="منتظر اقدام دیگران (واحدها و مسئولان)" icon={Hourglass} count={data.waiting.length} tone="amber">
        {data.waiting.length === 0
          ? <EmptyState title="مورد معلقی در انتظار واحدها نیست" hint="اقداماتی با وضعیت «منتظر اطلاعات یا همکاری» اینجا می‌آیند." />
          : (
            <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
              {data.waiting.map((i) => (
                <div key={i.id}>
                  <ItemRow item={i} showWaiting />
                  <div className="mt-1 pr-1 text-[11px] text-muted-foreground">
                    آخرین ثبت پرونده: {i.lastUpdate ? faDateTime(i.lastUpdate) : "ثبت نشده"}
                  </div>
                </div>
              ))}
            </div>
          )}
        {/* تصمیم‌های باز شورا */}
        {data.awaitingDecision.length > 0 && (
          <div className="mt-3 rounded-xl border border-border bg-muted/60 p-3">
            <div className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5"><Gavel className="h-3.5 w-3.5" /> مصوبات در انتظار پیگیری</div>
            {data.awaitingDecision.map((d) => (
              <div key={d.id} className="py-1 text-xs text-muted-foreground border-b last:border-0 border-border">
                <span className="font-mono text-[10px] text-muted-foreground/80">{d.code}</span> — {d.content.slice(0, 90)}
                {d.dueDate && <span className="text-amber-700 dark:text-amber-400"> · مهلت {faDate(d.dueDate)}</span>}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ─── ناحیه ۵: دستیار هوشمند ─── */}
      <Section id="assistant" title="دستیار هوشمند — «چه چیزی نیازمند توجه من است؟»" icon={Bot} defaultOpen={false}>
        <div className="space-y-2">
          {[
            "امروز باید به چه مواردی رسیدگی کنم؟",
            "تا پایان هفته چه مهلت‌هایی داریم؟",
            "کدام تعهدات ۳۰روزه هنوز تکمیل نشده‌اند؟",
            "کدام اقدامات به تصمیم من نیاز دارند؟",
            "فهرست موارد معوق به تفکیک واحدها را تهیه کن.",
            "برای جلسه آتی شورا، دستور جلسه پیشنهادی بساز.",
          ].map((q) => (
            <button
              key={q}
              onClick={() => window.dispatchEvent(new CustomEvent("nigc-ask-ai", { detail: q }))}
              className="w-full text-right rounded-lg border p-2.5 text-xs hover:border-emerald-600/40 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/30 transition-colors"
            >
              <Sparkles className="ml-1 inline h-3 w-3 text-amber-500" /> {q}
            </button>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={() => window.dispatchEvent(new CustomEvent("nigc-open-ai"))}>
            <Sparkles className="h-3.5 w-3.5" /> گفت‌وگوی کامل با دستیار هوشمند
          </Button>
          <p className="text-[10px] text-muted-foreground leading-4">{data.priorityModelNote}</p>
        </div>
      </Section>

      {/* جلسات پیش‌رو — یادآوری آماده‌سازی */}
      {data.meetings.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/40 p-3.5 flex items-center gap-2.5">
          <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="text-xs text-amber-900 dark:text-amber-300">
            جلسه پیش‌رو: <span className="font-medium">{data.meetings[0].number ? `جلسه ${faNum(data.meetings[0].number)} — ` : ""}{data.meetings[0].title}</span>
            {data.meetings[0].scheduledAt && ` — ${faDateTime(data.meetings[0].scheduledAt)}`}
            {" · "}
            <button onClick={() => setModule("meetings")} className="underline hover:no-underline">آماده‌سازی و دستور جلسه</button>
          </div>
        </div>
      )}

      {/* ─── دیالوگ پیش‌نویس ─── */}
      <Dialog open={!!draftFor} onOpenChange={(v) => !v && setDraftFor(null)}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              پیش‌نویس تولیدی هوش مصنوعی — گام {draftFor ? faNum(draftFor.refStep) : ""}
            </DialogTitle>
          </DialogHeader>
          {draftLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> در حال تهیه پیش‌نویس از داده‌های رکورد…
            </div>
          ) : (
            <>
              <Textarea value={draftText ?? ""} onChange={(e) => setDraftText(e.target.value)} rows={12} className="text-sm leading-7" aria-label="متن پیش‌نویس" />
              <p className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg p-2.5 leading-5">
                پیش‌نویس تولیدی هوش مصنوعی است و فقط از داده‌های ثبت‌شده همین رکورد ساخته شده — پیش از استفاده رسمی بازبینی کنید. تصمیم رسمی از گردش کار مصوب عبور می‌کند.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(draftText ?? ""); toast({ title: "متن کپی شد" }); }}>کپی متن</Button>
                <Button size="sm" onClick={saveDraft} disabled={!draftText || busyId === draftFor?.id}>ثبت در پرونده اقدام</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── دیالوگ پیگیری سریع ─── */}
      <Dialog open={!!followUpFor} onOpenChange={(v) => !v && setFollowUpFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">ثبت پیگیری و زمان پیگیری بعدی</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground rounded-lg bg-muted/60 border p-2.5">
              {followUpFor && <>گام {faNum(followUpFor.refStep)} — {followUpFor.title.slice(0, 70)}{followUpFor.unit ? ` · ${followUpFor.unit}` : ""}</>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fu-note" className="text-xs">یادداشت پیگیری</Label>
              <Textarea id="fu-note" rows={2} defaultValue="یادآوری به واحد مسئول ارسال شد؛ منتظر پاسخ." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fu-date" className="text-xs">زمان پیگیری بعدی (اختیاری)</Label>
              <Input id="fu-date" type="datetime-local" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
              <p className="text-[10px] text-muted-foreground">در زمان تعیین‌شده، موتور یادآوری سروری به شما اعلان می‌دهد — مستقل از بازبودن مرورگر.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setFollowUpFor(null)}>انصراف</Button>
              <Button size="sm" onClick={quickFollowUp} disabled={busyId === followUpFor?.id}>ثبت پیگیری</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
