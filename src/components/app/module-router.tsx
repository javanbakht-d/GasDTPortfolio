"use client";

import { useAppStore } from "@/store/app-store";
import { MyDeskModule } from "@/components/app/modules/my-desk";
import { DashboardModule } from "@/components/app/modules/dashboard";
import { ActionsModule } from "@/components/app/modules/actions";
import { CalendarModule } from "@/components/app/modules/calendar";
import { OrganizationModule } from "@/components/app/modules/organization";
import { DocumentsModule } from "@/components/app/modules/documents";
import { PortfolioModule } from "@/components/app/modules/portfolio";
import { GovernanceModule } from "@/components/app/modules/governance";
import { AiRegistryModule } from "@/components/app/modules/ai-registry";
import { KpisModule } from "@/components/app/modules/kpis";
import { RisksModule } from "@/components/app/modules/risks";
import { MeetingsModule } from "@/components/app/modules/meetings";
import { BudgetModule } from "@/components/app/modules/budget";
import { ReportsModule } from "@/components/app/modules/reports";
import { KnowledgeModule } from "@/components/app/modules/knowledge";
import { UsersModule } from "@/components/app/modules/users";
import { SettingsModule } from "@/components/app/modules/settings";

/** مسیریاب ماژول‌ها در مسیر یکتای سامانه — ناوبری SPA سمت کلاینت */
export function ModuleRouter() {
  const active = useAppStore((s) => s.activeModule);
  switch (active) {
    case "my-desk": return <MyDeskModule />;
    case "dashboard": return <DashboardModule />;
    case "actions": return <ActionsModule />;
    case "calendar": return <CalendarModule />;
    case "organization": return <OrganizationModule />;
    case "documents": return <DocumentsModule />;
    case "portfolio": return <PortfolioModule />;
    case "governance": return <GovernanceModule />;
    case "ai-registry": return <AiRegistryModule />;
    case "kpis": return <KpisModule />;
    case "risks": return <RisksModule />;
    case "meetings": return <MeetingsModule />;
    case "budget": return <BudgetModule />;
    case "reports": return <ReportsModule />;
    case "knowledge": return <KnowledgeModule />;
    case "users": return <UsersModule />;
    case "settings": return <SettingsModule />;
    default: return <MyDeskModule />;
  }
}
