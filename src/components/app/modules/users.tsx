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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppStore } from "@/store/app-store";
import { faNum, faDateTime } from "@/lib/persian-date-format";
import { Plus, Pencil, UserX, Info } from "lucide-react";

type UserRow = {
  id: string; username: string; fullName: string; email: string | null; title: string | null;
  isActive: boolean; lastLoginAt: string | null;
  orgUnit: { id: string; name: string } | null;
  roles: { key: string; name: string }[];
};
type RoleRow = { id: string; key: string; name: string; description: string | null; permissions: string[] };
type UnitBrief = { id: string; name: string; isActive: boolean };

export function UsersModule() {
  const qc = useQueryClient();
  const me = useAppStore((s) => s.user);
  const hasPerm = useAppStore((s) => s.hasPerm);
  const canManage = hasPerm("users:manage");
  const canView = hasPerm("users:view");

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<UserRow | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<{ users: UserRow[] }>({
    queryKey: ["users"],
    queryFn: () => api.get("/api/users"),
    enabled: canView,
  });
  const users = data?.users ?? [];
  const activeCount = users.filter((u) => u.isActive).length;

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/api/users/${id}`, { isActive }),
    onSuccess: (_d, vars) => {
      toast({
        title: vars.isActive ? "کاربر فعال شد" : "کاربر غیرفعال شد",
        description: vars.isActive ? undefined : "همه نشست‌های فعال این کاربر خاتمه یافت.",
      });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => toast({ title: "خطا در تغییر وضعیت کاربر", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  if (!canView) {
    return (
      <div className="p-4 lg:p-6">
        <ModuleHeader title="مدیریت کاربران و دسترسی‌ها" />
        <EmptyState title="دسترسی لازم را ندارید" hint="مشاهده فهرست کاربران نیازمند مجوز «مشاهده کاربران» است." />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      <ModuleHeader
        title="مدیریت کاربران و دسترسی‌ها"
        description="کاربران سامانه، نقش‌های سازمانی و وضعیت دسترسی — غیرفعال‌سازی کاربر همه نشست‌های فعال او را بلافاصله خاتمه می‌دهد."
      >
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 ml-1" /> کاربر جدید</Button>
        )}
      </ModuleHeader>

      {!isLoading && !isError && users.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">کل کاربران</div>
            <div className="text-2xl font-bold mt-1">{faNum(users.length)}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">فعال</div>
            <div className="text-2xl font-bold mt-1 text-emerald-700">{faNum(activeCount)}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">غیرفعال</div>
            <div className="text-2xl font-bold mt-1 text-slate-500">{faNum(users.length - activeCount)}</div>
          </CardContent></Card>
        </div>
      )}

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="خطا در دریافت کاربران" onRetry={() => refetch()} />}
      {!isLoading && !isError && users.length === 0 && (
        <EmptyState title="کاربری یافت نشد" hint="کاربران در زمان استقرار سامانه ایجاد می‌شوند." />
      )}

      {users.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <ScrollArea className="max-h-[36rem]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نام کاربری</TableHead>
                    <TableHead>نام کامل</TableHead>
                    <TableHead>واحد سازمانی</TableHead>
                    <TableHead>نقش‌ها</TableHead>
                    <TableHead>فعال</TableHead>
                    <TableHead>آخرین ورود</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} className={!u.isActive ? "opacity-60" : ""}>
                      <TableCell className="font-mono text-xs" dir="ltr">{u.username}</TableCell>
                      <TableCell className="text-xs font-medium">
                        {u.fullName}{u.title ? <span className="text-muted-foreground font-normal"> — {u.title}</span> : null}
                        {u.id === me?.id && <span className="text-[10px] text-muted-foreground"> (حساب شما)</span>}
                      </TableCell>
                      <TableCell className="text-xs">{u.orgUnit?.name ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-64">
                          {u.roles.length === 0 && <span className="text-xs text-slate-400">—</span>}
                          {u.roles.map((r) => (
                            <Badge key={r.key} variant="outline" className="text-[10px] bg-slate-50">{r.name}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={u.isActive}
                          disabled={!canManage || (u.id === me?.id)}
                          onCheckedChange={(v) => {
                            if (!v) setDeactivateTarget(u);
                            else toggleActive.mutate({ id: u.id, isActive: true });
                          }}
                          aria-label={`فعال/غیرفعال — ${u.fullName}`}
                        />
                        {u.id === me?.id && <div className="text-[10px] text-muted-foreground mt-1">غیرفعال‌سازی حساب خودتان مجاز نیست</div>}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{u.lastLoginAt ? faDateTime(u.lastLoginAt) : <span className="text-slate-400">—</span>}</TableCell>
                      <TableCell>
                        {canManage && (
                          <Button size="sm" variant="ghost" onClick={() => setEditTarget(u)}><Pencil className="h-3.5 w-3.5" /></Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {createOpen && <CreateUserDialog onClose={() => setCreateOpen(false)} />}
      {editTarget && <EditUserDialog user={editTarget} meId={me?.id ?? null} onClose={() => setEditTarget(null)} />}

      {/* تأیید غیرفعال‌سازی از جدول */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={(v) => !v && setDeactivateTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><UserX className="h-5 w-5 text-rose-600" /> غیرفعال‌سازی کاربر</AlertDialogTitle>
            <AlertDialogDescription>
              با غیرفعال‌سازی «{deactivateTarget?.fullName}»، همه نشست‌های فعال او بلافاصله خاتمه می‌یابد و امکان ورود مجدد تا فعال‌سازی دوباره وجود ندارد. سوابق و اقدامات او حفظ می‌شود.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => {
                if (deactivateTarget) toggleActive.mutate({ id: deactivateTarget.id, isActive: false });
                setDeactivateTarget(null);
              }}
            >
              غیرفعال کن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ───────────── فرم نقش‌های چندگانه (چک‌باکس) ─────────────
function RolesChecklist({ roles, selected, onChange, disabled }: {
  roles: RoleRow[]; selected: string[]; onChange: (keys: string[]) => void; disabled?: boolean;
}) {
  const toggle = (key: string) => {
    if (disabled) return;
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  };
  if (roles.length === 0) return <div className="text-xs text-muted-foreground py-2">در حال بارگذاری نقش‌ها…</div>;
  return (
    <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
      {roles.map((r) => (
        <label key={r.key} className={`flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50 ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
          <Checkbox checked={selected.includes(r.key)} onCheckedChange={() => toggle(r.key)} className="mt-0.5" disabled={disabled} />
          <div className="min-w-0">
            <div className="text-xs font-medium leading-5">{r.name}</div>
            {r.description && <div className="text-[10px] text-muted-foreground leading-4">{r.description}</div>}
          </div>
        </label>
      ))}
    </div>
  );
}

// ───────────── انتخاب واحد سازمانی ─────────────
function OrgUnitSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useQuery<{ units: UnitBrief[] }>({ queryKey: ["org-units"], queryFn: () => api.get("/api/org-units") });
  const units = data?.units ?? [];
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="انتخاب واحد…" /></SelectTrigger>
      <SelectContent className="max-h-60">
        <SelectItem value="none">— بدون واحد —</SelectItem>
        {units.map((u) => (
          <SelectItem key={u.id} value={u.id}>{u.name}{!u.isActive ? " (غیرفعال)" : ""}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ───────────── ایجاد کاربر ─────────────
function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ username: "", fullName: "", password: "", email: "", title: "", orgUnitId: "none" });
  const [roleKeys, setRoleKeys] = useState<string[]>([]);

  const rolesQ = useQuery<{ roles: RoleRow[] }>({ queryKey: ["roles"], queryFn: () => api.get("/api/roles") });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => api.post("/api/users", {
      username: form.username.trim().toLowerCase(), fullName: form.fullName, password: form.password,
      email: form.email || undefined, title: form.title || undefined,
      orgUnitId: form.orgUnitId === "none" ? undefined : form.orgUnitId, roleKeys,
    }),
    onSuccess: () => {
      toast({ title: "کاربر ایجاد شد", description: "کاربر می‌تواند با گذرواژه تعیین‌شده وارد سامانه شود." });
      qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (e) => toast({ title: "خطا در ایجاد کاربر", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  const valid = form.username.trim().length >= 3 && form.fullName.trim().length >= 3 && form.password.length >= 8;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">ایجاد کاربر جدید</DialogTitle>
          <DialogDescription>نام کاربری یکتا و گذرواژه حداقل ۸ نویسه — نقش‌ها سطح دسترسی را تعیین می‌کنند.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nu-username">نام کاربری</Label>
              <Input id="nu-username" dir="ltr" value={form.username} onChange={(e) => set("username", e.target.value)} placeholder="مثال: a.ahmadi" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-full">نام کامل</Label>
              <Input id="nu-full" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="نام و نام خانوادگی" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-pass">گذرواژه (حداقل ۸ نویسه)</Label>
              <Input id="nu-pass" type="password" dir="ltr" value={form.password} onChange={(e) => set("password", e.target.value)} className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-email">ایمیل (اختیاری)</Label>
              <Input id="nu-email" type="email" dir="ltr" value={form.email} onChange={(e) => set("email", e.target.value)} className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-title">عنوان شغلی</Label>
              <Input id="nu-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="اختیاری" />
            </div>
            <div className="space-y-1.5">
              <Label>واحد سازمانی</Label>
              <OrgUnitSelect value={form.orgUnitId} onChange={(v) => set("orgUnitId", v)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>نقش‌ها</Label>
            <RolesChecklist roles={rolesQ.data?.roles ?? []} selected={roleKeys} onChange={setRoleKeys} />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !valid}>
            {save.isPending ? "در حال ایجاد…" : "ایجاد کاربر"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── ویرایش کاربر ─────────────
function EditUserDialog({ user, meId, onClose }: { user: UserRow; meId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isSelf = user.id === meId;
  const [form, setForm] = useState({
    fullName: user.fullName, email: user.email ?? "", title: user.title ?? "",
    orgUnitId: user.orgUnit?.id ?? "none", password: "",
  });
  const [roleKeys, setRoleKeys] = useState<string[]>(user.roles.map((r) => r.key));
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const rolesQ = useQuery<{ roles: RoleRow[] }>({ queryKey: ["roles"], queryFn: () => api.get("/api/roles") });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => api.patch(`/api/users/${user.id}`, {
      fullName: form.fullName, email: form.email, title: form.title,
      orgUnitId: form.orgUnitId === "none" ? "" : form.orgUnitId,
      roleKeys, password: form.password || undefined,
    }),
    onSuccess: () => {
      toast({ title: "تغییرات کاربر ذخیره شد", description: form.password ? "گذرواژه بازنشانی شد." : undefined });
      qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (e) => toast({ title: "خطا در ذخیره تغییرات", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  const deactivate = useMutation({
    mutationFn: () => api.patch(`/api/users/${user.id}`, { isActive: false }),
    onSuccess: () => {
      toast({ title: "کاربر غیرفعال شد", description: "همه نشست‌های فعال این کاربر خاتمه یافت." });
      qc.invalidateQueries({ queryKey: ["users"] });
      setConfirmDeactivate(false);
      onClose();
    },
    onError: (e) => toast({ title: "خطا در غیرفعال‌سازی", description: e instanceof ApiClientError ? e.message : "خطای نامشخص", variant: "destructive" }),
  });

  return (
    <>
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">ویرایش کاربر — {user.fullName}</DialogTitle>
            <DialogDescription>
              <span dir="ltr" className="font-mono text-[11px]">{user.username}</span>
              {" · "}آخرین ورود: {user.lastLoginAt ? faDateTime(user.lastLoginAt) : "—"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="eu-full">نام کامل</Label>
                <Input id="eu-full" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eu-title">عنوان شغلی</Label>
                <Input id="eu-title" value={form.title} onChange={(e) => set("title", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eu-email">ایمیل</Label>
                <Input id="eu-email" type="email" dir="ltr" value={form.email} onChange={(e) => set("email", e.target.value)} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>واحد سازمانی</Label>
                <OrgUnitSelect value={form.orgUnitId} onChange={(v) => set("orgUnitId", v)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eu-pass">بازنشانی گذرواژه</Label>
                <Input id="eu-pass" type="password" dir="ltr" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="برای تغییر، گذرواژه جدید (≥۸)" className="font-mono" />
                {form.password && form.password.length < 8 && <div className="text-[10px] text-rose-600">گذرواژه باید حداقل ۸ نویسه باشد.</div>}
              </div>
              <div className="space-y-1.5">
                <Label>وضعیت حساب</Label>
                <div className="flex items-center gap-2 h-9">
                  {user.isActive ? (
                    <Button type="button" size="sm" variant="outline" className="text-rose-700 border-rose-200 hover:bg-rose-50" disabled={isSelf}
                      onClick={() => setConfirmDeactivate(true)}>
                      <UserX className="h-3.5 w-3.5 ml-1" /> غیرفعال‌سازی حساب
                    </Button>
                  ) : (
                    <Badge variant="outline" className="bg-zinc-100 text-zinc-600">غیرفعال — برای فعال‌سازی از کلید جدول استفاده کنید</Badge>
                  )}
                </div>
                {isSelf && <div className="text-[10px] text-muted-foreground">غیرفعال‌سازی حساب خودتان مجاز نیست.</div>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>نقش‌ها</Label>
              <RolesChecklist roles={rolesQ.data?.roles ?? []} selected={roleKeys} onChange={setRoleKeys} />
            </div>
            <div className="rounded-lg bg-slate-50 border p-2.5 text-[11px] text-muted-foreground flex gap-2 leading-4">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              تغییر نقش‌ها از ورود بعدی کاربر اعمال می‌شود؛ تغییر وضعیت فعال از جدول به‌صورت فوری اعمال و نشست‌ها خاتمه می‌یابد.
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={onClose}>انصراف</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.fullName.trim() || (!!form.password && form.password.length < 8)}>
              {save.isPending ? "در حال ذخیره…" : "ذخیره تغییرات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>غیرفعال‌سازی کاربر</AlertDialogTitle>
            <AlertDialogDescription>
              با غیرفعال‌سازی «{user.fullName}»، همه نشست‌های فعال او بلافاصله خاتمه می‌یابد و امکان ورود مجدد تا فعال‌سازی دوباره وجود ندارد. ادامه می‌دهید؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-700" onClick={() => deactivate.mutate()}>
              غیرفعال کن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
