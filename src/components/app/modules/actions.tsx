"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { api, ApiClientError } from "@/lib/api-client";
import { ModuleHeader, ActionStatusBadge, PriorityBadge, LoadingState, ErrorState, EmptyState } from "@/components/app/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/store/app-store";
import { faNum, faDate, faDateTime, daysUntil } from "@/lib/persian-date-format";
import { ACTION_GROUPS, ACTION_STATUSES, ACTION_TYPES, CYCLES, PRIORITIES } from "@/lib/constants";
import {
  Search, Plus, ChevronDown, Link2, History, AlertOctagon, Send, FileCheck2,
  MessageSquarePlus, Info, CalendarDays, Building2, UserCheck, Wrench,
} from "lucide-react";

type ActionRow = {
  id: string; refStep: number; code: string; title: string; description: string;
  groupKey: string; actionType: string; sourceRef?: string | null;
  dueStartDay: number | null; dueEndDay: number | null; cycleKey: string | null;
  dueDate: string | null; dueDateOverridden: boolean;
  deliverable: string | null; dependencies: number[];
  responsibleUnit: { id: string; name: string; code: string } | null;
  followUpOwner: { id: string; fullName: string } | null;
  status: string; progress: number; priority: string;
  delayReason: string | null; remedialAction: string | null;
  isOverdue: boolean; dueInDays: number | null; isDueSoon: boolean;
  lastUpdate: { content: string; createdAt: string; type: string } | null;
};

type UpdateRow = {
  id: string; type: string; fromStatus?: string | null; toStatus?: string | null;
  progress?: number | null; content: string; createdAt: string;
  user?: { fullName: string } | null;
};

type ActionDetail = {
  action: ActionRow & { acceptanceCriteria: string | null; approverRoleKey: string | null; actualEndDate: string | null };
  depActions: { refStep: number; title: string; status: string; code: string }[];
};

const typeLabels: Record<string, string> = {
  STATUS_CHANGE: "تغییر وضعیت", COMMENT: "توضیح", PROGRESS: "پیشرفت",
  REMINDER: "یادآوری", DELAY_REPORT: "گزارش تأخیر", REMEDIAL: "اقدام جبرانی", DECISION: "تصمیم",
};

export function ActionsModule() {
  const qc = useQueryClient();
  const openActionId = useAppStore((s) => s.detailActionId);
  const openAction = useAppStore((s) => s.openAction);
  const hasPerm = useAppStore((s) => s.hasPerm);
  const [group, setGroup] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");

  const { data, isLoading, isError, refetch } = useQuery<{ actions: ActionRow[]; programDay: number }>({
    queryKey: ["actions"],
    queryFn: () => api.get("/api/actions"),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.actions.filter((a) =>
      (group === "all" || a.groupKey === group) &&
      (status === "all" || a.status === status) &&
      (!q.trim() || a.title.includes(q) || a.code.includes(q) || String(a.refStep) === q.trim())
    );
  }, [data, group, status, q]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of data?.actions ?? []) m[a.status] = (m[a.status] ?? 0) + 1;
    return m;
  }, [data]);

  return (
    <div className="p-4 lg:p-6">
      <ModuleHeader
        title="اقدامات و تعهدات"
        description="مدیریت ۳۷ گام سند مرجع و اقدامات تکمیلی — هر گام با شناسه مرجع قابل ردیابی، مهلت نسبی از تاریخ ابلاغ، وابستگی‌های صریح و گردش کار قابل کنترل."
      >
        {hasPerm("actions:create") && (
          <Button size="sm" disabled title="ثبت اقدام جدید از طریق ماژول (در نسخه‌های بعدی با فرم کامل)">
            <Plus className="h-4 w-4 ml-1" /> اقدام جدید
          </Button>
        )}
      </ModuleHeader>

      {/* نوار فیلتر */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جست‌وجوی عنوان، کد یا شماره گام…" className="pr-9 bg-white" />
        </div>
        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger className="w-56 bg-white"><SelectValue placeholder="گروه زمانی" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه گروه‌های زمانی</SelectItem>
            {ACTION_GROUPS.map((g) => (
              <SelectItem key={g.key} value={g.key}>{g.label} ({g.sub})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="وضعیت" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه وضعیت‌ها</SelectItem>
            {Object.entries(ACTION_STATUSES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}{counts[k] ? ` (${faNum(counts[k])})` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{faNum(filtered.length)} مورد</span>
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="خطا در دریافت اقدامات" onRetry={() => refetch()} />}

      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState title="اقدامی مطابق فیلترها یافت نشد" hint="فیلترها را تغییر دهید یا جست‌وجو را پاک کنید." />
      )}

      <div className="space-y-2">
        {filtered.map((a) => {
          const d = daysUntil(a.dueDate);
          const g = ACTION_GROUPS.find((x) => x.key === a.groupKey);
          return (
            <button
              key={a.id}
              onClick={() => openAction(a.id)}
              className={`w-full text-right rounded-xl border bg-white p-4 transition-all hover:shadow-sm hover:border-emerald-600/40 ${a.isOverdue ? "border-rose-300" : a.isDueSoon ? "border-amber-300" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${a.isOverdue ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}>
                    {faNum(a.refStep)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm leading-6">{a.title}</div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                      <span>{g?.label}</span>
                      <span>· {ACTION_TYPES[a.actionType] ?? a.actionType}</span>
                      {a.cycleKey && <span>· چرخه {CYCLES[a.cycleKey]}</span>}
                      <span>· {a.responsibleUnit?.name ?? "دبیرخانه"}</span>
                      {a.dependencies.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <Link2 className="h-3 w-3" /> وابسته به گام {faNum(a.dependencies.join("، "))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={a.priority} />
                    <ActionStatusBadge status={a.status} />
                  </div>
                  <div className={`text-xs ${a.isOverdue ? "text-rose-600 font-medium" : a.isDueSoon ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                    {a.dueDate
                      ? (a.isOverdue ? `معوق — ${faNum(-(d ?? 0))} روز از سررسید (${faDate(a.dueDate)})`
                        : a.isDueSoon ? `${faNum(d ?? 0)} روز تا سررسید (${faDate(a.dueDate)})`
                        : `سررسید: ${faDate(a.dueDate)}`)
                      : a.cycleKey ? `چرخه ${CYCLES[a.cycleKey] ?? "مستمر"}` : "—"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <Progress value={a.progress} className="h-1.5 flex-1" />
                <span className="text-xs text-muted-foreground shrink-0">{faNum(a.progress)}٪</span>
              </div>
            </button>
          );
        })}
      </div>

      {openActionId && <ActionDetailDialog id={openActionId} onClose={() => openAction(null)} />}
    </div>
  );
}

// ───────────── دیالوگ جزئیات اقدام — گردش کار کامل ─────────────
function ActionDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const hasPerm = useAppStore((s) => s.hasPerm);
  const [updateText, setUpdateText] = useState("");
  const [progress, setProgress] = useState<string>("");
  const [transitionStatus, setTransitionStatus] = useState<string>("");
  const [transitionNote, setTransitionNote] = useState("");

  const { data, isLoading, isError, refetch } = useQuery<ActionDetail & { updates: UpdateRow[] }>({
    queryKey: ["action", id],
    queryFn: async () => {
      const d = await api.get<ActionDetail>(`/api/actions/${id}`);
      const u = await api.get<{ updates: UpdateRow[] }>(`/api/actions/${id}/updates`);
      return { ...d, updates: u.updates };
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["action", id] });
    qc.invalidateQueries({ queryKey: ["actions"] });
    qc.invalidateQueries({ queryKey: ["overview"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const transition = useMutation({
    mutationFn: (body: { toStatus: string; content: string }) => api.post(`/api/actions/${id}/status`, body),
    onSuccess: () => {
      toast({ title: "وضعیت با موفقیت تغییر کرد" });
      setTransitionStatus(""); setTransitionNote("");
      invalidate();
    },
    onError: (e) => toast({ title: "خطا در تغییر وضعیت", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  const addUpdate = useMutation({
    mutationFn: (body: { content: string; type: string; progress?: number }) => api.post(`/api/actions/${id}/updates`, body),
    onSuccess: () => {
      toast({ title: "ثبت شد" });
      setUpdateText(""); setProgress("");
      invalidate();
    },
    onError: (e) => toast({ title: "خطا در ثبت", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  const setProgressMutation = useMutation({
    mutationFn: (p: number) => api.patch(`/api/actions/${id}`, { progress: p }),
    onSuccess: () => { toast({ title: "پیشرفت به‌روزرسانی شد", description: "توجه: مهلت مصوب با تغییر پیشرفت تغییر نمی‌کند." }); invalidate(); },
    onError: (e) => toast({ title: "خطا", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  const a = data?.action;
  const nextStatuses = a ? Object.keys(ACTION_STATUSES).filter((s) => {
    // ترتیب مجاز از ثابت‌های گردش کار
    return (TRANSITIONS[a.status] ?? []).includes(s);
  }) : [];

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogTitle className="sr-only">جزئیات اقدام</DialogTitle>
        {isLoading || !a ? (
          <div className="p-8"><LoadingState /></div>
        ) : (
          <>
            <DialogHeader className="p-6 pb-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm font-bold shrink-0">{faNum(a.refStep)}</div>
                <div className="flex-1">
                  <DialogTitle className="text-base leading-7">{a.title}</DialogTitle>
                  <DialogDescription className="mt-1">
                    {a.code} · {ACTION_TYPES[a.actionType]} · {ACTION_GROUPS.find((g) => g.key === a.groupKey)?.label}
                    {a.sourceRef && <span className="text-slate-500"> · منبع: {a.sourceRef}</span>}
                  </DialogDescription>
                </div>
                <ActionStatusBadge status={a.status} />
              </div>
            </DialogHeader>

            <ScrollArea className="max-h-[calc(90vh-200px)] px-6 pb-4">
              <div className="space-y-4">
                {/* شرح و خروجی */}
                <Card>
                  <CardContent className="p-4 space-y-3 text-sm">
                    <p className="leading-7 text-slate-700">{a.description}</p>
                    <Separator />
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="flex gap-2"><CalendarDays className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium">مهلت</div>
                          <div className="text-muted-foreground text-xs leading-5">
                            {a.dueStartDay != null && a.dueEndDay != null ? `روز ${faNum(a.dueStartDay)} تا ${faNum(a.dueEndDay)} از ابلاغ` : a.cycleKey ? `چرخه ${CYCLES[a.cycleKey] ?? "مستمر"}` : "—"}
                            {a.dueDate && <> — سررسید: <b className="text-slate-700">{faDate(a.dueDate)}</b></>}
                            {a.dueDateOverridden && <Badge variant="outline" className="ms-1 text-[10px]">اصلاح‌شده (سابقه ثبت شده)</Badge>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2"><FileCheck2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium">خروجی قابل تحویل</div>
                          <div className="text-muted-foreground text-xs leading-5">{a.deliverable ?? "—"}</div>
                        </div>
                      </div>
                      <div className="flex gap-2"><Building2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium">واحد مسئول</div>
                          <div className="text-muted-foreground text-xs leading-5">{a.responsibleUnit?.name ?? "دبیرخانه"}</div>
                        </div>
                      </div>
                      <div className="flex gap-2"><UserCheck className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium">مسئول پیگیری</div>
                          <div className="text-muted-foreground text-xs leading-5">{a.followUpOwner?.fullName ?? "—"}</div>
                        </div>
                      </div>
                    </div>
                    {data.depActions.length > 0 && (
                      <>
                        <Separator />
                        <div className="flex gap-2"><Link2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="font-medium mb-1">وابستگی‌ها (ترتیب الزامی)</div>
                            <div className="space-y-1">
                              {data.depActions.map((d) => (
                                <div key={d.refStep} className="flex items-center gap-2 text-xs">
                                  <Badge variant="outline" className="font-mono text-[10px]">گام {faNum(d.refStep)}</Badge>
                                  <span className="line-clamp-1">{d.title}</span>
                                  <ActionStatusBadge status={d.status} />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                    {a.delayReason && (
                      <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex gap-2">
                        <AlertOctagon className="h-4 w-4 shrink-0" />
                        <div><b>علت تأخیر ثبت‌شده:</b> {a.delayReason}</div>
                      </div>
                    )}
                    {a.remedialAction && (
                      <div className="rounded-lg bg-teal-50 border border-teal-200 p-3 text-xs text-teal-900 flex gap-2">
                        <Wrench className="h-4 w-4 shrink-0" />
                        <div><b>اقدام جبرانی:</b> {a.remedialAction}</div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* تغییر وضعیت (گردش کار) */}
                {hasPerm("actions:edit") && nextStatuses.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Send className="h-4 w-4" /> تغییر وضعیت (گردش کار)</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {nextStatuses.map((s) => (
                          <button
                            key={s}
                            onClick={() => setTransitionStatus(s)}
                            className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${transitionStatus === s ? "border-emerald-600 bg-emerald-50 text-emerald-800 font-medium" : "hover:border-slate-300"}`}
                          >
                            {ACTION_STATUSES[s].label}
                          </button>
                        ))}
                      </div>
                      {transitionStatus && (
                        <div className="space-y-2">
                          {(transitionStatus === "OVERDUE" || transitionStatus === "HALTED" || transitionStatus === "IN_REVIEW") && (
                            <div className="text-xs text-muted-foreground flex gap-1.5"><Info className="h-3.5 w-3.5 shrink-0" />
                              {transitionStatus === "OVERDUE" ? "ثبت وضعیت معوق نیازمند ذکر علت تأخیر است." :
                               transitionStatus === "HALTED" ? "توقف نیازمند مجوز مرجع مجاز است." :
                               "خروجی اقدام برای بررسی و تأیید ارسال می‌شود."}
                            </div>
                          )}
                          <Textarea
                            value={transitionNote}
                            onChange={(e) => setTransitionNote(e.target.value)}
                            placeholder={transitionStatus === "OVERDUE" ? "علت تأخیر (الزامی)…" : "توضیح تغییر وضعیت (اختیاری)…"}
                            rows={2}
                          />
                          <Button size="sm" disabled={transition.isPending}
                            onClick={() => transition.mutate({ toStatus: transitionStatus, content: transitionNote })}>
                            {transition.isPending ? "در حال ثبت…" : `ثبت انتقال به «${ACTION_STATUSES[transitionStatus].label}»`}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* پیشرفت */}
                {hasPerm("actions:edit") && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">ثبت پیشرفت (فعلی: {faNum(a.progress)}٪)</CardTitle></CardHeader>
                    <CardContent className="flex gap-2 items-center">
                      <Input value={progress} onChange={(e) => setProgress(e.target.value.replace(/\D/g, ""))} placeholder="۰ تا ۱۰۰" className="w-32" dir="ltr" />
                      <Button size="sm" variant="outline" disabled={setProgressMutation.isPending || !progress}
                        onClick={() => { setProgressMutation.mutate(Number(progress)); setProgress(""); }}>
                        ثبت پیشرفت
                      </Button>
                      <span className="text-[11px] text-muted-foreground">توجه: تکمیل اقدام نیازمند پیشرفت ۱۰۰٪ است؛ مهلت مصوب تغییر نمی‌کند.</span>
                    </CardContent>
                  </Card>
                )}

                {/* ثبت توضیح/یادآوری */}
                {hasPerm("actions:edit") && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MessageSquarePlus className="h-4 w-4" /> ثبت توضیح / گزارش / یادآوری</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      <Textarea value={updateText} onChange={(e) => setUpdateText(e.target.value)} placeholder="متن توضیح، گزارش پیشرفت، یادآوری به واحد یا ثبت مانع…" rows={2} />
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={!updateText.trim() || addUpdate.isPending}
                          onClick={() => addUpdate.mutate({ content: updateText, type: "COMMENT" })}>ثبت توضیح</Button>
                        {hasPerm("actions:remind") && (
                          <Button size="sm" variant="outline" disabled={!updateText.trim() || addUpdate.isPending}
                            onClick={() => addUpdate.mutate({ content: updateText, type: "REMINDER" })}>ارسال یادآوری کتبی</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* تاریخچه */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4" /> تاریخچه و ردپای تغییرات</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(data?.updates ?? []).map((u) => (
                        <div key={u.id} className="flex gap-3 text-sm">
                          <div className="h-2 w-2 rounded-full bg-slate-300 mt-2 shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-slate-700">{typeLabels[u.type] ?? u.type}{u.toStatus ? ` → ${ACTION_STATUSES[u.toStatus]?.label ?? u.toStatus}` : ""}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">{faDateTime(u.createdAt)}</span>
                            </div>
                            <div className="text-xs text-muted-foreground leading-5 mt-0.5">{u.content}</div>
                            {u.user && <div className="text-[10px] text-slate-400 mt-0.5">{u.user.fullName}</div>}
                          </div>
                        </div>
                      ))}
                      {(data?.updates ?? []).length === 0 && <div className="text-sm text-muted-foreground">تاریخچه‌ای ثبت نشده است.</div>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// همان ترتیب‌های مجاز سرور — برای نمایش دکمه‌ها
const TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["READY", "IN_PROGRESS"],
  READY: ["IN_PROGRESS", "WAITING_INFO", "DRAFT"],
  IN_PROGRESS: ["IN_REVIEW", "WAITING_INFO", "NEEDS_FIX", "COMPLETED", "HALTED", "OVERDUE"],
  WAITING_INFO: ["IN_PROGRESS", "HALTED", "OVERDUE"],
  IN_REVIEW: ["APPROVED", "NEEDS_FIX", "IN_PROGRESS"],
  NEEDS_FIX: ["IN_PROGRESS", "IN_REVIEW"],
  APPROVED: ["COMPLETED", "IN_REVIEW"],
  COMPLETED: ["CLOSED"],
  HALTED: ["IN_PROGRESS", "CLOSED"],
  OVERDUE: ["IN_PROGRESS", "COMPLETED", "HALTED", "CLOSED"],
  CLOSED: [],
};
