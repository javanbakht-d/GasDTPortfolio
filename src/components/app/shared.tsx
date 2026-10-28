"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ACTION_STATUSES, PROJECT_STATUSES, DOC_STATUSES, AI_APP_STATUSES, PRIORITIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react";

export function ModuleHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1 max-w-3xl leading-6">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function ActionStatusBadge({ status, className }: { status: string; className?: string }) {
  const s = ACTION_STATUSES[status];
  if (!s) return <Badge variant="outline">{status}</Badge>;
  return (
    <span title={s.desc} className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", s.color, className)}>
      {s.label}
    </span>
  );
}

export function ProjectStatusBadge({ status }: { status: string }) {
  const s = PROJECT_STATUSES[status];
  if (!s) return <Badge variant="outline">{status}</Badge>;
  return (
    <span title={s.desc} className={cn("inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium", s.color)}>
      {s.label}
    </span>
  );
}

export function DocStatusBadge({ status }: { status: string }) {
  const s = DOC_STATUSES[status];
  if (!s) return <Badge variant="outline">{status}</Badge>;
  return <span className={cn("inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium", s.color)}>{s.label}</span>;
}

export function AiStatusBadge({ status }: { status: string }) {
  const s = AI_APP_STATUSES[status];
  if (!s) return <Badge variant="outline">{status}</Badge>;
  return <span className={cn("inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium", s.color)}>{s.label}</span>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const p = PRIORITIES[priority];
  if (!p) return null;
  return <span className={cn("text-xs font-medium", p.color)}>{p.label}</span>;
}

export function LoadingState({ label = "در حال بارگذاری…" }: { label?: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {label}
      </div>
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
        <Inbox className="h-10 w-10 text-muted-foreground/40" />
        <div className="font-medium">{title}</div>
        {hint && <div className="text-sm text-muted-foreground max-w-md">{hint}</div>}
        {action}
      </CardContent>
    </Card>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="border-rose-200 bg-rose-50/50">
      <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-3">
        <AlertTriangle className="h-8 w-8 text-rose-500" />
        <div className="font-medium text-rose-800">{message}</div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 ml-1" /> تلاش مجدد
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
