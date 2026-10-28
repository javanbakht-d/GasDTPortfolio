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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/store/app-store";
import { faNum } from "@/lib/persian-date-format";
import { Info, Plus, Wallet } from "lucide-react";

type BudgetRow = {
  id: string; year: number; title: string; category: string;
  amountEstimate: string | null; unit: string | null;
  status: string; documentRef: string | null; refStep: number | null; notes: string | null;
};

const CATEGORIES: Record<string, string> = {
  HARDWARE: "سخت‌افزار و زیرساخت", SOFTWARE: "نرم‌افزار و سکو", SERVICES: "خدمات و مشاوره",
  TRAINING: "توانمندسازی و آموزش", OTHER: "سایر",
};
const STATUSES: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "پیش‌نویس", color: "bg-stone-100 text-stone-700 border-stone-200" },
  SUBMITTED: { label: "ارسال‌شده", color: "bg-amber-50 text-amber-800 border-amber-200" },
  CONFIRMED: { label: "تأییدشده", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export function BudgetModule() {
  const hasPerm = useAppStore((s) => s.hasPerm);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<{ items: BudgetRow[] }>({
    queryKey: ["budget"],
    queryFn: () => api.get("/api/budget"),
  });

  const items = data?.items ?? [];
  const years = useMemo(() => Array.from(new Set(items.map((i) => i.year))).sort((a, b) => b - a), [items]);

  return (
    <div className="p-4 lg:p-6">
      <ModuleHeader
        title="برآورد بودجه تحول دیجیتال"
        description="اقلام برآوردی بودجه پیشران پروژه‌های تحول دیجیتال (گام‌های ۷ و ۲۹) — گروه‌بندی بر اساس سال و دسته."
      >
        {hasPerm("budget:manage") && (
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 ml-1" /> قلم بودجه جدید</Button>
        )}
      </ModuleHeader>

      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex gap-2 leading-5 mb-5">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          مبالغ این بخش <b>برآورد متنی</b> هستند؛ تا تکمیل چرخه رسمی بودجه سال ۱۴۰۶ (گام ۲۹) رقم قطعی ثبت نمی‌شود و به‌همین دلیل <b>جمع ریالی نمایش داده نمی‌شود</b> — ثبت عدد ساختگی ممنوع است.
        </span>
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="خطا در دریافت اقلام بودجه" onRetry={() => refetch()} />}
      {!isLoading && !isError && items.length === 0 && (
        <EmptyState
          title="قلم بودجه‌ای ثبت نشده است"
          hint="برآوردهای اولیه بودجه پس از تکمیل فرم‌های پیشنهادی واحدها (گام ۷) در این بخش ثبت می‌شود."
          action={hasPerm("budget:manage") ? <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 ml-1" /> ثبت اولین قلم</Button> : undefined}
        />
      )}

      {years.map((year) => {
        const yearItems = items.filter((i) => i.year === year);
        const catCounts = Object.entries(CATEGORIES).map(([k, label]) => ({ k, label, n: yearItems.filter((i) => i.category === k).length })).filter((c) => c.n > 0);
        return (
          <div key={year} className="mb-6">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-700" />
                <span className="font-bold text-sm">سال {faNum(year)}</span>
              </div>
              <Badge variant="outline">{faNum(yearItems.length)} قلم</Badge>
              {catCounts.map((c) => (
                <Badge key={c.k} variant="outline" className="text-[10px] bg-slate-50">{c.label}: {faNum(c.n)}</Badge>
              ))}
            </div>
            <Card>
              <CardContent className="p-4">
                <ScrollArea className="max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>عنوان</TableHead>
                        <TableHead>دسته</TableHead>
                        <TableHead>برآورد (متنی)</TableHead>
                        <TableHead>واحد</TableHead>
                        <TableHead>وضعیت</TableHead>
                        <TableHead>سند مرجع</TableHead>
                        <TableHead>گام</TableHead>
                        <TableHead>یادداشت</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {yearItems.map((i) => {
                        const st = STATUSES[i.status];
                        return (
                          <TableRow key={i.id}>
                            <TableCell className="text-xs font-medium max-w-56"><div className="truncate" title={i.title}>{i.title}</div></TableCell>
                            <TableCell className="text-xs">{CATEGORIES[i.category] ?? i.category}</TableCell>
                            <TableCell className="text-xs">{i.amountEstimate?.trim() || <span className="text-slate-400">—</span>}</TableCell>
                            <TableCell className="text-xs">{i.unit?.trim() || <span className="text-slate-400">—</span>}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${st?.color ?? ""}`}>{st?.label ?? i.status}</span>
                            </TableCell>
                            <TableCell className="text-xs">{i.documentRef?.trim() || <span className="text-slate-400">—</span>}</TableCell>
                            <TableCell className="text-xs">{i.refStep != null ? faNum(i.refStep) : "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-48"><div className="truncate" title={i.notes ?? ""}>{i.notes?.trim() || "—"}</div></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        );
      })}

      {createOpen && <CreateBudgetDialog defaultYear={years[0] ?? 1406} onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function CreateBudgetDialog({ defaultYear, onClose }: { defaultYear: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "", year: String(defaultYear), category: "HARDWARE",
    amountEstimate: "", unit: "", documentRef: "", notes: "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => api.post("/api/budget", {
      title: form.title, year: Number(form.year) || 1406, category: form.category,
      amountEstimate: form.amountEstimate || undefined, unit: form.unit || undefined,
      documentRef: form.documentRef || undefined, notes: form.notes || undefined,
    }),
    onSuccess: () => {
      toast({ title: "قلم بودجه ثبت شد", description: "برآورد به‌صورت متنی ثبت می‌شود — رقم قطعی پس از تصویب بودجه ۱۴۰۶." });
      qc.invalidateQueries({ queryKey: ["budget"] });
      onClose();
    },
    onError: (e) => toast({ title: "خطا در ثبت قلم بودجه", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">ثبت قلم بودجه (برآورد)</DialogTitle>
          <DialogDescription>مبلغ را به‌صورت برآورد متنی وارد کنید — مثال: «حدود ۴۰ میلیارد ریال (برآورد اولیه)». ثبت رقم قطعی بدون سند رسمی ممنوع است.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="b-title">عنوان قلم</Label>
            <Input id="b-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="مثال: زیرساخت ابری سکوی یکپارچه داده" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="b-year">سال</Label>
              <Input id="b-year" value={form.year} onChange={(e) => set("year", e.target.value.replace(/\D/g, ""))} dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>دسته</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-amount">برآورد (متنی)</Label>
              <Input id="b-amount" value={form.amountEstimate} onChange={(e) => set("amountEstimate", e.target.value)} placeholder="برآورد متنی — بدون رقم قطعی" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-unit">واحد</Label>
              <Input id="b-unit" value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="مثال: ریال / نفر-ماه" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-ref">سند مرجع</Label>
              <Input id="b-ref" value={form.documentRef} onChange={(e) => set("documentRef", e.target.value)} placeholder="مثال: فرم پیشنهاد واحد IT" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-notes">یادداشت</Label>
            <Textarea id="b-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="فرضیات برآورد، محدوده و …" />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim()}>
            {save.isPending ? "در حال ثبت…" : "ثبت قلم بودجه"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
