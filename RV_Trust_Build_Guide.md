# RV Trust AI ERP — Complete Build Guide
### Repository Structure, Feature Breakdown & Step-by-Step Cursor Prompts

> Version 0.1 · 18 April 2026 · Prepared for Abhijat

---

## PART 1 — REPOSITORY OVERVIEW

You have two repositories. Here is exactly what lives where and why.

---

### Repository 1: `rv-trust-backend`

**Purpose:** Every server-side service — business logic, AI, telephony, integrations, databases, infra.

**Tech Stack:**
- NestJS + TypeScript (core ERP services — 11 services)
- Python 3.12 + FastAPI (AI platform — ASR, TTS, NMT, LLM)
- Go 1.22 (voice/telephony service — SIP/RTP bridge)
- PostgreSQL 16 + pgvector, ClickHouse, Redis, Kafka
- Docker Compose (local dev), AWS EKS + Terraform (production)

```
rv-trust-backend/
├── services/
│   ├── identity/          ← Module 1: SSO, RBAC, parent-student linkage
│   ├── attendance/        ← Module 3: Biometric ingestion, early warning
│   ├── academics/         ← Module 5, 6, 7: Marks, assessments, faculty workload
│   ├── fees/              ← Module 8: Payments, EMI, receipts, SAP write-back
│   ├── voice/             ← Module 4 (Go): SIP/RTP bridge, telephony, ASR streaming
│   ├── ai-platform/       ← Module 4 (Python): ASR, TTS, NMT, LLM orchestration
│   ├── comms/             ← Module 2: WhatsApp, SMS, push, email, student timeline
│   ├── mentorship/        ← Module 11: Mentor mapping, counselling, screening
│   ├── placements/        ← Module 10: CRM, drive scheduling, alumni
│   ├── grievance/         ← Module 12: Grievance lifecycle, feedback, sentiment
│   ├── compliance/        ← Module 13: NAAC/NBA/UGC auto-reports
│   ├── analytics/         ← Module 14: KPI dashboards, Trust-level metrics
│   └── sap-bridge/        ← Module 15: OData/IDoc/BAPI SAP SLCM integration
├── shared/
│   ├── kafka/schemas/     ← Avro event schemas
│   ├── types/             ← Shared TypeScript interfaces
│   └── dto/               ← Shared DTOs
├── infra/
│   ├── terraform/         ← AWS EKS, RDS, MSK, S3, KMS
│   ├── k8s/               ← Kubernetes manifests
│   └── helm/              ← Helm charts per service
├── scripts/               ← DB migrations, seed scripts
└── docker-compose.yml     ← Local: Postgres, ClickHouse, Redis, Kafka, Grafana
```

---

### Repository 2: `rv-trust-frontend`

**Purpose:** All user-facing interfaces — mobile app for parents/students, web app for faculty/admin.

**Tech Stack:**
- Flutter 3.x + Riverpod + Isar + Go Router (Parent + Student mobile app)
- Next.js 14 + TypeScript + Tailwind + shadcn/ui (Faculty + Admin web)
- NextAuth.js (web auth), Keycloak OIDC (mobile auth)
- Zustand + React Query (web state), Riverpod (mobile state)

```
rv-trust-frontend/
├── apps/
│   ├── mobile/                    ← Modules 2, 3, 4, 5, 8, 11, 12
│   │   └── lib/
│   │       ├── features/
│   │       │   ├── auth/          ← Login, SSO, biometric unlock
│   │       │   ├── attendance/    ← Attendance view, leave requests
│   │       │   ├── timeline/      ← Unified student timeline
│   │       │   ├── fees/          ← Fee dues, payments, EMI
│   │       │   ├── notifications/ ← Push, WhatsApp, in-app alerts
│   │       │   ├── profile/       ← Language picker, consent centre
│   │       │   └── voice_calls/   ← Call history, transcripts
│   │       ├── core/
│   │       │   ├── api/           ← HTTP client + interceptors
│   │       │   ├── models/        ← Data models + Isar schemas
│   │       │   ├── providers/     ← Riverpod state providers
│   │       │   ├── router/        ← Go Router navigation
│   │       │   └── theme/         ← Design tokens, typography
│   │       └── shared/widgets/    ← Reusable UI components
│   └── web/                       ← Modules 3, 5, 6, 7, 10, 11, 12, 13, 14
│       └── src/
│           ├── app/               ← Next.js App Router pages
│           ├── features/
│           │   ├── attendance/    ← Live absentee dashboard
│           │   ├── marks/         ← Marks entry + dual verification
│           │   ├── voice/         ← Call queue, transcripts
│           │   ├── placements/    ← Drive management
│           │   ├── grievance/     ← Grievance officer console
│           │   ├── compliance/    ← NAAC/NBA report builder
│           │   └── dashboard/     ← Trust-level KPI view
│           ├── components/
│           │   ├── ui/            ← shadcn/ui base components
│           │   ├── forms/         ← React Hook Form
│           │   ├── tables/        ← AG Grid data tables
│           │   └── charts/        ← Recharts visualisations
│           └── lib/
│               ├── api/           ← tRPC / REST client
│               ├── hooks/         ← Custom React hooks
│               └── stores/        ← Zustand stores
└── packages/
    ├── shared-types/              ← TypeScript types shared with backend
    └── api-client/                ← Generated API client (OpenAPI)
```

---

## PART 2 — MODULE-TO-REPO MAPPING

| # | Module | Backend Service | Frontend (Mobile) | Frontend (Web) |
|---|--------|----------------|-------------------|----------------|
| 1 | Identity & Directory | `services/identity` | `features/auth` | `app/(auth)` |
| 2 | Student & Parent Portal | `services/comms` | `features/timeline`, `features/notifications` | `features/dashboard` |
| 3 | Attendance Intelligence | `services/attendance` | `features/attendance` | `features/attendance` |
| 4 | AI Parent Voice Agent | `services/voice` + `services/ai-platform` | `features/voice_calls` | `features/voice` |
| 5 | Academic Performance & Early Warning | `services/academics` | (read-only marks view) | `features/marks` |
| 6 | Faculty Workload & Lecture | `services/academics` | — | `features/faculty` |
| 7 | Examination & Internal Assessment | `services/academics` | — | `features/marks` |
| 8 | Fees, Scholarships & Aid | `services/fees` | `features/fees` | `features/fees` |
| 9 | Hostel, Transport, Library | `services/hostel` (new) | — | `features/hostel` |
| 10 | Placements & Internships CRM | `services/placements` | — | `features/placements` |
| 11 | Mentorship & Counselling | `services/mentorship` | (mentor chat) | `features/mentorship` |
| 12 | Grievance & Feedback | `services/grievance` | `features/grievance` | `features/grievance` |
| 13 | Compliance & Accreditation | `services/compliance` | — | `features/compliance` |
| 14 | Admin & Trust Dashboard | `services/analytics` | — | `features/dashboard` |
| 15 | Integrations Hub | `services/sap-bridge` | — | — |

---

## PART 3 — RECOMMENDED BUILD ORDER

Build in this exact sequence. Each phase unlocks the next.

```
Phase 0: Foundation (Week 1-2)
  → Backend: Docker infra, shared types, Kafka schemas, DB migrations
  → Frontend: Project init, design system, auth shell

Phase 1: Identity (Week 2-3)
  → Backend: services/identity (SSO, RBAC, JWT)
  → Frontend: Login screens, role-based routing

Phase 2: Attendance (Week 3-5)
  → Backend: services/attendance (biometric ingestion, SAP sync)
  → Frontend: Absentee dashboard (web), attendance view (mobile)

Phase 3: AI Voice Agent (Week 4-8) [runs parallel to Phase 2]
  → Backend: services/ai-platform (ASR/TTS/NMT), services/voice (Go SIP bridge)
  → Frontend: Call queue (web), call history + transcripts (mobile)

Phase 4: Academics & Fees (Week 6-9)
  → Backend: services/academics, services/fees
  → Frontend: Marks entry (web), marks + fees view (mobile)

Phase 5: Comms & Timeline (Week 8-10)
  → Backend: services/comms (WhatsApp, push, timeline events)
  → Frontend: Unified timeline (mobile), notifications

Phase 6: Mentorship, Placements, Grievance (Week 10-14)
  → Backend: services/mentorship, services/placements, services/grievance
  → Frontend: Respective web feature modules

Phase 7: Compliance & Analytics (Week 13-16)
  → Backend: services/compliance, services/analytics
  → Frontend: NAAC report builder, Trust KPI dashboard

Phase 8: SAP Bridge & Integrations (Week 14-18)
  → Backend: services/sap-bridge, DigiLocker, ABC, payment gateways
```

---

## PART 4 — CURSOR PROMPTS BY MODULE

> **How to use:** Open the relevant folder in Cursor. Open a new chat (Cmd+L). Paste the prompt exactly. Cursor will scaffold the full feature. Run each step in sequence — do not skip.

---

## MODULE 1 — IDENTITY & DIRECTORY

### Backend → `rv-trust-backend/services/identity`

---

**STEP 1.1 — Scaffold the NestJS Identity Service**

```
You are building the Identity & Directory service for RV Trust AI ERP.
This is a NestJS TypeScript microservice that handles SSO, RBAC, 
parent-student linkage, and the campus directory.

Scaffold a new NestJS project inside services/identity/ with:
- NestJS 10 with TypeScript strict mode
- TypeORM with PostgreSQL (connection via DATABASE_URL env var)
- Passport.js with JWT strategy and Keycloak OIDC strategy
- @nestjs/config for environment management
- class-validator + class-transformer for DTOs
- winston logger

Create the following module structure:
  src/
    auth/          - AuthModule, AuthController, AuthService
    users/         - UsersModule, UsersController, UsersService, User entity
    roles/         - RolesModule, RolesService, Role entity, RBAC guard
    parents/       - ParentsModule, ParentsController, ParentsService, Parent entity
    students/      - StudentsModule, StudentsController, StudentsService, Student entity
    directory/     - DirectoryModule, DirectoryController (org chart, campus directory)
    health/        - HealthModule with Terminus health check

The User entity must have: id (uuid), email, name, role (enum: STUDENT | PARENT | FACULTY | HOD | DEAN | PRINCIPAL | TRUSTEE | COUNSELLOR | ADMIN), institution_id, sap_id, preferred_language (enum: kn | en | hi | ta | te | ml), is_active, created_at, updated_at.

The Parent entity must have: id, user_id (FK), relation (FATHER|MOTHER|GUARDIAN), phone (tokenised — store token only, not raw number), whatsapp, email, preferred_language, consent_flags (jsonb), created_at.

The Student entity must have: id, user_id (FK), sap_id (unique), usn (unique), name, dob, section_id, photo_url, biometric_ref, institution_id, created_at.

Add a ParentStudentLink join table: id, parent_id, student_id, is_primary, linked_at.

Include:
- JWT access token (15min) + refresh token (7d) rotation
- Role guard decorator @Roles(...) using RBAC
- Keycloak OIDC callback endpoint /auth/callback
- POST /auth/login (email+password fallback)
- POST /auth/refresh
- GET /users/me
- GET /students/:id (with parent guard — only linked parent or self can read)
- POST /parents/link-student (links a parent to a student with OTP verification)
- GET /directory/org-chart (returns institution hierarchy)

Add .env.example with all required variables.
Add Docker Dockerfile for this service.
```

---

**STEP 1.2 — Database Migrations for Identity**

```
Inside rv-trust-backend/services/identity, using TypeORM migrations:

Create migration files in src/migrations/ for:
1. CreateUsersTable — all fields from User entity above, index on email and institution_id
2. CreateParentsTable — with phone stored as VARCHAR(64) for the PII token, index on user_id
3. CreateStudentsTable — unique indexes on sap_id and usn, index on section_id
4. CreateParentStudentLinksTable — composite unique on (parent_id, student_id)
5. CreateRolesTable — id, name, permissions (jsonb)
6. CreateUserRolesTable — user_id, role_id join table

Add a seed script in scripts/seed-identity.ts that:
- Creates the Institution record for RVCE (id: 'rvce', name: 'R.V. College of Engineering', code: 'RVCE')
- Creates one admin user per institution
- Creates sample roles: STUDENT, PARENT, FACULTY, HOD, DEAN, PRINCIPAL, TRUSTEE, COUNSELLOR with their default permissions

Run command: npm run migration:generate && npm run migration:run
```

---

**STEP 1.3 — PII Vault Integration for Phone Numbers**

```
In rv-trust-backend/services/identity/src/parents/:

Implement a PiiVaultService that:
- Uses AWS KMS to encrypt/decrypt parent phone numbers
- Stores only the KMS-encrypted ciphertext in the parents.phone column
- Exposes encrypt(plaintext: string): Promise<string> and decrypt(token: string): Promise<string>
- Never logs raw phone numbers — uses a phone hash for logging (SHA-256 of the number)
- Is injected into ParentsService wherever phone numbers are read or written

Update ParentsService.createParent() to encrypt the phone before saving.
Update ParentsService.findById() to decrypt phone only when called with includePhone: true 
and only from services that have the PHONE_READ permission.

Add unit tests in parents/parents.service.spec.ts covering:
- Phone is encrypted on create (raw number never appears in DB insert)
- Phone is decrypted on read with correct permission
- Phone read without permission throws ForbiddenException
```

---

**STEP 1.4 — Consent Management**

```
In rv-trust-backend/services/identity/src/consent/:

Create a ConsentModule with:

Consent entity:
  id (uuid), subject_id (FK to users), scope (enum: VOICE_CALLS | WHATSAPP | PUSH | TIMELINE_SHARE | DATA_EXPORT), 
  granted_at, revoked_at (nullable), method (enum: APP_UI | ADMISSION_FORM | PAPER_FORM), 
  ip_address, user_agent

ConsentService methods:
  - grantConsent(userId, scope, method, ip, ua): creates or reactivates consent record
  - revokeConsent(userId, scope): sets revoked_at = now()
  - hasConsent(userId, scope): returns boolean — checks revoked_at is null
  - getConsentHistory(userId): full audit trail of all consent changes
  - exportConsents(userId): returns JSON export of all consents (for DPDP right-to-information)

ConsentController:
  GET    /consent/me              — current user's active consents
  POST   /consent/:scope/grant    — grant a scope
  DELETE /consent/:scope          — revoke a scope  
  GET    /consent/me/export       — full export for DPDP compliance

Add a @RequiresConsent(scope) decorator that can be applied to any controller method.
It checks consent before the request proceeds and throws ConsentRequiredException if absent.
This decorator will be used by the Voice and Comms services.
```

---

### Frontend (Mobile) → `rv-trust-frontend/apps/mobile/lib/features/auth`

---

**STEP 1.5 — Flutter Auth Feature (Mobile)**

```
In rv-trust-frontend/apps/mobile/lib/features/auth/:

Build the complete authentication flow for the Flutter parent/student app.

Dependencies to add to pubspec.yaml:
- flutter_riverpod: ^2.5.0
- riverpod_annotation: ^2.3.0
- go_router: ^13.0.0
- dio: ^5.4.0
- flutter_secure_storage: ^9.0.0
- local_auth: ^2.1.0  (biometric unlock)
- flutter_keycloak: latest
- easy_localization: ^3.0.0

Create:

1. lib/features/auth/models/auth_state.dart
   - AuthState sealed class: AuthInitial | AuthLoading | AuthAuthenticated(user) | AuthError(message)

2. lib/features/auth/providers/auth_provider.dart
   - AuthNotifier extends AsyncNotifier<AuthState>
   - Methods: login(email, password), loginWithSSO(), logout(), refreshToken(), checkBiometric()
   - Stores JWT in FlutterSecureStorage (key: 'access_token', 'refresh_token')
   - Auto-refreshes token 2 minutes before expiry using a Timer

3. lib/features/auth/repositories/auth_repository.dart
   - AuthRepository with Dio HTTP client
   - POST /auth/login → returns AuthTokens
   - POST /auth/refresh → returns new AuthTokens
   - GET /users/me → returns UserProfile

4. lib/features/auth/screens/login_screen.dart
   - Clean, branded login screen with RV Trust logo
   - Email + password fields with validation
   - "Sign in with Google / Microsoft" SSO button (Keycloak redirect)
   - Biometric unlock button (shown if previously logged in + biometric enrolled)
   - Language selector (Kannada 🇮🇳 / English / Hindi) — saves to SharedPreferences
   - Error snackbar on failure

5. lib/features/auth/screens/biometric_unlock_screen.dart
   - Shows when app is backgrounded and re-opened
   - Fingerprint/face scan prompt using local_auth
   - Falls back to PIN entry if biometric fails

6. lib/core/router/app_router.dart
   - GoRouter with redirect guard: if not authenticated → /login
   - Role-based initial route: PARENT → /timeline, STUDENT → /timeline, 
     FACULTY → redirect to web app (deep link)

Write widget tests for login_screen.dart covering successful login, 
failed login error display, and biometric unlock button visibility.
```

---

### Frontend (Web) → `rv-trust-frontend/apps/web/src/app/(auth)`

---

**STEP 1.6 — Next.js Auth (Web — Faculty & Admin)**

```
In rv-trust-frontend/apps/web/:

Set up NextAuth.js v5 for the faculty and admin web portal.

1. Install: pnpm add next-auth@beta @auth/core

2. Create src/auth.ts:
   - Configure NextAuth with Keycloak provider (OIDC)
   - Extract roles from Keycloak JWT token claims
   - Map Keycloak roles to internal role enum (FACULTY, HOD, DEAN, PRINCIPAL, TRUSTEE, ADMIN, COUNSELLOR)
   - Session includes: user.id, user.name, user.email, user.role, user.institutionId, user.preferredLanguage

3. Create src/middleware.ts:
   - Protect all routes under /dashboard, /attendance, /marks, /voice, /placements, /grievance, /compliance
   - Redirect unauthenticated users to /login
   - Role-based route protection:
     FACULTY can access: /attendance, /marks, /voice, /students
     HOD/DEAN can access: all faculty routes + /compliance, /analytics
     PRINCIPAL/TRUSTEE can access: /dashboard only (high-level KPIs)
     COUNSELLOR can access: /mentorship only
     ADMIN can access: everything

4. Create src/app/(auth)/login/page.tsx:
   - Minimal, branded login page
   - "Sign in with Google Workspace" button (for staff using @rvce.edu.in)
   - "Sign in with Microsoft 365" button
   - Shows institution logo (RVCE / RVITM based on subdomain)
   - Loading spinner while redirecting

5. Create src/app/layout.tsx:
   - SessionProvider wrapper
   - Sidebar layout for authenticated pages (collapsible on mobile)
   - Top bar with user name, role badge, institution name, logout button

6. Create src/components/layout/Sidebar.tsx:
   - Navigation links filtered by user role
   - Uses Next.js Link with active state highlighting
   - Icons from lucide-react

Use shadcn/ui components throughout. Add loading.tsx and error.tsx for each route segment.
```

---

## MODULE 2 — STUDENT & PARENT PORTAL

### Backend → `rv-trust-backend/services/comms`

---

**STEP 2.1 — Student Timeline Service**

```
In rv-trust-backend/services/comms/:

Scaffold a NestJS service that owns the Student Timeline — the append-only, 
auditable log of every meaningful event in a student's life at the institution.

TimelineEvent entity:
  id (uuid), student_id (FK), ts (timestamptz, indexed), 
  kind (enum: ATTENDANCE_ABSENT | ATTENDANCE_PRESENT | CALL_PLACED | CALL_COMPLETED | 
              MARKS_PUBLISHED | FEE_DUE | FEE_PAID | GRIEVANCE_FILED | COUNSELLING_SESSION | 
              CIRCULAR | LEAVE_APPROVED | MENTOR_NOTE | PLACEMENT_APPLIED),
  actor_id (uuid — who created this event), 
  visibility (enum: STUDENT_ONLY | PARENT_AND_STUDENT | FACULTY | ALL),
  payload_json (jsonb — event-specific data),
  lang_original (varchar — language the payload was originally written in),
  created_at (timestamptz, default now())

Rules:
- TimelineEvents are NEVER updated or deleted. Corrections are new events.
- All writes go through TimelineService.append() — never direct DB inserts.
- Reads are always filtered by: student_id + visibility (based on requester's role) + date range.

Create:

TimelineService:
  - append(dto: CreateTimelineEventDto): Promise<TimelineEvent>
  - findByStudent(studentId, requesterId, requesterRole, opts: {from, to, kinds, page}): paginated events
  - findById(eventId, requesterId, requesterRole): single event with permission check
  - getTranslation(eventId, targetLang): returns payload translated to targetLang via AI Platform

TimelineController:
  GET  /timeline/:studentId           — paginated events for a student (role-filtered)
  GET  /timeline/:studentId/:eventId  — single event
  GET  /timeline/:studentId/export    — DPDP data export (student or parent only)

Kafka consumer: listens to ALL domain events from all services on topic 'timeline.events.inbound'
and calls TimelineService.append() for each. This means all other services never write to Timeline 
directly — they emit events and this service consumes them.

Add @nestjs/microservices Kafka consumer with consumer group 'comms-timeline-consumer'.
```

---

**STEP 2.2 — Notifications & Messaging Service**

```
In rv-trust-backend/services/comms/src/notifications/:

Build the multi-channel notification dispatcher.

NotificationChannel enum: PUSH | WHATSAPP | SMS | EMAIL | IN_APP

NotificationTemplate entity:
  id, code (unique varchar e.g. 'ABSENT_PARENT_NOTIFY'), 
  channel, language (enum: kn|en|hi|ta|te|ml),
  subject (nullable, for email), body_template (handlebars template string),
  created_at

NotificationLog entity:
  id, recipient_user_id, student_id (nullable), channel, template_code,
  payload_json, status (enum: PENDING|SENT|DELIVERED|FAILED), 
  external_id (provider message ID), sent_at, delivered_at, failed_reason, created_at

NotificationService:
  - send(dto: SendNotificationDto): dispatches to the correct channel adapter
  - sendToParent(parentId, templateCode, variables, channels?): looks up parent language + consent,
    then sends on consented channels only
  - retry(notificationId): retries failed notifications (max 3 attempts with exponential backoff)

Channel adapters (each in its own file):
  - WhatsAppAdapter: uses Meta WhatsApp Business Cloud API. POST /messages with template_name.
    Requires WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID env vars.
  - SmsAdapter: uses Karix/Gupshup API. Sends transactional SMS (DLT-registered template only).
  - PushAdapter: uses Firebase Admin SDK. Sends to device token stored in user profile.
  - EmailAdapter: uses SendGrid. HTML email using handlebars template.
  - InAppAdapter: writes to a notifications table read by mobile/web app via polling or SSE.

Add a Bull queue (Redis-backed) for async notification dispatch.
Each send() call enqueues a job. The processor picks it up and calls the appropriate adapter.
Failed jobs are retried 3 times then moved to dead-letter queue.

Create NotificationTemplates seed for all templates in English and Kannada:
  - ABSENT_PARENT_NOTIFY: "Dear [parent_name], [student_name] was absent today..."
  - FEE_DUE_REMINDER: "Dear [parent_name], fee of ₹[amount] is due on [date]..."
  - MARKS_PUBLISHED: "[student_name]'s [subject] marks: [score]/[max]..."
  - PTM_INVITE: "Parent-Teacher Meeting scheduled for [date] at [time]..."
  - CALL_SUMMARY_WHATSAPP: "Summary of today's call: [summary]..."
```

---

### Frontend (Mobile) → `rv-trust-frontend/apps/mobile/lib/features/timeline`

---

**STEP 2.3 — Unified Timeline Screen (Mobile)**

```
In rv-trust-frontend/apps/mobile/lib/features/timeline/:

Build the unified student timeline — the home screen of the parent/student app.

1. lib/features/timeline/models/timeline_event.dart
   - TimelineEvent: id, studentId, ts (DateTime), kind (TimelineEventKind enum), 
     visibility, payloadJson (Map<String,dynamic>), langOriginal, createdAt
   - TimelineEventKind enum matching backend: attendanceAbsent, attendancePresent, 
     callPlaced, callCompleted, marksPublished, feeDue, feePaid, grievanceFiled, 
     counsellingSession, circular, leaveApproved, mentorNote, placementApplied
   - fromJson factory constructor

2. lib/features/timeline/repositories/timeline_repository.dart
   - fetchEvents(studentId, {from, to, kinds, page}) → PaginatedResult<TimelineEvent>
   - fetchEvent(studentId, eventId) → TimelineEvent
   - Uses Dio with Bearer token interceptor
   - Caches last 7 days of events in Isar local DB for offline access

3. lib/features/timeline/providers/timeline_provider.dart
   - TimelineNotifier: AsyncNotifier<List<TimelineEvent>>
   - Supports infinite scroll (fetch next page on scroll)
   - Filter by kind (chips at top of screen)
   - Auto-refresh every 5 minutes via Timer

4. lib/features/timeline/screens/timeline_screen.dart
   Main home screen — a vertical scrolling feed of events, newest first.
   
   Design:
   - Each event is a Card with a left-edge colour strip (red=absent, green=present, 
     blue=call, orange=fee, purple=marks, grey=circular)
   - Event icon + title + timestamp + 1-line summary
   - Tap to expand full detail
   - Pull-to-refresh
   - Filter chips at top: All | Attendance | Calls | Marks | Fees | Circulars
   - Language toggle button in AppBar — switches display language via easy_localization
   - Offline banner (yellow) if loading from Isar cache
   
   Event card variants (each a separate Widget):
   - AttendanceEventCard: shows date, period, subject, status badge
   - CallEventCard: shows call time, duration, sentiment badge, "Play recording" button 
     (disabled if audio expired), "View transcript" button
   - MarksEventCard: shows subject, score/max, grade, trend arrow vs last test
   - FeeEventCard: shows component, amount, due date, "Pay Now" CTA button
   - CircularEventCard: shows title, date, "Read More" link

5. lib/features/timeline/screens/event_detail_screen.dart
   Full-screen detail for any event. Shows full payload_json rendered appropriately for kind.
   For CallEventCard: embedded audio player (if recording available) + full transcript 
   with speaker labels and timestamps.

Use shimmer loading placeholders while fetching.
```

---

## MODULE 3 — ATTENDANCE INTELLIGENCE

### Backend → `rv-trust-backend/services/attendance`

---

**STEP 3.1 — Attendance Ingestion Pipeline**

```
In rv-trust-backend/services/attendance/:

Build the Attendance Intelligence NestJS service.

Entities:

AttendanceRecord:
  id (uuid), student_id, course_id, session_ts (timestamptz), 
  status (enum: PRESENT | ABSENT | LATE | EXCUSED | SANCTIONED_EVENT),
  source (enum: BIOMETRIC | GEO_FENCE | FACIAL | MANUAL | SAP_SYNC),
  verified_by (faculty_id, nullable), institution_id, created_at

AttendanceSummary:
  id, student_id, course_id, month (date), total_classes, classes_attended, 
  percentage, at_risk_75 (boolean), at_risk_85 (boolean), updated_at

CourseSession:
  id, course_id, section_id, faculty_id, scheduled_start (timestamptz), 
  scheduled_end, room, status (enum: SCHEDULED | ONGOING | COMPLETED | CANCELLED)

Create:

AttendanceController:
  POST /attendance/ingest          — receives biometric punch events (from MQTT bridge)
  POST /attendance/geo-fence       — receives geo-fence check-in from mobile app
  GET  /attendance/students/:id/summary      — % per course for a student
  GET  /attendance/sections/:id/today        — today's session list with absentee counts
  GET  /attendance/sections/:id/absentees    — today's absentees for a section (faculty use)
  POST /attendance/records/:id/excuse        — mark an absence as excused (faculty/HOD)
  GET  /attendance/at-risk                   — students below 75% or 85% thresholds

AttendanceService:
  - ingestPunch(biometricRef, timestamp, deviceId): looks up student by biometricRef, 
    finds the current CourseSession for their section, creates AttendanceRecord
  - reconcileWithSap(date): pulls attendance roster from SAP SLCM via OData, 
    compares with local records, flags discrepancies
  - updateSummary(studentId, courseId): recalculates AttendanceSummary for the month
  - getAtRiskStudents(institutionId, threshold): returns students below threshold

Kafka Publisher: after consolidation at 09:30 daily (Bull cron job),
emit AbsenteeDetected event to topic 'attendance.absentees.daily' for each absentee:
  {
    eventType: 'AbsenteeDetected',
    studentId, studentName, sectionId, date, 
    parentId, parentPhone (token), parentLanguage,
    absentCount: number, percentage: number
  }

This event is consumed by the Voice service to trigger parent calls.

Add MQTT bridge subscriber (using @nestjs/microservices with MQTT transport) 
to receive punch events from biometric devices on topic 'biometric/+/punch'.
```

---

**STEP 3.2 — Early Warning Engine**

```
In rv-trust-backend/services/attendance/src/early-warning/:

Build the attendance early warning system.

EarlyWarningRule entity:
  id, institution_id, threshold_type (enum: AT_75 | AT_85 | CONSECUTIVE_ABSENCES | PATTERN),
  threshold_value (decimal), action (enum: NOTIFY_PARENT | FLAG_MENTOR | ESCALATE_HOD),
  is_active, created_at

EarlyWarningEvent entity:
  id, student_id, rule_id, triggered_at, current_percentage (decimal), 
  courses_affected (jsonb), status (enum: OPEN | ACKNOWLEDGED | RESOLVED), 
  acknowledged_by (faculty_id, nullable), resolved_at (nullable)

EarlyWarningService:
  - evaluateStudent(studentId): runs all active rules against student's current summaries.
    If a rule fires and no open EarlyWarningEvent exists for that rule+student, creates one
    and emits AtRiskFlagged Kafka event.
  - acknowledgeWarning(warningId, facultyId): marks as acknowledged
  - resolveWarning(warningId, facultyId): marks as resolved

Schedule a Bull cron job to run evaluateStudent() for all active students 
every day at 10:00 AM (after AbsenteeDetected events are processed).

Kafka event emitted on AtRiskFlagged:
  { eventType: 'AtRiskFlagged', studentId, ruleType, currentPercentage, triggeredAt }

This is consumed by:
  - Mentorship service (creates a mentor alert)
  - Comms service (adds to student timeline)
  - Voice service (if configured, triggers a parent call)
```

---

### Frontend (Web) → `rv-trust-frontend/apps/web/src/features/attendance`

---

**STEP 3.3 — Live Absentee Dashboard (Web)**

```
In rv-trust-frontend/apps/web/src/features/attendance/:

Build the faculty-facing live absentee dashboard for the Next.js web app.

1. src/features/attendance/types/attendance.ts
   Define TypeScript interfaces:
   - AbsenteeRecord: studentId, usn, name, sectionId, courseId, courseName, 
     percentage, parentNotified (boolean), warningLevel ('ok'|'warn'|'danger')
   - AttendanceSummary: courseId, courseName, totalStudents, presentCount, 
     absentCount, percentage, sessions

2. src/features/attendance/api/attendance-api.ts
   API functions using fetch + NextAuth session token:
   - getAbsenteesToday(sectionId): GET /attendance/sections/:id/absentees
   - getSectionSummary(sectionId): GET /attendance/sections/:id/today
   - getAtRiskStudents(institutionId): GET /attendance/at-risk
   - excuseAbsence(recordId, reason): POST /attendance/records/:id/excuse

3. src/features/attendance/hooks/useAttendanceLive.ts
   Custom hook that:
   - Fetches absentee data every 60 seconds using React Query with refetchInterval
   - Returns: absentees (list), isLoading, lastRefreshed, refetch

4. src/app/(dashboard)/attendance/page.tsx
   Full-page attendance dashboard.

   Layout:
   - Top row: 3 stat cards — Total Students Today, Present Count (green), Absent Count (red)
   - Section selector dropdown (faculty sees only their sections; HOD sees all in department)
   - "Last refreshed: X seconds ago" with manual refresh button
   - Main table (AG Grid Community):
       Columns: Photo | USN | Student Name | Courses Absent | Attendance % | 
                Warning Level | Parent Notified | Actions
       - Warning Level: green chip (>85%), yellow chip (75-85%), red chip (<75%)
       - Parent Notified: green tick if AbsenteeDetected event was emitted today
       - Actions: "Excuse" button, "View Timeline" link
   - Row click → opens a side panel with the student's 30-day attendance chart (Recharts AreaChart)
   - "Export CSV" button
   - At-Risk tab: shows all students below 85% across all sections in the department

5. src/features/attendance/components/AttendanceChart.tsx
   Recharts AreaChart showing attendance percentage over the last 30 days.
   X-axis: dates. Y-axis: percentage. 
   Reference lines at 75% (red dashed) and 85% (orange dashed).
   Tooltip shows: date, % present, courses absent.

Use shadcn/ui Table, Badge, Button, Card components.
Use AG Grid for the main data table with client-side sorting and filtering.
```

---

### Frontend (Mobile) → `rv-trust-frontend/apps/mobile/lib/features/attendance`

---

**STEP 3.4 — Attendance View & Leave Request (Mobile)**

```
In rv-trust-frontend/apps/mobile/lib/features/attendance/:

Build the student/parent-facing attendance view.

1. lib/features/attendance/models/attendance_summary.dart
   - AttendanceSummary: courseId, courseName, totalClasses, attended, percentage
   - AttendanceRecord: id, date, period, courseName, status (AttendanceStatus enum), source
   - AttendanceStatus enum: present, absent, late, excused, sanctionedEvent

2. lib/features/attendance/repositories/attendance_repository.dart
   - fetchSummary(studentId) → List<AttendanceSummary> (one per course)
   - fetchRecords(studentId, courseId, from, to) → List<AttendanceRecord>
   - submitLeaveRequest(dto: LeaveRequestDto) → LeaveRequest

3. lib/features/attendance/screens/attendance_screen.dart
   
   Design: shows course-wise attendance summary.
   
   - Overall percentage donut chart at top (shows aggregate across all courses)
   - List of courses below — each course card shows:
       Course name, Faculty name, X/Y classes attended, percentage bar, 
       warning badge if below 85%
   - Tap course → opens AttendanceDetailScreen for that course
   - FAB: "Apply for Leave" → opens leave request bottom sheet
   
4. lib/features/attendance/screens/attendance_detail_screen.dart
   - Calendar view (TableCalendar package) showing month-by-month attendance
   - Green dot = present, Red dot = absent, Orange dot = late, Grey = holiday
   - Below calendar: list of absent dates with reason (if excused)

5. lib/features/attendance/widgets/leave_request_sheet.dart
   Bottom sheet for submitting leave applications:
   - Date range picker
   - Reason text field
   - Document upload (medical certificate, etc.) via file_picker
   - Submit button → POST to attendance service
   - Shows confirmation with leave request ID

All text must be localised using easy_localization .tr() extension.
All percentage values must be formatted as "X/Y (Z%)" where Z is coloured 
red if <75%, orange if 75-85%, green if >=85%.
```

---

## MODULE 4 — AI PARENT VOICE AGENT

### Backend → `rv-trust-backend/services/ai-platform` (Python FastAPI)

---

**STEP 4.1 — AI Platform Service: ASR + TTS + NMT**

```
In rv-trust-backend/services/ai-platform/:

Build a Python 3.12 + FastAPI service that provides the AI primitives 
used by the Voice service and other services.

Directory structure:
  src/
    routers/
      asr.py       — Speech-to-Text endpoints
      tts.py       — Text-to-Speech endpoints  
      nmt.py       — Neural Machine Translation endpoints
      llm.py       — LLM orchestration endpoints
      health.py    — Health check
    services/
      asr_service.py       — Sarvam Saaras + AI4Bharat IndicConformer
      tts_service.py       — Sarvam Bulbul + AI4Bharat Indic-TTS
      nmt_service.py       — AI4Bharat IndicTrans2 + Bhashini pipeline
      llm_service.py       — LiteLLM gateway to Claude Sonnet / Llama 3.1
      pii_scrubber.py      — Strips phone numbers, Aadhaar patterns before LLM calls
    models/
      schemas.py   — Pydantic request/response models
    config.py      — Settings from environment variables

Endpoints:

POST /asr/transcribe
  Body: { audio_base64: str, language: str (kn|hi|en|ta|te|ml), format: str (wav|ogg) }
  Returns: { transcript: str, confidence: float, segments: [{start_ms, end_ms, text, speaker}] }
  Implementation: call Sarvam Saaras API if language is Kannada/Hindi, 
                  AI4Bharat IndicConformer for Tamil/Telugu/Malayalam,
                  Whisper-large as fallback for English or if primary fails.

POST /asr/stream  (WebSocket endpoint for real-time streaming)
  Accepts audio chunks over WebSocket, returns transcript segments in real-time.
  Used by Voice service during live calls.

POST /tts/synthesise
  Body: { text: str, language: str, voice_gender: str (male|female), speed: float }
  Returns: { audio_base64: str, format: 'wav', duration_ms: int }
  Implementation: Sarvam Bulbul for Kannada/Hindi, AI4Bharat Indic-TTS for South Indian languages.

POST /nmt/translate
  Body: { text: str, source_lang: str, target_lang: str, domain: str (education|general) }
  Returns: { translation: str, confidence: float, model_used: str }
  Implementation: AI4Bharat IndicTrans2 as primary. 
                  If confidence < 0.8, call Bhashini as secondary.
                  If both fail, call Claude Sonnet with cultural-context prompt.

POST /llm/summarise
  Body: { transcript_segments: list, language: str, summary_language: str }
  Returns: { summary: str, sentiment: str, escalation_needed: bool, key_points: list }
  Implementation: Claude Sonnet via LiteLLM. 
                  Scrub PII before sending. 
                  System prompt: institution context + dialogue policy.

POST /llm/dialogue-turn
  Body: { conversation_history: list, current_transcript: str, call_type: str, student_context: dict }
  Returns: { next_utterance: str, should_escalate: bool, escalation_reason: str, call_complete: bool }
  Implementation: Claude Sonnet with a scripted dialogue tree loaded from YAML policy files.
                  The LLM can only choose from predefined dialogue nodes — not free-form.

Add Prometheus metrics: request_count, latency_p99, asr_confidence_histogram, 
nmt_confidence_histogram, llm_tokens_used.

Add Redis caching for NMT translations (cache key: hash of source text + lang pair, TTL 24h).

Add .env.example with: SARVAM_API_KEY, AI4BHARAT_API_KEY, BHASHINI_API_KEY, 
LITELLM_API_KEY, ANTHROPIC_API_KEY, REDIS_URL.
```

---

**STEP 4.2 — Voice Service (Go): SIP Bridge & Call Orchestration**

```
In rv-trust-backend/services/voice/:

Build a Go 1.22 service that manages telephony and orchestrates AI calls.

Directory structure:
  cmd/voice/main.go        — entrypoint
  internal/
    sip/                   — SIP client (Exotel/Plivo integration)
      client.go            — places and receives SIP calls
      events.go            — webhook handlers for call state changes
    rtp/
      bridge.go            — bidirectional RTP audio bridge
      chunker.go           — splits audio stream into 100ms chunks for ASR
    orchestrator/
      call_session.go      — manages a single call's state machine
      dialogue_policy.go   — loads YAML dialogue trees
      turn_manager.go      — drives turn-taking: listen → transcribe → decide → speak
    kafka/
      consumer.go          — subscribes to attendance.absentees.daily
      producer.go          — emits voice.CallCompleted events
    api/
      rest.go              — HTTP endpoints for call management
      health.go
    store/
      postgres.go          — writes ConversationLog and TranscriptSegment records
      redis.go             — stores active call sessions

Kafka Consumer (topic: attendance.absentees.daily):
  For each AbsenteeDetected event:
  1. Check parent consent (call Identity service gRPC)
  2. Check quiet hours (no calls before 8am or after 8pm IST)
  3. Check rate limit (max 2 calls per parent per day in Redis)
  4. If all pass: create CallSession in Redis, place SIP call via Exotel API

Call State Machine (per call):
  INITIATED → RINGING → CONNECTED → ACTIVE → COMPLETED | FAILED | NO_ANSWER

During ACTIVE state:
  1. Stream audio from Exotel RTP → RTP Bridge → 100ms chunks
  2. Send chunks to AI Platform /asr/stream WebSocket
  3. When transcript segment arrives, send to AI Platform /llm/dialogue-turn
  4. Get next_utterance from LLM → send to AI Platform /tts/synthesise
  5. Stream synthesised audio back to Exotel RTP
  6. If should_escalate=true: initiate warm transfer to human counsellor
  7. If call_complete=true: end call, emit CallCompleted event

On CallCompleted Kafka event payload:
  { callId, studentId, parentId, duration_seconds, transcript_segments (array),
    summary_en, sentiment, escalated (bool), escalation_reason, audio_s3_url }

REST API:
  POST /calls/outbound       — manually trigger an outbound call (admin use)
  GET  /calls/:id            — get call session status
  GET  /calls/:id/transcript — get transcript (calls AI Platform for stored segments)
  POST /calls/webhook/exotel — Exotel webhook for call state changes

Handle no-answer: retry after 2h, then 4h. If 3rd attempt fails, send WhatsApp voice note.
Store audio recording in S3 under: s3://{bucket}/recordings/{institution_id}/{date}/{call_id}.ogg
Retention: 90 days (S3 lifecycle rule).
```

---

**STEP 4.3 — Call Queue & Transcript Viewer (Web)**

```
In rv-trust-frontend/apps/web/src/features/voice/:

Build the faculty-facing call management interface.

1. src/features/voice/types/voice.ts
   - CallSession: callId, studentId, studentName, parentName, parentLanguage, 
     status (CallStatus enum), startedAt, endedAt, durationSeconds, 
     sentiment ('positive'|'neutral'|'negative'|'escalated'), escalated (boolean)
   - TranscriptSegment: speaker ('AGENT'|'PARENT'), startMs, endMs, text, translationEn
   - CallStatus enum: initiated | ringing | connected | active | completed | failed | noAnswer

2. src/features/voice/api/voice-api.ts
   - getCallQueue(sectionId, date): GET /calls?sectionId=&date=
   - getCallDetails(callId): GET /calls/:id
   - getTranscript(callId): GET /calls/:id/transcript
   - triggerManualCall(studentId, callType): POST /calls/outbound

3. src/app/(dashboard)/voice/page.tsx
   Call queue dashboard — shows today's outbound call status.
   
   Layout:
   - Top stat bar: Total calls today | Completed | Failed | Escalated | No Answer
   - Main table (AG Grid):
       Student Name | USN | Parent Name | Language | Call Time | Duration | 
       Sentiment Badge | Status Badge | Actions
   - Sentiment badges: green (positive), yellow (neutral), orange (negative), red (escalated)
   - Actions: "View Transcript" button, "Retry Call" button (if failed/no-answer)
   - Filter by: status, sentiment, section
   - "Trigger Manual Call" button → dialog to select student + call type

4. src/features/voice/components/TranscriptViewer.tsx
   A slide-over panel (shadcn Sheet component) showing full call transcript.
   
   Layout:
   - Header: student name, parent name, call date/time, duration, sentiment
   - Audio player (HTML5 audio element) with waveform visualisation if recording available
   - Transcript: chat-bubble style — AGENT on left (blue), PARENT on right (grey)
   - Each bubble shows: speaker label, original text, English translation (collapsed by default)
   - Translation toggle: "Show/hide translation" per bubble
   - "Escalated to counsellor" notice if escalation occurred (with timestamp and reason)
   - AI Summary box at bottom: sentiment, key points, action items for teacher

5. src/features/voice/components/SentimentBadge.tsx
   Colour-coded badge component used across the voice feature.

Use real-time polling (React Query refetchInterval: 30000) for the call queue.
```

---

**STEP 4.4 — Call History & Transcripts (Mobile)**

```
In rv-trust-frontend/apps/mobile/lib/features/voice_calls/:

Build the parent-facing call history screen.

1. lib/features/voice_calls/models/call_record.dart
   - CallRecord: callId, date (DateTime), durationSeconds (int), 
     status (CallStatus enum), sentimentLabel (String), summaryText (String),
     hasRecording (bool), hasTranscript (bool)
   - TranscriptSegment: speaker (Speaker enum), startMs, endMs, 
     textOriginal (String), textTranslation (String)

2. lib/features/voice_calls/repositories/voice_repository.dart
   - fetchCallHistory(studentId, page) → PaginatedResult<CallRecord>
   - fetchTranscript(callId) → List<TranscriptSegment>
   - fetchAudioUrl(callId) → String (pre-signed S3 URL, expires in 1h)

3. lib/features/voice_calls/screens/call_history_screen.dart
   List of past calls to this parent about their child.
   
   Each list tile shows:
   - Date + time of call
   - Duration (e.g., "3 min 24 sec")
   - One-line summary in parent's preferred language
   - Sentiment icon (😊 positive, 😐 neutral, 😟 negative)
   - Status chip: Completed / Missed / Escalated
   
   Tap → navigates to CallDetailScreen

4. lib/features/voice_calls/screens/call_detail_screen.dart
   - Audio player widget at top with play/pause, progress slider
   - Summary card: "What was discussed" (in parent's language)
   - Full transcript in chat-bubble style
   - Each bubble has original text + a "Translate" button 
     (shows English translation inline)
   - "Message the teacher" button at bottom — opens a text reply UI
     (reply goes via WhatsApp or in-app, routed to class teacher)

All audio URLs must be fetched fresh (1h expiry). 
Show "Recording expired" placeholder for calls older than 90 days.
Transcript text must be displayed in parent's preferred language (from profile).
```

---

## MODULE 5 — ACADEMIC PERFORMANCE & EARLY WARNING

### Backend → `rv-trust-backend/services/academics`

---

**STEP 5.1 — Academics Service: Marks & Assessments**

```
In rv-trust-backend/services/academics/:

Build the NestJS academics service covering marks, assessments, and early warning.

Entities:

Course:
  id, code (e.g. '21CS51'), name, department_id, credits, 
  assessment_scheme (jsonb: {ia1: 30, ia2: 30, assignment: 10, practical: 30}),
  faculty_ids (array), section_ids (array), institution_id

AssessmentRecord:
  id, student_id, course_id, component (enum: IA1|IA2|IA3|ASSIGNMENT|PRACTICAL|SEMESTER_EXAM|PROJECT),
  score (decimal), max_score (decimal), graded_by (faculty_id), 
  verified_by (second_faculty_id, nullable), 
  sap_sync_status (enum: PENDING|SYNCED|FAILED),
  created_at, updated_at

AcademicAtRiskFlag:
  id, student_id, course_id, flag_type (enum: LOW_MARKS|FAILING_RISK|BACKLOG_RISK),
  triggered_at, threshold_value (decimal), current_value (decimal),
  mentor_notified (bool), status (enum: OPEN|ACKNOWLEDGED|RESOLVED)

Controllers/Endpoints:
  GET  /courses/:id/marks              — all student marks for a course (faculty)
  GET  /students/:id/marks             — all marks for a student (self, parent, mentor)
  POST /courses/:id/marks              — faculty bulk-enter marks (returns submission ID)
  POST /marks/verify/:submissionId     — second faculty verifies marks (dual-verification gate)
  POST /marks/sync-to-sap/:courseId    — pushes verified marks to SAP via BAPI after dual-verify
  GET  /academics/at-risk              — students flagged for academic risk (mentor/HOD view)

Mark entry rules:
  - Faculty enters marks → status = PENDING_VERIFICATION
  - Second faculty (different person) verifies → status = VERIFIED
  - Only VERIFIED marks are pushed to SAP
  - No mark can be changed after SAP sync — corrections are new AssessmentRecord entries

Early warning: after every mark entry, run:
  - If IA average < 40%: emit AcademicsAtRiskFlagged Kafka event
  - If student has 2+ components below pass mark: emit AcademicsAtRiskFlagged
  Kafka topic: 'academics.at-risk.flagged'
  Payload: { studentId, courseId, flagType, currentValue, thresholdValue }

Add Kafka producer for marks.Published events (for timeline service):
  { studentId, courseId, courseName, component, score, max, gradedBy }
```

---

### Frontend (Web) → `rv-trust-frontend/apps/web/src/features/marks`

---

**STEP 5.2 — Marks Entry with Dual Verification (Web)**

```
In rv-trust-frontend/apps/web/src/features/marks/:

Build the faculty marks entry and dual-verification workflow.

1. src/features/marks/types/marks.ts
   AssessmentEntry: studentId, usn, studentName, score (number|null), maxScore, isValid (boolean)
   MarksSubmission: submissionId, courseId, component, entries, submittedBy, status, createdAt
   VerificationStatus: 'draft'|'pending_verification'|'verified'|'synced_to_sap'

2. src/app/(dashboard)/marks/[courseId]/page.tsx
   Marks entry page for a specific course.
   
   Page sections:
   a) Course header: Course name, code, faculty name, current component (tab selector: IA1|IA2|IA3...)
   b) Marks entry table (AG Grid editable):
      Columns: USN | Student Name | Max Score | Score (editable input) | Percentage | Grade
      - Score column: inline editable number input
      - Validation: score must be 0 to max_score, decimals allowed to 2 places
      - Grade auto-computed: O(≥90), A+(≥80), A(≥70), B+(≥60), B(≥55), C(≥50), P(≥45), F(<45)
      - Row turns red if score < pass mark
   c) Bottom action bar: "Save Draft" | "Submit for Verification" button
   
   On "Submit for Verification":
   - Validates all entries (no blanks, all within range)
   - Shows confirmation dialog: "You are submitting IA1 marks for [N] students. 
     A second faculty member will verify these before SAP sync."
   - POST /courses/:id/marks → submissionId

3. src/app/(dashboard)/marks/verify/page.tsx
   Verification queue — for the second verifier faculty.
   
   - Lists all submissions with status PENDING_VERIFICATION in HOD's department
   - Each row: Course | Component | Submitted by | Submitted at | Student count | Action
   - "Verify" button → opens VerificationPanel

4. src/features/marks/components/VerificationPanel.tsx
   Side panel for mark verification.
   - Shows submitted marks in read-only AG Grid (same columns as entry table)
   - "Verify & Approve" button → POST /marks/verify/:submissionId
     Disabled if the verifier is the same person who submitted (enforced UI + API)
   - "Return for Correction" button → opens textarea for reason, PUT /submissions/:id/return
   - On approval → shows "Sync to SAP" button (HOD/admin only)

5. src/features/marks/components/MarksStats.tsx
   Stats card shown above the table:
   - Class average, highest, lowest score
   - Distribution bar chart (Recharts BarChart) showing grade distribution

Show toast notifications for: successful save, verification submitted, SAP sync complete.
```

---

## MODULE 8 — FEES, SCHOLARSHIPS & AID

### Backend → `rv-trust-backend/services/fees`

---

**STEP 8.1 — Fee Service: Payments, EMI, Receipts**

```
In rv-trust-backend/services/fees/:

Build the NestJS fees service.

Entities:

FeeStructure:
  id, institution_id, programme_id, year (1|2|3|4), 
  academic_year (e.g. '2025-26'), components (jsonb array: 
  [{code, name, amount, due_date, late_fee_per_day}])

FeeRecord:
  id, student_id, institution_id, component_code, amount_due, amount_paid,
  due_date, paid_at (nullable), receipt_no (nullable), 
  sap_posting_status (enum: PENDING|POSTED|FAILED), created_at

PaymentTransaction:
  id, student_id, fee_record_ids (array), amount, currency ('INR'),
  gateway (enum: RAZORPAY|PAYU), gateway_order_id, gateway_payment_id,
  status (enum: INITIATED|PENDING|SUCCESS|FAILED|REFUNDED),
  receipt_url (s3 key), gst_amount, created_at

EmiPlan:
  id, student_id, total_amount, instalments (jsonb array: [{seq, amount, due_date}]),
  status (enum: ACTIVE|COMPLETED|DEFAULTED), created_at

Endpoints:
  GET  /fees/students/:id/dues         — all pending fee components for a student
  GET  /fees/students/:id/history      — payment history with receipts
  POST /fees/payment/initiate          — creates Razorpay order, returns order_id + key
  POST /fees/payment/verify            — verifies Razorpay signature, marks paid
  POST /fees/webhook/razorpay          — Razorpay webhook for async status updates
  GET  /fees/receipt/:transactionId    — pre-signed S3 URL for PDF receipt
  POST /fees/emi/create                — creates EMI plan for a student
  GET  /fees/emi/students/:id          — get EMI plan status
  GET  /fees/overdue                   — list of all overdue students (admin/finance)

Payment flow:
  1. POST /fees/payment/initiate: create Razorpay order, store PaymentTransaction(INITIATED)
  2. Frontend renders Razorpay checkout
  3. On success: POST /fees/payment/verify with razorpay_payment_id + signature
  4. Verify HMAC signature. If valid: mark FeeRecord paid, generate PDF receipt, 
     upload to S3, store receipt URL, update SAP via BAPI fee-posting call
  5. Emit PaymentReceived Kafka event → timeline service logs it

Auto-nudge scheduler (Bull cron, daily at 9am):
  - Find all FeeRecords with due_date < today + 7 days and amount_paid = 0
  - Emit FeeReminderRequired Kafka event for each → Comms service sends WhatsApp + push

Generate PDF receipts using pdfkit:
  - GST invoice format with institution letterhead
  - Student name, USN, components paid, amounts, payment date, receipt number
  - Upload to S3 at: receipts/{institution_id}/{academic_year}/{receipt_no}.pdf
```

---

### Frontend (Mobile) → `rv-trust-frontend/apps/mobile/lib/features/fees`

---

**STEP 8.2 — Fee Dues & Payment (Mobile)**

```
In rv-trust-frontend/apps/mobile/lib/features/fees/:

Build the parent-facing fee payment feature.

1. lib/features/fees/models/fee_models.dart
   - FeeComponent: componentCode, name, amountDue, amountPaid, dueDate, isOverdue
   - PaymentTransaction: transactionId, amount, status, receiptUrl, paidAt
   - EmiInstalment: seq, amount, dueDate, isPaid

2. lib/features/fees/repositories/fee_repository.dart
   - fetchDues(studentId) → List<FeeComponent>
   - fetchHistory(studentId) → List<PaymentTransaction>
   - initiatePayment(studentId, componentCodes, amount) → RazorpayOrder
   - verifyPayment(paymentId, orderId, signature, transactionId) → Receipt
   - fetchEmiPlan(studentId) → EmiPlan?

3. lib/features/fees/screens/fees_screen.dart
   Main fees overview screen.
   
   Design:
   - Summary card at top: Total Outstanding (large, red if overdue) | Total Paid
   - "Pay Now" CTA button (disabled if nothing due)
   - List of fee components:
       Each card: Component name | Amount | Due date | Status badge (Paid/Due/Overdue)
       Overdue cards have red border
   - "View Payment History" link at bottom
   - "Apply for EMI" link (if student eligible — show only if total outstanding > ₹10,000)

4. lib/features/fees/screens/payment_screen.dart
   Payment flow screen.
   
   - Checkbox list of due components (pre-selected, parent can deselect)
   - Total amount summary + GST breakdown
   - "Proceed to Pay" button → calls fee_repository.initiatePayment()
   - Opens Razorpay checkout using razorpay_flutter plugin
   - On payment success: calls verifyPayment(), shows success screen with receipt download button
   - On payment failure: shows retry option with error message

5. lib/features/fees/screens/payment_history_screen.dart
   - List of past transactions with date, amount, components, status
   - Each transaction: tap → view/download receipt (opens PDF in-app using flutter_pdfview)
   - Receipt URL fetched fresh (pre-signed S3 link, 1h expiry)

6. lib/features/fees/widgets/emi_plan_sheet.dart
   Bottom sheet showing EMI plan:
   - Timeline of instalments with due dates and amounts
   - Green tick for paid instalments, clock for upcoming, red X for overdue

Add payment result success/failure screens with Lottie animations.
All currency must be formatted as ₹X,XX,XXX (Indian number format).
```

---

## MODULE 11 — MENTORSHIP & COUNSELLING

### Backend → `rv-trust-backend/services/mentorship`

---

**STEP 11.1 — Mentorship Service**

```
In rv-trust-backend/services/mentorship/:

Build the mentorship and counselling NestJS service.

Entities:

MentorMapping:
  id, mentor_id (faculty user_id), student_id, institution_id, 
  valid_from (date), valid_to (date, nullable), is_active,
  assigned_by (admin_id), created_at

MentorSession:
  id, mentor_id, student_id, scheduled_at (timestamptz), 
  duration_minutes, notes_encrypted (text — AES-256 encrypted), 
  session_type (enum: ACADEMIC | PERSONAL | CAREER | MENTAL_HEALTH),
  outcome (enum: RESOLVED | FOLLOW_UP | ESCALATED_COUNSELLOR | ESCALATED_PARENT),
  consent_given (boolean, must be true to save notes), created_at

MentalHealthScreening:
  id, student_id, mentor_id, screening_date, 
  tool_used (enum: GAD7 | PHQ9 | DASS21),
  responses (jsonb: [{question_id, score}]), 
  total_score, severity (enum: MINIMAL|MILD|MODERATE|SEVERE),
  escalation_required (boolean), counsellor_notified_at (nullable), created_at

CounsellingCase:
  id, student_id, referred_by (mentor_id), counsellor_id, 
  referral_reason (text), status (enum: OPEN|IN_PROGRESS|CLOSED),
  privacy_boundary (text: 'counselling notes never shared with academic record'),
  opened_at, closed_at, created_at

Endpoints:
  GET  /mentorship/my-mentees                 — mentor's list of assigned mentees
  GET  /mentorship/students/:id/timeline      — mentoring history for a student (mentor-only)
  POST /mentorship/sessions                   — log a mentoring session
  GET  /mentorship/sessions/:id               — get session (mentor or counsellor only — RBAC)
  POST /mentorship/screening                  — submit a mental health screening
  POST /mentorship/cases                      — open a counselling referral
  GET  /mentorship/cases/mine                 — counsellor's active cases
  PUT  /mentorship/cases/:id/close            — close a case

Privacy rules (enforce at service level):
  - MentorSession.notes_encrypted: only mentor and counsellor can read decrypted notes
  - MentalHealthScreening responses: only counsellor can read, never included in academic audit
  - CounsellingCase: completely separate privacy boundary from AttendanceRecord/AssessmentRecord
  - Escalation to parent: only if student gives explicit consent OR risk-to-life threshold

Kafka consumer: listens to 'attendance.at-risk.flagged' and 'academics.at-risk.flagged'
  → creates a MentorAlert record and pushes notification to the assigned mentor

MentorNotes encryption:
  Use Node.js crypto.createCipheriv('aes-256-gcm', key, iv) where key is per-session 
  random 256-bit key encrypted with AWS KMS CMK.
  Store: iv + kms_encrypted_key + ciphertext + auth_tag in notes_encrypted column.
```

---

## MODULE 12 — GRIEVANCE & FEEDBACK

### Backend → `rv-trust-backend/services/grievance`

---

**STEP 12.1 — Grievance Service**

```
In rv-trust-backend/services/grievance/:

Build the grievance lifecycle NestJS service.

Entities:

Grievance:
  id (uuid), institution_id, student_id (nullable — can be anonymous), 
  submitted_by (user_id, nullable — null if anonymous),
  category (enum: ACADEMIC | FACILITY | FACULTY_CONDUCT | HARASSMENT | ADMINISTRATIVE | OTHER),
  title, description (text), is_anonymous (boolean),
  status (enum: SUBMITTED | ACKNOWLEDGED | INVESTIGATING | RESOLVED | CLOSED | ESCALATED),
  assigned_to (officer_id, nullable), priority (enum: LOW|MEDIUM|HIGH|URGENT),
  sla_hours (int), sla_deadline (timestamptz), sla_breached (boolean),
  resolution_notes (text, nullable), resolved_at (nullable),
  created_at, updated_at

GrievanceUpdate:
  id, grievance_id, updated_by (officer_id), 
  from_status, to_status, note (text), created_at

CourseFeedback:
  id, student_id, course_id, faculty_id, academic_year, semester,
  responses (jsonb: [{question_id, score (1-5), comment}]),
  sentiment_label (enum: POSITIVE|NEUTRAL|NEGATIVE),
  sentiment_score (float, -1 to 1), is_anonymous (boolean), submitted_at

Endpoints:
  POST /grievance                          — submit a grievance (authenticated or anonymous)
  GET  /grievance/:id                      — get grievance (submitter or assigned officer)
  GET  /grievance/:id/status               — public status check by grievance ID (no auth needed)
  GET  /grievance/officer/queue            — grievance officer's queue (filtered by status, priority)
  PUT  /grievance/:id/assign               — assign to an officer (admin/HOD)
  PUT  /grievance/:id/update               — update status + add note (officer)
  POST /grievance/:id/escalate             — escalate to HOD/Principal
  POST /feedback/course                    — submit course feedback (student)
  GET  /feedback/course/:courseId/summary  — aggregated feedback with sentiment (HOD/faculty)

SLA enforcement (Bull cron every 30 min):
  - Find grievances where sla_deadline < now() and status not in RESOLVED/CLOSED
  - Set sla_breached = true
  - Emit GrievanceSlaBreached Kafka event → notification to HOD + Grievance Officer

Sentiment analysis: after each CourseFeedback submission, 
  call AI Platform /llm/summarise with the free-text comments
  to get sentiment_label and sentiment_score.
  Store results on the CourseFeedback record.

Anonymous grievances: student_id and submitted_by remain null.
System assigns a tracking_code (6-char alphanumeric) shown to submitter.
Officer sees only the description, category, date — never the student identity.
```

---

### Frontend (Mobile) → `rv-trust-frontend/apps/mobile/lib/features/grievance`

---

**STEP 12.2 — Grievance Submission (Mobile)**

```
In rv-trust-frontend/apps/mobile/lib/features/grievance/:

Build the student grievance submission and tracking feature.

1. lib/features/grievance/models/grievance.dart
   - Grievance: id, trackingCode, category (GrievanceCategory enum), title, 
     description, status (GrievanceStatus enum), isAnonymous, createdAt, 
     slaDeadline (DateTime), updates (List<GrievanceUpdate>)
   - GrievanceUpdate: updatedAt, fromStatus, toStatus, note
   - GrievanceStatus enum: submitted, acknowledged, investigating, resolved, closed, escalated

2. lib/features/grievance/screens/grievance_screen.dart
   - List of student's own grievances (if not anonymous)
   - Each card: tracking code, category badge, title, status chip, days open
   - "File New Grievance" FAB

3. lib/features/grievance/screens/file_grievance_screen.dart
   Multi-step form:
   
   Step 1: Category selection (large tap targets: Academic / Facility / Faculty Conduct / Other)
   Step 2: Details
     - Title field (max 100 chars)
     - Description field (min 50 chars, max 1000 chars)
     - File attachment (optional — images/PDF)
     - Anonymous toggle switch with explanation: 
       "If anonymous, your name will not be shared with the reviewing officer"
   Step 3: Confirmation
     - Summary of what will be submitted
     - "Submit" button → POST /grievance
     - On success: shows tracking code in large text with "Copy" button
       "Save this code to check your grievance status later"

4. lib/features/grievance/screens/grievance_detail_screen.dart
   - Status timeline (vertical stepper): Submitted → Acknowledged → Investigating → Resolved
   - SLA indicator: "Expected resolution by [date]" (red if breached)
   - Updates log: list of officer notes with timestamps
   - Resolution note (if resolved)
   - "Track by code" button for anonymous grievances (opens a lookup dialog)
```

---

## MODULE 13 — COMPLIANCE & ACCREDITATION

### Backend → `rv-trust-backend/services/compliance`

---

**STEP 13.1 — Compliance Service: NAAC/NBA Auto-Reports**

```
In rv-trust-backend/services/compliance/:

Build the compliance and accreditation NestJS service.

This service aggregates data from all other services to auto-generate 
NAAC, NBA, UGC and AICTE reports.

EvidenceDocument:
  id, institution_id, category (enum: NAAC|NBA|UGC|AICTE|INTERNAL),
  criterion_code (e.g. 'NAAC-C1.1.2'), title, file_s3_key,
  academic_year, uploaded_by, verified_by (nullable), 
  is_locked (boolean — locked once submitted), created_at

ComplianceReport:
  id, institution_id, type (enum: NAAC_SSR|NBA_SAR|UGC_AISHE|AICTE_APPROVAL),
  academic_year, status (enum: DRAFT|IN_REVIEW|SUBMITTED|APPROVED),
  generated_at, submitted_at, data_snapshot (jsonb — full computed data at submission time)

AttainmentRecord:
  id, programme_id, course_id, academic_year, 
  co_attainment (jsonb: {CO1: 75, CO2: 80, ...}),   — Course Outcomes
  po_attainment (jsonb: {PO1: 70, PO2: 65, ...}),   — Programme Outcomes
  pso_attainment (jsonb: {PSO1: 72, ...}),           — Programme Specific Outcomes
  computation_method (enum: DIRECT|INDIRECT|COMBINED), computed_at

Endpoints:
  POST /compliance/reports/generate        — triggers generation of a report for academic year
  GET  /compliance/reports/:id             — get report with full data
  GET  /compliance/reports/:id/export      — export as PDF/Excel
  POST /compliance/evidence                — upload evidence document
  GET  /compliance/evidence/:criterion     — list evidence for a criterion code
  PUT  /compliance/evidence/:id/verify     — HOD/Dean verifies evidence
  GET  /compliance/attainment/:programmeId — CO/PO/PSO attainment for a programme

Report generation logic for NAAC SSR:
  Criterion 1 (Curricular Aspects):
    - Pull all Courses from academics service, count by type, compute credits distribution
  Criterion 2 (Teaching-Learning):
    - Pull AttendanceRecords: student-teacher ratio, attendance % across institution
    - Pull AssessmentRecords: pass rate, average marks, grade distribution
  Criterion 3 (Research):
    - Pull from manual evidence uploads
  Criterion 4 (Infrastructure):
    - Pull from manual evidence uploads
  Criterion 5 (Student Support):
    - Pull FeeRecords: scholarship amounts, EMI usage
    - Pull GrievanceRecords: resolution rate, average resolution time
    - Pull PlacementRecords: placement percentage, salary stats
  Criterion 6 (Governance):
    - Pull AuditLogs for tamper-evidence
    - Pull ConsentRecords for DPDP compliance evidence
  Criterion 7 (Institutional Values):
    - Pull MentorSession counts, mental health screening counts

CO/PO/PSO auto-computation:
  CO Attainment = (students scoring ≥ threshold in CO-mapped questions) / total students × 100
  PO Attainment = weighted average of COs mapped to each PO (mapping matrix from course syllabus)
  PSO Attainment = similarly computed from PO-PSO mapping matrix
```

---

### Frontend (Web) → `rv-trust-frontend/apps/web/src/features/compliance`

---

**STEP 13.2 — NAAC Report Builder (Web)**

```
In rv-trust-frontend/apps/web/src/features/compliance/:

Build the compliance report builder for HODs and Deans.

1. src/app/(dashboard)/compliance/page.tsx
   Compliance overview dashboard.
   
   - Criterion completion tracker: 7 NAAC criteria shown as progress rings
     Each ring shows: % data points filled, # evidence docs uploaded, status
   - Quick stats: Documents uploaded, Verified, Pending verification
   - Active reports table: report type, academic year, status, last updated, actions
   - "Generate New Report" button → opens wizard

2. src/features/compliance/components/ReportWizard.tsx
   Step-by-step report generation wizard:
   
   Step 1: Select report type (NAAC SSR | NBA SAR | UGC AISHE | AICTE)
   Step 2: Select academic year
   Step 3: Data preview — shows what will be auto-computed vs what needs manual input
   Step 4: Confirm & Generate → POST /compliance/reports/generate
   Shows progress spinner while generating (can take 30-60 seconds)
   On completion: navigates to ReportViewer

3. src/features/compliance/components/ReportViewer.tsx
   Full report viewer with criterion-by-criterion breakdown.
   
   Left panel: criterion tree navigator (collapsible)
   Right panel: selected criterion detail
     - Auto-computed metrics (read-only, with source reference)
     - Evidence documents section: list of uploaded docs, upload button for missing ones
     - Narrative text editor (rich text — for qualitative sections)
     - "Mark as Ready" checkbox per sub-criterion
   
   Bottom bar: overall completion % | "Export as PDF" | "Export as Excel"

4. src/features/compliance/components/EvidenceManager.tsx
   Document management panel for uploading NAAC evidence.
   
   - File upload (drag & drop) with criterion code selector
   - Uploaded files list with: name, criterion, uploaded by, verified status
   - "Verify" button (HOD/Dean only) → marks document as verified
   - Once 'locked': cannot be deleted (shown with lock icon)

5. src/features/compliance/components/AttainmentMatrix.tsx
   Interactive CO-PO-PSO attainment matrix table.
   
   - Rows: Course Outcomes (CO1, CO2, ...)
   - Columns: Programme Outcomes (PO1-PO12) + PSOs
   - Cell: mapping weight (dropdown: 1|2|3|0) + computed attainment %
   - Heat map colouring: red (<50%), yellow (50-65%), green (>65%)
   - Export to Excel button

Use AG Grid for all data tables. Use shadcn/ui Tabs for criterion navigation.
Add a Recharts RadarChart showing PO attainment levels visually.
```

---

## MODULE 14 — ADMIN & TRUST DASHBOARD

### Backend → `rv-trust-backend/services/analytics`

---

**STEP 14.1 — Analytics Service: KPI Aggregation**

```
In rv-trust-backend/services/analytics/:

Build the analytics NestJS service that powers the Trust-level KPI dashboard.
This service reads from ClickHouse for aggregated metrics and PostgreSQL for live counts.

Create ClickHouse tables (in scripts/clickhouse-migrations/):
  
  attendance_daily_agg:
    institution_id, section_id, date, total_students, present_count, absent_count, 
    avg_percentage (Float32), at_risk_count (UInt32)
    Engine: ReplacingMergeTree() PARTITION BY toYYYYMM(date) ORDER BY (institution_id, date)

  fee_daily_agg:
    institution_id, date, total_due, total_collected, outstanding, 
    payment_count (UInt32), emi_active_count (UInt32)
    Engine: ReplacingMergeTree() PARTITION BY toYYYYMM(date) ORDER BY (institution_id, date)

  voice_call_agg:
    institution_id, date, total_calls, completed, failed, no_answer, escalated,
    avg_duration_seconds (Float32), sentiment_positive, sentiment_negative
    Engine: ReplacingMergeTree()

  placement_agg:
    institution_id, academic_year, department_id, total_eligible, placed, 
    avg_package_lpa (Float32), highest_package_lpa (Float32)
    Engine: ReplacingMergeTree()

Kafka consumer: subscribes to all domain event topics and writes aggregated 
stats to ClickHouse using clickhouse-js Node client.
Topics consumed: attendance.absentees.daily, fees.payment.received, 
voice.call.completed, placements.offer.received

Analytics REST API:
  GET /analytics/kpi/trust            — Trust-level KPIs across all institutions
  GET /analytics/kpi/institution/:id  — Institution-level KPIs
  GET /analytics/kpi/department/:id   — Department-level KPIs
  GET /analytics/attendance/trend     — Attendance % trend (7d, 30d, semester)
  GET /analytics/fees/collection      — Fee collection trend + outstanding
  GET /analytics/voice/outcomes       — Call outcomes + sentiment trends
  GET /analytics/placements/summary   — Placement stats by dept + year
  GET /analytics/grievance/health     — Grievance SLA compliance + resolution rates

Each endpoint accepts: institutionId, from (date), to (date), granularity ('day'|'week'|'month')
Returns time-series data suitable for Recharts.

Add response caching with Redis (TTL: 5 min for real-time KPIs, 1h for historical).
Add @nestjs/throttler rate limiting: 100 req/min per user on analytics endpoints.
```

---

### Frontend (Web) → `rv-trust-frontend/apps/web/src/features/dashboard`

---

**STEP 14.2 — Trust-Level KPI Dashboard (Web)**

```
In rv-trust-frontend/apps/web/src/features/dashboard/:

Build the executive KPI dashboard for Principal/Trustee/HOD.

1. src/app/(dashboard)/page.tsx  (default dashboard route)
   
   Layout: 3-column grid at top (stat cards), then charts section, then tables.
   
   KPI Cards row (shadcn Card components):
   - Overall Attendance Today: X% (vs yesterday delta with arrow)
   - Fee Collection This Month: ₹X Cr (vs target %)
   - AI Calls Today: X completed | Y escalated
   - At-Risk Students: X (attendance) + Y (academic)
   - Active Grievances: X (Z overdue SLA — shown in red if > 0)
   - Placements YTD: X% placed | Avg ₹Y LPA
   
   Charts row:
   - Attendance Trend (last 30 days): Recharts AreaChart, line per institution
   - Fee Collection Trend: Recharts BarChart (monthly collected vs target)
   - Call Outcomes Donut: completed/failed/escalated/no-answer
   
   Bottom tables:
   - Top 10 at-risk students (attendance + academic combined score)
   - Today's escalated calls (link to voice feature)
   - SLA-breached grievances

2. src/features/dashboard/components/KpiCard.tsx
   Reusable KPI card:
   - Props: title, value, unit, delta, deltaDirection ('up'|'down'), deltaLabel, 
     trendData (array of numbers for sparkline), variant ('default'|'success'|'warning'|'danger')
   - Includes a tiny Recharts Sparkline at bottom
   - Colour-codes based on variant

3. src/features/dashboard/components/AttendanceTrendChart.tsx
   Recharts ComposedChart with:
   - AreaChart for attendance percentage
   - Reference lines at 75% and 85%
   - Tooltip showing: date, %, absent count
   - Institution filter (dropdown for Trustee to compare RVCE vs RVITM)

4. src/features/dashboard/components/RiskMatrix.tsx
   2D scatter plot (Recharts ScatterChart):
   - X axis: Attendance percentage
   - Y axis: Academic score (average marks %)
   - Each dot = one student
   - Quadrants: 
       Top-right (green): good attendance + good marks
       Top-left (orange): low attendance but good marks
       Bottom-right (yellow): good attendance but low marks
       Bottom-left (red): at-risk on both dimensions
   - Hover tooltip: student name, USN, mentor name
   - Click dot → opens student profile in a drawer

5. src/features/dashboard/hooks/useDashboardData.ts
   Custom hook:
   - Uses React Query with 5-minute refetch interval
   - Fetches all KPI data in parallel
   - Returns: kpis, attendanceTrend, feeCollection, callOutcomes, atRiskStudents, 
     isLoading, lastUpdated

Role-based display:
  PRINCIPAL: sees full dashboard with all KPIs for their institution
  TRUSTEE: sees aggregated view across all institutions (no individual student data)
  HOD: sees only department-level data
  DEAN: sees faculty + department view
```

---

## MODULE 15 — SAP BRIDGE & INTEGRATIONS HUB

### Backend → `rv-trust-backend/services/sap-bridge`

---

**STEP 15.1 — SAP SLCM Integration Service**

```
In rv-trust-backend/services/sap-bridge/:

Build the SAP SLCM integration NestJS service.
This service is the only authorized gateway for SAP reads and writes.
No other service talks to SAP directly — they call this service.

SAP integration methods to implement:

1. OData Read (using @sap-cloud-sdk/odata-v2-adapter or raw HTTP):
   - GET /sap/students           — pulls student roster from SAP SLCM OData endpoint
   - GET /sap/programmes         — pulls programme structure
   - GET /sap/sections           — pulls section/batch list
   - GET /sap/faculty            — pulls faculty from SAP HR OData
   - GET /sap/fee-structure      — pulls fee master for a programme + year
   Cache all OData reads in Redis (TTL: 2h for master data, 15min for transactional)

2. BAPI/RFC calls (using pyrfc via Python sidecar or node-rfc):
   - postAttendanceRollup(studentId, courseId, month, percentage) — IDoc ALE attendance
   - postMarkEntry(studentId, courseId, component, score, verifiedBy) — BAPI_STUDENTASSMT_SAVE
   - postFeePayment(studentId, amount, receiptNo, componentCode) — FI posting BAPI

3. Nightly ETL fallback (Bull cron at 2am):
   - Downloads full CSV/Parquet dumps from SAP for: students, attendance, assessments, fees
   - Uploads to S3 at: s3://{bucket}/sap-etl/{date}/
   - Reconciles with live data — flags discrepancies in a ReconciliationReport table

SapSyncLog entity:
  id, entity_type (enum: STUDENT|ATTENDANCE|MARKS|FEE), operation (enum: READ|WRITE),
  sap_bapi_name, request_payload (jsonb), response_payload (jsonb),
  status (enum: SUCCESS|FAILED|PARTIAL), error_message (nullable),
  duration_ms, created_at

API endpoints (internal — only callable from other services, not public):
  POST /sap/sync/students            — trigger student sync from SAP
  POST /sap/write/attendance-rollup  — write attendance rollup to SAP
  POST /sap/write/marks              — write verified marks to SAP
  POST /sap/write/fee-posting        — write fee payment to SAP
  GET  /sap/reconciliation/latest    — get latest reconciliation report

Add circuit breaker (using @nestjs/circuit-breaker or opossum):
  If SAP OData returns 503 three times in 60 seconds, open circuit for 10 minutes.
  Fall back to last successful S3 ETL dump during outage.
  Alert via Kafka event: 'sap.circuit.open' → Comms service → email to SAP BASIS team.

Add detailed SapSyncLog for every SAP interaction for audit purposes.
```

---

## PART 5 — INFRASTRUCTURE & SHARED SETUP

---

**STEP INF-1 — Docker Compose Local Dev Environment**

```
The docker-compose.yml in rv-trust-backend/ already defines the infrastructure.
Now add the missing services and complete the setup:

1. Add to docker-compose.yml:
   
   keycloak:
     image: quay.io/keycloak/keycloak:24.0
     command: start-dev
     environment:
       KEYCLOAK_ADMIN: admin
       KEYCLOAK_ADMIN_PASSWORD: admin_dev
       KC_DB: postgres
       KC_DB_URL: jdbc:postgresql://postgres:5432/keycloak
       KC_DB_USERNAME: rvtrust
       KC_DB_PASSWORD: rvtrust_dev
     ports:
       - "8080:8080"
     depends_on: [postgres]
   
   redpanda:  (lighter Kafka alternative for local dev)
     image: redpandadata/redpanda:v23.3.1
     command: redpanda start --overprovisioned --smp 1 --memory 1G
     ports:
       - "9092:9092"    (Kafka-compatible)
       - "8082:8082"    (Pandaproxy REST)
       - "9644:9644"    (Admin API)
   
   (Remove zookeeper, kafka, schema-registry — replace with redpanda)
   
   prometheus:
     image: prom/prometheus:v2.48.0
     ports:
       - "9090:9090"
     volumes:
       - ./infra/prometheus.yml:/etc/prometheus/prometheus.yml
   
   loki:
     image: grafana/loki:2.9.0
     ports:
       - "3100:3100"

2. Create scripts/init-databases.sql:
   CREATE DATABASE identity_db;
   CREATE DATABASE attendance_db;
   CREATE DATABASE academics_db;
   CREATE DATABASE fees_db;
   CREATE DATABASE comms_db;
   CREATE DATABASE mentorship_db;
   CREATE DATABASE placements_db;
   CREATE DATABASE grievance_db;
   CREATE DATABASE compliance_db;
   CREATE DATABASE analytics_db;
   CREATE DATABASE sap_bridge_db;
   CREATE DATABASE keycloak;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS vector;

3. Create a root package.json with workspaces:
   {
     "workspaces": ["services/*"],
     "scripts": {
       "dev:all": "concurrently \"npm run start:dev --workspace=services/identity\" 
                   \"npm run start:dev --workspace=services/attendance\" ...",
       "migrate:all": "for each service, run TypeORM migrations",
       "build:all": "turbo run build"
     }
   }

4. Create infra/prometheus.yml:
   Scrape configs for all NestJS services on their /metrics endpoints.
   Each service exposes Prometheus metrics via @willsoto/nestjs-prometheus.
```

---

**STEP INF-2 — Kafka Event Schema Registry (Avro Schemas)**

```
In rv-trust-backend/shared/kafka/schemas/:

Define Avro schemas for all inter-service events.
These are the canonical event contracts — any service that publishes or 
consumes must conform to these schemas.

Create the following .avsc files:

1. AbsenteeDetected.avsc
{
  "type": "record",
  "name": "AbsenteeDetected",
  "namespace": "ai.rvtrust.attendance",
  "fields": [
    {"name": "eventId", "type": "string"},
    {"name": "eventVersion", "type": "string", "default": "1.0"},
    {"name": "studentId", "type": "string"},
    {"name": "studentName", "type": "string"},
    {"name": "sectionId", "type": "string"},
    {"name": "institutionId", "type": "string"},
    {"name": "date", "type": "string"},
    {"name": "parentId", "type": "string"},
    {"name": "parentPhoneToken", "type": "string"},
    {"name": "parentLanguage", "type": "string"},
    {"name": "consecutiveAbsentDays", "type": "int"},
    {"name": "semesterPercentage", "type": "float"},
    {"name": "consentVoice", "type": "boolean"},
    {"name": "consentWhatsapp", "type": "boolean"},
    {"name": "occurredAt", "type": "long", "logicalType": "timestamp-millis"}
  ]
}

2. CallCompleted.avsc — voice.CallCompleted topic
3. AtRiskFlagged.avsc — academics/attendance at-risk events
4. PaymentReceived.avsc — fees.PaymentReceived topic
5. TimelineEventCreated.avsc — comms.timeline.inbound topic
6. GrievanceFiled.avsc — grievance.filed topic
7. MarksPublished.avsc — academics.marks.published topic

Create shared/kafka/registry.ts:
  TypeScript helper that validates event objects against their Avro schema before publish.
  Uses avsc npm package.
  Every Kafka producer in every service must import this and call validate() before publish.
```

---

**STEP INF-3 — CI/CD Pipeline (GitHub Actions)**

```
In rv-trust-backend/.github/workflows/:

Create the following GitHub Actions workflows:

1. ci.yml — runs on every PR to main:
   jobs:
     lint:      runs eslint + prettier check for all NestJS services
     typecheck: runs tsc --noEmit for all TypeScript services
     test:      runs unit tests for each service in parallel matrix
     build:     Docker build for each service (no push on PR)
     security:  runs npm audit + Snyk scan
   
   Python service jobs:
     lint:  ruff check services/ai-platform/
     test:  pytest services/ai-platform/tests/ with coverage
   
   Go service jobs:
     lint:  golangci-lint run ./services/voice/...
     test:  go test ./services/voice/... -race -coverprofile=coverage.out

2. deploy-staging.yml — runs on merge to main:
   - Docker build + push to AWS ECR for each changed service
   - kubectl apply -f infra/k8s/overlays/staging/ via ArgoCD sync
   - Run DB migrations: kubectl exec migration pod

3. deploy-prod.yml — manual trigger only (workflow_dispatch):
   - Requires approval from 2 team members
   - Blue-green deployment via ArgoCD
   - Automatic rollback if health check fails after 5 minutes

Create infra/k8s/base/ with:
- One Deployment + Service + ConfigMap + HorizontalPodAutoscaler per service
- Shared Ingress (Nginx) with path routing: /api/identity/* → identity service, etc.
- PodDisruptionBudget for each service (minAvailable: 1)

Create infra/terraform/ with:
- main.tf: AWS EKS cluster (3 nodes t3.xlarge), RDS PostgreSQL 16, ElastiCache Redis
- variables.tf: environment (staging|prod), region, cluster name
- outputs.tf: EKS endpoint, RDS endpoint, Redis endpoint
```

---

## PART 6 — QUICK REFERENCE: WHICH FILE TO OPEN IN CURSOR

| Feature | Backend File | Frontend File |
|---------|-------------|---------------|
| Add a new user role | `services/identity/src/roles/roles.service.ts` | `apps/web/src/middleware.ts` |
| Add a new Kafka event | `shared/kafka/schemas/{EventName}.avsc` then the publishing service | Consumer in target service |
| Add a new notification template | `services/comms/src/seeds/notification-templates.ts` | — |
| Add a new timeline event kind | `services/comms/src/entities/timeline-event.entity.ts` | `apps/mobile/lib/features/timeline/models/timeline_event.dart` |
| Add a new compliance criterion | `services/compliance/src/report-generation/naac.service.ts` | `apps/web/src/features/compliance/components/ReportViewer.tsx` |
| Change fee structure | `services/fees/src/entities/fee-structure.entity.ts` | `apps/mobile/lib/features/fees/screens/fees_screen.dart` |
| Add a new language for TTS | `services/ai-platform/src/services/tts_service.py` | `apps/mobile/assets/translations/app_{lang}.arb` |
| Modify RBAC permissions | `services/identity/src/roles/roles.service.ts` | `apps/web/src/middleware.ts` + `apps/mobile/lib/core/router/app_router.dart` |
| Add a new dashboard KPI | `services/analytics/src/analytics.service.ts` | `apps/web/src/features/dashboard/components/KpiCard.tsx` |
| Add a new grievance category | `services/grievance/src/entities/grievance.entity.ts` | `apps/mobile/lib/features/grievance/screens/file_grievance_screen.dart` |

---

## PART 7 — ENVIRONMENT VARIABLES MASTER LIST

### Backend `.env` (per service)

```bash
# Common to all NestJS services
NODE_ENV=development
PORT=3001                          # increment per service: 3001, 3002, ...
DATABASE_URL=postgresql://rvtrust:rvtrust_dev@localhost:5432/{service}_db
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
INSTITUTION_ID=rvce               # override per deployment

# Identity service specific
KEYCLOAK_BASE_URL=http://localhost:8080
KEYCLOAK_REALM=rvtrust
KEYCLOAK_CLIENT_ID=rvtrust-backend
KEYCLOAK_CLIENT_SECRET=your-secret
AWS_KMS_KEY_ARN=arn:aws:kms:ap-south-1:...  # for PII vault

# AI Platform (Python)
SARVAM_API_KEY=your-sarvam-key
AI4BHARAT_API_KEY=your-key
BHASHINI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
LITELLM_BASE_URL=http://litellm:4000

# Voice service (Go)
EXOTEL_API_KEY=your-key
EXOTEL_API_TOKEN=your-token
EXOTEL_SID=your-sid
AWS_S3_BUCKET=rvtrust-recordings
AWS_REGION=ap-south-1

# Fees service
RAZORPAY_KEY_ID=your-key
RAZORPAY_KEY_SECRET=your-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret

# Comms service
META_WHATSAPP_ACCESS_TOKEN=your-token
META_WHATSAPP_PHONE_NUMBER_ID=your-id
FIREBASE_SERVICE_ACCOUNT_JSON=path-to-json
SENDGRID_API_KEY=your-key
KARIX_API_KEY=your-key
```

### Frontend Mobile `.env`
```bash
API_BASE_URL=http://10.0.2.2:3001  # Android emulator localhost
KEYCLOAK_BASE_URL=http://10.0.2.2:8080
KEYCLOAK_REALM=rvtrust
KEYCLOAK_CLIENT_ID=rvtrust-mobile
RAZORPAY_KEY_ID=your-key
```

### Frontend Web `.env.local`
```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret
KEYCLOAK_BASE_URL=http://localhost:8080
KEYCLOAK_REALM=rvtrust
KEYCLOAK_CLIENT_ID=rvtrust-web
KEYCLOAK_CLIENT_SECRET=your-secret
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

---

*End of RV Trust AI ERP Build Guide — v0.1 · 18 April 2026*
*Confidential — prepared for Abhijat, RV Trust engineering team*
