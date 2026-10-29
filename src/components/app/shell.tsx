"use client";

import { useEffect, useState } from "react";
import { useAppStore, type ModuleKey } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { faNum, faDate } from "@/lib/persian-date-format";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ModuleRouter } from "@/components/app/module-router";
import { AiAssistantPanel } from "@/components/app/modules/ai-assistant";
import { AboutDialog } from "@/components/app/about-dialog";
import { ThemeToggle } from "@/components/app/theme-toggle";
import {
  LayoutDashboard, ListChecks, CalendarRange, Building2, FileText, Briefcase,
  Database, Bot, Gauge, ShieldAlert, Gavel, Wallet, FileBarChart2, BookOpen,
  Users, Settings, Bell, PanelRightClose, PanelRightOpen, LogOut,
  UserCircle, Sparkles, Search, ChevronLeft, Home, Info,
} from "lucide-react";

type NavItem = { key: ModuleKey; label: string; icon: React.ElementType; perm?: string; group: string };

const NAV: NavItem[] = [
  { key: "my-desk", label: "میزکار روزانه", icon: Home, group: "پایش" },
  { key: "dashboard", label: "داشبورد راهبری کلان", icon: LayoutDashboard, group: "پایش" },
  { key: "actions", label: "اقدامات و تعهدات", icon: ListChecks, perm: "actions:view", group: "پایش" },
  { key: "calendar", label: "تقویم، مهلت‌ها و گانت", icon: CalendarRange, group: "پایش" },
  { key: "kpis", label: "شاخص‌ها و سنجش عملکرد", icon: Gauge, perm: "kpis:view", group: "پایش" },
  { key: "risks", label: "ریسک‌ها، انحرافات و اقدامات جبرانی", icon: ShieldAlert, perm: "risks:view", group: "پایش" },
  { key: "documents", label: "مدیریت اسناد و مصوبات", icon: FileText, perm: "documents:view", group: "اجرا" },
  { key: "portfolio", label: "سبد پروژه‌های تحول دیجیتال", icon: Briefcase, perm: "projects:view", group: "اجرا" },
  { key: "governance", label: "حاکمیت داده", icon: Database, perm: "governance:view", group: "اجرا" },
  { key: "ai-registry", label: "دفتر ثبت کاربردهای هوش مصنوعی", icon: Bot, perm: "ai_registry:view", group: "اجرا" },
  { key: "meetings", label: "جلسات، صورت‌جلسات و تصمیم‌ها", icon: Gavel, perm: "meetings:view", group: "اجرا" },
  { key: "budget", label: "بودجه و منابع", icon: Wallet, perm: "budget:view", group: "اجرا" },
  { key: "organization", label: "سازمان‌ها و واحدها", icon: Building2, perm: "org:view", group: "پشتیبانی" },
  { key: "reports", label: "گزارش‌ها و تحلیل‌های هوشمند", icon: FileBarChart2, perm: "reports:view", group: "پشتیبانی" },
  { key: "knowledge", label: "مرکز دانش و پشتیبانی", icon: BookOpen, perm: "knowledge:view", group: "پشتیبانی" },
  { key: "users", label: "مدیریت کاربران و دسترسی‌ها", icon: Users, perm: "users:view", group: "راهبری سامانه" },
  { key: "settings", label: "تنظیمات و راهبری سامانه", icon: Settings, perm: "settings:manage", group: "راهبری سامانه" },
];

export type Notification = { id: string; type: string; title: string; body?: string | null; isRead: boolean; createdAt: string; severity?: string; actionHint?: string | null };

export function Shell() {
  const user = useAppStore((s) => s.user);
  const activeModule = useAppStore((s) => s.activeModule);
  const setModule = useAppStore((s) => s.setModule);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const setUser = useAppStore((s) => s.setUser);
  const hasPerm = useAppStore((s) => s.hasPerm);
  const baselineDate = useAppStore((s) => s.baselineDate);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ label: string; module: ModuleKey }[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const visibleNav = NAV.filter((n) => !n.perm || hasPerm(n.perm));
  const unread = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const res = await api.get<{ notifications: Notification[] }>("/api/notifications");
        if (live) setNotifications(res.notifications.slice(0, 12));
      } catch { /* بی‌صدا */ }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { live = false; clearInterval(t); };
  }, [activeModule]);

  // اتصال میزکار روزانه و سایر ماژول‌ها به پنل دستیار
  useEffect(() => {
    const openHandler = () => setAiOpen(true);
    const askHandler = (e: Event) => {
      const q = (e as CustomEvent<string>).detail;
      setAiOpen(true);
      window.dispatchEvent(new CustomEvent("nigc-ai-question", { detail: q }));
    };
    window.addEventListener("nigc-open-ai", openHandler);
    window.addEventListener("nigc-ask-ai", askHandler);
    return () => {
      window.removeEventListener("nigc-open-ai", openHandler);
      window.removeEventListener("nigc-ask-ai", askHandler);
    };
  }, []);

  const markAllRead = async () => {
    await api.patch("/api/notifications", {}).catch(() => undefined);
    setNotifications((ns) => ns.map((n) => ({ ...n, isRead: true })));
  };

  const doSearch = (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    const results: { label: string; module: ModuleKey }[] = [];
    for (const item of visibleNav) {
      if (item.label.includes(q)) results.push({ label: `منو: ${item.label}`, module: item.key });
    }
    // جست‌وجوی گام‌ها با شماره
    const num = q.match(/\d+/);
    if (num) results.push({ label: `گام ${faNum(num[0])} در اقدامات و تعهدات`, module: "actions" });
    setSearchResults(results.slice(0, 8));
    setSearchOpen(true);
  };

  const logout = async () => {
    await api.post("/api/auth/logout").catch(() => undefined);
    setUser(null);
  };

  const currentLabel = NAV.find((n) => n.key === activeModule)?.label ?? "";

  const groups = Array.from(new Set(visibleNav.map((n) => n.group)));

  // بستن منوی موبایل پس از ناوبری
  const goModule = (m: ModuleKey) => {
    setModule(m);
    setMobileNavOpen(false);
  };

  if (!user) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen flex bg-muted/60" dir="rtl">
        {/* پس‌زمینه منوی موبایل */}
        {mobileNavOpen && (
          <div
            className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
        )}
        {/* منوی کناری — در موبایل: کشویی، در دسکتاپ: ثابت */}
        <aside
          className={cn(
            "bg-slate-900 text-slate-200 flex flex-col transition-all duration-200 shrink-0",
            // موبایل: پنل ثابت سمت راست با ترنسفورم
            "fixed inset-y-0 right-0 z-50 w-64 lg:static lg:z-auto",
            mobileNavOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0",
            // دسکتاپ: جمع‌شونده
            collapsed ? "lg:w-16" : "lg:w-64"
          )}
        >
          <div className="h-16 flex items-center gap-2.5 px-4 border-b border-slate-800">
            {/* لوگوی رسمی شرکت ملی گاز ایران */}
            <div className="h-10 w-10 rounded-lg bg-card flex items-center justify-center shrink-0 overflow-hidden">
              <img src="/nigc-logo.png" alt="لوگوی شرکت ملی گاز ایران" className="h-9 w-9 object-contain" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">NIGC-DTG</div>
                <div className="text-[10px] text-muted-foreground/80 truncate">شرکت ملی گاز ایران</div>
              </div>
            )}
          </div>

          <ScrollArea className="flex-1 py-2">
            <nav aria-label="ناوبری اصلی">
              {groups.map((g) => (
                <div key={g}>
                  {!collapsed && <div className="px-4 pt-3 pb-1 text-[10px] font-medium text-muted-foreground">{g}</div>}
                  {visibleNav.filter((n) => n.group === g).map((item) => {
                    const Icon = item.icon;
                    const active = activeModule === item.key;
                    const collapsedNow = collapsed;
                    const btn = (
                      <button
                        key={item.key}
                        onClick={() => {
                          setModule(item.key);
                          setMobileNavOpen(false);
                        }}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-right",
                          "hover:bg-secondary/80 focus-visible:outline focus-visible:outline-amber-400",
                          active ? "bg-white/10 text-white border-r-2 border-amber-400" : "text-slate-300"
                        )}
                      >
                        <Icon className={cn("shrink-0 h-[18px] w-[18px]", active ? "text-amber-400" : "text-muted-foreground/80")} />
                        {!collapsedNow && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                    return collapsedNow ? (
                      <Tooltip key={item.key}>
                        <TooltipTrigger asChild>{btn}</TooltipTrigger>
                        <TooltipContent side="left">{item.label}</TooltipContent>
                      </Tooltip>
                    ) : btn;
                  })}
                </div>
              ))}
            </nav>
          </ScrollArea>

          <div className="p-2 border-t border-slate-800">
            <button
              onClick={() => { setAiOpen(true); setMobileNavOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-secondary/80 rounded-lg transition-colors"
            >
              <Sparkles className="h-[18px] w-[18px] text-amber-400" />
              {!collapsed && <span>دستیار هوشمند دبیرخانه</span>}
            </button>
            <button
              onClick={toggleSidebar}
              className="hidden lg:flex w-full items-center gap-3 px-4 py-2 text-xs text-muted-foreground/80 hover:bg-secondary/80 rounded-lg transition-colors"
              aria-label={collapsed ? "بازکردن منو" : "جمع‌کردن منو"}
            >
              {collapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
              {!collapsed && <span>جمع‌کردن منو</span>}
            </button>
          </div>
        </aside>

        {/* بدنه اصلی */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* نوار بالایی */}
          <header className="h-16 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 border-b flex items-center gap-3 lg:gap-4 px-3 lg:px-6 sticky top-0 z-30">
            {/* دکمه منو در موبایل */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden shrink-0"
              onClick={() => setMobileNavOpen(true)}
              aria-label="بازکردن منوی اصلی"
            >
              <PanelRightOpen className="h-5 w-5" />
            </Button>
            <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
              <span>دبیرخانه</span>
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">{currentLabel}</span>
            </div>

            {/* جست‌وجوی سراسری */}
            <div className="flex-1 max-w-md relative mr-auto">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => doSearch(e.target.value)}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                placeholder="جست‌وجو در منوها و گام‌ها…"
                className="w-full h-9 rounded-lg bg-muted pr-9 pl-3 text-sm outline-none focus:bg-muted/60 focus:ring-2 focus:ring-emerald-600/30"
                aria-label="جست‌وجوی سراسری"
              />
              {searchOpen && searchResults.length > 0 && (
                <div className="absolute top-11 inset-x-0 bg-card rounded-xl shadow-lg border p-1.5 z-50">
                  {searchResults.map((r, i) => (
                    <button
                      key={i}
                      onMouseDown={() => { setModule(r.module); setQuery(""); setSearchOpen(false); }}
                      className="w-full text-right px-3 py-2 rounded-lg hover:bg-muted text-sm"
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {baselineDate && (
              <div className="hidden lg:block text-xs text-muted-foreground whitespace-nowrap">
                روز {faNum(Math.max(0, Math.floor((Date.now() - new Date(baselineDate).getTime()) / 86400000)))} برنامه · مبنا: {faDate(baselineDate)}
              </div>
            )}

            {/* تعویض تم روشن/تاریک */}
            <ThemeToggle />

            {/* اعلان‌ها */}
            <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label={`اعلان‌ها${unread ? ` (${faNum(unread)} نخوانده)` : ""}`}>
                  <Bell className="h-5 w-5" />
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -left-0.5 h-4 min-w-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center px-1">
                      {unread > 9 ? "۹+" : unread.toLocaleString("fa-IR")}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-sm font-semibold">اعلان‌ها</span>
                  {unread > 0 && (
                    <button onClick={markAllRead} className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline">خواندن همه</button>
                  )}
                </div>
                <DropdownMenuSeparator />
                {notifications.length === 0 && (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">اعلان جدیدی نیست</div>
                )}
                {notifications.map((n) => (
                  <DropdownMenuItem key={n.id} className="flex-col items-start gap-0.5 py-2.5" onClick={() => { if (!n.isRead) api.patch("/api/notifications", { id: n.id }).catch(() => undefined); }}>
                    <div className="flex items-center gap-2 w-full">
                      {n.severity === "CRITICAL" ? (
                        <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" aria-label="بحرانی" />
                      ) : n.severity === "IMPORTANT" ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" aria-label="مهم" />
                      ) : !n.isRead ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      ) : <span className="h-1.5 w-1.5 shrink-0" />}
                      <span className="text-sm font-medium line-clamp-2">{n.title}</span>
                    </div>
                    {n.body && <span className="text-xs text-muted-foreground line-clamp-2">{n.body}</span>}
                    {n.actionHint && <span className="text-[10px] text-emerald-700 dark:text-emerald-400">اقدام پیشنهادی: {n.actionHint}</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* منوی کاربر */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2" aria-label="منوی کاربر">
                  <UserCircle className="h-6 w-6 text-muted-foreground" />
                  <span className="hidden md:block text-sm font-medium">{user.fullName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <div className="font-bold">{user.fullName}</div>
                  <div className="text-xs font-normal text-muted-foreground">{user.title ?? user.username}</div>
                  {user.orgUnitName && <Badge variant="secondary" className="mt-1.5">{user.orgUnitName}</Badge>}
                </DropdownMenuLabel>
                <div className="px-2 pb-2 flex flex-wrap gap-1">
                  {user.roles.map((r) => (
                    <Badge key={r.key} variant="outline" className="text-[10px] font-normal">{r.name}</Badge>
                  ))}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setModule("my-desk")}>
                  <Home className="h-4 w-4 ml-2" /> میزکار روزانه
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAboutOpen(true)}>
                  <Info className="h-4 w-4 ml-2" /> درباره سامانه و طراح
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="text-rose-600 dark:text-rose-400 focus:text-rose-600 dark:text-rose-400">
                  <LogOut className="h-4 w-4 ml-2" /> خروج از سامانه
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          {/* محتوای ماژول */}
          <main className="flex-1 min-h-0" role="main">
            <ModuleRouter />
          </main>

          {/* پانویس چسبان */}
          <footer className="mt-auto bg-card border-t py-2.5 px-6 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <div>سامانه یکپارچه راهبری تحول دیجیتال و حکمرانی هوشمند — شرکت ملی گاز ایران (NIGC-DTG)</div>
            <div className="flex items-center gap-3">
              <button onClick={() => setAboutOpen(true)} className="hover:text-foreground underline-offset-2 hover:underline">درباره سامانه</button>
              <span>فعالیت‌ها در سوابق ممیزی ثبت می‌شود · منطقه زمانی: تهران (Asia/Tehran)</span>
            </div>
          </footer>
        </div>

        {/* پنل دستیار هوشمند */}
        <AiAssistantPanel open={aiOpen} onOpenChange={setAiOpen} />

        {/* گفت‌وگوی درباره سامانه */}
        <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      </div>
    </TooltipProvider>
  );
}
