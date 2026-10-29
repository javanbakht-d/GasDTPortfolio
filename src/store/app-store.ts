"use client";
import { create } from "zustand";

export type ModuleKey =
  | "my-desk" | "dashboard" | "actions" | "calendar" | "organization" | "documents"
  | "portfolio" | "governance" | "ai-registry" | "kpis" | "risks" | "meetings"
  | "budget" | "reports" | "knowledge" | "ai-assistant" | "users" | "settings" | "guide";

export type SessionUser = {
  id: string;
  username: string;
  fullName: string;
  title?: string | null;
  orgUnitId?: string | null;
  orgUnitName?: string | null;
  roles: { key: string; name: string; permissions: string[] }[];
  permissions: string[];
};

type AppState = {
  user: SessionUser | null;
  authReady: boolean;
  baselineDate: string | null;
  activeModule: ModuleKey;
  sidebarCollapsed: boolean;
  detailActionId: string | null;
  setUser: (u: SessionUser | null) => void;
  setAuthReady: (v: boolean) => void;
  setBaselineDate: (v: string | null) => void;
  setModule: (m: ModuleKey) => void;
  toggleSidebar: () => void;
  openAction: (id: string | null) => void;
  hasPerm: (perm: string) => boolean;
};

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  authReady: false,
  baselineDate: null,
  activeModule: "my-desk",
  sidebarCollapsed: false,
  detailActionId: null,
  setUser: (u) => set({ user: u }),
  setAuthReady: (v) => set({ authReady: v }),
  setBaselineDate: (v) => set({ baselineDate: v }),
  setModule: (m) => set({ activeModule: m }),
  toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
  openAction: (id) => set({ detailActionId: id }),
  hasPerm: (perm) => {
    const u = get().user;
    if (!u) return false;
    return u.permissions.includes("*") || u.permissions.includes(perm);
  },
}));
