# فرهنگ داده (Data Dictionary) — NIGC-DTG

**قرارداد کلی:** همه تاریخ‌ها `DateTime` (ISO/UTC، نمایش شمسی fa-IR-u-ca-persian با منطقه زمانی Asia/Tehran — §۲.۲)؛ همه موجودیت‌ها دارای `id` (شناسه یکتا)، `createdAt` (تاریخ ایجاد) و `updatedAt` (آخرین به‌روزرسانی) هستند و در جدول‌های زیر تکرار نمی‌شوند. حذف‌ها نرم (soft delete) هستند مگر تصریح شود. متن‌های فارسی UTF-8. این فرهنگ داده با `prisma/schema.prisma` هم‌ارز است و شِما برای PostgreSQL آماده طراحی شده (§۴).

---

## ۱. هویت، دسترسی و سازمان

### 1.1 User — کاربر
| فیلد | نوع | توضیح فارسی |
|---|---|---|
| username | String @unique | نام کاربری ورود |
| passwordHash | String | هش bcryptjs گذرواژه (هرگز متن خام ذخیره/لاگ نمی‌شود) |
| fullName | String | نام و نام خانوادگی فارسی |
| email | String? | رایانامه (برای پیکربندی آتی اعلان ایمیل — §۱۷) |
| phone | String? | تلفن همراه (اختیاری) |
| isActive | Boolean | فعال بودن حساب؛ غیرفعال‌سازی → خاتمه همه Sessionها (§۸ قاعده ۷) |
| extraPermissions | String (JSON array) | مجوزهای صریح مستقل از نقش (ABAC — §۸) |
| lastLoginAt | DateTime? | آخرین ورود (§۱۶) |

### 1.2 Role — نقش
| فیلد | نوع | توضیح |
|---|---|---|
| key | String @unique | کلید فنی نقش (مثل SECRETARIAT_MANAGER) |
| name | String | نام فارسی (مثل «مدیر دبیرخانه») — ۱۶ نقش پیش‌فرض §۸ |
| permissions | String (JSON array) | آرایه ۱۴ مجوز §۸: view, create, edit, submit, approve, reject, close, soft-delete, files, export, users-admin, audit, settings, sensitive-ops |
| isSystem | Boolean | نقش پیش‌فرض سامانه (غیرقابل حذف) |
| description | String? | شرح دامنه نقش |

نکته حاکمیتی (§۸): نقش‌ها «پیش‌فرض طراحی» هستند، نه انتصاب سازمانی.

### 1.3 UserRole — تخصیص نقش
| فیلد | نوع | توضیح |
|---|---|---|
| userId | FK → User | کاربر |
| roleId | FK → Role | نقش |
| orgUnitId | FK → OrgUnit? | محدوده سازمانی نقش (null = سراسری) — مبنای ABAC |

### 1.4 OrgUnit — واحد سازمانی
| فیلد | نوع | توضیح |
|---|---|---|
| parentId | FK → OrgUnit? | والد (سلسله‌مراتب شرکت/ستاد/تابعه — §۸) |
| name | String | نام واحد |
| code | String @unique | کد واحد |
| unitType | Enum: HQ_STAFF, SUBSIDIARY, COMMITTEE, OTHER | نوع (ستادی/تابعه/…) — تعریف از پنل، بدون ثابت‌سازی نام واحدها در کد (§۸) |
| validFrom / validTo | DateTime? | تاریخ اعتبار — تغییر ساختار بدون تخریب تاریخچه (قاعده ۲٫۵.۶) |
| isActive | Boolean | وضعیت فعالیت |
| managerId | FK → User? | مسئول واحد |
| deputyId | FK → User? | جانشین |
| dtCoordinatorUserId | FK → User? | رابط تحول دیجیتال واحد (گام ۱۱) |
| dataOwnerId | FK → User? | مالک داده واحد (گام ۱۱) |
| dataCustodianId | FK → User? | متولی داده واحد (گام ۱۱) |
| reportingStatus | Enum: NOT_RECEIVED, RECEIVED, VALIDATED, INCOMPLETE | وضعیت دریافت/اعتبارسنجی اطلاعات (گام ۱۲) |

### 1.5 Session — نشست
| فیلد | نوع | توضیح |
|---|---|---|
| userId | FK → User | مالک نشست |
| tokenHash | String @unique | هش توکن کوکی httpOnly (توکن خام هرگز ذخیره نمی‌شود) |
| expiresAt | DateTime | انقضا (پیش‌فرض ۸ ساعت) |
| ip / userAgent | String? | متادیتای امنیتی (§۱۸) |
| revokedAt | DateTime? | زمان ابطال (خروج/غیرفعال‌سازی) |

### 1.6 Setting — تنظیمات
| فیلد | نوع | توضیح |
|---|---|---|
| key | String @unique | کلید (مثل baselineDate، scoringModelVersion، brandName، brandColors، timezone) |
| value | String (JSON) | مقدار |
| valueType | Enum: STRING, DATE, JSON, NUMBER | نوع مقدار |
| description | String? | توضیح کاربرد |
| isSensitive | Boolean | تغییر نیازمند perm sensitive-ops و ثبت علت (§۱۶) |

`baselineDate` (پیش‌فرض ۲۰۲۶-۱۰-۲۳ = ۱ آبان ۱۴۰۵): روز صفر برنامه — بخش ۹ همین سند.

### 1.7 BaselineChange — تاریخچه تغییر تاریخ مبنا
| فیلد | نوع | توضیح |
|---|---|---|
| oldValue / newValue | DateTime | مقدار قبلی/جدید مبنا |
| reason | String | علت تغییر (الزامی — §۲.۲) |
| changedById | FK → User | تغییردهنده |
| approvedById | FK → User? | تأییدکننده مجاز |
| impactPreview | String (JSON) | پیش‌نمایش اثر روی مهلت‌ها پیش از اعمال |

### 1.8 AuditLog — سوابق ممیزی (جداشده از گزارش‌های معمول — §۱۸)
| فیلد | نوع | توضیح |
|---|---|---|
| userId | FK → User? | عامل (null = سیستمی) |
| action | String | رخداد (LOGIN, CREATE, UPDATE, STATUS_CHANGE, PERMISSION_CHANGE, SENSITIVE_OP, …) |
| entityType / entityId | String | موجودیت و شناسه هدف |
| before / after | String (JSON)? | مقادیر قبل/بعد (پس از پاک‌سازی اسرار) |
| ip / userAgent | String? | منبع درخواست |
| severity | Enum: INFO, WARNING, CRITICAL | شدت |

فقط append؛ ویرایش/حذف از API تعریف نمی‌شود (ضد دستکاری — threat-model).

---

## ۲. هسته برنامه: اقدامات

### 2.1 Action — اقدام/تعهد (۳۷ گام + اقدامات جدید مصوب)
| فیلد | نوع | توضیح |
|---|---|---|
| refStep | Int? @unique | شماره گام سند مرجع (۱-۳۷) — کلید ردیابی §۲.۱ |
| title / description | String | عنوان و شرح اقدام |
| timeGroup | Enum: IMMEDIATE, FIRST_30, SECOND_60, THIRD_90, ONGOING | گروه زمانی (۵ گروه §۲.۱) |
| phase | Enum: P1405, P1406, P1407 | فاز سالانه (جدول ۷ سند) |
| actionType | Enum: NORMAL, DECISION, ONGOING, CRITICAL, SPECIAL | نوع: عادی/مصوبه/مستمر/بحرانی/مورد خاص (§۷) |
| cycle | Enum?: MONTHLY, QUARTERLY, SEMIANNUAL, CONTINUOUS | تواتر اقدامات مستمر ۳۰-۳۷ (جدول ۵ سند) |
| dueFromDays / dueToDays | Int? | مهلت نسبی از مبنا (مثال گام ۲: ۳ و ۷) |
| startDate / dueDate / completedAt | DateTime? | شروع / سررسید مطلق محاسبه‌شده / پایان واقعی |
| ownerUserId | FK → User | مسئول اجرا |
| followupUserId | FK → User? | مسئول پیگیری (دبیرخانه) |
| approverUserId | FK → User? | مسئول تأیید |
| partnerOrgUnitIds | String (JSON array) | واحدهای همکار |
| deliverable | String | خروجی قابل تحویل (ستون سند) |
| acceptanceCriteria | String? | معیار پذیرش خروجی (§۷) |
| progress | Int (0-100) | درصد پیشرفت (تغییر آن مهلت را عوض نمی‌کند — §۷) |
| status | Enum (۱۱ وضعیت — بخش ۱۰ همین سند) | وضعیت گردش کار §۷ |
| dependencyActionIds | String (JSON array) | وابستگی‌های صریح سند/مصوبه (مثال: گام ۲۷→۱۹) |
| relatedDocumentIds | String (JSON array) | اسناد/مصوبات مرتبط |
| delayReason | String? | علت تأخیر |
| remediationNote / remediationOwnerId / remediationDueDate | — | اقدام جبرانی، مسئول و مهلت جبرانی (قاعده ۲٫۵.۳) |
| isCritical | Boolean | اهمیت برای تشدید یادآوری (§۱۷) |

### 2.2 ActionUpdate — تاریخچه/رویداد اقدام
| فیلد | نوع | توضیح |
|---|---|---|
| actionId | FK → Action | اقدام |
| userId | FK → User | ثبت‌کننده |
| type | Enum: STATUS_CHANGE, PROGRESS, COMMENT, ASSIGNMENT, DEADLINE_CHANGE, ATTACHMENT, DECISION_REQUEST, EXTENSION_REQUEST | نوع رویداد (§۷ قابلیت‌های تعاملی) |
| field / oldValue / newValue | String? | فیلد تغییر یافته و مقادیر (سررسید قبلی اینجا ماندگار است — §۷) |
| comment | String? | توضیح/علت |

---

## ۳. اسناد

### 3.1 Document — سند
| فیلد | نوع | توضیح |
|---|---|---|
| title | String | عنوان سند |
| docType | Enum: CHARTER, EXECUTIVE_INSTRUCTION, AI_GOVERNANCE_FRAMEWORK, PORTFOLIO_MECHANISM, MOU, FORM_TEMPLATE, COUNCIL_RESOLUTION, EXECUTION_CALENDAR, BUDGET_DOC, PERIODIC_REPORT, REFERENCE_PLAN, SUPPORTING_DOC, OTHER | نوع (منشور/دستورالعمل/چارچوب AI/سازوکار سبد/تفاهم‌نامه/فرم/مصوبه/…) — §۲.۳، §۹ |
| docNumber | String? | شماره سند |
| docDate | DateTime? | تاریخ سند |
| status | Enum: DRAFT, IN_REVIEW, APPROVED, ISSUED, PUBLISHED, OBSOLETE, ARCHIVED | پیش‌نویس/در بررسی/تأییدشده/مصوب/ابلاغ‌شده/منسوخ/بایگانی‌شده (§۹) |
| ownerId | FK → User | مالک سند |
| classification | Enum: PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED | طبقه‌بندی/محرمانگی (§۹، §۱۸) |
| needsUpload | Boolean | «نیازمند بارگذاری» — نسخه ۲٫۰ برنامه اجرایی و تفصیلی ۱٫۰ (§۲.۵) |
| accessLevel | Enum: ALL, SECRETARIAT, MANAGEMENT, UNIT_SCOPE | سطح دسترسی |
| relatedActionIds / relatedProjectIds / relatedMeetingIds | JSON | اتصال سند به اقدام/پروژه/جلسه (§۹) |
| reviewReminderDate | DateTime? | یادآوری بازنگری دوره‌ای (§۹) |

### 3.2 DocumentVersion — نسخه سند
| فیلد | نوع | توضیح |
|---|---|---|
| documentId | FK → Document | سند والد |
| versionNo | Int | شماره نسخه |
| contentSummary | String? | خلاصه/محتوای استخراج‌شده برای جست‌وجو (با رعایت مجوز — §۹) |
| fileId | FK → FileAsset? | فایل پیوست نسخه |
| changeNote | String? | توضیح تغییر نسبت به نسخه قبل |
| draftedById / reviewedById / approvedById | FK → User? | تدوین‌کننده/بررسی‌کننده/تأییدکننده (§۹) |
| approvedAt | DateTime? | تاریخ تصویب نسخه |

---

## ۴. سبد پروژه‌ها

### 4.1 Project — پروژه
| فیلد | نوع | توضیح |
|---|---|---|
| code | String @unique | شناسه پروژه |
| title | String | عنوان |
| sponsoringOrgUnitId | FK → OrgUnit | واحد پیشنهاددهنده |
| businessOwnerId | FK → User | مالک کسب‌وکار |
| projectManagerId | FK → User | مدیر پروژه |
| teamMemberIds | JSON | تیم همکار |
| problemStatement | String | مسئله/نیاز/فرصت (§۱۰) |
| objectives | String | اهداف و نتایج مورد انتظار |
| scope / deliverables / stakeholders | String | محدوده، اقلام تحویلی، ذی‌نفعان |
| timelinePlan | String (JSON) | فازها و نقاط عطف |
| budgetEstimate | Float? | بودجه برآوردی |
| dependencies | String? | وابستگی‌های اصلی |
| dataReadiness | Enum: LOW, MEDIUM, HIGH | آمادگی داده (ورودی امتیازدهی) |
| maturityNote | String? | وضعیت بلوغ |
| securityNotes | String? | ملاحظات امنیتی |
| risksSummary | String? | ریسک‌ها/موانع/مفروضات |
| successMetrics | String (JSON) | شاخص‌های موفقیت و منافع مورد انتظار |
| benefitBaseline / benefitTarget / benefitActual | String (JSON)? | خط مبنا/هدف/نتایج واقعی منافع — فقط با داده معتبر (§۱۰) |
| isFlagship | Enum: SMART_METERS, BSS_PLATFORM, DT_PORTFOLIO, NONE | پیشران بودن (کنتورهای هوشمند گاز / سکوی BSS / سبد DT — گام ۱۵) |
| status | Enum: PROPOSED, INITIAL_REVIEW, INFO_COMPLETED, SCORED, UNDER_REVIEW, RECOMMENDED, APPROVED, REJECTED, PILOT, EVALUATED, GATE_DECISION, SCALED, HALTED | چرخه §۱۰ (ثبت پیشنهاد → … → توسعه/توقف) |
| approvedDecisionId | FK → Decision? | مصوبه تصویب (تصویب نهایی فقط شورا — گام ۲۵) |

### 4.2 ProjectScore — امتیازدهی متوازن (گام ۲۳، محور ۶-۳)
| فیلد | نوع | توضیح |
|---|---|---|
| projectId | FK → Project | پروژه |
| modelVersion | String | نسخه مدل امتیازدهی (پیش‌فرض v1 = ۴۰/۲۰/۲۰/۲۰) |
| valueScore | Int (0-40) | ارزش و منفعت |
| dataReadinessScore | Int (0-20) | آمادگی داده |
| riskSecurityScore | Int (0-20) | ریسک و امنیت |
| feasibilityScore | Int (0-20) | امکان‌پذیری اجرا |
| totalScore | Int (0-100) | جمع محاسبه‌شده سمت سرور |
| rationale | String (JSON) | توضیح هر معیار |
| evidenceFileIds | JSON | شواهد |
| evaluatedById | FK → User | ارزیابی‌کننده |
| evaluatedAt | DateTime | تاریخ ارزیابی |

---

## ۵. حاکمیت داده و AI

### 5.1 DataDomain — حوزه داده
| فیلد | نوع | توضیح |
|---|---|---|
| name / description | String | نام و شرح حوزه/دامنه اطلاعاتی (§۱۱) |
| ownerId / custodianId | FK → User | مالک/متولی داده |
| producerUnitId / consumerUnitIds / custodianUnitId | FK/JSON | واحد تولیدکننده/مصرف‌کننده/نگهدارنده |
| relatedSystemNames | JSON | سامانه‌ها و پایگاه‌های داده مرتبط |
| usagePurpose | String? | هدف استفاده و فرایندهای مصرف‌کننده |
| classification | Enum: PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED | طبقه‌بندی/محرمانگی |
| qualityStatus | Enum: UNKNOWN, POOR, FAIR, GOOD | کیفیت/کامل‌بودن/به‌روزی |
| accessRules | String? | قواعد دسترسی و کنترل‌ها |
| complianceNotes | String? | عدم انطباق‌ها و مستندات |
| remediationPlan | String? | برنامه اصلاح کیفیت/رفع مغایرت |

### 5.2 DigitalStatusEntry — وضعیت موجود دیجیتال واحد (گام ۱۲)
| فیلد | نوع | توضیح |
|---|---|---|
| orgUnitId | FK → OrgUnit | واحد |
| entryType | Enum: IS_SYSTEM, DATABASE, AI_APPLICATION, OTHER | سامانه اطلاعاتی/پایگاه داده/کاربرد AI/سایر (§۱۱) |
| name / description | String | نام و شرح |
| validationStatus | Enum: PENDING, VALID, INVALID, INCOMPLETE | وضعیت اعتبارسنجی دبیرخانه |
| reportedAt | DateTime | تاریخ گزارش واحد |
| maturityScore | Int? | نمره خودارزیابی بلوغ (گام ۲۲) — بدون تحمیل مقیاس فرضی |

### 5.3 AiApplication — کاربرد هوش مصنوعی (دفتر ثبت — §۱۲)
| فیلد | نوع | توضیح |
|---|---|---|
| code | String @unique | شناسه یکتا |
| title | String | عنوان کاربرد |
| ownerOrgUnitId / businessOwnerId | FK | واحد مالک و مسئول کسب‌وکار |
| problemStatement / purpose | String | شرح مسئله و هدف |
| appType / businessProcess | String | نوع کاربرد و فرایند کسب‌وکار |
| status | Enum: PROPOSED, UNDER_EVALUATION, PILOT, APPROVED, OPERATIONAL, SUSPENDED, RETIRED | پیشنهادی/در حال ارزیابی/آزمایشی/مصوب/عملیاتی/متوقف‌شده/بازنشسته (§۱۲) |
| provider / modelName | String? | ارائه‌دهنده/مدل/فناوری (در صورت اطلاع) |
| inputData / outputData / dataSources | String | داده‌های ورودی/خروجی و منابع |
| classification | Enum: PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED | طبقه‌بندی و حساسیت |
| riskLevel | Enum: LOW, MEDIUM, HIGH, CRITICAL | سطح ریسک + روش ارزیابی در riskAssessmentNote |
| riskAssessmentNote | String? | روش/نتایج ارزیابی ریسک |
| humanOversight | String | نحوه نظارت انسانی (§۱۲) |
| usageConstraints | String? | محدودیت‌ها و شرایط استفاده |
| acceptanceCriteria / successMetrics | String | معیارهای پذیرش و سنجه‌های موفقیت |
| evaluationResults | String? | نتایج ارزیابی و خطاها |
| authorizationDocId | FK → Document? | مستند مجوز/ارزیابی/تصویب |
| lastReviewAt / reviewOwnerId | — | تاریخ آخرین بازبینی و مسئول |

قاعده ۶-۲: status ≠ APPROVED/OPERATIONAL بدون ارزیابی معتبر → در گزارش «بدون ثبت و ارزیابی» ظاهر می‌شود (قاعده ۲٫۵.۷).

---

## ۶. شاخص‌ها، ریسک و انحراف

### 6.1 Kpi — شاخص
| فیلد | نوع | توضیح |
|---|---|---|
| code | String @unique | کد (مثل KPI-02) |
| title | String | عنوان |
| family | Enum: COMMITMENT_COVERAGE, SCHEDULING, AI_REGISTRATION, DATA_QUALITY_MATURITY, BENEFIT_REALIZATION, ENABLEMENT, OTHER | خانواده §۱۳ |
| definition | String? | تعریف مصوب |
| formula | String? | فرمول محاسبه |
| unit | String? | واحد اندازه‌گیری |
| dataSource | String? | منبع داده |
| ownerUserId | FK → User? | متولی |
| baselineValue / targetValue | Float? | خط مبنا/هدف — فقط پس از تعیین مصوب (گام ۲۶) |
| baselineDate | DateTime? | تاریخ تعیین خط مبنا |
| reportingPeriod | Enum: MONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL | دوره گزارش‌دهی |
| dataQualityStatus | Enum: NO_DATA, PARTIAL, VALIDATED | وضعیت کیفیت داده |
| needsDefinition | Boolean | «نیازمند تعیین تعریف یا خط مبنا» — بذر هشت شاخص جدول ۳ سند (§۶، §۱۳) |

### 6.2 KpiMeasurement — اندازه‌گیری شاخص
| فیلد | نوع | توضیح |
|---|---|---|
| kpiId | FK → Kpi | شاخص |
| periodStart / periodEnd | DateTime | دوره اندازه‌گیری |
| value | Float | مقدار ثبت‌شده |
| sourceNote | String? | منبع/شرح داده |
| recordedById | FK → User | ثبت‌کننده |
| isBaseline | Boolean | این اندازه‌گیری خط مبنا مصوب است (گام ۲۶) |

### 6.3 Risk — ریسک (§۱۳)
| فیلد | نوع | توضیح |
|---|---|---|
| title / description | String | عنوان/شرح |
| relatedEntityType / relatedEntityId | String? | اتصال به اقدام/پروژه/بودجه |
| probability | Enum: LOW, MEDIUM, HIGH | احتمال |
| impact | Enum: LOW, MEDIUM, HIGH, CRITICAL | شدت اثر |
| ownerId | FK → User | مالک ریسک |
| preventiveAction | String? | اقدام پیشگیرانه |
| responsePlan | String? | برنامه پاسخ |
| dueDate | DateTime? | مهلت |
| status | Enum: OPEN, MITIGATING, CLOSED, ACCEPTED | وضعیت |

### 6.4 Deviation — انحراف (قاعده ۲٫۵.۳)
| فیلد | نوع | توضیح |
|---|---|---|
| relatedEntityType / relatedEntityId | String | اقدام/گزارش/پروژه منحرف‌شده |
| type | Enum: DEADLINE_MISSED, SCOPE_CHANGE, PARALLEL_WORK, DATA_MISMATCH, BUDGET, GOVERNANCE_EXCEPTION | نوع (شامل درخواست مجوز کتبی اقدام خارج از چارچوب — گام ۲، ۳۴) |
| reason | String | علت (الزامی) |
| severity | Enum: LOW, MEDIUM, HIGH, CRITICAL | شدت اثر (الزامی) |
| responsibleUserId | FK → User | مسئول (الزامی) |
| remediationAction | String | اقدام جبرانی (الزامی) |
| remediationOwnerId / remediationDueDate | — | مسئول/مهلت جبرانی (الزامی — بخش ۹ سند) |
| status | Enum: OPEN, IN_REVIEW, RESOLVED, ESCALATED_TO_COUNCIL | ارجاع به شورا (مرجع تفسیر — بخش ۱ سند) |

---

## ۷. جلسات، بودجه، گزارش

### 7.1 Meeting — جلسه (§۱۴)
| فیلد | نوع | توضیح |
|---|---|---|
| title | String | عنوان |
| meetingType | Enum: STEERING_COUNCIL, SECRETARIAT_WORKING, LIAISON_BRIEFING, OTHER | شورای راهبری/کاری دبیرخانه/نشست رابطان (گام ۱۰، ۱۷) |
| scheduledAt | DateTime | زمان |
| agenda | String (JSON) | دستور جلسه |
| attendeeUserIds / inviteeList | JSON | دعوت‌شدگان/حاضران |
| preReadFileIds | JSON | مستندات پیش از جلسه |
| minutesStatus | Enum: NONE, AI_DRAFT, REVIEW, APPROVED, PUBLISHED | وضعیت صورت‌جلسه (پیش‌نویس AI فقط تا تأیید نقش مجاز — §۱۴) |
| minutesContent | String? | متن صورت‌جلسه |
| minutesVersionNo | Int | نسخه صورت‌جلسه |

### 7.2 Decision — تصمیم/مصوبه (§۱۴)
| فیلد | نوع | توضیح |
|---|---|---|
| meetingId | FK → Meeting? | جلسه مبنا |
| number | String? | شماره مصوبه |
| title / content | String | عنوان/متن تصمیم |
| relatedEntityType / relatedEntityId | String? | اتصال به اقدام/پروژه/سند/ریسک |
| ownerUserId | FK → User | مسئول اجرای مصوبه |
| followupDueDate | DateTime? | مهلت پیگیری |
| executionStatus | Enum: PENDING, IN_PROGRESS, DONE, OVERDUE, CANCELLED | وضعیت اجرا (فهرست باز/معوق/اجرا‌شده — §۱۴) |
| decisionDate | DateTime | تاریخ تصویب |

### 7.3 BudgetItem — آیتم بودجه و منابع (گام ۷، ۲۹)
| فیلد | نوع | توضیح |
|---|---|---|
| title / description | String | شرح نیاز مالی |
| fiscalYear | Int | سال مالی (۱۴۰۶) |
| relatedProjectId | FK → Project? | پروژه مرتبط |
| relatedActionId | FK → Action? | اقدام مرتبط (گام ۲۹) |
| estimatedAmount | Float? | برآورد |
| status | Enum: IDENTIFIED, COORDINATED, SUBMITTED, CONFIRMED | شناسایی→هماهنگی (گام ۷)→تحویل چرخه بودجه→تثبیت (گام ۲۹) |
| ownerId | FK → User | مسئول پیگیری مالی |

### 7.4 Report — گزارش (§۱۴)
| فیلد | نوع | توضیح |
|---|---|---|
| title | String | عنوان |
| reportType | Enum: MONTHLY, QUARTERLY, QUARTERLY_90, ANNUAL, GATE_REVIEW | ماهانه/فصلی/۹۰روزه/سالانه/دروازه فاز |
| periodStart / periodEnd | DateTime | دوره گزارش |
| dueDate | DateTime | سررسید (فصلی: پایان فصل + ۱۵ روز — گام ۳۱) |
| status | Enum: DRAFT, COLLECTING, INCOMPLETE, READY, SUBMITTED, APPROVED | گردش §۱۴ (موارد ناقص مشخص می‌شوند) |
| content | String (JSON) | بدنه گردآوری‌شده از داده معتبر |
| generatedBy | Enum: SYSTEM, AI_DRAFT, MANUAL | مبدأ (AI فقط پیش‌نویس — §۱۵) |
| submittedById / approvedById | FK → User? | ارائه‌دهنده/تأییدکننده |

---

## ۸. اعلان، فایل، دانش

### 8.1 Notification — اعلان (§۱۷)
| فیلد | نوع | توضیح |
|---|---|---|
| userId | FK → User | گیرنده |
| type | Enum: ASSIGNMENT, DEADLINE_NEAR, OVERDUE, STATUS_CHANGE, REWORK, REVIEW_REQUEST, DECISION_REGISTERED, CRITICAL_RISK, REPORT_READY, COUNCIL_DECISION_NEEDED | انواع §۱۷ |
| title / body | String | متن (بدون داده محرمانه غیرضروری) |
| relatedEntityType / relatedEntityId | String? | هدف |
| readAt | DateTime? | زمان خواندن |
| channel | Enum: IN_APP, EMAIL | درون‌سامانه‌ای پایه؛ EMAIL فقط پس از پیکربندی معتبر |

### 8.2 FileAsset — فایل پیوست (§۹، §۱۸)
| فیلد | نوع | توضیح |
|---|---|---|
| fileName / mimeType / size | String/String/Int | متادیتا |
| storagePath | String | مسیر ذخیره (خارج از مخزن کد) |
| sha256 | String | اثر برای یکپارچگی |
| uploadedById | FK → User | بارگذارنده |
| classification | Enum: PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED | طبقه‌بندی |
| relatedEntityType / relatedEntityId | String | اقدام/سند/جلسه/پروژه والد |

### 8.3 KnowledgeArticle — مرکز دانش (§۵، گام ۲، ۳۵، ۳۶)
| فیلد | نوع | توضیح |
|---|---|---|
| title / body | String | محتوا (راهنما، FAQ، دستورالعمل تکمیل فرم) |
| category | Enum: FORM_GUIDE, FAQ, LESSON_LEARNED, SUPPORT, DOC_REQUEST_INFO | درس‌آموخته‌ها هم اینجا (§۱۵) |
| relatedActionId | FK → Action? | اتصال (مثلاً گام ۲) |
| isPublished | Boolean | انتشار با مجوز |

### 8.4 AiChatLog — لاگ گفت‌وگوی دستیار (§۱۵)
| فیلد | نوع | توضیح |
|---|---|---|
| userId | FK → User | پرسشگر |
| questionHash | String | اثر پرسش (بدون متن خام محرمانه) |
| retrievedRefs | String (JSON) | ارجاع‌های بازیابی‌شده (شناسه سند/رکورد/نسخه) |
| modelProvider / modelName | String | ارائه‌دهنده |
| usageTokens / latencyMs | Int? | مصرف/تأخیر (§۱۵: ثبت مصرف و هزینه) |
| outcome | Enum: ANSWERED, NO_EVIDENCE, CONFIG_MISSING, ERROR | «اطلاعات کافی نیست» صریح ثبت می‌شود |
| feedbackScore | Int? | بازخورد کاربر (§۱۵) |

---

## ۹. Enumهای سراسری

### 9.1 وضعیت‌های گردش کار اقدام (۱۱ وضعیت §۷)
`DRAFT` (پیش‌نویس) · `READY` (آماده اقدام) · `IN_PROGRESS` (در حال انجام) · `BLOCKED` (منتظر اطلاعات یا همکاری) · `SENT_FOR_REVIEW` (ارسال‌شده برای بررسی) · `NEEDS_REVISION` (نیازمند اصلاح) · `APPROVED` (تأییدشده) · `COMPLETED` (تکمیل‌شده) · `SUSPENDED` (متوقف‌شده با مجوز) · `OVERDUE` (معوق) · `CLOSED` (بسته‌شده)

ماتریس انتقال معتبر سمت سرور اعمال می‌شود؛ بازگشت وضعیت فقط با مجوز (§۷).

### 9.۲ گروه‌های زمانی (§۲.۱)
`IMMEDIATE` روز ۰-۱۰ (گام ۱-۹) · `FIRST_30` روز ۱۱-۳۰ (۱۰-۱۷) · `SECOND_60` روز ۳۱-۶۰ (۱۸-۲۴) · `THIRD_90` روز ۶۱-۹۰ (۲۵-۲۹) · `ONGOING` مستمر (۳۰-۳۷)

### 9.3 ۱۴ مجوز (§۸)
`view` مشاهده · `create` ایجاد · `edit` ویرایش · `submit` ارسال برای بررسی · `approve` تأیید · `reject` رد/عودت · `close` بستن · `soft-delete` حذف نرم/ابطال · `files` بارگذاری/دریافت فایل · `export` خروجی · `users-admin` مدیریت کاربران · `audit` مشاهده سوابق ممیزی · `settings` مدیریت تنظیمات · `sensitive-ops` عملیات حساس

### 9.4 طبقه‌بندی داده
`PUBLIC` عمومی · `INTERNAL` داخلی · `CONFIDENTIAL` محرمانه · `RESTRICTED` خیلی محرمانه (پایش از تاریخ ابلاغ دستورالعمل‌ها — §۱۱، گام ۲۷)

## ۱۰. قواعد داده (Integral Constraints)

1. `Action.refStep` unique — فقط ۳۷ رکورد بذرگذاری‌شده دارند؛ اقدامات جدید مصوب null و از مسیر Decision ساخته می‌شوند (قاعده ۲٫۵.۸).
2. `Action.dueDate` همیشه مشتق (baseline + dueDays) است و به‌روزرسانی مستقیم آن از API عمومی مسدود است؛ تغییر فقط با DEADLINE_CHANGE در گردش کار.
3. `ProjectScore.totalScore = value+data+risk+feasibility` با سقف معیارها اعتبارسنجی سمت سرور می‌شود (۴۰/۲۰/۲۰/۲۰).
4. حذف نرم همه موجودیت‌های عملیاتی؛ OrgUnit هیچ‌گاه فیزیکی حذف نمی‌شود (validTo) — قاعده ۲٫۵.۶.
5. `Kpi.needsDefinition=true` → محاسبات داشبورد این شاخص را با برچسب «نیازمند تعیین تعریف یا خط مبنا» نمایش می‌دهند، نه عدد صفر/ساختگی (§۶، ۲٫۵.۹).
6. `Session` بدون User فعال معتبر نیست؛ غیرفعال‌سازی User ⇒ revoke همه Sessionها (تراکنش واحد).
7. `Document.needsUpload=true` برای دو سند مرجع در دسترس نبودن؛ تولید محتوا برای آن‌ها ممنوع.
8. `AuditLog` قابل ویرایش/حذف از API نیست (فقط INSERT داخلی).
