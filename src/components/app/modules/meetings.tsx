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
import { faNum, faDate, faDateTime } from "@/lib/persian-date-format";
import { MEETING_STATUSES, DECISION_STATUSES } from "@/lib/constants";
import { CalendarClock, FileSignature, Plus, Pencil, Gavel, ListChecks } from "lucide-react";

// ───────────── انواع ─────────────
type DecisionBrief = { id: string; code: string; content: string; responsible: string | null; dueDate: string | null; followUpStatus: string };
type MeetingRow = {
  id: string; number: number | null; title: string; meetingType: string;
  scheduledAt: string | null; heldAt: string | null; agenda: string | null; attendees: string | null;
  status: string; minutesSummary: string | null; refStep: number | null; decisions: DecisionBrief[];
};
type DecisionRow = {
  id: string; code: string; meeting: { number: number | null; title: string } | null;
  content: string; responsible: string | null; dueDate: string | null;
  followUpStatus: string; relatedActionRefStep: number | null; createdAt: string;
};

const MEETING_TYPES: Record<string, string> = { STEERING: "شورای راهبری", WORKING: "جلسه کاری" };

const decisionBadge = (s: string) => {
  switch (s) {
    case "PENDING": return "bg-muted text-foreground border-border";
    case "IN_PROGRESS": return "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900";
    case "DONE": return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900";
    case "OVERDUE": return "bg-rose-100 dark:bg-rose-900/40 text-rose-800 border-rose-300";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

const isDecisionOverdue = (d: DecisionRow) =>
  d.followUpStatus === "OVERDUE" || (d.dueDate != null && d.followUpStatus !== "DONE" && new Date(d.dueDate) < new Date());

/** دستور جلسه در پایگاه داده به‌صورت JSON string ذخیره می‌شود */
function parseAgenda(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string" && x.trim());
  } catch { /* فرمت غیر JSON — نمایش خطی */ }
  return raw.split("\n").map((s) => s.trim()).filter(Boolean);
}

export function MeetingsModule() {
  const hasPerm = useAppStore((s) => s.hasPerm);
  const [tab, setTab] = useState("meetings");
  const [createMeeting, setCreateMeeting] = useState(false);
  const [minutesTarget, setMinutesTarget] = useState<MeetingRow | null>(null);
  const [createDecision, setCreateDecision] = useState(false);
  const [editDecision, setEditDecision] = useState<DecisionRow | null>(null);

  const meetingsQ = useQuery<{ meetings: MeetingRow[] }>({ queryKey: ["meetings"], queryFn: () => api.get("/api/meetings") });
  const decisionsQ = useQuery<{ decisions: DecisionRow[] }>({ queryKey: ["decisions"], queryFn: () => api.get("/api/decisions") });

  const meetings = meetingsQ.data?.meetings ?? [];
  const decisions = decisionsQ.data?.decisions ?? [];
  const overdueDecisions = useMemo(() => decisions.filter(isDecisionOverdue), [decisions]);

  return (
    <div className="p-4 lg:p-6">
      <ModuleHeader
        title="جلسات و مصوبات"
        description="برنامه‌ریزی جلسات شورای راهبری و جلسات کاری، ثبت صورت‌جلسه و پیگیری مصوبات با مسئول و مهلت اجرا."
      >
        {tab === "meetings" && hasPerm("meetings:manage") && (
          <Button size="sm" onClick={() => setCreateMeeting(true)}><Plus className="h-4 w-4 ml-1" /> جلسه جدید</Button>
        )}
        {tab === "decisions" && hasPerm("decisions:manage") && (
          <Button size="sm" onClick={() => setCreateDecision(true)}><Plus className="h-4 w-4 ml-1" /> مصوبه جدید</Button>
        )}
      </ModuleHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="meetings" className="gap-1.5"><CalendarClock className="h-4 w-4" /> جلسات {meetingsQ.data && <span className="text-[10px] text-muted-foreground">({faNum(meetings.length)})</span>}</TabsTrigger>
          <TabsTrigger value="decisions" className="gap-1.5"><Gavel className="h-4 w-4" /> مصوبات و پیگیری {decisionsQ.data && <span className="text-[10px] text-muted-foreground">({faNum(decisions.length)})</span>}</TabsTrigger>
        </TabsList>

        {/* ─────────── تب جلسات ─────────── */}
        <TabsContent value="meetings" className="space-y-4">
          {meetingsQ.isLoading && <LoadingState />}
          {meetingsQ.isError && <ErrorState message="خطا در دریافت جلسات" onRetry={() => meetingsQ.refetch()} />}
          {!meetingsQ.isLoading && !meetingsQ.isError && meetings.length === 0 && (
            <EmptyState title="جلسه‌ای ثبت نشده است" hint="اولین جلسه شورای راهبری در زمان استقرار ثبت می‌شود." />
          )}

          <div className="space-y-3">
            {meetings.map((m) => {
              const agenda = parseAgenda(m.agenda);
              const stLabel = MEETING_STATUSES[m.status] ?? m.status;
              return (
                <Card key={m.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                          {m.number ? faNum(m.number) : "—"}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm leading-6">{m.title}</div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
                            <span>{MEETING_TYPES[m.meetingType] ?? m.meetingType}</span>
                            <span>· زمان: {faDateTime(m.scheduledAt)}</span>
                            {m.heldAt && <span>· برگزاری: {faDateTime(m.heldAt)}</span>}
                            {m.refStep != null && <span>· مرتبط با گام {faNum(m.refStep)}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          m.status === "HELD" ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900" :
                          m.status === "CANCELED" ? "bg-muted text-muted-foreground border-border" :
                          "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900"}`}>
                          {stLabel}
                        </span>
                        {hasPerm("meetings:manage") && (
                          <Button size="sm" variant="outline" onClick={() => setMinutesTarget(m)}>
                            <FileSignature className="h-3.5 w-3.5 ml-1" /> ثبت صورت‌جلسه
                          </Button>
                        )}
                      </div>
                    </div>

                    {agenda.length > 0 && (
                      <div className="rounded-lg border bg-muted/60 p-3">
                        <div className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5" /> دستور جلسه</div>
                        <ol className="list-decimal pr-5 space-y-0.5 text-xs leading-6 text-foreground">
                          {agenda.map((a, i) => <li key={i}>{a}</li>)}
                        </ol>
                      </div>
                    )}

                    {m.attendees?.trim() && (
                      <div className="text-xs"><span className="text-muted-foreground">حاضران: </span><span>{m.attendees}</span></div>
                    )}

                    {m.minutesSummary?.trim() && (
                      <div className="rounded-lg bg-teal-50 border border-teal-200 p-3 text-xs text-teal-900 leading-6">
                        <b>خلاصه صورت‌جلسه:</b> {m.minutesSummary}
                      </div>
                    )}

                    {m.decisions.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5"><Gavel className="h-3.5 w-3.5" /> مصوبات این جلسه ({faNum(m.decisions.length)})</div>
                        {m.decisions.map((d) => (
                          <div key={d.id} className="rounded-lg border p-2.5 text-xs flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="leading-5">{d.content}</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                مسئول: {d.responsible?.trim() || "—"} · مهلت: {faDate(d.dueDate)}
                              </div>
                            </div>
                            <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${decisionBadge(d.followUpStatus)}`}>
                              {DECISION_STATUSES[d.followUpStatus] ?? d.followUpStatus}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ─────────── تب مصوبات ─────────── */}
        <TabsContent value="decisions" className="space-y-4">
          {decisionsQ.isLoading && <LoadingState />}
          {decisionsQ.isError && <ErrorState message="خطا در دریافت مصوبات" onRetry={() => decisionsQ.refetch()} />}
          {!decisionsQ.isLoading && !decisionsQ.isError && decisions.length === 0 && (
            <EmptyState title="مصوبه‌ای ثبت نشده است" hint="مصوبات جلسات با مسئول و مهلت اجرا در این بخش پیگیری می‌شوند." />
          )}

          {overdueDecisions.length > 0 && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-3 text-xs text-rose-800 leading-5">
              {faNum(overdueDecisions.length)} مصوبه از مهلت اجرا گذشته است — نیازمند اقدام جبرانی و گزارش به جلسه بعدی شورا.
            </div>
          )}

          {decisions.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <ScrollArea className="max-h-[32rem]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>کد</TableHead>
                        <TableHead>جلسه</TableHead>
                        <TableHead>متن مصوبه</TableHead>
                        <TableHead>مسئول</TableHead>
                        <TableHead>مهلت</TableHead>
                        <TableHead>وضعیت پیگیری</TableHead>
                        <TableHead>گام مرتبط</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {decisions.map((d) => {
                        const overdue = isDecisionOverdue(d);
                        return (
                          <TableRow key={d.id} className={overdue ? "bg-rose-50/60 dark:bg-rose-950/40" : ""}>
                            <TableCell className="font-mono text-[11px]" dir="ltr">{d.code}</TableCell>
                            <TableCell className="text-xs max-w-40">
                              <div className="truncate">{d.meeting ? `جلسه ${d.meeting.number ? faNum(d.meeting.number) : "—"} — ${d.meeting.title}` : "—"}</div>
                            </TableCell>
                            <TableCell className="text-xs max-w-64"><div className="leading-5">{d.content}</div></TableCell>
                            <TableCell className="text-xs">{d.responsible?.trim() || <span className="text-muted-foreground/80">—</span>}</TableCell>
                            <TableCell className={`text-xs whitespace-nowrap ${overdue ? "text-rose-700 dark:text-rose-400 font-medium" : ""}`}>{faDate(d.dueDate)}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${decisionBadge(d.followUpStatus)}`}>
                                {DECISION_STATUSES[d.followUpStatus] ?? d.followUpStatus}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs">{d.relatedActionRefStep != null ? faNum(d.relatedActionRefStep) : "—"}</TableCell>
                            <TableCell>
                              {hasPerm("decisions:manage") && (
                                <Button size="sm" variant="ghost" onClick={() => setEditDecision(d)}><Pencil className="h-3.5 w-3.5" /></Button>
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
      </Tabs>

      {createMeeting && <CreateMeetingDialog onClose={() => setCreateMeeting(false)} />}
      {minutesTarget && <MinutesDialog meeting={minutesTarget} onClose={() => setMinutesTarget(null)} />}
      {createDecision && <CreateDecisionDialog meetings={meetings} onClose={() => setCreateDecision(false)} />}
      {editDecision && <EditDecisionDialog decision={editDecision} onClose={() => setEditDecision(null)} />}
    </div>
  );
}

// ───────────── ایجاد جلسه ─────────────
function CreateMeetingDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", number: "", meetingType: "STEERING", scheduledAt: "", agenda: "", attendees: "" });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => api.post("/api/meetings", {
      title: form.title, meetingType: form.meetingType,
      number: form.number ? Number(form.number) : undefined,
      scheduledAt: form.scheduledAt || undefined,
      agenda: form.agenda.split("\n").map((s) => s.trim()).filter(Boolean),
      attendees: form.attendees || undefined,
    }),
    onSuccess: () => {
      toast({ title: "جلسه ثبت شد", description: "پس از برگزاری، صورت‌جلسه را ثبت کنید." });
      qc.invalidateQueries({ queryKey: ["meetings"] });
      onClose();
    },
    onError: (e) => toast({ title: "خطا در ثبت جلسه", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base">ثبت جلسه جدید</DialogTitle>
          <DialogDescription>دستور جلسه را در چند سطر وارد کنید — هر سطر یک بند.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="m-title">عنوان جلسه</Label>
            <Input id="m-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="مثال: سومین جلسه شورای راهبری تحول دیجیتال" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>نوع جلسه</Label>
              <Select value={form.meetingType} onValueChange={(v) => set("meetingType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(MEETING_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-num">شماره جلسه</Label>
              <Input id="m-num" value={form.number} onChange={(e) => set("number", e.target.value.replace(/\D/g, ""))} dir="ltr" placeholder="خودکار" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-sched">زمان برگزاری</Label>
              <Input id="m-sched" type="datetime-local" value={form.scheduledAt} onChange={(e) => set("scheduledAt", e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-att">حاضران</Label>
              <Input id="m-att" value={form.attendees} onChange={(e) => set("attendees", e.target.value)} placeholder="نام حاضران…" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-agenda">دستور جلسه (هر سطر یک بند)</Label>
            <Textarea id="m-agenda" rows={4} value={form.agenda} onChange={(e) => set("agenda", e.target.value)} placeholder={"۱. بررسی گزارش پیشرفت\n۲. تصویب …"} />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim()}>{save.isPending ? "در حال ثبت…" : "ثبت جلسه"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── ثبت صورت‌جلسه ─────────────
function MinutesDialog({ meeting, onClose }: { meeting: MeetingRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    minutesSummary: meeting.minutesSummary ?? "",
    attendees: meeting.attendees ?? "",
    status: meeting.status === "SCHEDULED" ? "HELD" : meeting.status,
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => api.patch(`/api/meetings/${meeting.id}`, {
      minutesSummary: form.minutesSummary, attendees: form.attendees, status: form.status,
    }),
    onSuccess: () => {
      toast({ title: "صورت‌جلسه ثبت شد", description: form.status === "HELD" ? "زمان برگزاری به‌صورت خودکار ثبت می‌شود." : undefined });
      qc.invalidateQueries({ queryKey: ["meetings"] });
      onClose();
    },
    onError: (e) => toast({ title: "خطا در ثبت صورت‌جلسه", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base">ثبت صورت‌جلسه — {meeting.title}</DialogTitle>
          <DialogDescription>خلاصه صورت‌جلسه و وضعیت برگزاری — مصوبات در تب «مصوبات و پیگیری» ثبت می‌شوند.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>وضعیت جلسه</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(MEETING_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
              {form.status === "HELD" && (
                <div className="text-[11px] text-muted-foreground">با ثبت «برگزارشده»، زمان برگزاری به‌صورت خودکار ثبت می‌شود.</div>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mi-att">حاضران</Label>
            <Input id="mi-att" value={form.attendees} onChange={(e) => set("attendees", e.target.value)} placeholder="نام حاضران…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mi-sum">خلاصه صورت‌جلسه</Label>
            <Textarea id="mi-sum" rows={5} value={form.minutesSummary} onChange={(e) => set("minutesSummary", e.target.value)} placeholder="خلاصه بحث‌ها، تصمیم‌ها و موارد ارجاعی…" />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "در حال ثبت…" : "ثبت صورت‌جلسه"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── ایجاد مصوبه ─────────────
function CreateDecisionDialog({ meetings, onClose }: { meetings: MeetingRow[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ meetingId: "", content: "", responsible: "", dueDate: "", relatedActionRefStep: "" });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => api.post("/api/decisions", {
      meetingId: form.meetingId || undefined, content: form.content,
      responsible: form.responsible || undefined, dueDate: form.dueDate || undefined,
      relatedActionRefStep: form.relatedActionRefStep || undefined,
    }),
    onSuccess: () => {
      toast({ title: "مصوبه ثبت شد", description: "پیگیری اجرا با مسئول و مهلت در همین تب انجام می‌شود." });
      qc.invalidateQueries({ queryKey: ["decisions"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
      onClose();
    },
    onError: (e) => toast({ title: "خطا در ثبت مصوبه", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">ثبت مصوبه</DialogTitle>
          <DialogDescription>مصوبه به جلسه مرتبط و در صورت لزوم به گام برنامه لینک می‌شود.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>جلسه مرتبط</Label>
            <Select value={form.meetingId} onValueChange={(v) => set("meetingId", v)}>
              <SelectTrigger><SelectValue placeholder="انتخاب جلسه…" /></SelectTrigger>
              <SelectContent className="max-h-60">
                {meetings.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="truncate block max-w-72">جلسه {m.number ? faNum(m.number) : "—"} — {m.title}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dc-content">متن مصوبه</Label>
            <Textarea id="dc-content" rows={3} value={form.content} onChange={(e) => set("content", e.target.value)} placeholder="متن دقیق مصوبه…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dc-resp">مسئول اجرا</Label>
              <Input id="dc-resp" value={form.responsible} onChange={(e) => set("responsible", e.target.value)} placeholder="نام یا واحد مسئول" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dc-due">مهلت اجرا</Label>
              <Input id="dc-due" type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dc-step">گام مرتبط برنامه</Label>
              <Input id="dc-step" value={form.relatedActionRefStep} onChange={(e) => set("relatedActionRefStep", e.target.value.replace(/\D/g, ""))} dir="ltr" placeholder="اختیاری" />
            </div>
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.content.trim()}>
            {save.isPending ? "در حال ثبت…" : "ثبت مصوبه"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── ویرایش/پیگیری مصوبه ─────────────
function EditDecisionDialog({ decision, onClose }: { decision: DecisionRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    content: decision.content, responsible: decision.responsible ?? "",
    dueDate: decision.dueDate ? decision.dueDate.slice(0, 10) : "", followUpStatus: decision.followUpStatus,
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => api.patch(`/api/decisions/${decision.id}`, {
      content: form.content, responsible: form.responsible || undefined,
      dueDate: form.dueDate || undefined, followUpStatus: form.followUpStatus,
    }),
    onSuccess: () => {
      toast({ title: "وضعیت پیگیری مصوبه ذخیره شد" });
      qc.invalidateQueries({ queryKey: ["decisions"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
      onClose();
    },
    onError: (e) => toast({ title: "خطا در ذخیره مصوبه", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">پیگیری مصوبه — {decision.code}</DialogTitle>
          <DialogDescription>{decision.meeting ? `جلسه ${decision.meeting.number ? faNum(decision.meeting.number) : "—"} — ${decision.meeting.title}` : "بدون جلسه مرتبط"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="de-content">متن مصوبه</Label>
            <Textarea id="de-content" rows={3} value={form.content} onChange={(e) => set("content", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>وضعیت پیگیری</Label>
              <Select value={form.followUpStatus} onValueChange={(v) => set("followUpStatus", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(DECISION_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="de-resp">مسئول اجرا</Label>
              <Input id="de-resp" value={form.responsible} onChange={(e) => set("responsible", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="de-due">مهلت اجرا</Label>
              <Input id="de-due" type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} dir="ltr" />
            </div>
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.content.trim()}>{save.isPending ? "در حال ذخیره…" : "ذخیره"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
