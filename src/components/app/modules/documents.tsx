"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { api, ApiClientError } from "@/lib/api-client";
import { ModuleHeader, DocStatusBadge, LoadingState, ErrorState, EmptyState } from "@/components/app/shared";
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
import { useAppStore } from "@/store/app-store";
import { faNum, faDateTime } from "@/lib/persian-date-format";
import { DOC_STATUSES, DOC_TYPES, DOC_CLASSIFICATIONS } from "@/lib/constants";
import {
  Search, Plus, FileText, History, Upload, Info, AlertTriangle,
  CalendarClock, Building2, Link2, ShieldCheck, FileUp,
} from "lucide-react";

type DocRow = {
  id: string; code: string; title: string; docType: string; status: string; version: string;
  classification: string; description: string | null; sourceRef: string | null;
  relatedRefStep: number | null; approvalDueDay: number | null;
  needsUpload: boolean; fileUrl: string | null; createdAt: string;
  ownerUnit: { name: string } | null;
};

type DocVersion = {
  id: string; version: string; summary: string | null; changeNote: string | null;
  status: string; createdAt: string;
};

type OrgUnitRow = { id: string; name: string; code: string };

/** ترتیب گردش وضعیت سند — هماهنگ با سرور (PATCH /api/documents/[id]) */
const DOC_FLOW = ["DRAFT", "IN_REVIEW", "APPROVED", "ISSUED", "SUPERSEDED", "ARCHIVED"] as const;

export function DocumentsModule() {
  const hasPerm = useAppStore((s) => s.hasPerm);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<{ documents: DocRow[] }>({
    queryKey: ["documents"],
    queryFn: () => api.get("/api/documents"),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.documents.filter((d) =>
      (type === "all" || d.docType === type) &&
      (status === "all" || d.status === status) &&
      (!q.trim() || d.title.includes(q) || d.code.includes(q) || (d.description ?? "").includes(q))
    );
  }, [data, type, status, q]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of data?.documents ?? []) m[d.status] = (m[d.status] ?? 0) + 1;
    return m;
  }, [data]);

  const needsUploadCount = (data?.documents ?? []).filter((d) => d.needsUpload).length;

  return (
    <div className="p-4 lg:p-6">
      <ModuleHeader
        title="اسناد و مدارک مرجع"
        description="مدیریت اسناد حاکمیتی (منشور، دستورالعمل، سازوکار، فرم‌ها) با گردش وضعیت کنترل‌شده، نسخه‌بندی قابل ممیزی و قاعده «تغییر سند مصوب/ابلاغی فقط با ثبت نسخه جدید»."
      >
        {hasPerm("documents:create") && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 ml-1" /> سند جدید
          </Button>
        )}
      </ModuleHeader>

      {/* نوار فیلتر */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جست‌وجوی عنوان، کد یا شرح سند…" className="pr-9 bg-white" />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-48 bg-white"><SelectValue placeholder="نوع سند" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه انواع</SelectItem>
            {Object.entries(DOC_TYPES).map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="وضعیت" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه وضعیت‌ها</SelectItem>
            {Object.entries(DOC_STATUSES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}{counts[k] ? ` (${faNum(counts[k])})` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{faNum(filtered.length)} سند</span>
        {needsUploadCount > 0 && (
          <Badge className="bg-amber-50 text-amber-800 border border-amber-300">
            <AlertTriangle className="h-3 w-3 ml-1" /> {faNum(needsUploadCount)} سند نیازمند بارگذاری نسخه رسمی
          </Badge>
        )}
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="خطا در دریافت اسناد" onRetry={() => refetch()} />}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState title="سندی مطابق فیلترها یافت نشد" hint="فیلترها را تغییر دهید یا جست‌وجو را پاک کنید." />
      )}

      <div className="space-y-2">
        {filtered.map((d) => (
          <button
            key={d.id}
            onClick={() => setDetailId(d.id)}
            className={`w-full text-right rounded-xl border bg-white p-4 transition-all hover:shadow-sm hover:border-emerald-600/40 ${d.needsUpload ? "border-amber-300" : ""}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm leading-6">{d.title}</div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                    <span className="font-mono text-[10px]">{d.code}</span>
                    <span>· {DOC_TYPES[d.docType] ?? d.docType}</span>
                    <span>· نسخه {d.version}</span>
                    {d.ownerUnit && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{d.ownerUnit.name}</span>}
                    {d.relatedRefStep != null && (
                      <span className="inline-flex items-center gap-1 text-slate-500"><Link2 className="h-3 w-3" /> گام {faNum(d.relatedRefStep)}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{DOC_CLASSIFICATIONS[d.classification] ?? d.classification}</Badge>
                  <DocStatusBadge status={d.status} />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {d.approvalDueDay != null && (
                    <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" /> مهلت مصوبه: روز {faNum(d.approvalDueDay)}</span>
                  )}
                  {d.needsUpload ? (
                    <span className="text-amber-700 font-medium inline-flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> نیازمند بارگذاری
                    </span>
                  ) : d.fileUrl ? (
                    <span className="text-emerald-700 inline-flex items-center gap-1"><FileUp className="h-3 w-3" /> فایل رسمی ثبت شده</span>
                  ) : null}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {createOpen && <NewDocumentDialog onClose={() => setCreateOpen(false)} />}
      {detailId && <DocumentDetailDialog id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

// ───────────── دیالوگ ثبت سند جدید ─────────────
function NewDocumentDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("REPORT");
  const [ownerUnitId, setOwnerUnitId] = useState("none");
  const [sourceRef, setSourceRef] = useState("");
  const [refStep, setRefStep] = useState("");
  const [description, setDescription] = useState("");

  const { data: unitsData } = useQuery<{ units: OrgUnitRow[] }>({
    queryKey: ["org-units"],
    queryFn: () => api.get("/api/org-units"),
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/api/documents", body),
    onSuccess: () => {
      toast({ title: "سند با موفقیت ثبت شد", description: "سند در وضعیت پیش‌نویس ایجاد شد و پس از تکمیل برای بررسی ارسال می‌شود." });
      qc.invalidateQueries({ queryKey: ["documents"] });
      onClose();
    },
    onError: (e) => toast({ title: "خطا در ثبت سند", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ثبت سند جدید</DialogTitle>
          <DialogDescription>سند در وضعیت پیش‌نویس ثبت می‌شود؛ تصویب و ابلاغ نیازمند نقش مجاز (documents:approve) است.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>عنوان سند *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: سازوکار گزارش‌دهی فصلی واحدها" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>نوع سند</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_TYPES).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>واحد مالک</Label>
              <Select value={ownerUnitId} onValueChange={setOwnerUnitId}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="انتخاب واحد" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">واحد کاربر جاری (پیش‌فرض)</SelectItem>
                  {(unitsData?.units ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>مرجع صادرکننده / مبنای سند</Label>
              <Input value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="مثال: مصوبه جلسه اول شورا" />
            </div>
            <div className="space-y-1.5">
              <Label>گام مرتبط از ۳۷ گام</Label>
              <Input dir="ltr" value={refStep} onChange={(e) => setRefStep(e.target.value.replace(/\D/g, ""))} placeholder="مثال: 5" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>شرح سند</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="هدف و دامنه سند…" />
          </div>
        </div>
        <div className="flex justify-start gap-2 mt-2">
          <Button size="sm" disabled={!title.trim() || create.isPending}
            onClick={() => create.mutate({
              title: title.trim(), docType,
              description: description.trim() || undefined,
              sourceRef: sourceRef.trim() || undefined,
              relatedRefStep: refStep ? Number(refStep) : undefined,
              ownerUnitId: ownerUnitId === "none" ? undefined : ownerUnitId,
            })}>
            {create.isPending ? "در حال ثبت…" : "ثبت سند"}
          </Button>
          <Button size="sm" variant="outline" onClick={onClose} disabled={create.isPending}>انصراف</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── دیالوگ جزئیات سند — گردش وضعیت، نسخه‌ها، بارگذاری ─────────────
function DocumentDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const hasPerm = useAppStore((s) => s.hasPerm);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [newVersion, setNewVersion] = useState("");
  const [versionSummary, setVersionSummary] = useState("");
  const [desc, setDesc] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState("");

  const { data, isLoading, isError, refetch } = useQuery<{ document: DocRow & { versions: DocVersion[] } }>({
    queryKey: ["document", id],
    queryFn: () => api.get(`/api/documents/${id}`),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["document", id] });
    qc.invalidateQueries({ queryKey: ["documents"] });
  };

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/api/documents/${id}`, body),
    onSuccess: (_res, vars) => {
      const st = (vars as { status?: string }).status;
      toast({
        title: st ? "وضعیت سند به‌روزرسانی شد" : "تغییرات سند ثبت شد",
        description: st ? `وضعیت جدید: ${DOC_STATUSES[st]?.label ?? st}` : undefined,
      });
      setSelectedStatus(""); setNewVersion(""); setVersionSummary(""); setFileUrl("");
      invalidate();
    },
    onError: (e) => toast({ title: "خطا در به‌روزرسانی سند", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  const doc = data?.document;
  const isApprovedOrIssued = doc ? ["APPROVED", "ISSUED"].includes(doc.status) : false;
  const candidates = doc ? DOC_FLOW.filter((s) => s !== doc.status) : [];
  const needsApprovePerm = ["APPROVED", "ISSUED"].includes(selectedStatus);
  const versionMissing = isApprovedOrIssued && !newVersion.trim();
  const canSubmitStatus = selectedStatus && !needsApprovePerm && !versionMissing && !patch.isPending;
  const editBlocked = patch.isPending || (isApprovedOrIssued && versionMissing);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogTitle className="sr-only">جزئیات سند</DialogTitle>
        {isLoading || !doc ? (
          <div className="p-8">
            {isError ? <ErrorState message="خطا در دریافت جزئیات سند" onRetry={() => refetch()} /> : <LoadingState />}
          </div>
        ) : (
          <>
            <DialogHeader className="p-6 pb-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-base leading-7">{doc.title}</DialogTitle>
                  <DialogDescription className="mt-1">
                    <span className="font-mono text-[10px]">{doc.code}</span> · {DOC_TYPES[doc.docType] ?? doc.docType} · نسخه {doc.version} · {DOC_CLASSIFICATIONS[doc.classification] ?? doc.classification}
                    {doc.ownerUnit && <> · مالک: {doc.ownerUnit.name}</>}
                  </DialogDescription>
                </div>
                <DocStatusBadge status={doc.status} />
              </div>
            </DialogHeader>

            <ScrollArea className="max-h-[calc(90vh-190px)] px-6 pb-6">
              <div className="space-y-4">
                {/* مشخصات سند */}
                <Card>
                  <CardContent className="p-4 space-y-3 text-sm">
                    <p className="leading-7 text-slate-700 whitespace-pre-wrap">{doc.description || "شرحی برای این سند ثبت نشده است."}</p>
                    <Separator />
                    <div className="grid sm:grid-cols-2 gap-3">
                      <MetaItem icon={<Link2 className="h-4 w-4 text-emerald-700" />} label="مرجع و گام مرتبط">
                        {doc.sourceRef ?? "—"}{doc.relatedRefStep != null && <> · گام {faNum(doc.relatedRefStep)}</>}
                      </MetaItem>
                      <MetaItem icon={<CalendarClock className="h-4 w-4 text-emerald-700" />} label="مهلت مصوبه (از روز صفر)">
                        {doc.approvalDueDay != null ? `روز ${faNum(doc.approvalDueDay)}` : "—"}
                      </MetaItem>
                      <MetaItem icon={<History className="h-4 w-4 text-emerald-700" />} label="تاریخ ایجاد">
                        {faDateTime(doc.createdAt)}
                      </MetaItem>
                      <MetaItem icon={<FileUp className="h-4 w-4 text-emerald-700" />} label="فایل رسمی">
                        {doc.fileUrl
                          ? <span className="break-all" dir="ltr">{doc.fileUrl}</span>
                          : <span className={doc.needsUpload ? "text-amber-700 font-medium" : ""}>{doc.needsUpload ? "نیازمند بارگذاری نسخه رسمی" : "ثبت نشده"}</span>}
                      </MetaItem>
                    </div>
                  </CardContent>
                </Card>

                {/* قاعده نسخه جدید برای اسناد مصوب/ابلاغی */}
                {hasPerm("documents:edit") && isApprovedOrIssued && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /> تغییر سند مصوب/ابلاغی فقط با نسخه جدید</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 flex gap-1.5">
                        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        هرگونه تغییر در وضعیت، شرح یا فایل رسمی این سند نیازمند شماره نسخه جدید است — نسخه قبلی به‌عنوان «منسوخ» در تاریخچه حفظ می‌شود.
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <Input value={newVersion} onChange={(e) => setNewVersion(e.target.value)} placeholder="شماره نسخه جدید (مثال: ۱٫۱) *" />
                        <Input value={versionSummary} onChange={(e) => setVersionSummary(e.target.value)} placeholder="خلاصه تغییرات نسخه جدید" />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* گردش وضعیت سند */}
                {hasPerm("documents:edit") && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">تغییر وضعیت سند</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {candidates.map((s) => (
                          <button
                            key={s}
                            onClick={() => setSelectedStatus(s)}
                            className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${selectedStatus === s ? "border-emerald-600 bg-emerald-50 text-emerald-800 font-medium" : "hover:border-slate-300"}`}
                          >
                            {DOC_STATUSES[s]?.label ?? s}
                          </button>
                        ))}
                      </div>
                      {needsApprovePerm && (
                        <div className={`rounded-lg p-2.5 text-xs flex gap-1.5 ${hasPerm("documents:approve") ? "bg-teal-50 border border-teal-200 text-teal-900" : "bg-rose-50 border border-rose-200 text-rose-800"}`}>
                          <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          {hasPerm("documents:approve")
                            ? "تصویب/ابلاغ با نقش مجاز شما امکان‌پذیر است و در ردپای تغییرات ثبت می‌شود."
                            : "تصویب و ابلاغ سند نیازمند نقش مجاز (documents:approve) است — دکمه ثبت برای شما فعال نیست."}
                        </div>
                      )}
                      {isApprovedOrIssued && (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 flex gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          سند مصوب/ابلاغی فقط با ثبت نسخه جدید قابل تغییر است — شماره نسخه جدید را وارد کنید (نسخه قبلی به‌عنوان منسوخ در تاریخچه حفظ می‌شود).
                        </div>
                      )}
                      {selectedStatus && (
                        <div className="space-y-2">
                          <Button size="sm" disabled={!canSubmitStatus}
                            onClick={() => patch.mutate({
                              status: selectedStatus,
                              ...(isApprovedOrIssued ? { newVersion: newVersion.trim(), versionSummary: versionSummary.trim() || "نسخه جدید" } : {}),
                            })}>
                            {patch.isPending ? "در حال ثبت…" : `ثبت انتقال به «${DOC_STATUSES[selectedStatus]?.label ?? selectedStatus}»`}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* ویرایش شرح سند */}
                {hasPerm("documents:edit") && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">ویرایش شرح سند</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      <Textarea value={desc ?? doc.description ?? ""} onChange={(e) => setDesc(e.target.value)} rows={3} />
                      <Button size="sm" variant="outline" disabled={editBlocked || desc === null || desc === (doc.description ?? "")}
                        onClick={() => patch.mutate({
                          description: desc,
                          ...(isApprovedOrIssued ? { newVersion: newVersion.trim(), versionSummary: versionSummary.trim() || "به‌روزرسانی شرح سند" } : {}),
                        })}>
                        ذخیره شرح
                      </Button>
                      {isApprovedOrIssued && versionMissing && <div className="text-xs text-amber-700">برای ذخیره، ابتدا شماره نسخه جدید را در کارت بالا وارد کنید.</div>}
                    </CardContent>
                  </Card>
                )}

                {/* بارگذاری فایل رسمی */}
                {hasPerm("documents:edit") && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2"><Upload className="h-4 w-4" /> بارگذاری فایل رسمی</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="rounded-lg bg-slate-50 border p-2.5 text-xs text-muted-foreground flex gap-1.5">
                        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        زیرساخت بارگذاری مستقیم فایل نیازمند تنظیمات استقرار (ذخیره‌سازی فایل) است؛ در این نسخه نشانی/شناسه فایل رسمی را به‌صورت متن ثبت کنید. ثبت نشانی، هشدار «نیازمند بارگذاری» را رفع می‌کند.
                      </div>
                      <div className="flex gap-2">
                        <Input dir="ltr" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://… یا شناسه سند در مخزن اسناد" className="flex-1" />
                        <Button size="sm" variant="outline" disabled={!fileUrl.trim() || editBlocked}
                          onClick={() => patch.mutate({
                            fileUrl: fileUrl.trim(),
                            ...(isApprovedOrIssued ? { newVersion: newVersion.trim(), versionSummary: versionSummary.trim() || "ثبت فایل رسمی" } : {}),
                          })}>
                          ثبت نشانی فایل
                        </Button>
                      </div>
                      {isApprovedOrIssued && versionMissing && <div className="text-xs text-amber-700">برای ذخیره، ابتدا شماره نسخه جدید را در کارت بالا وارد کنید.</div>}
                    </CardContent>
                  </Card>
                )}

                {/* تاریخچه نسخه‌ها */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4" /> تاریخچه نسخه‌ها ({faNum(doc.versions.length)})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {doc.versions.map((v) => (
                        <div key={v.id} className="flex gap-3 text-sm">
                          <Badge variant="outline" className="font-mono text-[10px] shrink-0 mt-0.5">نسخه {v.version}</Badge>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-slate-700">{v.summary ?? "—"}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">{faDateTime(v.createdAt)}</span>
                            </div>
                            {v.changeNote && <div className="text-xs text-muted-foreground leading-5 mt-0.5">{v.changeNote}</div>}
                            <div className="mt-1"><DocStatusBadge status={v.status} /></div>
                          </div>
                        </div>
                      ))}
                      {doc.versions.length === 0 && <div className="text-sm text-muted-foreground">نسخه‌ای ثبت نشده است.</div>}
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
