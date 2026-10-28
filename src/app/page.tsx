"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { api } from "@/lib/api-client";
import { LoginScreen } from "@/components/app/login-screen";
import { Shell } from "@/components/app/shell";
import { Providers } from "@/components/app/providers";
import { Loader2 } from "lucide-react";

export default function Home() {
  const user = useAppStore((s) => s.user);
  const authReady = useAppStore((s) => s.authReady);
  const setUser = useAppStore((s) => s.setUser);
  const setAuthReady = useAppStore((s) => s.setAuthReady);
  const setBaseline = useAppStore((s) => s.setBaselineDate);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let live = true;
    api.get<{ user: never; baselineDate: string }>("/api/auth/me")
      .then((res) => {
        if (!live) return;
        setUser(res.user);
        setBaseline(res.baselineDate);
      })
      .catch(() => undefined)
      .finally(() => {
        if (live) { setAuthReady(true); setChecked(true); }
      });
    return () => { live = false; };
  }, [setUser, setAuthReady, setBaseline]);

  if (!authReady && !checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
          <span className="text-sm">در حال بررسی نشست…</span>
        </div>
      </div>
    );
  }

  return (
    <Providers>
      {!user ? <LoginScreen /> : <Shell />}
    </Providers>
  );
}
