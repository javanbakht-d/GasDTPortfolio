# معماری سامانه — NIGC-DTG

**پروژه:** سامانه یکپارچه راهبری تحول دیجیتال و حکمرانی هوشمند شرکت ملی گاز ایران
**الزام منبع:** §۴ پرامپت جامع (معماری و فناوری) + §۲۲ (شیوه کار عامل) + محدودیت‌های محیط sandbox.

---

## ۱. تصمیم پشته فنی و مستندسازی دلایل (§۴)

| لایه | انتخاب | دلیل (با ارجاع به §۴) |
|---|---|---|
| فریم‌ورک Full-Stack | **Next.js 16 App Router + TypeScript** | هم‌ارزِ پیشنهاد §۴ (React/Next.js)؛ یکپارچگی UI + API در یک مخزن؛ RSC و Server Actions برای جلوگیری از منطق کسب‌وکار در مرورگر (اصل ۵ §۴) |
| UI | **Tailwind CSS 4 + shadcn/ui** | پیشنهاد صریح §۴؛ اجزای قابل سفارشی‌سازی برای RTL و هویت بصری قابل پیکربندی (§۱) |
| ORM / داده | **Prisma ORM** با **SQLite** در sandbox | پیشنهاد §۴ (Prisma/PostgreSQL). محیط عامل فقط SQLite فایل‌محور عرضه می‌کند؛ شِما برای PostgreSQL آماده طراحی شده (بخش ۹ همین سند) |
| احراز هویت | **نشست اختصاصی** (جدول Session + کوکی httpOnly + bcryptjs) | به‌جای NextAuth: کنترل کامل سیاست نشست (خاتمه نشست هنگام غیرفعال‌سازی کاربر — §۸ قاعده ۷)، سبکی، و سازگاری با «قابلیت اتصال آتی به SSO/OIDC» (§۱۶) |
| مجوزدهی | **RBAC با آرایه JSON مجوزها در Role** + فیلتر محدوده سازمانی (ABAC-lite) | §۸ (مدل ترکیبی RBAC/ABAC، ۱۴ دسته مجوز، default-deny) |
| AI | **z-ai-web-dev-sdk سمت سرور** پشت لایه انتزاعی ارائه‌دهنده | §۱۵ (استقلال از ارائه‌دهنده، کلید فقط سمت سرور، وضعیت «نیازمند پیکربندی») |
| نمودار | **Recharts** | §۴ (کتابخانه معتبر نمودار) برای داشبوردهای از داده واقعی |
| فونت/تقویم | Vazirmatn + `Intl.DateTimeFormat('fa-IR-u-ca-persian')` | §۵، §۲.۲ |
| حالت مدیریت سمت کلاینت | zustand (سوییچ ماژول روی مسیر واحد) | محدودیت sandbox — بخش ۳ |
| آزمون/انتشار | lint + verification via agent-browser در sandbox؛ Docker/CI/CD به‌عنوان آمادگی خط لوله | §۱۹، §۲۰؛ محدودیت sandbox صادقانه ثبت می‌شود |

قاعده §۴ (فناوری‌ها «پیشنهاد اولیه‌اند، نه الزام») رعایت شده: انحراف‌ها (SQLite به‌جای PostgreSQL، نشست اختصاصی به‌جای NextAuth، اجرای آزمون محدود) با دلیل مستند شده‌اند و در `assumptions-and-open-decisions.md` آمده‌اند.

## ۲. معماری لایه‌ای

```
┌─────────────────────────────────────────────────────────────┐
│ L1 — لایه ارائه (UI)                                        │
│  مسیر واحد «/» · ماژول‌های ۱۷گانه · RTL فارسی · Vazirmatn    │
│  shadcn/ui + Tailwind 4 · Recharts · zustand (module switch) │
│  فقط نمایش و فرم — هیچ منطق حاکمیتی/مجوزی در مرورگر          │
├─────────────────────────────────────────────────────────────┤
│ L2 — لایه API (src/app/api/*)                               │
│  Route Handlers · Zod validation · session middleware       │
│  can(user, perm) + orgScope filter روی «هر» درخواست (§۸)     │
├─────────────────────────────────────────────────────────────┤
│ L3 — منطق دامنه (src/lib/domain)                            │
│  محاسبه مهلت (baseline+dueDays) · ماتریس انتقال وضعیت        │
│  امتیازدهی ۴۰/۲۰/۲۰/۲۰ · قاعده ۱۵روزه فصلی · قواعد ۲٫۵       │
│  AI orchestration (retrieval → grounded prompt → LLM)        │
├─────────────────────────────────────────────────────────────┤
│ L4 — داده (Prisma + SQLite/PostgreSQL-ready)                │
│  ۲۶ موجودیت (data-dictionary.md) · مهاجرت نسخه‌بندی‌شده       │
│  AuditLog جداشده از داده عملیاتی (§۱۸)                        │
├─────────────────────────────────────────────────────────────┤
│ L5 — سرویس‌های بیرونی                                        │
│  LLM (z-ai-web-dev-sdk) · [آتی] ایمیل/پیام‌رسان، SSO/OIDC     │
└─────────────────────────────────────────────────────────────┘
```

اصول §۴ اعمال‌شده: تفکیک لایه‌ها (اصل ۱)، تنظیمات در DB/ENV نه کد (اصل ۸)، مهاجرت نسخه‌بندی‌شده (اصل ۳)، مستندسازی API و کنترل ورودی/خروجی (اصل ۴)، امکان جایگزینی ارائه‌دهنده AI (اصول ۶ و ۷).

## ۳. معماری «مسیر واحد» (Single-Route SPA) و دلیل آن

**محدودیت sandbox:** محیط عامل، یک مسیر عمومی قابل ارائه دارد؛ وایت‌لیست مسیرهای چندگانه (مثل /actions، /projects) پشتیبانی نمی‌شود.

**طرح:** مسیر قابل مشاهده فقط `/` است. ۱۷ ماژول ناوبری (§۵) به‌صورت کامپوننت‌های شرطی روی همان صفحه با zustand سوییچ می‌شوند؛ «مسیر» فعلی در state (و قابل به‌اشتراک‌گذاری با query/hash) نگهداری می‌شود.

**پیامد حاکمیتی:** چون UI در مرورگر قابل دستکاری است، امنیت باید کاملاً در L2 تضمین شود:
- هر Route Handler مستقلاً نشست و مجوز را بررسی می‌کند (`requireSession` + `requirePermission`).
- مخفی‌بودن آیتم منو صرفاً تجربه کاربری است (الزام صریح §۵: «کاربر نباید با مخفی‌بودن منو مصون فرض شود»).
- GET/POST مستقیم به API بدون مجوز = 401/403 و ثبت رخداد امنیتی.

## ۴. نقشه ماژول‌ها ↔ کامپوننت ↔ API

| # | ماژول (§۵) | کامپوننت فرعی (نمونه) | APIهای اصلی |
|---|---|---|---|
| ۱ | میزکار من | وظایف من، مهلت‌های نزدیک، اعلان‌ها | /api/auth/*، /api/notifications |
| ۲ | داشبورد راهبری کلان | KPI کارت‌ها، نمودارها، ۸ نما (§۶) | /api/dashboard/summary |
| ۳ | اقدامات و تعهدات | فهرست/فرم/گردش کار/تاریخچه/پیوست | /api/actions*، /api/files |
| ۴ | تقویم و گانت | تقویم شمسی، گانت ۵ گروه | /api/actions، /api/dashboard/summary |
| ۵ | سازمان‌ها و واحدها | درخت واحدها، رابط/مالک/متولی | /api/org-units* |
| ۶ | اسناد و مصوبات | مخزن، نسخه‌ها، گردش تصویب | /api/documents*، /api/files |
| ۷ | سبد پروژه‌ها | فهرست، امتیازدهی، موج نخست | /api/projects*، /api/projects/[id]/scores |
| ۸ | حاکمیت داده | حوزه‌های داده، وضعیت موجود دیجیتال | /api/data-domains، /api/digital-status |
| ۹ | دفتر ثبت هوش مصنوعی | رکوردهای کاربرد، ارزیابی، انطباق | /api/ai-applications* |
| ۱۰ | شاخص‌ها | تعریف شاخص، اندازه‌گیری، خط مبنا | /api/kpis*، /api/kpis/[id]/measurements |
| ۱۱ | ریسک‌ها و انحرافات | ریسک، انحراف، اقدام جبرانی | /api/risks، /api/deviations |
| ۱۲ | جلسات و مصوبات | تقویم جلسات، صورت‌جلسه، تصمیم‌ها | /api/meetings*، /api/meetings/[id]/decisions |
| ۱۳ | بودجه و منابع | آیتم‌های بودجه ۱۴۰۶ | /api/budget-items |
| ۱۴ | گزارش‌ها | ماهانه/فصلی/۹۰روزه/سالانه + تولید | /api/reports، /api/reports/generate |
| ۱۵ | مرکز دانش | FAQ، راهنماها، درخواست سند | /api/knowledge |
| ۱۶ | مدیریت کاربران | کاربران، نقش‌ها، نشست‌ها | /api/users*، /api/roles |
| ۱۷ | تنظیمات | مبنا، شِما کار، مدل امتیازدهی، هویت بصری، AI | /api/settings* |

## ۵. فهرست نقاط پایانی API (~۲۸)

| # | Endpoint | متدها | توضیح | مجوز |
|---|---|---|---|---|
| 1 | /api/auth/login | POST | ورود، ایجاد Session | عمومی (rate-limited) |
| 2 | /api/auth/logout | POST | ابطال نشست | session |
| 3 | /api/auth/me | GET | پروفایل + مجوزها | session |
| 4 | /api/dashboard/summary | GET | تجمیع داشبورد (§۶) | view + orgScope |
| 5 | /api/actions | GET/POST | فهرست/ایجاد اقدام (refStep) | view/create |
| 6 | /api/actions/[id] | GET/PATCH/DELETE | خواندن/ویرایش/حذف نرم | view/edit/soft-delete |
| 7 | /api/actions/[id]/status | POST | انتقال وضعیت (ماتریس §۷) | submit/approve/reject/close |
| 8 | /api/actions/[id]/history | GET | تاریخچه ActionUpdate | view |
| 9 | /api/org-units | GET/POST | درخت واحدها | view/create |
| 10 | /api/org-units/[id] | PATCH | تغییر ساختار (بدون تخریب تاریخچه) | edit |
| 11 | /api/users | GET/POST | مدیریت کاربران | users-admin |
| 12 | /api/users/[id] | PATCH | ویرایش/غیرفعال‌سازی/نقش | users-admin |
| 13 | /api/documents | GET/POST | مخزن اسناد | view/create |
| 14 | /api/documents/[id] | PATCH/DELETE | ویرایش/منسوخ/بایگانی | edit/soft-delete |
| 15 | /api/documents/[id]/versions | GET/POST | نسخه‌ها و گردش تصویب | view/submit/approve |
| 16 | /api/files | POST | بارگذاری امن فایل | files |
| 17 | /api/files/[id] | GET/DELETE | دریافت امن فایل | files + دسترسی رکورد والد |
| 18 | /api/projects | GET/POST | سبد پروژه‌ها | view/create |
| 19 | /api/projects/[id] | GET/PATCH | جزئیات/وضعیت چرخه (§۱۰) | view/edit/approve |
| 20 | /api/projects/[id]/scores | GET/POST | امتیازدهی ۴۰/۲۰/۲۰/۲۰ | edit + sensitive (ارزیابی) |
| 21 | /api/data-domains | GET/POST | حوزه‌های داده | view/create |
| 22 | /api/digital-status | GET/POST | وضعیت موجود دیجیتال (گام ۱۲) | view/create |
| 23 | /api/ai-applications | GET/POST | دفتر ثبت AI | view/create |
| 24 | /api/ai-applications/[id] | PATCH | وضعیت/ارزیابی (قاعده ۶-۲) | edit/approve |
| 25 | /api/kpis | GET/POST | شاخص‌ها (+needsDefinition) | view/create |
| 26 | /api/kpis/[id]/measurements | GET/POST | اندازه‌گیری/خط مبنا | view/edit |
| 27 | /api/risks | GET/POST | ریسک‌ها | view/create |
| 28 | /api/deviations | GET/POST | انحرافات + اقدام جبرانی | view/create |
| 29 | /api/meetings | GET/POST | جلسات و صورت‌جلسه | view/create |
| 30 | /api/meetings/[id]/decisions | GET/POST | تصمیم‌ها و پیگیری مصوبه | view/create/approve |
| 31 | /api/budget-items | GET/POST | بودجه و منابع | view/create |
| 32 | /api/reports | GET | فهرست گزارش‌ها + سررسید ۱۵ روزه | view |
| 33 | /api/reports/generate | POST | تولید پیش‌نویس گزارش از داده واقعی | export |
| 34 | /api/settings | GET/PATCH | تنظیمات (baseline، هویت، مدل امتیازدهی) | settings (+sensitive برای مبنا) |
| 35 | /api/notifications | GET | اعلان‌های کاربر | session |
| 36 | /api/notifications/[id]/read | PATCH | خواندن اعلان | session (مالک) |
| 37 | /api/ai/chat | POST | دستیار هوشمند grounded | session + آستانه نرخ |
| 38 | /api/audit-logs | GET | سوابق ممیزی (فقط خواندنی) | audit |

(محدوده «~۲۵»: هسته عملیاتی؛ مسیرهای فرعی مانند /read و /history جزو همان گروه شمرده می‌شوند.)

## ۶. جریان احراز هویت و نشست

```
ورود: POST /api/auth/login {username, password}
  1) یافتن User → bcryptjs.compare
  2) ایجاد Session {id(token hash), userId, expiresAt(۸ ساعت), ip, userAgent}
  3) Set-Cookie: session=<token>; HttpOnly; SameSite=Lax; Path=/
هر درخواست API:
  1) خواندن کوکی → یافتن Session معتبر (نشست منقضی/ابطال‌شده = 401)
  2) بارگذاری User + نقش‌ها → union مجوزها
  3) requirePermission(perm) → 403 در صورت نبود
  4) اعمال orgScope (دبیرخانه/ادمین=همه؛ مدیر واحد=واحد خود+فرزندان؛ بقیه=رکوردهای خود)
غیرفعال‌سازی کاربر → DELETE همه Sessionهای او (§۸ قاعده ۷)
خروج → حذف Session
```

- توکن نشست تصادفی ۳۲ بایتی است و فقط hash آن در DB ذخیره می‌شود (کاهش اثر سرقت دیتابیس).
- گذرواژه bcryptjs (cost ≥ 10)؛ گذرواژه/توکن هرگز در لاگ نمی‌رود (§۱۸).
- MFA/SSO/OIDC: نقطه اتصال در `requireSession` محفوظ است — یکپارچه‌سازی آتی (§۱۶).

## ۷. مدل مجوزدهی

- **Role.permissions:** آرایه JSON از ۱۴ کلید مجوز (view, create, edit, submit, approve, reject, close, soft-delete, files, export, users-admin, audit, settings, sensitive-ops) — §۸.
- **can(user, perm):** union مجوزهای نقش‌های کاربر + مجوزهای صریح کاربر (در صورت نیاز ABAC).
- **orgScope:** فیلتر سمت سرور روی کوئری‌ها؛ کاربر واحد فقط داده واحد خود (+فرزندان) را می‌بیند؛ دبیرخانه/ناظر با مجوز سراسری همه را. جزئیات در `rbac-matrix.md`.
- **default-deny:** هر مجوز نامعلوم = رد؛ هر مسیر API بدون بررسی صریح = رد (§۸ قاعده ۱).
- **تفکیک وظایف:** approve با پیکربندی از ایجادکننده تفکیک می‌شود (§۸ قاعده ۶) — در ماتریس انتقال وضعیت اعمال می‌شود.

## ۸. منطق محاسبه مهلت‌ها (نسبی → مطلق)

```
baseline = Setting("baselineDate")            // روز صفر = ابلاغ سراسری (Asia/Tehran)
for each Action:
  dueStart = baseline + dueFromDays           // مثال گام ۲: ۳
  dueEnd   = baseline + dueToDays             // مثال گام ۲: ۷
  statusMachine:
    if now > dueEnd and not completed → OVERDUE (معوق) + الزام Deviation (۲٫۵.۳)
    if dueEnd - now ≤ 7 روز → هشدار ۷ روزه (§۶، §۱۷)
گزارش فصلی: due = endOfQuarter(تقویم) + ۱۵ روز (گام ۳۱، فصل ۹ سند)
تغییر مبنا: پیش‌نمایش همه dueهای جدید → تأیید (perm settings+sensitive-ops) →
  ثبت BaselineChange {oldValue,newValue,reason,approvedBy} → بازمحاسبه نمایشی
```

- ذخیره‌سازی: تاریخ‌ها به‌صورت ISO/UTC؛ نمایش با تقویم شمسی؛ هیچ تاریخ مصوبی در کد هاردکد نمی‌شود (§۲.۲).
- مهلت نسبی (dueFromDays/dueToDays) از سند قابل تغییر نیست مگر با مصوبه — تغییر سررسید فقط گردش‌کارمحور است و مقدار قبلی در ActionUpdate می‌ماند (§۷).

## ۹. مسیر مهاجرت SQLite → PostgreSQL

- شِمای Prisma به‌گونه‌ای نوشته شده که با PostgreSQL سازگار است: انواع `DateTime`، `String`، `Int`/`Float`، رابطه‌های صریح؛ خودداری از ویژگی‌های SQLite-خاص (به‌جز datasource فعلی sandbox).
- مهاجرت: تغییر `datasource provider` به `"postgresql"` + `DATABASE_URL` محیطی + `prisma migrate deploy`؛ داده بذر استاندارد قابل اجرای مجدد است.
- محدودیت‌های شناخته‌شده: توابع تجمعی تقویم شمسی در اپلیکیشن (نه DB) پیاده شده‌اند تا مستقل از موتور DB باشند؛ در تولید از ایندکس‌گذاری و connection pool PostgreSQL استفاده می‌شود.

## ۱۰. معماری دستیار هوشمند (§۱۵)

```
کاربر → POST /api/ai/chat {question}
  1) requireSession + مجوز ماژول AI + rate limit
  2) استخراج intent (ماژول‌های مرتبط)
  3) Retrieval: کوئری Prisma فقط روی رکوردهای مجازِ همان کاربر (همان orgScope و مجوزهای view)
     + متن اسناد مجاز (DocumentVersion محتوای استخراج‌شده)
  4) ساخت پرامپت grounded:
     - system: قواعد «فقط از زمینه ارائه‌شده پاسخ بده»، «در نبود شواهد صریحاً بگو اطلاعات کافی نیست»،
       «هرگز مصوبه/تاریخ/رقم/نام مسئول نساز» (§۱۵ + ۲٫۵.۹)، «خروجی = پیش‌نویس»
     - context: JSON رکوردها + متادیتا (شناسه، عنوان، نسخه، بخش) برای استناددهی
     - محتوای اسناد بازیابی‌شده = داده غیرقابل اعتماد (به‌عنوان داده نشان‌دار، نه دستور)
  5) فراخوانی z-ai-web-dev-sdk سمت سرور (لایه انتزاعی LLMProvider — قابل تعویض)
  6) پاسخ با ارجاع منابع + برچسب «پیش‌نویس تولید AI»
  7) ثبت AuditLog (prompt hash، مدل، مصرف) بدون محتوای محرمانه
حالت بدون پیکربندی: پاسخ صریح «نیازمند پیکربندی اتصال»؛ هیچ وانمودسازی به تحلیل (§۱۵)
عملیات حساس: خروجی AI هرگز مستقیم تغییر وضعیت/مصوبه نمی‌سازد؛ اقدام نیازمند تأیید انسانی
```

**ضد prompt-injection:** دستورات کاربر و محتوای بازیابی‌شده جدا و برچسب‌دار می‌شوند؛ ابزارهای server-side فقط طبق مجوز کاربر اجرا می‌شوند و مکانیزم «ارتقای مجوز توسط دستور» وجود ندارد؛ خروجی مدل قابل اجرای خودکار نیست.

## ۱۱. ثبت رخداد و ممیزی (§۱۸)

- **AuditLog:** {userId, action, entityType, entityId, before(JSON), after(JSON), ip, userAgent, createdAt} — فقط append؛ رابط خواندنی با مجوز audit.
- **تفکیک:** AuditLog مستقل از Report/ActionUpdate است (الزام صریح §۱۸ «تفکیک سوابق ممیزی از گزارش‌های معمول»)؛ Reportها داده برنامه را گزارش می‌کنند، AuditLog رفتار سامانه را.
- عملیات حساس (تغییر مبنا، تغییر مجوز، غیرفعال‌سازی کاربر، توقف/بازکردن اقدام، تغییر مدل امتیازدهی، ارتقای نقش) همیشه ثبت می‌شوند — از جمله اقدامات مدیر سامانه (§۸ قاعده ۸).
- ممنوعیت: گذرواژه، توکن، کلید API در لاگ (sanitize خروجی خطا).

## ۱۲. اعلان‌ها (§۱۷)

- جدول Notification + تولید رویدادمحور از L2/L3 (تخصیص، نزدیکی مهلت، عبور سررسید، عودت، درخواست تأیید، ریسک بحرانی، آماده‌شدن گزارش، نیاز به تصمیم شورا).
- محاسبات زمان‌بندی (یادآوری ۷/۳۰ روزه، سررسید ۱۵ روزه فصلی) در یک scheduler درون‌برنامه‌ای هنگام درخواست داشبورد/میزکار (lazy evaluation) — بدون وابستگی به worker بیرونی در sandbox.
- ایمیل/پیام‌رسان: لایه انتزاعی آماده اما پیش‌فرض غیرفعال تا پیکربندی و تأیید سازمانی (§۱۷).

## ۱۳. مدیریت خطا و وضعیت‌های UI

- الگوی پاسخ یکنواخت: `{ok, data} | {ok:false, error:{code, messageFa}}`؛ کدهای ۴۰۰/۴۰۱/۴۰۳/۴۰۴/۴۰۹/۴۲۹/۵۰۰.
- پیام‌های خطای فارسیِ فهمیدنی برای کاربر؛ جزئیات فنی فقط در لاگ سرور بدون اسرار (§۱۸).
- UI برای همه نماها: Loading / Empty / Error / Success / «دسترسی غیرمجاز» (§۵).

## ۱۴. پیکربندی محیط‌ها

| متغیر | کاربرد | مقدار نمونه (غیرحساس) |
|---|---|---|
| DATABASE_URL | مسیر SQLite / رشته PostgreSQL | file:./db/custom.db |
| SESSION_TTL_HOURS | عمر نشست | 8 |
| TZ | منطقه زمانی | Asia/Tehran |
| AI_PROVIDER / AI_API_KEY* | ارائه‌دهنده LLM (فقط محیط سرور) | z-ai / *** |

*کلید واقعی فقط در Secret Store / GitHub Environments (§۱۹)؛ `.env.example` بدون مقدار واقعی.

## ۱۵. استقرار (§۱۹) — وضعیت صادقانه

- آماده‌سازی: Dockerfile، تعریف CI (lint + build + migrate + seed نمونه غیرمحرمانه)، `.env.example`، راهنمای راه‌اندازی.
- محدودیت sandbox: مخزن GitHub عمومی/واقعی و انتشار تولید در دسترس نیست؛ طبق §۱۹ فقط «آمادگی کد و خط لوله» گزارش می‌شود و ادعایی از استقرار واقعی نمی‌شود.
- GitHub Pages هرگز میزبان این سامانه نخواهد بود (§۱۹)؛ محیط مقصد باید TLS و پشتیبان‌گیری داشته باشد (NFR-SEC.8، NFR-DEP.2).
