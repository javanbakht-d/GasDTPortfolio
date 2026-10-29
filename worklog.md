# NIGC-DTG Worklog — سامانه یکپارچه راهبری تحول دیجیتال و حکمرانی هوشمند شرکت ملی گاز ایران

Project: NIGC Digital Transformation & Intelligent Governance Platform (NIGC-DTG)
Stack: Next.js 16 App Router + TypeScript + Tailwind 4 + shadcn/ui + Prisma(SQLite) + z-ai-web-dev-sdk
Constraint: single visible route `/` (SPA-style module switching on one page). APIs under src/app/api/*.

---
Task ID: 0
Agent: main (Z.ai Code)
Task: Analyze reference documents, define architecture plan.

Work Log:
- Read `upload/Pasted Content_1793091759125.txt` (comprehensive prompt, 23 sections).
- Extracted `upload/folder/d45c8948/NIGC-Secretariat-NextSteps-Action-Plan.docx` via pandoc → /tmp/nigc-action-plan.md (37 steps, 5 time groups, 7 annual phases/KPI references, 3 drivers).

Stage Summary:
- Key decisions:
  - Single-route SPA: all 17 nav modules rendered conditionally on `/` via zustand-driven module switch. Server-side permissions enforced in API routes.
  - Auth: custom session token (Session table + httpOnly cookie), bcryptjs password hash. No NextAuth (lighter, full control).
  - RBAC: Role.permissions as JSON string array; `can(user, perm)` helper; org-scope filtering (unit users see own unit data; secretariat/admin see all).
  - Baseline date (روز صفر) = configurable setting, seeded 2026-10-23 (= ۱ آبان ۱۴۰۵), Tehran timezone. Deadlines computed from relative day ranges in each of the 37 steps.
  - Palette: dark slate sidebar + emerald/teal primary + amber accent (no blue/indigo). Vazirmatn font via CDN link with system fallback.
  - Persian dates via Intl.DateTimeFormat('fa-IR-u-ca-persian').
  - 37 steps seeded verbatim from the reference doc with refStep numbers kept traceable.
  - 8 KPIs seeded as structure-only with `needsDefinition: true` (no fabricated baselines — rule 2.5.9).
  - AI assistant via z-ai-web-dev-sdk on backend, grounded retrieval over permitted records, graceful "needs configuration" state.

---
Task ID: 2-3
Agent: main (Z.ai Code)
Task: Database schema + seed + backend core/API layer

Work Log:
- Wrote prisma/schema.prisma: 27 models (User, Role, UserRole, OrgUnit, Session, Setting, BaselineChange, Action, ActionUpdate, Document, DocumentVersion, Project, ProjectScore, DataDomain, DigitalStatusEntry, AiApplication, Kpi, KpiMeasurement, Risk, Deviation, Meeting, Decision, BudgetItem, Report, Notification, AuditLog). Pushed via db:push.
- Wrote scripts/seed.ts: all 37 steps verbatim from reference doc (refStep 1..37, 5 groups, relative dueStartDay/dueEndDay), 16 roles with JSON permission arrays, 9 org units, 8 sample users (pw Nigc@1405), 11 core documents, 3 driver projects, 8 KPIs structure-only (needsDefinition=true, no fabricated baselines), first council meeting, 4 doc-grounded risks, sample digital-status entries marked as sample data, settings incl. program.baselineDate=2026-10-23.
- Built backend: src/lib/auth.ts (session token + bcrypt + cookie, terminateUserSessions), src/lib/api.ts (requireAuth/requirePermission default-deny, ApiError, rate limit, audit helper), src/lib/persian-date.ts (fa-IR persian calendar formatting, baseline cache, programDay), src/lib/constants.ts (workflow transitions, labels).
- API routes (25+): auth login/logout/me, actions CRUD + status transitions (11-state workflow w/ transition validation, approve separation, overdue reason required) + updates, dashboard (all real-data aggregations), overview (my desk), org-units, users (+deactivation kills sessions), roles, documents (version flow), projects (+lifecycle flow, council-only approve), project scores (40/20/20/20 model v1.0-ابلاغی), data-domains, digital-status validation, ai-applications (no-operation-without-registration rule), kpis + measurements (baseline requires approval ref), risks, deviations, meetings, decisions, budget, reports, notifications, settings (baseline change flow w/ reason+approval+recalculation), audit, ai/chat (permission-scoped retrieval, anti-injection system prompt, graceful unconfigured state, rate limited).
- Fixed TS errors; src/ typechecks clean.

Stage Summary:
- Backend fully operational: server-side RBAC enforced on every endpoint; audit trail separated; governance rules (deadline change workflow, council approval, no-fabrication) encoded in API.
- Seed users: admin, sec.admin (مدیر دبیرخانه), secretary, council, itc.mgr, itc.liaison, auditor, viewer — password Nigc@1405.
- API patterns established for frontend: GET list → {x: [...]}; errors → {error:{code,message}}; Persian labels in src/lib/constants.ts.

---
Task ID: 4-a
Agent: main (Z.ai Code)
Task: Frontend core — RTL shell, login, store, shared components, core modules

Work Log:
- layout.tsx: lang=fa dir=rtl, Vazirmatn via Google Fonts link, metadata. globals.css: .font-vazir, custom scrollbar, RTL tables, gantt track, recharts font.
- src/lib/api-client.ts: fetch wrapper (credentials same-origin, Persian error messages, 401 → clear store).
- src/lib/persian-date-format.ts: CLIENT-SAFE persian date helpers (faDate/faDateTime/faNum/programDay/daysUntil). Server variant: src/lib/persian-date.ts (has db import — do NOT import from client components).
- src/store/app-store.ts: zustand (user, authReady, baselineDate, activeModule, sidebarCollapsed, detailActionId, hasPerm()).
- src/app/page.tsx: auth gate (GET /api/auth/me) → LoginScreen or Shell, wrapped in Providers (TanStack Query).
- src/components/app/login-screen.tsx: RTL split screen, sample accounts note, rate-limit-aware errors.
- src/components/app/shell.tsx: dark slate sidebar (17 nav items, permission-filtered, collapsible, tooltips), topbar (breadcrumb, global search over menus+steps, notifications dropdown w/ unread badge, user menu with roles badges), sticky footer, AI assistant Sheet trigger. Nav keys map to ModuleKey in store.
- src/components/app/module-router.tsx: switch on activeModule → 17 modules.
- src/components/app/shared.tsx: ModuleHeader, ActionStatusBadge, ProjectStatusBadge, DocStatusBadge, AiStatusBadge, PriorityBadge, LoadingState (skeleton), EmptyState, ErrorState.
- Core modules done: my-desk (stats cards, my tasks w/ progress, overdue/due-soon, risks, meetings), dashboard (recharts radial completion %, milestones, group bar chart, coverage %, 4 pillars), actions (filter bar, group/status/search, 37-step list w/ dependency badges, detail dialog: description/deliverable/deadline/dependencies cards, workflow transitions validated client+server, progress submit, comment/reminder, full history timeline), calendar (gantt timeline 0-120 days from baseline with today marker, deadline list sorted, cyclical actions, meetings), ai-assistant (Sheet panel, chat with history, configured/unconfigured states, disclaimer).

Stage Summary:
- FRONTEND PATTERNS FOR MODULE AGENTS:
  - File: src/components/app/modules/<key>.tsx, export function <Pascal>Module().
  - Data: useQuery({queryKey:[...], queryFn:()=>api.get<T>("/api/...")}) from @tanstack/react-query; mutations via useMutation + useQueryClient invalidateQueries.
  - Wrap page in <div className="p-4 lg:p-6">; header via <ModuleHeader title description>children</ModuleHeader>.
  - States: LoadingState / ErrorState(onRetry) / EmptyState from shared.tsx. Toast: import { toast } from "@/hooks/use-toast".
  - Labels: src/lib/constants.ts (ACTION_STATUSES, PROJECT_STATUSES, DOC_STATUSES, AI_APP_STATUSES, CYCLES, PHASES...). Dates: faDate/faDateTime/faNum from "@/lib/persian-date-format" (NEVER from "@/lib/persian-date" — server-only).
  - Persian UI, RTL, numbers via faNum(). Cards p-4, lists max-h with overflow-y-auto. No blue/indigo — use emerald/teal primary, amber accent, slate neutrals, rose for errors.
  - API error shape: throw ApiClientError with .message in Persian — show via toast variant destructive.
---
Task ID: 4-d
Agent: full-stack-developer
Task: Frontend modules (8) — organization, kpis, risks, meetings, budget, reports, users, settings (Persian RTL)

Work Log:
- organization.tsx: unit cards (type badge, parent, honest «— ثبت نشده» for missing manager/liaison/owners), 6-obligation coverage model (9 DB flags rolled into 6 documented obligations of گام ۱۱) with ✓/✗ per obligation + coverage badge (X/۶, emerald≥full / amber≥3), summary strip (units, active, full-coverage count, liaisons introduced), counts of users/actions/projects; edit dialog (org:manage) PATCHes name, managerName, dtLiaison, dataOwner, dataCustodian + 7 switches (6 obligation flags + isActive).
- kpis.tsx: 8 KPI cards (code chip, sourceRef, CYCLES label), prominent amber badge «نیازمند تعیین تعریف یا خط مبنا» per rule 2.5.9, honest «تعریف ثبت نشده…» copy, baseline shown as «ثبت نشده — نیازمند مصوبه» when empty, measurement history list (max-h-32 scroll, period/value/note/recordedAt); 3 dialogs: DefinitionDialog (definition/formula/unit/dataSource/owner/target/dataQuality via kpis:manage), BaselineDialog (baseline + mandatory baselineApprovalRef with گام ۲۶ explainer, button disabled until both filled — server 400 mirrored client-side), MeasureDialog (period/value/note via kpis:measure).
- risks.tsx: Tabs ریسک‌ها/انحرافات. Risk matrix 5×5 (probability rows 5→1 × impact cols), cells colored by score bands (۱–۴ emerald, ۵–۹ amber, ۱۰–۱۴ orange, ۱۵–۲۵ rose) with open-risk counts ringed, band legend + critical-open count; risks table (max-h-96 scroll) with score badge, RISK_STATUSES badges, overdue-tinted critical rows; create dialog (title/category/relatedType/relatedTitle/prob/impact/owner/preventiveAction/responsePlan/dueDate) and edit dialog (status transitions among OPEN/MONITORING/MITIGATED/CLOSED + coords). Deviations tab: mandatory banner «هر انحراف از مهلت باید دارای علت، مسئول، شدت اثر و اقدام جبرانی باشد», deviation cards (cause/responsible/severity(PRIORITIES)/remedial+due with past-due red), create dialog with relatedType ACTION|PROJECT|REPORT backed by live selects from /api/actions, /api/projects, /api/reports (lazy per type), cause mandatory; follow-up dialog PATCHes status/responsible/severity/remedialAction/remedialDueDate.
- meetings.tsx: Tabs جلسات/مصوبات و پیگیری. Meeting cards with agenda parsed from JSON string (safe parse + line fallback), MEETING_STATUSES badges, attendees, minutes summary block, per-meeting decisions list with follow-up badges; create dialog (title/type/number/scheduledAt datetime-local/agenda textarea→string[]/attendees); «ثبت صورت‌جلسه» dialog PATCHes minutesSummary+attendees+status (HELD auto-stamps heldAt server-side — UI explains). Decisions tab: table (max-h) with DECISION_STATUSES badges, rose highlight for overdue (status OVERDUE or dueDate past & not DONE), overdue summary banner; create dialog links meetingId select + optional refStep; edit dialog PATCHes content/followUpStatus/responsible/dueDate.
- budget.tsx: grouped by year sections with per-category count chips, table (title/category/برآورد متنی/unit/status DRAFT|SUBMITTED|CONFIRMED/documentRef/refStep/notes), amber disclosure banner that amounts are textual estimates until بودجه ۱۴۰۶ cycle (گام ۲۹) completes and no currency totals are shown (no fabricated sums); create dialog (budget:manage) with textual estimate field and year input.
- reports.tsx: schedule info card fed from API schedule payload (90-day report due day + live report90Status incl. NOT_CREATED «ثبت نشده», quarterly 15-day window rule گام ۳۱, currentProgramDay vs روز صفر); reports table with REPORT_TYPES + honest status badges (DRAFT/SUBMITTED/FINAL); view dialog (summary + content pre-wrap); create dialog (reports:create) type select/period/summary/content.
- users.tsx: gated by users:view; stats cards, users table (username ltr mono, fullName+title, unit, role badges, active Switch, lastLoginAt faDateTime), self-row switch disabled (server also blocks — SELF_DEACTIVATION); deactivate via AlertDialog with session-termination warning both from table switch and inside edit dialog; create dialog (username/fullName/password≥8 client-validated/email/title/orgUnit select from /api/org-units/role checkbox list from /api/roles); edit dialog PATCHes fullName/email/title/orgUnitId (clearable via «بدون واحد»→"")/roleKeys/optional password reset (≥8 hint) + deactivate button.
- settings.tsx: سلامت سامانه card (DB connected inferred from successful settings load, timezone from program.timezone fallback Asia/Tehran, ai.provider + ai.enabled); Tab پیکربندی برنامه: per-valueType editors (boolean→Switch, number/date→typed ltr inputs, string→text), changed-key tracking with «تغییر کرده» badges, PUT sends only changed keys, program.baselineDate readonly in this tab with link to baseline workflow; Tab تاریخ مبنای برنامه: current baseline display, change dialog (date + mandatory reason + mandatory approver, rose warning about full deadline recalculation + audit), on success setBaselineDate() in store + full query invalidation; baselineChanges history table (old→new, reason, approvedBy, createdAt); Tab سوابق عملیاتی ممیزی: paginated audit table (faDateTime, user fullName+username, ACTION_LABELS/ENTITY_LABELS Persian maps, details JSON truncated 90ch ltr mono, ip), prev/next pagination with totals, gated by audit:view.
- Conventions kept: shared.tsx (ModuleHeader/LoadingState/ErrorState/EmptyState), TanStack Query + invalidations, ApiClientError Persian toasts (destructive), faNum/faDate/faDateTime from client-safe persian-date-format, p-4 cards, max-h+overflow-y-auto lists, no blue/indigo palette, permission gating via useAppStore.hasPerm for org:manage, kpis:manage, kpis:measure, risks:manage, deviations:manage, meetings:manage, decisions:manage, budget:manage, reports:create, users:view, users:manage, settings:manage, audit:view.

Verification:
- npx tsc --noEmit → zero errors in the 8 module files (remaining repo errors pre-exist in examples/ and skills/, out of scope).
- bun run lint → 0 errors (only pre-existing layout.tsx font warning; fixed one React-Compiler memoization error in risks.tsx by basing the matrix useMemo on query data).
- dev.log hot-reload compiled clean; curl smoke test of all 12 GET endpoints as admin matched UI type shapes; contracts cross-checked against org-units/[id], kpis/[id]+measurements, risks/[id], deviations/[id], meetings/[id], decisions, users/[id], settings PUT.

Stage Summary:
- All 8 module stubs replaced with full implementations; no API mismatches found — every PATCH/POST body matches the live routes (meetings PATCH does not take heldAt — UI relies on server auto-stamp; users PATCH allows clearing email/title/orgUnitId via empty string; deviations PATCH accepts cause too).
- Remaining TODOs: none blocking in scope. Possible future polish: report status FINALization endpoint (no PATCH /api/reports/[id] exists yet — status stays DRAFT), budget item status transitions UI (no PATCH /api/budget/[id] yet), and org-unit create dialog (POST /api/org-units exists but adding units was left to seed/admin flows per scope).

---
Task ID: 4-c
Agent: full-stack-developer
Task: Frontend modules — documents, portfolio, governance, ai-registry, knowledge (replace stubs with full Persian RTL implementations)

Work Log:
- documents.tsx: filter bar (search/type/status + «نیازمند بارگذاری» count badge), doc cards with DocStatusBadge/classification/version/ownerUnit/گام مرتبط/needsUpload warning, "سند جدید" dialog (documents:create; title/docType/ownerUnit from /api/org-units/sourceRef/refStep/description → POST), detail dialog (GET /api/documents/[id]) with: full meta grid, status-transition chips (documents:edit; APPROVED/ISSUED gated by documents:approve with honest disable + hint), dedicated "تغییر سند مصوب/ابلاغی فقط با نسخه جدید" card (server rule VERSION_REQUIRED — version fields shared by status/description/fileUrl submissions), description edit, «بارگذاری فایل رسمی» as fileUrl text input (explanatory note: upload infra needs deployment config; clears needsUpload), version history (version/summary/changeNote/status/createdAt via faDateTime).
- portfolio.tsx: stats row (total/driver/unit/proposed/scored), track+status+search filters, project cards with scoreTotal progress bar, "ثبت پروژه جدید" (projects:create; title/trackKey/problem/goals/scope/successMetrics/dataReadiness), detail dialog (GET /api/projects/[id] → allowedTransitions): پرونده استاندارد grid (businessOwner/PM/sourceRef/refStep/dataReadiness/timeline/scoreTotal), problem/goals/scope/successMetrics sections, benefit baseline/target/actual, scores card (4 criteria with rationale/evidence/assessor/assessedAt + model chip v1.0-ابلاغی + شورا note), lifecycle chips from allowedTransitions (APPROVED/REJECTED gated projects:approve, server 400s toasted), full edit form (projects:edit; 11 fields PATCH), ScoreDialog (projects:score): 4 inputs clamped to ۴۰/۲۰/۲۰/۲۰ with per-row validity, rationale required per criterion, evidence optional, live total «X از ۱۰۰», prefilled from existing scores, POST /api/projects/[id]/scores.
- governance.tsx: Tabs — «حوزه‌های داده» (table with owner/custodian/classification/qualityStatus labels + create dialog governance:manage POST /api/data-domains with ownerUnit select), «پوشش تعهدات واحدها» (matrix 8 units × 6 obligations from /api/org-units booleans — emerald CircleCheck / rose XCircle with tooltips, per-obligation completion chips, "N از M واحد کامل" summary, names of manager/dtLiaison under unit, note on SUBMITTED/VALIDATED/NEEDS_INFO validation flow), «کاربردهای شناسایی‌شده» (/api/ai-applications compact table with risk/status/مجوز بهره‌برداری + deep-link button to ai-registry module) + shared «ثبت کاربرد هوش مصنوعی از وضعیت موجود» dialog (governance tab posts to /api/ai-applications; gated ai_registry:create; fields per server contract incl. riskLevel/humanOversight).
- ai-registry.tsx: prominent rule banner «بدون ثبت و ارزیابی، بهره‌برداری ممنوع» (rose), 5 honest stat cards from stats (total/highRisk/withoutOperationApproval/notAssessed/needsReview), status distribution bars, status/risk/search filters, table with «نیازمند مجوز بهره‌برداری» badge for PILOT/OPERATIONAL rows and «بدون بازنگی» amber, register dialog (ai_registry:create), detail dialog driven from list data (NOTE: no GET /api/ai-applications/[id] exists — data passed from list): full dossier, lifecycle chips from client AI_FLOW mirroring server (OPERATIONAL disabled until evaluationResults exist; HIGH/CRITICAL requires تأیید انسانی note sent as humanApprovalNote+humanOversight), manage card (ai_registry:manage): riskLevel/humanOversight/evaluationResults/constraints/successMetrics + isRegisteredForOperation switch (server enforces assessment prerequisite) + markReviewed button.
- knowledge.tsx: static-real content — 5 tool forms of گام ۲ as cards (معرفی رابط، ثبت وضعیت موجود، فرم استاندارد پروژه، خودارزیابی بلوغ، درخواست مجوز کتبی) with purpose/target/output, quarterly report rule card (حداکثر ۱۵ روز پس از پایان فصل), baseline-date card showing live baselineDate from useAppStore via faDate + council-approval change rule, 37-step groups table from ACTION_GROUPS (group/steps/بازه), two governance rule cards (بدون ثبت و ارزیابی بهره‌برداری ممنوع / ممنوعیت اقدام موازی خارج از چارچوب), «اسناد مرجع قابل استناد» from /api/documents filtered to ISSUED (code/title/version/DocStatusBadge + fileUrl link only when real), 7-item Accordion FAQ (all grounded in reference doc).
- Verification: npx tsc --noEmit → 0 errors in the 5 files; bun run lint → clean for my files (transient risks.tsx parse error belonged to concurrent Task 4-b agent and was resolved by them; pre-existing layout.tsx font warning untouched); dev.log → no compile errors for my files, GET / → 200; live API smoke tests via curl (login as admin): documents PATCH (description/fileUrl/status/newVersion + VERSION_REQUIRED rule), projects POST/scores(40/20/20/20→77 total, modelComplete)/transitions(invalid jump → 400), ai-applications lifecycle (PROPOSED→EVALUATING→PILOT→OPERATIONAL; HUMAN_APPROVAL_REQUIRED without note; markReviewed), data-domains POST — all consistent with UI logic; all throwaway test records and their side effects (incl. DocumentVersion rows) removed afterwards — DB verified back to exact seed state.

Stage Summary:
- 5 modules fully implemented and wired: documents, portfolio, governance, ai-registry, knowledge — permission-gated (documents:create/edit/approve, projects:create/edit/score/approve, governance:manage, ai_registry:create/manage), TanStack Query + invalidateQueries, Persian toasts, LoadingState/ErrorState/EmptyState, RTL tables in max-h scroll containers, no fabricated numbers anywhere (empty stats shown as «ثبت نشده»).
- API mismatches noticed: (1) GET /api/ai-applications/[id] does not exist (PATCH only) — ai-registry detail dialog consumes the full list payload instead; (2) VERSION_REQUIRED on /api/documents/[id] only triggers when body.status is present, so description/fileUrl edits on مصوب/ابلاغی docs technically pass without a new version — UI is intentionally stricter (shows version card) to honor the documented rule; (3) server guard for OPERATIONAL checks riskLevel==="HIGH" only, UI also requires the تأیید انسانی note for CRITICAL (stricter, aligned with policy).
- Remaining TODOs: real file-upload infrastructure for document attachments (needs deployment storage config — fileUrl text field with explanation in place); digital-status list endpoint not wired in backend — governance shows org-unit coverage matrix + note that entry validation (PATCH /api/digital-status/[id]) will activate once the list endpoint ships; seed data has 0 AI applications so ai-registry stats start empty (honest state until units submit وضعیت موجود).

---
Task ID: 6-7
Agent: main (Z.ai Code)
Task: Browser E2E verification, bug fixes, docs completion, final report.

Work Log:
- agent-browser E2E: login (sec.admin) → visited all 18 modules → zero console/page errors.
- Golden path test: opened گام ۱ detail, executed status transition «معوق → ارسالشده برای بررسی» with note — toast + list + badge all updated, persisted in DB.
- Verified real data: dashboard 37/0/11/1 from aggregate query; action 1 correctly «معوق — ۱ روز تأخیر» (deadline math from baseline ۱ آبان ۱۴۰۵); portfolio driver scored ۷۵/۱۰۰ (40/20/20/20); documents flag «نیازمند بارگذاری نسخه رسمی» honestly; KPIs flagged «نیازمند تعیین تعریف/خط مبنا» without fabricated values.
- AI assistant verified end-to-end (grounded answers with record codes NIGC-PRJ-xxx, honest «اطلاعات کافی نیست», disclaimer).
- Fixed: sample-question buttons now auto-send (askSample); /api/ai/chat returns 401 for unauthenticated instead of misleading «not configured».
- Confirmed ScrollArea dialogs scroll correctly; mobile (iPhone 14) layout responsive with collapsible sidebar.
- bun run lint: 0 errors (1 benign font-link warning).
- Completed remaining docs: rbac-matrix.md, threat-model.md, test-plan.md, assumptions-and-open-decisions.md (all 10 design docs present).

Stage Summary:
- System verified working end-to-end in real browser: auth, RBAC-scoped data, 37-step program with deadline math, workflow transitions, dashboards, portfolio scoring, AI assistant, settings, mobile responsive.
- All 10 design docs delivered under docs/.
- Remaining open items documented honestly in docs/assumptions-and-open-decisions.md (KPI definitions, baseline date confirmation, production deployment, GitHub repo, SSO/2FA, email notifications).
---
Task ID: 8-a
Agent: full-stack-developer
Task: تب‌های یادآوری‌ها/سلامت دستیار در settings.tsx

Work Log:
- Read worklog.md + inspected GET/POST /api/scheduler route, GET/PUT /api/settings route, src/lib/assistant-settings.ts (DEFAULT_REMINDER_SETTINGS / DEFAULT_PRIORITY_WEIGHTS / key families reminders.*, digest.*, priority.weights) and scheduler-engine jobKeys (REMINDER_TICK | MORNING_DIGEST | EOD_DIGEST | WEEKLY_DIGEST) before touching UI.
- Edited ONLY src/components/app/modules/settings.tsx. Added two TabsTrigger/TabsContent («یادآوری‌ها و گزارش‌های خودکار» value=reminders، «سلامت و قابلیت اعتماد دستیار» value=health) between config and baseline; only other touch on existing markup: TabsList got `h-auto max-w-full flex-wrap` so 5 tabs don't overflow on mobile.
- RemindersTab (new component, own remChanges/weightDraft state — independent of config-tab changes record so each tab's save button sends only its own changed keys):
  - 19 keys in 3 grouped cards (موتور یادآوری و آستانه‌ها / ساعات سکوت و سیاست اعلان‌ها / گزارش‌های خودکار) + a separate «مدل اولویت‌بندی» card. Controls per valueType: boolean→Switch (+فعال/غیرفعال), number→ltr numeric Input with min/max (quiet hours 0–23, tick≥30), string HH:MM→ltr text Input maxLength 5 with placeholder, digest.weeklyDay→Select (۰=یکشنبه … ۶=شنبه, default ۴=پنجشنبه).
  - Keys missing from DB fall back to assistant-settings defaults and get an honest «پیش‌فرض پیشنهادی — ذخیره نشده» outline badge (later verified: scripts/seed-upgrade.ts actually seeds all 19 keys, so defaults path is a safe fallback).
  - priority.weights rendered as five numeric Inputs (urgency/importance/dependency/risk/waiting) parsed safely via parseWeights(); live «جمع وزن‌ها: N از ۱۰۰» (emerald when 100, amber otherwise), save blocked with amber note when sum ≠ 100; JSON.stringify(canonical order) on save compared against canonicalized stored JSON to detect real changes.
  - Save = same pattern as config tab: «تغییر کرده» amber badges, count line «N کلید تغییر کرده», PUT /api/settings with only actually-different keys and {key,value,valueType,category} (so first-time saves create rows with correct type/category), toast on success, invalidate ["settings"] + ["assistant-health"], ApiClientError destructive toast on failure. Readonly notice + disabled controls when !hasPerm("settings:manage").
- HealthTab (new component): useQuery<SchedulerHealth>(queryKey ["assistant-health"], /api/scheduler, enabled:canManage, refetchInterval 30000, retry 1). !canManage or ApiClientError 403 → EmptyState «دسترسی مدیریتی لازم است» (no crash). Typed against live payload: scheduler{enabled,alive,tickIntervalSec,lastRun,failedLast24h,recentRuns[10]}, notifications.pendingQuiet, emailChannel{configured,pending,note}, assistant{enabled,lastErrorAt}, infrastructure{dbConnected,timezone,serverTime}, priorityModel{version,weights,note}.
  - Conditional alerts above section: scheduler.enabled=false → amber; alive=false → amber «زمان‌بند پاسخگو نیست»; failedLast24h>0 → destructive rose with faNum count.
  - Command bar: last-updated stamp from dataUpdatedAt (faDateTime) + «بازخوانی هر ۳۰ ثانیه», icon-only RefreshCw button (aria-label «بازخوانی وضعیت سلامت», spins while isFetching) and «اجرای دستی چرخه زمان‌بند» → AlertDialog confirm (honest copy: یادآوری فوراً، digest‌ها فقط در بازه خودشان؛ ثبت در ممیزی) → POST /api/scheduler → toast summarizing each TickResult (jobKey Persian label + created/skipped/failed via faNum) + invalidate ["assistant-health"].
  - Six tone-coded status cards (emerald/amber/rose/slate via TONE_CARD/TONE_DOT + HealthDot): آخرین اجرای زمان‌بند (job label + status chip + duration fmtDuration + alive dot + tick interval), اجراهای ناموفق ۲۴ ساعت (big faNum number), صف ایمیل (honest «بدون SMTP سازمانی ارسال نمی‌شود» + server note), اتصال پایگاه داده (+ timezone + server time), وضعیت دستیار هوشمند (enabled + lastErrorAt), اعلان‌های در صف نمایش (pendingQuiet).
  - Secondary row: priority model card (version ltr mono + Persian weight chips + council-note) and «۱۰ اجرای اخیر» table (زمان/وظیفه/وضعیت/ایجاد/رد/ناموفق/مدت) inside max-h-64 overflow-y-auto, failed counts rose-tinted.
- Conventions kept: Persian RTL, faNum/faDateTime from client-safe persian-date-format, no blue/indigo (emerald/teal/amber/rose/slate only), p-4 cards, aria-labels on icon buttons, LoadingState/ErrorState/EmptyState from shared, toast from @/hooks/use-toast.

Verification:
- bunx tsc --noEmit (filtered examples/skills) → 0 lines.
- bun run lint → 0 errors (only pre-existing layout.tsx no-page-custom-font warning).
- dev.log: module compiles clean, GET / → 200. (Transient `⨯ shell.tsx:17 Can't resolve about-dialog` lines in log belong to a concurrent agent's in-progress file and are gone now that about-dialog.tsx exists — not touched by me.)
- curl as admin (Nigc@1405): GET /api/scheduler shape matches UI types exactly (alive=true, lastRun REMINDER_TICK SUCCESS durationMs 73, failedLast24h 0, emailChannel configured=no pending=2 with honest note, assistant.lastErrorAt set, priorityModel weights 35/25/15/15/10); GET /api/settings rows match SettingRow. PUT test with 4 reminder keys incl. priority.weights JSON → ok:true and values persisted with correct valueType/category; POST /api/scheduler manual tick → {"ok":true,"results":[{"jobKey":"REMINDER_TICK","processed":37,"created":0,"skipped":4,"failed":0}]}. Test values then reverted via the same PUT to exact originals (tickIntervalSec 60 / morningTime 07:30 / weights 35/25/15/15/10) and updatedById reset to null via prisma — DB verified back to pre-test state.

Stage Summary:
- settings.tsx now has 5 tabs: پیکربندی برنامه / یادآوری‌ها و گزارش‌های خودکار / سلامت و قابلیت اعتماد دستیار / تاریخ مبنای برنامه / سوابق ممیزی — both new tabs fully wired to the live reminder-engine settings and scheduler health endpoints with permission gating, changed-key-only saves, 30s auto-refresh health polling, manual tick with audit, and honest empty/degraded states.
- Contract findings: POST /api/scheduler returns only jobs that actually ran (digest jobs skip outside their window — UI explains this in toast/dialog); emailChannel.configured is "no" while SMTP is unconfigured and UI states emails are never faked; reminders.* / digest.* / priority.weights rows already exist (seed-upgrade.ts) with Persian descriptions, so the «پیش‌فرض پیشنهادی» fallback badge rarely shows.
- Remaining TODOs: none in scope. Possible future polish: link reminders tab enable-switch state into the health tab alert copy via shared state, and a dedicated SMTP configuration section when the org provides credentials.

---
Task ID: 8-main
Agent: main (Z.ai Code)
Task: اجرای دستور ارتقای دستیار هوشمند دبیر شورا — ممیزی، موتور یادآوری سروری، میزکار روزانه، دستیار سطح ۳/۴، گزارش‌های خودکار، پنل سلامت

Work Log:
- ممیزی کامل سامانه (کد/DB/سرور/مرورگر قبلی) → docs/current-state-audit.md با وضعیت هر ۳۲ قابلیت + یافته بحرانی: نبود زمان‌بند سروری
- پشتیبان قابل بازیابی: backups/backup-20261027-1928 (DB + tar کد) + git commit 25b7fd3
- مهاجرت افزودنی schema: Notification (severity/reason/actionHint/dedupeKey @unique/channel/deliveryStatus/scheduledFor) + مدل‌های SchedulerRun و EmailOutbox + Action.nextFollowUpAt/lastFollowUpAt — بدون حذف داده
- src/lib/assistant-settings.ts: تنظیمات موتور (reminders.*/digest.*) با پیش‌فرض‌ها + ساعات سکوت تهران
- src/lib/priority.ts: موتور اولویت شفاف v0.1-پیشنهادی (۵ عامل وزن‌دار پیکربندی‌پذیر) + suggestNextStep
- src/lib/scheduler-engine.ts: تیک یادآوری (معوق/نزدیک/روز سررسید/تشدید/پیگیری/جلسه/تصمیم) با dedupeKey، ارتقای اعلان‌های سکوت، گزارش صبحگاهی/پایان‌روز/هفتگی از سازنده واحد buildBriefing، صف ایمیل صادقانه (PENDING بدون SMTP)، هشدار شکست به ادمین
- src/instrumentation.ts: بوت خودکار زمان‌بند با سرور (مستقل از مرورگر) — تیک ۶۰ ثانیه
- APIهای جدید: /api/desk (۵ ناحیه)، /api/scheduler (GET سلامت/POST تیک دستی ممیزی‌شده)، /api/reports/briefing، /api/assistant/draft (پیش‌نویس زمین‌گیر followup/delay_notice/agenda/progress_summary + ثبت DRAFT در پرونده)
- توسعه /api/actions/[id]: nextFollowUpAt + updates: FOLLOWUP→lastFollowUpAt، انواع DRAFT/FOLLOWUP
- scripts/seed-upgrade.ts: ۲۱ تنظیم جدید موتور (additive)
- باگ یافت‌شده و رفع شد: getReminderSettings کلیدهای digest.* را نمی‌خواند (فقط reminders.*) — رفع شد و گزارش صبحگاهی آزمون شد
- UI: بازطراحی my-desk.tsx به میزکار روزانه ۵ ناحیه‌ای (خلاصه مدیریتی/اقدامات امروز با دلیل و اقدام بعدی و دکمه‌های مشاهده/پیگیری/پیش‌نویس/ارجاع/در معرض خطر با شواهد/منتظر دیگران با زمان پیگیری/دستیار)، shell.tsx (لوگوی رسمی NIGC، رنگ شدت اعلان + اقدام پیشنهادی، About dialog، رویداد nigc-ask-ai)، ai-assistant.tsx (۹ سناریوی دبیر شورا + پرسش از میزکار)، login-screen (لوگو)، about-dialog.tsx جدید (داود جوانبخت — معاون مطالعات آینده‌پژوهی و آینده‌نگاری و دبیر شورا)، public/nigc-logo.png
- Task 8-a (subagent): تب‌های «یادآوری‌ها و گزارش‌های خودکار» و «سلامت و قابلیت اعتماد دستیار» در settings.tsx
- آزمون‌های بک‌اند: تیک دوبار → ضدتکرار ✓، ۸ اعلان واقعی ✓، سکوت ۲۱–۷ ✓ (PENDING→ارتقا)، گزارش صبحگاهی با تغییر موقت ساعت → ۲ دیجست + ۲ ردیف outbox PENDING با blockedReason صادقانه ✓
- tsc صفر خطا، lint صفر خطا، HTTP 200

Stage Summary:
- P0 و P1 دستور اجرا شد: موتور یادآوری سروری مستقل از مرورگر فعال و آزموده، میزکار روزانه ۵ ناحیه‌ای، موتور اولویت شفاف، گزارش‌های خودکار، پنل سلامت، سطح ۳/۴ دستیار
- باقی‌مانده: آزمون E2E مرورگر ۸ آزمون پذیرش + اسناد تحویلی + گزارش نهایی

---
Task ID: 8-b
Agent: general-purpose
Task: چهار سند تحویلی ارتقا (reminder-engine، assistant-capabilities، security-review، ux-review)

Work Log:
- worklog.md (Task 0 تا 8-main و 8-a) + docs/current-state-audit.md و docs/threat-model.md خوانده شد تا اسناد مستند به واقعیت باشند نه ادعا.
- کد واقعی مطالعه و ممیزی شد: src/lib/scheduler-engine.ts (619 خط: notify/dedupe/سکوت/تیک/digests/outbox/alertAdmins/recordRun/runFullTick)، src/lib/priority.ts (فرمول ۵عامله + suggestNextStep)، src/lib/assistant-settings.ts (۱۹ کلید reminders.*/digest.* + priority.weights + رفع‌بایگ digest خوانی)، src/instrumentation.ts (بوت + interval)؛ APIهای /api/desk، /api/scheduler (GET/POST ممیزی‌شده)، /api/reports/briefing، /api/assistant/draft (۴ kind + save DRAFT)، /api/ai/chat (retrieveContext + قواعد ضدساخت‌داده + rate limit)؛ api/actions/[id] (due:manage guard + nextFollowUpAt) و updates (FOLLOWUP→lastFollowUpAt)؛ schema.prisma (Notification/SchedulerRun/EmailOutbox + dedupeKey @unique)؛ UI: my-desk.tsx (۵ ناحیه + دیالوگ‌ها)، settings.tsx (RemindersTab ۱۹ کلید + HealthTab polling ۳۰s)، shell.tsx (شدت + actionHint)، ai-assistant.tsx (۹ سناریو)؛ login route (rate limit + کوکی httpOnly secure:false مستند).
- docs/reminder-engine.md نوشته شد: اجزای ۳گانه بوت/موتور/جدول‌ها، جدول ۷ قاعده یادآوری با dedupeKey دقیق هر کدام، سازوکار P2002، سکوت ۲۱–۷ با استثنای CRITICAL سیاستی، تجمیع دیجست‌ها از buildBriefing واحد، reason/actionHint، کانال‌ها (IN_APP فعال، EMAIL صف صادقانه با blockedReason، SMS/MESSENGER نقطه اتصال آینده)، پایش سلامت + SCHEDULER_ALERT + POST ممیزی‌شده، محدودیت sandbox + معماری تولید (worker+BullMQ یا cron+جدول صف، sender جدا برای outbox)، جدول کامل ۱۹ کلید + priority.weights + smtp.host.
- docs/assistant-capabilities.md نوشته شد: چهار سطح (چت زمین‌گیر RBAC / تحلیل / پیشنهاد suggestNextStep+۹ سناریو / اجرای کنترل‌شده draft با ثبت DRAFT)، مرزهای سطح ۴ (ارسال/تمدید/تأیید همیشه انسانی)، سازوکار زمین‌گیری ۳لایه، پاسخ مستند و «علت ثبت‌نشده اختراع نمی‌شود»، ایمنی (اسرار سرور، ضدتزریق دو endpoint، سهمیه ۲۰/۱۰ و ۱۲/۱۰، ai.enabled، ممیزی AI_QUERY/AI_DRAFT)، ۶ محدودیت صادقانه (Z-ai SDK، بدون حافظه بین نشست‌ها، کیفیت تابع داده، بازیابی واژه‌ای، عدم قطعیت مدل، بدون کانال ارسال واقعی).
- docs/security-review.md (نسخه ۲٫۰) نوشته شد: جدول کنترل‌های موجود با شواهد سطر به سطر (نشست ۲۵۶bit/12h/httpOnly، bcrypt(10)، RBAC پیش‌فرض‌رد + ACCESS_DENIED، جداسازی واحد، AuditLog، rate limit، ضدتزریق، پنهان‌سازی خطا، SELF_DEACTIVATION، due:manage+علت+تاریخچه)، ۶ کنترل جدید ارتقا (ممیزی تیک دستی، dedupeKey سپر، عدم افشای SMTP، صف بدون ارسال تا پیکربندی، سهمیه مدل، هشدار سلامت)، تفاضل T7/T8/T14 + ۴ تهدید جدید، جدول یافته‌های باقی‌مانده با اولویت — همه «پیاده‌نشده/نیازمند تصمیم»: بدون 2FA/SSO، rate limit محدود (پیشنهاد گسترش)، بدون encrypt-at-rest (پیشنهاد استقرار)، آپلود واقعی نیازمند زیرساخت، sandbox مانع آزمون نفوذ، بدون تاریخچه کامل گفتگو، هم‌زمانی زمان‌بند multi-instance؛ + تصمیم‌های باز (سیاست quietBypassCritical، نگهداشت داده، تفکیک مجوز settings).
- docs/ux-review.md نوشته شد: جدول پیش از ارتقا مستند به یافته‌های ممیزی، توصیف ۵ ناحیه پس از ارتقا با منطق ناحیه‌بندی zone (focus/risk/waiting)، اصول ضدشلوغی (جمع‌شونده با aria-expanded، قرمز فقط بحرانی، جزئیات در پنل‌ها، سقف ۶/۶/۸ ردیف)، منو: ۱۷ ماژول حفظ شده + توجیه نقش‌های چندگانه + واگذاری تصمیم حذف به دبیرخانه (پیشنهاد §۹ اجرا نشد — صریح)، موبایل/دسترس‌پذیری با نکته صادقانه h-7≈۲۸px زیر هدف لمسی ۴۴px، جدول مسیرهای پرتکرار (کار امروز=۰ کلیک، پیگیری/پیش‌نویس/ارجاع=۱ کلیک)، ۶ مورد باز (جست‌وجوی سراسری، ترتیب شخصی نواحی، Notification API مرورگر، فرم SMTP، هدف لمسی، منوی دستوری).
- ویرایش‌های اصلاحی پس از نگارش (typo موتور، دقت defaultOpen نواحی) اعمال شد؛ هر ۴ فایل نهایی و در docs/ قرار گرفت.

Stage Summary:
- ۴ سند تحویلی تولید شد: docs/reminder-engine.md، docs/assistant-capabilities.md، docs/security-review.md (به‌روزرسانی threat-model)، docs/ux-review.md — همه فارسی، RTL مفهومی و مستند به مسیر فایل/خط کد واقعی.
- اصل حاکم بر اسناد: تفکیک صریح «پیاده‌شده و آزموده» از «صف صادقانه/پیاده‌نشده/نیازمند تصمیم» — ایمیل هرگز «ارسال‌شده» جعل نمی‌شود، مدل اولویت «پیشنهادی تا تصویب شورا»، سطح ۴ دستیار محدود به ثبت DRAFT، و یافته‌های امنیتی باقی‌مانده با اولویت و بدون ادعای تأیید.
- نکات کلیدی مستندشده: تیک ۶۰ ثانیه‌ای مستقل از مرورگر با ۷ قاعده یادآوری + سپر dedupeKey@unique (P2002→skipped)؛ سکوت تهران ۲۱–۷ با معوق‌سازی PENDING/scheduledFor و ارتقای تیک بعدی؛ دیجست صبحگاهی/پایان‌روز/هفتگی از buildBriefing واحد (سازگاری میزکار/گزارش)؛ هشدار SCHEDULER_ALERT و پنل سلامت با POST ممیزی‌شده؛ معماری پیشنهادی تولید (worker جدا/BullMQ یا cron + جدول صف + sender outbox) بدون تغییر جدول‌ها و قواعد.
- بدون تغییر کد در این تسک — فقط مستندسازی (فایل‌های src/** دست نخوردند).
- نکته برای تسک بعدی (E2E مرورگر ۸ آزمون پذیرش): اسناد جدید می‌توانند چک‌لیست آزمون باشند؛ مخصوصاً آزمون ۱ (بدون مرورگر)، ۳ (ضدتکرار) و ۵ (جداسازی دستیار).

---
Task ID: 9
Agent: main (Z.ai Code)
Task: آزمون‌های پذیرش ۸‌گانه با مرورگر واقعی + اسناد تحویلی + گزارش نهایی

Work Log:
- E2E مرورگر (agent-browser): ورود دبیر → میزکار ۵ ناحیه‌ای با داده واقعی (گام ۱ معوق با امتیاز ۶۰/بالا و دلیل)؛ پیگیری سریع → ذخیره در DB (FOLLOWUP + lastFollowUpAt)؛ تهیه پیش‌نویس AI زمین‌گیر (کد رکورد، «علت ثبت‌نشده» صادقانه، جای‌نگهدار به‌جای ساخت تاریخ) → ثبت DRAFT در پرونده؛ سناریوی دستیار از میزکار → پاسخ با NIGC-RSK-001/NIGC-DOC-*/NIGC-PRJ-* واقعی؛ اعلان‌ها با شدت/دلیل/اقدام پیشنهادی؛ About با داود جوانبخت؛ موبایل ۳۹۰px سالم؛ صفر خطای کنسول
- آزمون ۵ (دسترسی): کاربر واحد desk=۰ از دبیرخانه، scheduler=۴۰۳، اعلان=۰ → کشف نقص P0 در بازیابی AI (اسناد/پروژه‌ها بدون فیلتر مجوز) → رفع فوری (شرط مجوز + محدوده واحد/طبقه‌بندی) → retest: «اطلاعات کافی نیست» برای واحد، پاسخ کامل برای دبیر
- پنل سلامت با admin: زمان‌بند زنده، صف ایمیل ۲ (صادقانه)، اجرای دستی موفق و ممیزی‌شده (SCHEDULER_RUN توسط admin)
- آزمون ۷: بازیابی پشتیبان (integrity ok، رکوردهای کلیدی یکسان)؛ آزمون ۸: سازگاری میزکار/گزارش (overdue=1/1) با تمایز معنایی urgent مستند
- اسناد: acceptance-tests.md، release-notes.md، operations-guide.md (+ ۴ سند قبلی از Task 8-b)
- tsc صفر خطا، lint صفر (۱ warning قدیمی فونت)، HTTP 200، صفر خطای کنسول در بارگذاری تازه
- commit گیت ارتقا

Stage Summary:
- هر ۸ آزمون پذیرش قبول؛ یک نقص امنیتی P0 در همین چرخه یافت و رفع شد
- وضعیت نهایی: پیاده‌سازی‌شده و آزموده‌شده در محیط توسعه — انتشار عملیاتی نیازمند SMTP/پشتیبان دوره‌ای/تصمیم دبیرخانه (مستند در release-notes)

---
Task ID: github-push
Agent: Z.ai Code (main)
Task: کپی کامل برنامه به ریپوی GitHub جدید کاربر (javanbakht-d/GasDTPortfolio) بدون آسیب به اپ زنده

Work Log:
- بررسی محیط: گیت لوکال موجود با ۱۰۳ فایل تغییرکرده (کار ارتقا)، بدون ریموت و بدون credential
- پاک‌سازی امنیتی: خارج‌سازی .env (حاوی DATABASE_URL)، backups/ (tar آن شامل .env بود) و tool-results/ از گیت + افزودن به .gitignore + ساخت .env.example
- کامیت f1b197f: ثبت کامل کار ارتقا در تاریخچه لوکال
- دریافت PAT از کاربر؛ بررسی ریپوی مقصد: موجود، عمومی، خالی، توکن با مجوز push
- ساخت برنچ archive/local-sandbox-history برای حفظ تاریخچه سندباکس (کامیت‌های UUID + آرتیفکت‌ها) — ارسال نشد
- ساخت کامیت تمیز orphan (1927232) با ۱۹۳ فایل، نویسنده: Davood Javanbakht <javanbakht-d@users.noreply.github.com>
- Push موفق main → origin (GitHub) و تأیید با ls-remote
- تلاش برای تنظیم description/homepage/topics با API: ناموفق (توکن مجوز Administration ندارد) — به کاربر اطلاع داده شد
- سلامت اپ زنده تأیید شد: HTTP 200 روی localhost:3000، اسکجولر فعال
- unset توکن و اطمینان از عدم ذخیره آن در config/credentials

Stage Summary:
- ریپوی GitHub https://github.com/javanbakht-d/GasDTPortfolio شامل کامل برنامه در یک کامیت تمیز (1927232) است
- تاریخچه کامل سندباکس لوکال در برنچ archive/local-sandbox-history حفظ شده و منتشر نشده است
- هیچ توکن/ secret در گیت، remote URL یا فایلی ذخیره نشد
- اپ زنده در gdtportfolio.space-z.ai دست‌نخورده و سالم است

---
Task ID: cloud-deploy-prep
Agent: Z.ai Code (main)
Task: آماده‌سازی ریپو برای استقرار رایگان ابری (Vercel + Neon + cron-job.org) + راهنمای گام‌به‌گام

Work Log:
- بررسی معماری: tick در runFullTick() جداست، AI با dynamic import و گیت ai.enabled، seedها Prisma خالص، بدون fs در src
- ساخت prisma/schema.postgres.prisma (کپی با provider postgresql) — هر دو اسکیما validate شدند
- تولید DDL با prisma migrate diff (67 دستور) و تبدیل به src/lib/postgres-ddl.ts (آرایه آماده اجرا)
- ریفکتور: src/lib/seed-core.ts و src/lib/seed-upgrade-core.ts (کلاینت تزریقی) + scripts/seed*.ts به wrapper نازک تبدیل شد
- مسیر /api/system/bootstrap (GET/POST با BOOTSTRAP_TOKEN): اجرای idempotent DDL + seed کامل + تنظیم ai.enabled=false روی Vercel + بازگرداندن رمزهای اولیه فقط یک‌بار
- مسیر /api/system/cron-tick (GET/POST با CRON_SECRET): اجرای runFullTick + قفل درون‌پردازشی + مقایسه امن توکن
- instrumentation.ts: روی VERCEL=1 حلقه درون‌پردازشی غیرفعال (تیک با cron بیرونی)
- vercel.json (buildCommand با اسکیمای pg) + next.config.ts (standalone فقط خارج Vercel) + .env.example کامل + README.md فارسی
- docs/deploy-guide.md: راهنمای ۸ گامی کامل فارسی (Neon → Vercel → bootstrap → cron-job.org → صحت‌سنجی → نگهداری → عیب‌یابی)
- آزمون: tsc پاک (سورس)، eslint پاک، bootstrap/cron-tick بدون توکن → 403 JSON فارسی، صفحه اصلی 200، رندر مرورگری سالم، اسکجولر لوکال فعال

Stage Summary:
- ریپو آماده Import در Vercel است؛ راه‌اندازی اولیه بدون هیچ ابزار لوکال فقط با یک URL انجام می‌شود
- اپ زنده سندباکس (SQLite) دست‌نخورده ماند — تغییرات صرفاً افزودنی/شرطی است
- محدودیت‌های شفاف: AI روی ابر غیرفعال، ایمیل فقط صف، مستند در deploy-guide

---
Task ID: github-push-2
Agent: Z.ai Code (main)
Task: push کیت استقرار ابری + راهنما به GitHub (توکن دوم کاربر)

Work Log:
- توکن قبلی 401 (باطل‌شده توسط کاربر — صحیح)
- توکن جدید دریافت و تأیید (200)
- push موفق main: 1927232..c501813 — اکنون ریپو کامل است (اپ + کیت استقرار + راهنمای گام‌به‌گام)
- unset توکن؛ در هیچ فایلی ذخیره نشد

Stage Summary:
- ریپو https://github.com/javanbakht-d/GasDTPortfolio آماده Import در Vercel
- کاربر می‌تواند راهنمای docs/deploy-guide.md را از گام ۱ (Neon) اجرا کند

---
Task ID: ui-operational
Agent: Z.ai Code (main)
Task: عملیاتی‌سازی UI — صفحه ورود حرفه‌ای بدون حساب نمونه، تم روشن/تاریک، پالت جذاب، رمز ادمین قوی

Work Log:
- globals.css: پالت جدید (فیروزه‌ای/زمردی + کهربایی)، پس‌زمینه تم‌دار روشن/تاریک، اسکرول‌بار سازگار با تم، ::selection
- providers.tsx: ThemeProvider (next-themes، attribute=class، defaultTheme=system)
- theme-toggle.tsx: کلید تعویض تم (CSS-only، بدون hydration mismatch، پاس‌خور لینت react-hooks)
- login-screen.tsx: بازطراحی کامل — پنل برند گرادیانی با لوگو/ویژگی‌ها/امضای طراح، فرم با آیکون‌ها، حذف کامل باکس حساب‌های نمونه، کلید تم
- sed نظام‌مند: ۲۴۳ کلاس hard-code (bg-white/slate/text-slate/border-slate + emerald/amber/rose بدون dark variant) → توکن‌های تم + dark variants؛ اصلاح ۲۴ شکستگی ناشی از الگوهای تودرتو (bg-*-500→/400، /40/NN، muted/600)
- shell.tsx: هدر شیشه‌ای (backdrop-blur)، کلید تم در هدر، آیتم فعال سایدبار bg-white/10
- seed-core.ts: کاربران نمونه به‌صورت پیش‌فرض isActive=false (فقط admin فعال) — برای استقرار عملیاتی
- bootstrap route: پیام demoCredentials به‌روز شد (فقط admin فعال)
- DB زنده: رمز قوی جدید admin (تحویل در چت)، ۷ حساب نمونه غیرفعال، ۱۴ نشست پاک، AuditLog ثبت شد
- آزمون: ورود admin 200، ورود حساب غیرفعال 401، لینت 0 خطا، مرورگر: ورود/داشبورد/اقدامات در هر دو تم

Stage Summary:
- اپ زنده (سندباکس) به‌روز و سالم؛ آماده push به GitHub
- رمز ادمین در هیچ فایل/کدی ذخیره نشد — فقط در چت تحویل شد

---
Task ID: rbac-org-structure
Agent: Z.ai Code (main)
Task: دید داده‌ای مبتنی بر نقش (RBAC سخت‌گیرانه) + ساختار رسمی سازمانی NIGC (۷۷ واحد)

Work Log:
- seed-core.ts: بازسازی کامل واحدهای سازمانی مطابق ساختار رسمی شرکت ملی گاز ایران — ۷۷ واحد:
  دبیرخانه (COMMITTEE) + معاونت آینده‌پژوهی (DEPUTY) + ۱۴ مدیریت ستادی (HQ_DIRECTORATE) + ۹ امور مستقل
  (INDEPENDENT_OFFICE) + ۳ شرکت ستادی (STAFF_COMPANY) + ۳۱ شرکت گاز استانی (PROVINCIAL_GAS، زیر GSC)
  + ۷ شرکت پالایش گاز (REFINERY، زیر PRD) + ۱۱ منطقه عملیات انتقال گاز (OPS_REGION، زیر TGI)؛ والدین ثبت شد
- حذف واحدهای منسوخ (PLG خطوط لوله، GDN گازرسانی ایران)؛ FPF تجزیه به IPG (برنامه‌ریزی تلفیقی) و FIN (مالی)
- سازمان‌گرام: واحد پایلوت فاوا با پرچم‌های پاسخ نمونه؛ بقیه واحدها تازه (پوشش واقعی و صادقانه)
- api.ts: isGlobalViewer() + actionScopeFilter() — کمک‌تابع‌های مرکزی محدوده داده
- actions/route.ts: فیلتر AND [scope واحد یا اقدامات محول‌شده شخصی]؛ بدون fallback ناامن
- actions/[id]/route.ts: رد ۴۰۳ برای اقدامات خارج از واحد/اقدامات شخصی
- documents/route.ts + documents/[id]/route.ts: اسناد محرمانه فقط واحد مالک + نقش‌های سراسری
- projects/route.ts + projects/[id]/route.ts: واحد خود + پیشران‌های برنامه ابلاغی
- data-domains/route.ts: حوزه‌های داده محرمانه محدود به مالک
- dashboard/route.ts: بازنویسی — scope GLOBAL/UNIT؛ نقش واحد: شاخص‌های واحد خود + تعهدات شش‌گانه واحد؛
  ریسک‌ها/مصوبات شورا فقط برای نقش‌های دبیرخانه/شورا
- dashboard.tsx: بنر اطلاع محدوده داده، تب «تعهدات واحد شما» (چک‌لیست شش تعهد)، کارت ریسک مشروط
- organization.tsx: برچسب ۹ نوع واحد + فیلتر چیپ‌شکل گروه‌های ساختاری + گروه‌بندی کارت‌ها با سربخش
- governance.tsx: برچسب انواع واحد هم‌راستا شد
- schema.prisma + schema.postgres.prisma: کامنت انواع واحد به‌روز (بدون تغییر DDL)
- reseed کامل: ۷۷ واحد + ۸ کاربر (فقط admin فعال، رمز Nigc@1405) + ۳۷ گام + ۱۱ سند + ۳ پیشران
- آزمون مرورگر: admin → ۳۷ اقدام/داشبورد سراسری؛ itc.mgr (فعال‌سازی موقت) → ۰ اقدام، داشبورد واحد
  با بنر محدوده، تب تعهدات واحد (۶ تعهد پاس)، فیلتر گروه‌های سازمانی کار می‌کند؛ سپس غیرفعال شد
Stage Summary:
- اصل «هر کاربر فقط داده‌های حوزه وظایف خودش» هم در API و هم در UI اعمال شد
- ساختار سازمانی دقیقاً مطابق توضیحات رسمی مدیر (۱۴ مدیریت، امور مستقل، ستادی، استانی، پالایش، مناطق)

---
Task ID: github-push-2
Agent: Z.ai Code (main)
Task: Push RBAC + org structure work to GitHub with new PAT

Work Log:
- اعتبارسنجی PAT جدید (Bearer, 200) — بدون ذخیره در هیچ فایلی
- پاک‌سازی ۲ نشست آزمایشی مانده، commit پایایی db (8a3ce88)
- push موفق main: e9e3553..8a3ce88 (شامل operational UI, RBAC scope, org structure ۷۷ واحد)
- تأیید HEAD ریموت = 8a3ce88؛ token متغیر محیطی پس از push unset شد

Stage Summary:
- ریپو https://github.com/javanbakht-d/GasDTPortfolio کاملاً به‌روز است — آماده Import در Vercel
- گام بعدی: اجرای docs/deploy-guide.md (Neon → Vercel → cron-job.org)

---
Task ID: in-app-guide
Agent: Z.ai Code (main)
Task: راهنمای آنلاین جامع و کاربرپسند — افزودن ماژول «راهنمای سامانه» به خود برنامه

Work Log:
- ماژول جدید guide.tsx با ۶ تب: شروع سریع (چک‌لیست ۵ قدم اول با ذخیره localStorage)،
  ماژول‌ها (۱۷ ماژول — هدف، چه‌کسی می‌بیند، قدم‌به‌قدم، نکته‌ها، دکمه پرش)، قابلیت‌ها
  (دستیار هوشمند، اعلان‌ها، جست‌وجو، تم، محدوده داده)، نقش‌ها و دسترسی (۱۶ نقش در دو گروه
  دید سراسری/واحدی)، واژه‌نامه (۱۸ اصطلاح)، پرسش‌های متداول (۱۴ پرسش کاربردی)
- جست‌وجوی زنده در کل محتوای راهنما با پرش بین‌تبی و هایلایت هدف (scrollIntoView + ring)
- چک‌لیست شروع سریع با useSyncExternalStore — سازگار SSR بدون hydration mismatch، بدون setState در effect
- دسترسی‌ها: آیتم منوی «راهنمای سامانه» (بدون مجوز — همه نقش‌ها)، دکمه CircleHelp در هدر،
  آیتم منوی کاربر، لینک پانویس
- ModuleKey «guide» + رجیستر در ModuleRouter
- آزمون: لینت ۰ خطا؛ مرورگر — ورود admin، باز شدن با دکمه هدر، جست‌وجوی «گذرواژه» و پرش به
  FAQ با هایلایت، بازکردن کارت ماژول و پرش به اقدامات، چک‌لیست ذخیره شد ([0])، تب نقش‌ها
  (۱۶ نقش)، واژه‌نامه، تم تاریک و موبایل ۳۹۰px — صفر خطای کنسول و سرور

Stage Summary:
- راهنمای کاملاً داخل برنامه، آنلاین، فارسی و RTL؛ برای همه نقش‌ها در دسترس است
- محتوا دقیقاً مطابق قابلیت‌های واقعی سامانه (۳۷ گام، ۱۶ نقش، ۷۷ واحد، قواعد حاکمیتی)

---
Task ID: cloud-clean-start
Agent: Z.ai Code (main)
Task: بررسی عمیق استقرار ابری — دسترس‌پذیری ایران، تحلیل دو تصویر، نسخه Git، شروع تمیز

Work Log:
- Git: origin/main = HEAD = c64a762 — آخرین نسخه (راهنمای درون‌برنامه‌ای) روی GitHub است ✓
- تحلیل تصویر Neon: دو پروژه تکراری «gasdt» (AWS US East، مصرف تقریباً صفر) — دستور حذف هر دو
- تحلیل تصویر Vercel: gasdt.app = Invalid Configuration + gas-dt-portfolio.vercel.app روی Redirect 307
  به gasdt.app → سایت در هیچ آدرسی بالا نمی‌آید؛ رفع فوری: Edit دامنه vercel.app → Connect to Production
- تحقیق دسترس‌پذیری از ایران (عناوین رسمی + تجربه جامعه):
  * Neon (neon.com): داشبورد از ایران باز نمی‌شود (مشاهده مدیر) — کنار گذاشته شد
  * Supabase: Free $0 بدون کارت، ۵۰۰MB DB، ۵GB egress، ۲ پروژه، pause پس از ۱ هفته بی‌کاری
    (تیک cron ۵دقیقه‌ای جلوی آن را می‌گیرد)؛ PostgreSQL واقعی = صفر تغییر کد
  * Aiven Free: $0، VM اختصاصی ۱GB، بدون pause — پلن جایگزین B
- راهنمای استقرار بازنویسی شد (نسخه ۲): گام پاکسازی (حذف ۲ پروژه Neon + رفع redirect + اختیاری حذف
  پروژه Vercel)، Supabase Session pooler پورت 5432 (سازگار Prisma بدون پارامتر)، ریجن فرانکفورت
  (Supabase + Vercel fra1)، گام ۸ اصلاح DNS gasdt.app (A @ 76.76.21.21 + CNAME www) و جهت صحیح redirect
- README بخش استقرار به‌روز شد (Vercel + Supabase)
- چک‌لیست صحت‌سنجی به ۹ مورد افزایش یافت (مورد راهنما و مورد فعال‌ماندن Supabase)

Stage Summary:
- تصمیم: Supabase (پلن اصلی) + Vercel فرانکفورت + cron-job.org — همه رایگان و از ایران قابل‌مدیریت
- مسیر شروع تمیز کامل مستند شد؛ منتظر اجرای گام‌ها توسط مدیر
