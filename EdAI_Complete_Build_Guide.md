# EdAI — Complete Build Guide
## Two Repositories · 8 Features · Step-by-Step Cursor Prompts
### AI-Powered Platform for Educational Institutions · by Raycraft Technologies

> Version 1.0 · 18 April 2026 · Prepared for Abhijat Dakshesh

---

## WHO THIS IS FOR

EdAI (formerly EduStack / Phali Tantramsha) is an AI-native engagement platform
for any educational institution — college, school, university group.
It automates every manual administrative task and uses regional-language AI voice
calls to communicate with parents and students in Kannada, Hindi, English, Tamil,
Telugu, and Malayalam.

Endorsed by RVITM Principal (LOR, 01-Sep-2025). Deployed at RV Educational Institutions.

---

## THE 8 FEATURES

| # | Feature | Core Automation |
|---|---------|----------------|
| 1 | Smart Attendance System | AI voice call within 2 min of absence mark |
| 2 | Assignment Intelligence | Deadline tracking, miss escalation, performance drop detection |
| 3 | Teacher Productivity Suite | Auto reports, AI marks validation, daily/weekly digests |
| 4 | Proactive Parent Engagement | Weekly update calls, PTM auto-scheduling |
| 5 | Intelligent AI Chatbot | Student doubt resolution, parent query answering |
| 6 | Financial Intelligence | Fee collection workflow, scholarship auto-discovery |
| 7 | Administrative Command Center | Real-time dashboard, risk scoring, audit intelligence |
| 8 | Behavioral Intelligence | Incident classification, pattern recognition, escalation |

---

## PART 1 — TWO REPOSITORIES

---

### REPOSITORY 1: `edai-backend`

Everything server-side. Three languages, one purpose.

```
edai-backend/
├── services/
│   ├── identity/        NestJS   — Auth, SSO, RBAC, multi-tenant, consent
│   ├── attendance/      NestJS   — Attendance marking, escalation engine [Feature 1]
│   ├── voice/           Go       — SIP bridge, AI call orchestration [Features 1,2,4]
│   ├── ai-engine/       Python   — ASR, TTS, NMT, LLM, dialogue policy [All AI features]
│   ├── assignments/     NestJS   — Assignment tracking, deadline mgmt [Feature 2]
│   ├── academics/       NestJS   — Marks, performance, early warning [Features 2,3]
│   ├── communications/  NestJS   — WhatsApp, SMS, push, email, timeline [Features 1-8]
│   ├── finance/         NestJS   — Fee collection, EMI, scholarship [Feature 6]
│   ├── behavior/        NestJS   — Incident logging, pattern analysis [Feature 8]
│   ├── analytics/       NestJS   — Admin command center, KPI aggregation [Feature 7]
│   └── chatbot/         NestJS   — AI chatbot proxy for students/parents [Feature 5]
├── shared/
│   ├── kafka/schemas/   — Avro event schemas (all inter-service events)
│   ├── types/           — Shared TypeScript interfaces
│   └── dto/             — Shared request/response DTOs
├── infra/
│   ├── terraform/       — AWS EKS, RDS, Redis, S3, KMS
│   ├── k8s/             — Kubernetes manifests
│   └── helm/            — Helm charts per service
├── scripts/
│   ├── migrations/      — TypeORM migration files
│   └── seeds/           — Seed data (institutions, roles, templates)
└── docker-compose.yml   — Local dev: Postgres, Redis, Kafka, Keycloak, Grafana
```

**Tech Stack:**

| Layer | Technology |
|-------|-----------|
| Core ERP services | TypeScript + NestJS 10 + Node 20 |
| AI/ML service | Python 3.12 + FastAPI |
| Voice/Telephony | Go 1.22 |
| Database | PostgreSQL 16 + pgvector |
| Cache & Queues | Redis 7 (Bull queues) |
| Message Bus | Apache Kafka / Redpanda |
| Telephony | Exotel (primary) / Plivo / Twilio |
| WhatsApp | Meta WhatsApp Business Cloud API |
| SMS | Karix / Gupshup (DLT registered) |
| ASR | Sarvam Saaras (Kannada/Hindi) + AI4Bharat |
| TTS | Sarvam Bulbul + AI4Bharat Indic-TTS |
| NMT | AI4Bharat IndicTrans2 + Bhashini |
| LLM | Claude Sonnet via LiteLLM |
| Storage | Amazon S3 (ap-south-1) |
| Auth | Keycloak OIDC |
| Container | Docker + AWS EKS |

---

### REPOSITORY 2: `edai-frontend`

All user interfaces. Two apps, one design system.

```
edai-frontend/
├── apps/
│   ├── mobile/                      Flutter 3.x (Parent + Student)
│   │   └── lib/
│   │       ├── features/
│   │       │   ├── auth/            Login, SSO, biometric unlock
│   │       │   ├── attendance/      View attendance, apply leave [Feature 1]
│   │       │   ├── assignments/     Submit work, view deadlines [Feature 2]
│   │       │   ├── academics/       Marks, performance charts [Features 2,3]
│   │       │   ├── fees/            Dues, pay online, EMI [Feature 6]
│   │       │   ├── timeline/        Unified event feed (all features)
│   │       │   ├── notifications/   Push, in-app alerts
│   │       │   ├── voice_calls/     Call history, transcripts [Features 1,4]
│   │       │   ├── chatbot/         AI chat interface [Feature 5]
│   │       │   └── profile/         Language picker, consent centre
│   │       ├── core/
│   │       │   ├── api/             Dio HTTP client + interceptors
│   │       │   ├── models/          Data models + Isar offline schemas
│   │       │   ├── providers/       Riverpod state
│   │       │   ├── router/          Go Router navigation
│   │       │   └── theme/           Raycraft design system
│   │       └── shared/widgets/      Reusable Raycraft UI components
│   │
│   └── web/                         Next.js 14 + TypeScript (Teacher + Admin)
│       └── src/
│           ├── app/
│           │   ├── (auth)/          Login page
│           │   └── (dashboard)/
│           │       ├── page.tsx     Admin command center [Feature 7]
│           │       ├── attendance/  Live absentee dashboard [Feature 1]
│           │       ├── assignments/ Assignment tracking [Feature 2]
│           │       ├── marks/       Marks entry + validation [Feature 3]
│           │       ├── voice/       Call queue + transcripts [Features 1,4]
│           │       ├── finance/     Fee collection dashboard [Feature 6]
│           │       ├── behavior/    Incident management [Feature 8]
│           │       ├── chatbot/     AI chatbot management [Feature 5]
│           │       └── students/    Student profiles + risk scores
│           ├── components/
│           │   ├── ui/              shadcn/ui (Raycraft themed)
│           │   ├── tables/          AG Grid (Raycraft themed)
│           │   ├── charts/          Recharts (Raycraft themed)
│           │   └── layout/          Shell, Sidebar, TopBar
│           └── lib/
│               ├── api/             REST client + React Query
│               ├── hooks/           Custom hooks
│               └── stores/          Zustand global state
│
└── packages/
    ├── shared-types/                TypeScript types shared with backend
    └── api-client/                  Generated OpenAPI client
```

**Tech Stack:**

| Layer | Technology |
|-------|-----------|
| Mobile | Flutter 3.x + Riverpod + Isar + Go Router |
| Web | Next.js 14 + TypeScript + Tailwind CSS |
| UI Components | shadcn/ui (Raycraft themed) |
| Data Tables | AG Grid Community |
| Charts | Recharts |
| Auth (Web) | NextAuth.js v5 + Keycloak |
| Auth (Mobile) | Keycloak OIDC + flutter_keycloak |
| State (Web) | Zustand + React Query |
| Design | Raycraft design system (cream/espresso/Cormorant Garamond) |

---

## PART 2 — BUILD ORDER

Build in this sequence. Each phase unlocks the next.

```
PHASE 0 — Foundation (Week 1-2)
  Backend:  docker-compose, shared types, Kafka schemas, DB migrations, Keycloak setup
  Frontend: repo init, Raycraft theme, auth shell, shared widgets

PHASE 1 — Identity & Auth (Week 2-3)
  Backend:  services/identity (SSO, RBAC, multi-tenant, parent-student link)
  Frontend: Login screens (mobile + web), role-based routing

PHASE 2 — Smart Attendance + AI Voice (Week 3-7) ← THE CORE FEATURE
  Backend:  services/attendance, services/voice (Go), services/ai-engine (Python)
  Frontend: Attendance dashboard (web), attendance view + call history (mobile)

PHASE 3 — Communications Engine (Week 5-7) [parallel to Phase 2]
  Backend:  services/communications (WhatsApp, SMS, push, email, timeline)
  Frontend: Notifications, timeline feed (mobile)

PHASE 4 — Assignments + Academics (Week 7-10)
  Backend:  services/assignments, services/academics
  Frontend: Assignment tracking (web+mobile), marks entry (web), performance (mobile)

PHASE 5 — AI Chatbot + Parent Engagement (Week 9-12)
  Backend:  services/chatbot (proxies ai-engine), weekly call scheduler
  Frontend: Chat UI (mobile), chatbot management (web)

PHASE 6 — Financial Intelligence (Week 11-14)
  Backend:  services/finance
  Frontend: Fee dashboard (web), payment flow (mobile)

PHASE 7 — Behavioral Intelligence (Week 13-16)
  Backend:  services/behavior
  Frontend: Incident management (web)

PHASE 8 — Admin Command Center (Week 15-18)
  Backend:  services/analytics (ClickHouse aggregation)
  Frontend: Executive dashboard (web)
```

---

## PART 3 — FEATURE-BY-FEATURE CURSOR PROMPTS

> **How to use:** Open the exact folder in Cursor. Open a new chat (Cmd+L or Ctrl+L).
> Paste the prompt. Run steps in order. Each step builds on the previous one.

---

# FEATURE 1 — SMART ATTENDANCE SYSTEM
## AI voice call to parent within 2 minutes of absence mark, in their regional language

---

### BACKEND STEP 1.1 — Scaffold Attendance Service
**Folder: `edai-backend/services/attendance`**

```
You are building the Smart Attendance Service for EdAI — an AI platform for
educational institutions. This is the most critical feature: when a teacher
marks a student absent, the system must trigger an AI voice call to the parent
within 2 minutes, in the parent's preferred language (Kannada/Hindi/English/Tamil/Telugu/Malayalam).

Scaffold a new NestJS 10 TypeScript service in services/attendance/ with:

ENTITIES:

Student:
  id (uuid), institution_id, name, roll_number, class_id (e.g. "10-A"),
  section, admission_year, photo_url, is_active, created_at

Parent:
  id, student_id (FK), name, relation (FATHER|MOTHER|GUARDIAN),
  phone_token (KMS encrypted), whatsapp, email,
  preferred_language (enum: kn|en|hi|ta|te|ml),
  call_preference_time (jsonb: {from: "08:00", to: "20:00"}),
  consent_voice (boolean), consent_whatsapp (boolean),
  created_at

AttendanceRecord:
  id (uuid), student_id (FK), institution_id, class_id, subject_id (nullable),
  date (date), period (int, nullable), marked_at (timestamptz),
  status (enum: PRESENT|ABSENT|LATE|EXCUSED|HOLIDAY),
  marked_by (teacher_id), source (enum: MANUAL|BIOMETRIC|GEOFENCE|IMPORTED),
  absence_reason (nullable — filled after parent call),
  call_triggered (boolean, default false), created_at

AbsenceEscalation:
  id, student_id, institution_id, window_start (date), window_end (date),
  absence_count (int), escalation_level (enum: DAY3|DAY5|DAY7|DAY10),
  action_taken (enum: CALL|WHATSAPP_EMAIL|TEACHER_ALERT|PTM_SCHEDULED),
  triggered_at, completed_at, created_at

ENDPOINTS:

POST /attendance/mark
  Body: { studentId, classId, subjectId?, date, period?, status, markedBy }
  On ABSENT status:
    1. Creates AttendanceRecord with status=ABSENT, call_triggered=false
    2. Immediately emits 'attendance.absent.marked' Kafka event
    3. Returns { recordId, callScheduled: true }

POST /attendance/mark/bulk
  Body: { classId, date, period, records: [{studentId, status}], markedBy }
  Same logic — one Kafka event per absent student

GET  /attendance/students/:id/summary
  Returns: monthly summary per subject — total, present, absent, percentage

GET  /attendance/classes/:id/today
  Returns: today's attendance for a whole class — each student's status

GET  /attendance/classes/:id/absentees
  Returns: today's absentees with parent contact info (for teacher view)

GET  /attendance/at-risk
  Returns: students with >3 absences in 7 days, ranked by severity

PUT  /attendance/records/:id/excuse
  Marks an absence as EXCUSED with reason (faculty/admin only)

KAFKA CONSUMER:
  Topic: 'voice.call.completed'
  On CallCompleted event: update AttendanceRecord.absence_reason with call outcome

ESCALATION ENGINE (Bull cron — runs daily at 09:45 AM):
  For each student, check rolling 7-day window:
  - 3 absences → emit 'escalation.day3' → AI call to parent
  - 5 absences → emit 'escalation.day5' → WhatsApp + Email
  - 7 absences → emit 'escalation.day7' → Teacher alert + admin dashboard flag
  - 10 absences → emit 'escalation.day10' → Auto-schedule PTM

KAFKA EVENTS EMITTED:
  Topic: 'attendance.absent.marked'
  Payload: {
    eventId, studentId, studentName, classId, institutionId, date, period,
    parentId, parentPhoneToken, parentLanguage, consentVoice, consentWhatsapp,
    markedAt, teacherId
  }

Add .env.example. Add Dockerfile. Add health check endpoint GET /health.
```

---

### BACKEND STEP 1.2 — AI Voice Engine (Python FastAPI)
**Folder: `edai-backend/services/ai-engine`**

```
You are building the AI Engine service for EdAI — a Python 3.12 + FastAPI service
that provides speech, translation, and LLM capabilities for AI voice calls to parents
in Indian regional languages (Kannada, Hindi, English, Tamil, Telugu, Malayalam).

Create the following structure:
  src/
    routers/
      asr.py        Speech-to-Text (streaming + batch)
      tts.py        Text-to-Speech
      nmt.py        Neural Machine Translation
      llm.py        LLM dialogue orchestration
      health.py
    services/
      asr_service.py
      tts_service.py
      nmt_service.py
      llm_service.py
      pii_scrubber.py
      dialogue_loader.py   Loads YAML call scripts
    dialogue/
      absent_call.yaml     Script for absence calls
      fee_reminder.yaml    Script for fee reminder calls
      weekly_update.yaml   Script for weekly parent updates
      assignment_miss.yaml Script for missed assignment calls
    models/
      schemas.py
    config.py

ENDPOINTS:

POST /asr/transcribe
  Input: { audio_base64: str, language: str, format: str (wav|ogg|mp3) }
  Output: { transcript: str, confidence: float, segments: [{start_ms, end_ms, text, speaker}] }
  Logic:
    - If language in ['kn', 'hi']: use Sarvam Saaras API
    - If language in ['ta', 'te', 'ml']: use AI4Bharat IndicConformer API
    - If language == 'en' OR fallback: use OpenAI Whisper-large
    - Return structured transcript with speaker diarization

WS /asr/stream
  WebSocket endpoint for real-time streaming ASR during live calls.
  Accepts binary audio frames (100ms chunks, 16kHz, 16-bit mono PCM).
  Emits JSON: { type: "segment", text, confidence, is_final, speaker }
  Used by the Go voice service during live calls.

POST /tts/synthesise
  Input: { text: str, language: str, gender: str (male|female), speed: float (0.8-1.2) }
  Output: { audio_base64: str, format: "wav", duration_ms: int, sample_rate: 16000 }
  Logic:
    - Kannada/Hindi: Sarvam Bulbul API (most natural Indic voices)
    - Tamil/Telugu/Malayalam: AI4Bharat Indic-TTS API
    - English fallback: ElevenLabs or OpenAI TTS
    Cache synthesised audio (Redis, key=hash(text+lang+gender), TTL=24h)

POST /nmt/translate
  Input: { text: str, source_lang: str, target_lang: str }
  Output: { translation: str, confidence: float, model: str }
  Logic:
    - Primary: AI4Bharat IndicTrans2 (best for Indian language pairs)
    - Fallback: Bhashini pipeline API
    - For nuanced/cultural rewrites: Claude Sonnet with cultural context prompt
    Cache translations (Redis, TTL=1h)

POST /llm/dialogue-turn
  Input: {
    call_type: str (ABSENT_CALL|FEE_REMINDER|WEEKLY_UPDATE|ASSIGNMENT_MISS),
    conversation_history: list[{speaker, text, timestamp}],
    student_context: { name, class, subject?, absence_count?, fee_amount?, assignment? },
    institution_name: str,
    current_transcript: str,
    language: str
  }
  Output: {
    next_utterance: str,          (in the parent's language)
    next_utterance_en: str,       (English version for teacher log)
    should_escalate: bool,
    escalation_reason: str?,
    call_complete: bool,
    collected_reason: str?,       (what parent said — e.g. "child is sick")
    dtmf_expected: bool,          (if waiting for keypress 1/2/3)
    dtmf_options: dict?           ({1: "Sick", 2: "Running late", 3: "Unknown"})
  }
  Logic:
    1. Load dialogue YAML for call_type
    2. Scrub PII from all text before sending to LLM (pii_scrubber.py)
    3. Call Claude Sonnet via LiteLLM with:
       - System prompt: institution context + dialogue policy + language instructions
       - Dialogue tree: agent can only choose from predefined nodes
       - Escalation triggers: "sick", "hospital", "accident", "upset", "crying", "abuse"
    4. Never allow agent to promise fee waivers, mark corrections, or policy decisions

POST /llm/summarise-call
  Input: { segments: list, language: str, call_type: str }
  Output: {
    summary_en: str,
    summary_original_lang: str,
    sentiment: str (positive|neutral|concerned|escalated),
    sentiment_score: float,
    key_points: list[str],
    action_required: bool,
    action_description: str?,
    collected_reason: str?
  }

DIALOGUE YAML FORMAT (create absent_call.yaml):
  call_type: ABSENT_CALL
  greeting:
    kn: "ನಮಸ್ಕಾರ, ನಾನು {institution_name} ನಿಂದ {student_name} ಅವರ ಸಹಾಯಕಿ ಮಾತನಾಡುತ್ಿದ್ದೇನೆ."
    en: "Good morning, this is the automated assistant from {institution_name} calling about {student_name}."
    hi: "नमस्ते, मैं {institution_name} से {student_name} के बारे में बात कर रही हूँ।"
    ta: "வணக்கம், நான் {institution_name} சார்பாக {student_name} பற்றி பேசுகிறேன்."
    te: "నమస్కారం, నేను {institution_name} నుండి {student_name} గురించి మాట్లాడుతున్నాను."
    ml: "നമസ്കാരം, ഞാൻ {institution_name} ൽ നിന്ന് {student_name} നെ കുറിച്ച് വിളിക്കുന്നു."
  absence_reason_ask:
    kn: "{student_name} ಇಂದು ತರಗತಿಗೆ ಗೈರಾಗಿದ್ದಾರೆ. 1 ಒತ್ತಿ ಅನಾರೋಗ್ಯ, 2 ಒತ್ತಿ ತಡವಾಗಿ ಬರುತ್ತಾರೆ, 3 ಒತ್ತಿ ಇತರ ಕಾರಣ."
    en: "{student_name} is absent today. Press 1 if sick, 2 if running late, 3 for another reason."
    hi: "{student_name} आज अनुपस्थित है। बीमार है तो 1 दबाएं, देर से आएंगे तो 2, अन्य कारण के लिए 3।"
  # ... (create all nodes for the full call flow)

Add requirements.txt with: fastapi, uvicorn, httpx, redis, litellm, anthropic,
openai, pydantic, python-dotenv, aiofiles, websockets, pyyaml

Add Dockerfile.
```

---

### BACKEND STEP 1.3 — Voice Service (Go): SIP Bridge + Call Orchestrator
**Folder: `edai-backend/services/voice`**

```
You are building the Voice Orchestration service for EdAI in Go 1.22.
This service places and manages AI voice calls to parents in Indian regional languages.
It bridges between the telephony provider (Exotel), the ASR stream, and the LLM
to create a fully conversational AI experience.

Directory structure:
  cmd/voice/main.go
  internal/
    telephony/
      exotel.go      Exotel API client (place calls, get call status)
      plivo.go       Plivo fallback client
      webhook.go     Handles Exotel call state webhooks
    rtp/
      bridge.go      Bidirectional RTP audio bridge
      chunker.go     Splits audio into 100ms chunks for streaming ASR
      mixer.go       Mixes TTS audio into outbound RTP stream
    orchestrator/
      session.go     CallSession state machine
      turn_manager.go Drives listen→transcribe→decide→speak loop
      dtmf_handler.go Handles DTMF keypress responses (1=Sick, 2=Late, 3=Other)
      escalation.go  Detects escalation keywords and triggers warm transfer
    kafka/
      consumer.go    Subscribes to attendance.absent.marked + escalation topics
      producer.go    Emits voice.call.completed events
    storage/
      postgres.go    Writes ConversationLog + TranscriptSegment records
      redis.go       Stores active call sessions + rate limits
      s3.go          Uploads call recordings
    api/
      rest.go        HTTP endpoints (manual trigger, status check, webhooks)
      health.go

KAFKA CONSUMER:
Topic: 'attendance.absent.marked'
For each event:
  1. Check parent.consent_voice == true (call Identity service)
  2. Check quiet hours: no calls before 08:00 or after 20:00 IST
     (respect parent.call_preference_time if set)
  3. Check rate limit: max 2 calls per parent per day (Redis counter, TTL 24h)
  4. Check institution calling schedule (some institutions: calls only 09:30-13:00)
  5. If all checks pass: place Exotel outbound call
  6. Create CallSession in Redis:
     { callId, studentId, parentId, language, callType: "ABSENT_CALL",
       studentContext: {name, class, subject, absenceCount}, state: "INITIATED" }

CALL STATE MACHINE (per session):
  INITIATED → RINGING → CONNECTED → ACTIVE → COMPLETED|FAILED|NO_ANSWER|BUSY

ACTIVE STATE — Turn Manager Loop:
  Every 100ms:
    1. Receive RTP audio chunk from Exotel bridge
    2. Send chunk to ai-engine WS /asr/stream
    3. On is_final=true segment: call ai-engine POST /llm/dialogue-turn
    4. Get next_utterance (already in parent's language)
    5. If dtmf_expected=true: wait for DTMF keypress from Exotel webhook
       Map: 1→"Sick/unwell", 2→"Running late", 3→"Unknown reason"
    6. If next_utterance: call ai-engine POST /tts/synthesise
    7. Stream TTS audio into outbound RTP
    8. If should_escalate=true: initiate warm transfer to class teacher
    9. If call_complete=true: end call, move to COMPLETED

NO ANSWER HANDLING:
  - Attempt 1 at: immediate
  - Attempt 2 at: +2 hours
  - Attempt 3 at: +4 hours
  - After attempt 3: emit 'comms.sms.required' Kafka event → SMS fallback
  - If 3rd SMS also undelivered: flag student in admin dashboard

ON CALL COMPLETED:
  1. Stop RTP bridge
  2. Upload audio to S3: recordings/{institution_id}/{date}/{callId}.ogg
  3. Call ai-engine POST /llm/summarise-call
  4. Write ConversationLog to Postgres:
     { callId, studentId, parentId, duration_seconds, audio_s3_url,
       transcript_json, summary_en, sentiment, escalated, collected_reason }
  5. Emit Kafka event 'voice.call.completed':
     { callId, studentId, parentId, outcome, collected_reason, sentiment,
       escalated, summary_en, duration_seconds, timestamp }

REST API:
  POST /voice/calls/trigger           Manual trigger (admin)
  GET  /voice/calls/:id               Call session status
  GET  /voice/calls/:id/transcript    Full transcript
  POST /voice/webhook/exotel          Exotel state change webhook
  POST /voice/webhook/exotel/dtmf     DTMF input webhook
  GET  /health

Environment variables needed:
  EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_SID, EXOTEL_VIRTUAL_NUMBER
  PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN
  AI_ENGINE_URL (http://ai-engine:8000)
  KAFKA_BROKERS, REDIS_URL, DATABASE_URL
  AWS_S3_BUCKET, AWS_REGION

Use goroutines for each active call session (one goroutine per call).
Use Redis pub/sub to pass DTMF events to the right session goroutine.
```

---

### BACKEND STEP 1.4 — Communications Service (WhatsApp + SMS Fallback)
**Folder: `edai-backend/services/communications`**

```
In edai-backend/services/communications/:

Build the multi-channel communications service that handles all outbound
messaging: WhatsApp, SMS, push notifications, email, and the student timeline.

ENTITIES:

NotificationTemplate:
  id, institution_id (nullable — null = global), code (unique), channel, language,
  subject (email only), body_template (Handlebars syntax), created_at

NotificationLog:
  id, recipient_id (parent/student), student_id, channel, template_code,
  payload_json, status (PENDING|SENT|DELIVERED|FAILED), 
  external_id, sent_at, failed_reason, created_at

TimelineEvent:
  id, student_id, institution_id, ts (timestamptz), 
  kind (enum — see below), actor_id, visibility (STUDENT|PARENT|TEACHER|ALL),
  payload_json, created_at

TimelineEvent.kind values:
  ABSENT_MARKED | CALL_PLACED | CALL_COMPLETED | CALL_MISSED |
  ASSIGNMENT_DUE | ASSIGNMENT_SUBMITTED | ASSIGNMENT_MISSED |
  MARKS_PUBLISHED | PERFORMANCE_DROP | PERFORMANCE_IMPROVED |
  FEE_DUE | FEE_PAID | FEE_OVERDUE |
  BEHAVIORAL_INCIDENT | PTM_SCHEDULED | WEEKLY_REPORT | ESCALATION_TRIGGERED

KAFKA CONSUMERS (this service listens to ALL domain events):
  'attendance.absent.marked'     → create timeline event ABSENT_MARKED
  'voice.call.completed'         → create timeline events CALL_COMPLETED + send WhatsApp summary
  'assignments.missed'           → create timeline ASSIGNMENT_MISSED + notify parent
  'academics.performance.drop'   → create timeline PERFORMANCE_DROP + notify
  'finance.fee.overdue'          → send fee reminder WhatsApp/SMS/call trigger
  'behavior.incident.logged'     → notify parent based on severity
  'escalation.day5'              → send WhatsApp + Email warning to parent

WHATSAPP SENDER (using Meta Cloud API):
  sendTemplate(to, templateName, language, components):
    POST https://graph.facebook.com/v18.0/{PHONE_ID}/messages
    Content-Type: application/json
    Authorization: Bearer {ACCESS_TOKEN}

WhatsApp template messages to create in Meta Business Manager:
  1. ABSENT_CALL_SUMMARY — after every voice call:
     "Dear {parent_name}, {student_name} was absent today. 
      Reason given: {reason}. Summary: {summary}. 
      Call transcript: {link}"

  2. ASSIGNMENT_MISSED_REMINDER:
     "{student_name} has not submitted {assignment_name} due on {date}.
      This carries {weightage}% marks. Please ensure completion by {deadline}."

  3. FEE_REMINDER:
     "Fee of ₹{amount} for {student_name} is due on {due_date}.
      Pay online: {payment_link}
      Late charges of ₹{late_fee}/day apply after {due_date}."

  4. WEEKLY_UPDATE_POSITIVE:
     "Great news about {student_name} this week!
      Attendance: {attendance}% ✓
      {positive_highlights}
      Keep encouraging this wonderful momentum!"

  5. WEEKLY_UPDATE_CONCERN:
     "Weekly update about {student_name}.
      Attendance: {attendance}%
      {concern_summary}
      Action taken: {action}
      Resources shared: {links}"

SMS SENDER (Karix/Gupshup — DLT registered templates only):
  All SMS templates must be pre-registered on DLT with the institution's PE ID.
  Primary for: missed call fallback, OTP, urgent alerts when WhatsApp fails.

PUSH NOTIFICATIONS (Firebase Admin SDK):
  sendPush(deviceToken, title, body, data):
    For students and parents who have installed the mobile app.
    Used for: real-time alerts, call summaries, new assignments.

ENDPOINTS:
  POST /comms/send                   Manual notification send (admin)
  GET  /comms/timeline/:studentId    Student's full event timeline
  GET  /comms/logs/:recipientId      Notification delivery history
  POST /comms/templates              Create/update notification template
  GET  /comms/templates              List all templates

NOTIFICATION TEMPLATES SEED:
  Create seeds/notification-templates.ts with all templates in:
  English (en), Kannada (kn), Hindi (hi), Tamil (ta), Telugu (te), Malayalam (ml)
  for all channels: WHATSAPP, SMS, PUSH, EMAIL
```

---

### FRONTEND STEP 1.5 — Live Absentee Dashboard (Web)
**Folder: `edai-frontend/apps/web/src/app/(dashboard)/attendance`**

```
Build the teacher/admin-facing live attendance dashboard for EdAI.
Apply the Raycraft design system throughout:
  Background: #F2EFE9, Cards: #EAE6DE, Primary: #1C1810
  Display font: Cormorant Garamond italic, UI font: Inter
  Borders: 1px #D0C9BC, radius: 4-6px, no shadows

1. src/app/(dashboard)/attendance/page.tsx
   Page layout with Raycraft PageHeader:
   Title: "Attendance Intelligence" (Cormorant italic 36px)
   Subtitle: "LIVE ABSENTEE TRACKING" (uppercase, tracked, muted)
   Thin 40px rule below

   Top stat row (4 cards):
   - Total Students Today
   - Present (green accent)
   - Absent (danger accent)  
   - AI Calls Triggered (info accent)
   Each card: Cormorant italic large number + Inter label-track subtitle

   Class selector: dropdown to filter by class/section (faculty sees only their class)
   
   "Last updated X seconds ago" + manual refresh button
   
   Main absentee table (AG Grid with Raycraft theme — use ag-grid-raycraft.css):
   Columns:
     Photo (32px circle) | Student Name + Roll No | Class | 
     Attendance % (mini bar) | Parent Notified (✓ or ⏳) | 
     Call Status (badge) | Absence Reason | Actions
   
   Call Status badges (Raycraft StatusBadge):
     "Call Scheduled"  → warning (yellow)
     "Calling..."      → info (blue)
     "Answered"        → success (green)
     "Missed"          → danger (red)
     "SMS Sent"        → muted
   
   Actions per row:
     "View Timeline" → navigates to student detail
     "Excuse" → opens ExcuseDialog
     "Retry Call" → POST /voice/calls/trigger (if missed)
   
   Row click → opens StudentSidePanel (right drawer, 480px):
     Student photo + name + class + risk score
     30-day attendance chart (Recharts AreaChart, Raycraft colors)
     Recent call history (last 5 calls with outcomes)
     Quick action buttons

2. src/features/attendance/components/CallStatusTracker.tsx
   Real-time call status widget that polls every 10 seconds.
   Shows: current active calls count + a live list of calls in progress.
   Each live call shows: student name, parent language, call duration counter.
   Uses React Query with refetchInterval: 10000.

3. src/features/attendance/components/EscalationTimeline.tsx
   Visual timeline component showing the 4-stage escalation for chronic absentees:
   Day 3 → Day 5 → Day 7 → Day 10
   Each stage: icon + label + action taken + date.
   Completed stages in espresso #1C1810, pending in muted cream.

4. src/features/attendance/api/attendance-api.ts
   TypeScript API functions:
   - getAbsenteesToday(classId?, institutionId): AbsenteeRecord[]
   - getAttendanceSummary(classId, date): AttendanceSummary
   - markAttendance(payload): AttendanceRecord
   - bulkMarkAttendance(payload): BulkMarkResult
   - excuseAbsence(recordId, reason): AttendanceRecord
   - triggerCall(studentId): CallTriggerResult
   - getAtRiskStudents(institutionId): AtRiskStudent[]

5. src/features/attendance/hooks/useAttendanceLive.ts
   Custom hook with React Query:
   - Fetches absentee data, refetches every 30s
   - Returns: absentees, callStatuses, stats, isLoading, lastUpdated

All tables use AG Grid with ag-grid-raycraft.css theme.
All charts use RAYCRAFT_COLORS from lib/chart-theme.ts.
All badges use Raycraft StatusBadge component.
```

---

### FRONTEND STEP 1.6 — Attendance View + Call History (Mobile)
**Folder: `edai-frontend/apps/mobile/lib/features/attendance` & `voice_calls`**

```
Build the student/parent-facing attendance and call history screens in Flutter.
Apply Raycraft theme: raycraftTheme() in main.dart, RaycraftColors, RaycraftTextStyles.

1. lib/features/attendance/screens/attendance_screen.dart
   AppBar: "Attendance" in Cormorant italic (raycraftTheme AppBarTheme)
   
   Top card (RaycraftCard widget):
     Overall attendance percentage — large Cormorant italic number
     Subject-wise breakdown below (for student) or class-wide for teacher
   
   Subject list:
     Each RaycraftCard: subject name (Inter 15px) + attendance bar + 
     percentage badge (RaycraftStatusBadge: green>85%, yellow 75-85%, red<75%)
     Tap → AttendanceDetailScreen for that subject
   
   "Apply for Leave" FAB → LeaveRequestSheet bottom sheet

2. lib/features/attendance/screens/attendance_detail_screen.dart
   Calendar view (table_calendar package) showing month attendance:
   - Present: small green dot
   - Absent: small red dot  
   - Late: small orange dot
   - Excused: small grey dot
   Below calendar: list of absent dates with reason (if any from parent call)
   Colors from RaycraftColors (success/danger/warning)

3. lib/features/voice_calls/screens/call_history_screen.dart
   AppBar: "Call History" (Cormorant italic)
   
   Each call shown as RaycraftListTile:
     Leading: call icon in a circle (RaycraftColors.surface2)
     Title: date + time
     Subtitle: duration + "Reason: {collected_reason}" in RaycraftColors.textSecondary
     Trailing: RaycraftStatusBadge (Answered/Missed/Escalated)
   
   Empty state (RaycraftEmptyState widget):
     Icon: phone, Title: "No calls yet", Subtitle: "Call history will appear here"

4. lib/features/voice_calls/screens/call_detail_screen.dart
   Summary card (RaycraftCard):
     Call date, duration, AI summary text, sentiment badge
   
   Audio player (if recording available):
     Play/pause button (espresso #1C1810) + progress slider + duration
     "Recording expires after 90 days" note in muted style
   
   Transcript section:
     Chat bubble style — AGENT on left (#EAE6DE bg), PARENT on right (#1C1810 bg + cream text)
     Each bubble: text + timestamp + "Show English" toggle (for non-English calls)
   
   "Message the Teacher" button at bottom (OutlinedButton Raycraft style)
   
   "Recording expired" placeholder for calls >90 days old

All screens use RaycraftScaffold wrapper.
All text uses RaycraftTextStyles constants.
All colors use RaycraftColors constants — never hardcode hex.
```

---

# FEATURE 2 — ASSIGNMENT INTELLIGENCE
## Deadline tracking, missed submission escalation, performance drop detection

---

### BACKEND STEP 2.1 — Assignments Service
**Folder: `edai-backend/services/assignments`**

```
In edai-backend/services/assignments/:

Build the Assignment Intelligence NestJS service.

ENTITIES:

Assignment:
  id (uuid), institution_id, class_id, subject_id, teacher_id,
  title, description, due_date (timestamptz), max_marks (decimal),
  weightage_percent (decimal), type (enum: HOMEWORK|PROJECT|LAB|QUIZ|PRESENTATION),
  resources_urls (jsonb array), is_active, created_at

AssignmentSubmission:
  id, assignment_id, student_id, submitted_at (timestamptz, nullable),
  file_urls (jsonb array), marks_obtained (decimal, nullable),
  feedback (text, nullable), status (enum: PENDING|SUBMITTED|LATE|MISSING|GRADED),
  created_at

ENDPOINTS:
  POST /assignments                            Create assignment (teacher)
  GET  /assignments/class/:classId            List assignments for a class
  GET  /assignments/student/:studentId        Student's assignment list + submission status
  POST /assignments/:id/submit                Student submits assignment
  PUT  /assignments/submissions/:id/grade     Teacher grades a submission
  GET  /assignments/:id/summary               Submission stats for teacher

DEADLINE AUTOMATION (Bull queue scheduler):

  48h before deadline:
    Emit 'assignment.deadline.approaching' Kafka event
    → Comms service sends:
      - Student push notification: "Assignment due in 48 hours: {title}"
      - Parent WhatsApp (if opted-in): reminder message

  At deadline (0 hours):
    Query all students in the class who have not submitted.
    For each missing submission:
      Create AssignmentSubmission with status=MISSING
      Emit 'assignment.missed' Kafka event:
        { studentId, assignmentId, title, dueDate, weightage, missCount }

  24h after deadline (still missing):
    Emit 'assignment.missed.followup' → Voice service triggers AI call to parent

PERFORMANCE DROP DETECTION:
  After every assignment is graded:
  1. Compute student's rolling average for the subject (last 6 assessments)
  2. If current score < rolling_average × 0.85 (>15% drop):
     Emit 'academics.performance.drop' Kafka event:
     { studentId, subjectId, currentScore, rollingAverage, dropPercent,
       rootCauseHints: { attendanceLast14Days, assignmentsMissedLast14Days } }
  3. Comms service sends solution-focused parent message:
     "Arjun scored {score}% on {subject}. Our analysis: linked to {absences} missed classes.
      We've provided: recorded lessons, {N} practice problems, teacher office hours {time}."

SAMPLE AI CALL SCRIPT (for missed assignment - passed to ai-engine as context):
  "Good morning, this is the automated assistant from {institution_name} calling about
   {student_name}'s {subject} assignment titled '{title}'. The submission was due
   {days} ago. This assignment carries {weightage}% marks and this is {student_name}'s
   {missCount} missed submission this month. Please ensure completion by {new_deadline}.
   Press 1 if your child will submit today, press 2 if they need an extension,
   press 3 for other concerns."
```

---

### FRONTEND STEP 2.2 — Assignment Dashboard (Web)
**Folder: `edai-frontend/apps/web/src/app/(dashboard)/assignments`**

```
Build the teacher-facing assignment management dashboard (Raycraft theme).

1. src/app/(dashboard)/assignments/page.tsx
   PageHeader: title="Assignment Intelligence", subtitle="DEADLINE TRACKING & SUBMISSIONS"
   
   Stats row (RaycraftStatCards):
   - Active Assignments | Due This Week | Submission Rate % | Missing Count
   
   Active assignments table (AG Grid Raycraft):
   Columns: Assignment | Subject | Class | Due Date | Submitted | Missing | 
            Submission % (bar) | Actions
   - Submission % bar: green fill, percentage label inside
   - Missing count: red badge if > 0
   - Actions: "View Submissions" | "Send Reminder" | "Extend Deadline"
   
   "Create Assignment" button (primary Raycraft) → opens CreateAssignmentDialog

2. src/features/assignments/components/CreateAssignmentDialog.tsx
   shadcn Dialog with Raycraft styling:
   - Title in Cormorant italic
   - Fields: Title, Subject, Class, Due Date (date picker), Max Marks, Weightage %, 
     Type (select), Description (textarea), Resource URLs (tag input)
   - Submit → POST /assignments
   - On success: toast "Assignment created. Students notified." 

3. src/features/assignments/components/SubmissionsPanel.tsx
   Side panel showing submissions for a selected assignment:
   - Stats: submitted / total, on-time vs late, average marks
   - Student list: name | submitted at (or "Missing") | marks | status badge
   - "Send Reminder to Missing" bulk action → triggers AI calls/WhatsApp
   - Individual grading inline in the table

4. src/app/(dashboard)/assignments/performance/page.tsx
   Performance drop alerts page:
   - Students who have dropped >15% from personal average
   - Each row: student | subject | last score | average | drop % | root cause | action taken
   - Root cause chips: "3 absences" | "2 missed assignments" | "new topic"
   - "View AI Analysis" → shows detailed breakdown
   - "Message Parent" → triggers parent communication
```

---

# FEATURE 3 — TEACHER PRODUCTIVITY SUITE
## Auto reports, AI marks validation, daily/weekly digests

---

### BACKEND STEP 3.1 — Academics Service (Marks + Reports)
**Folder: `edai-backend/services/academics`**

```
In edai-backend/services/academics/:

Build the academics service covering marks entry, AI validation, and report generation.

ENTITIES:

Subject:
  id, institution_id, class_id, name, code, teacher_id,
  assessment_scheme (jsonb: {homework:20, test:40, practical:40}), created_at

MarksEntry:
  id (uuid), student_id, subject_id, institution_id,
  component (enum: HOMEWORK|QUIZ|IA1|IA2|PRACTICAL|PROJECT|SEMESTER),
  score (decimal), max_score (decimal), 
  entered_by (teacher_id), verified_by (nullable, second_teacher_id),
  ai_validation_flags (jsonb nullable — outliers, mismatches detected),
  status (enum: DRAFT|PENDING_REVIEW|VERIFIED|SYNCED),
  created_at

DailyReport:
  id, teacher_id, institution_id, report_date, 
  content_json (full report data), sent_at, created_at

MARKS ENTRY ENDPOINT with AI Validation:
  POST /academics/marks/bulk
  Body: { subjectId, component, entries: [{studentId, score}] }
  
  AI Validation Logic (run synchronously before saving):
    For each entry, check:
    1. Statistical outlier: score > mean + 2*stddev OR score < mean - 2*stddev
       Flag: "Statistical outlier — class scored avg {mean}, this student: {score}"
    2. Historical mismatch: student's avg for this subject is 75-85%, entered 45%
       Flag: "Student typically scores {avg}%, entered {score}% — confirm?"
    3. Missing entries: any student with null score
       Flag: "Missing entry for {count} students"
    4. Invalid score: score > max_score
       Flag: "Score {score} exceeds maximum {max_score}"
    5. Unusual pattern: all students same score → "All {N} students scored {score} — verify"
    6. Decimal error: score like 8.5 when typical range is 80-90
       Flag: "Possible decimal error: did you mean {score*10}?"
    
    Return:
    { flags: [{studentId, studentName, score, flagType, message, suggestion}],
      flagCount: N, canProceed: boolean }
    
    Frontend shows flags to teacher and requires explicit confirmation to save.

AUTOMATED DAILY REPORT (Bull cron at 17:00 every working day):
  For each teacher:
    Compile DailyReport:
    - Today's attendance: present/absent/late for each class
    - Assignments due today: submitted vs pending counts
    - Pending grading count (assignments teacher hasn't graded)
    - Upcoming deadlines this week
    - Students requiring attention (flag list)
    
    Send via: WhatsApp voice note summary (TTS from ai-engine) + in-app notification
    Store in DailyReport table

AUTOMATED WEEKLY DIGEST (Bull cron at 08:00 every Monday):
  For each teacher:
    Weekly summary:
    - Attendance trends: week-over-week chart data
    - Assignment completion rates by subject
    - Predictive alerts: "4 students likely to miss Friday's test based on patterns"
      (ML model: uses attendance + assignment submission history)
    - Class performance highlights: top performers + students needing help
    - Workload index: your classes/week, papers graded, PTMs held vs dept average
    
    Send via: WhatsApp message + in-app notification

ENDPOINTS:
  POST /academics/marks/bulk              Bulk marks entry with AI validation
  POST /academics/marks/bulk/confirm      Confirm and save after reviewing AI flags
  GET  /academics/marks/subject/:id       All marks for a subject
  GET  /academics/marks/student/:id       Student's complete marks history
  POST /academics/marks/verify/:id        Second teacher verification
  GET  /academics/reports/teacher/:id     Teacher's report history
  GET  /academics/predictive/at-risk      AI at-risk predictions for teacher's students
```

---

### FRONTEND STEP 3.2 — Marks Entry with AI Validation (Web)
**Folder: `edai-frontend/apps/web/src/app/(dashboard)/marks`**

```
Build the AI-powered marks entry interface (Raycraft theme throughout).

1. src/app/(dashboard)/marks/page.tsx
   Subject list for the logged-in teacher.
   Each subject card (RaycraftCard):
     Subject name (Cormorant italic) + class + pending grading count badge
     Tap → marks entry for that subject

2. src/app/(dashboard)/marks/[subjectId]/page.tsx
   Marks entry page.
   
   Header: Subject name + class + component selector tabs (IA1|IA2|Homework|Practical...)
   
   Marks Entry Table (AG Grid editable, Raycraft themed):
   Columns: Roll No | Student Name | Max Score | Score (editable) | % | Grade | Flags
   
   - Score column: inline NumberInput
   - Grade: auto-computed O/A+/A/B+/B/C/P/F
   - Flags column: warning icon if AI detects an issue
   
   Bottom action bar:
   "Validate with AI" button (primary) → POST /academics/marks/bulk
   
   AI VALIDATION RESULT PANEL (shown after validation):
   Appears as a warning card above the table:
   - Count: "5 entries need review"
   - List of flagged entries with red/orange highlight in the table
   - Each flag: student name + flag message + "Confirm anyway" checkbox
   - Only appears for flagged rows
   "Confirm & Save" button → POST /academics/marks/bulk/confirm
   
   Impact stat: "AI validation catches 94% of marking errors"

3. src/features/marks/components/AiValidationPanel.tsx
   Expandable panel showing all validation flags:
   Each flag as a RaycraftCard:
   - Flag type badge (Statistical Outlier / Historical Mismatch / Missing / Invalid)
   - Message: exact flag text
   - Student: name + current score + suggestion
   - "Accept Flag" or "Override" radio buttons
   
   Raycraft styling: warning flags use #F5EDDB background, border #8B6914
   Error flags use #F5E6E6 background, border #8B2F2F

4. src/features/marks/components/TeacherDigestCard.tsx
   Shows the daily digest in a card on the teacher dashboard.
   Sections: Attendance summary | Assignments pending | AI alerts
   "View Full Report" → expands to show weekly trends
```

---

# FEATURE 4 — PROACTIVE PARENT ENGAGEMENT
## Weekly update calls, PTM auto-scheduling

---

### BACKEND STEP 4.1 — Weekly Call Scheduler + PTM Booking
**Folder: `edai-backend/services/attendance` → new module `weekly-engagement`**

```
Add a weekly-engagement module to the attendance service (or create a separate
module in services/communications/). This handles weekly parent update calls
and PTM auto-scheduling.

WEEKLY CALL SCHEDULER:
  Bull cron job: Every Friday at 18:00 (6 PM IST):
    For each student, collect weekly summary:
    - Attendance %: classes attended / total classes this week
    - Assignments: submitted / total due
    - Test scores (if any this week): avg score
    - Positive highlights: highest score, attendance streak, improved from last week
    - Concerns: subjects with <60%, missed assignments
    
    Classify call type:
    - Positive (attendance >85%, no issues) → Weekly positive update call
    - Concern (attendance <85% OR missed assignment OR low score) → Concern call
    
    For each parent with consent_voice=true AND rate_limit not exceeded:
      Emit 'voice.weekly.call.required' Kafka event:
      {
        callType: 'WEEKLY_UPDATE',
        parentId, parentLanguage, studentId,
        studentContext: {
          weekAttendance, weekAssignments, positiveHighlights, concerns,
          callTone: 'positive'|'concern'
        }
      }
    
    For parents preferring WhatsApp voice note (consent_whatsapp=true but not consent_voice):
      Emit 'comms.whatsapp.voice.required'
      → ai-engine generates TTS of the update → sent as WhatsApp audio message

PTM AUTO-SCHEDULING:
  Trigger conditions (any one of):
    - Student absence count hits DAY10 escalation
    - Performance drop detected AND parent not engaged in 7 days
    - Teacher manually requests PTM
    - Behavioral incident HIGH SEVERITY
  
  PTM auto-scheduling algorithm:
    1. Get teacher's free slots (from timetable + existing PTM calendar)
    2. Get parent's preferred timing (from profile — morning/afternoon/evening)
    3. Select 3 optimal overlapping slots
    4. Send SMS to parent with a link to choose their slot:
       "Dear {parent_name}, a PTM has been requested for {student_name}.
        Please choose your slot: [Link]"
    5. Parent clicks link → simple web page (no login needed) → selects slot
    6. On slot confirmation:
       - Create PTMBooking record
       - Update teacher calendar
       - Update admin calendar
       - Send confirmation SMS/WhatsApp to parent
       - Send reminder 24h before PTM
       - If online: generate Google Meet / Zoom link

ENTITIES:
  PTMBooking:
    id, student_id, teacher_id, parent_id, institution_id,
    scheduled_at (timestamptz), duration_minutes (default 15),
    type (enum: ONLINE|IN_PERSON), meeting_link (nullable),
    status (enum: REQUESTED|CONFIRMED|COMPLETED|CANCELLED|NO_SHOW),
    trigger_reason, reminder_sent (boolean), created_at

ENDPOINTS:
  GET  /ptm/teacher/:id/available-slots    Teacher's available PTM slots
  POST /ptm/book                           Auto-book PTM (internal use)
  GET  /ptm/confirm/:token                 Public slot confirmation (no auth, token-based)
  POST /ptm/confirm/:token                 Parent confirms slot
  GET  /ptm/upcoming                       Upcoming PTMs for teacher/admin view
```

---

### FRONTEND STEP 4.2 — Parent Engagement Screen (Mobile)
**Folder: `edai-frontend/apps/mobile/lib/features/timeline`**

```
Build the parent-facing weekly updates and PTM scheduling view (Raycraft theme).

1. lib/features/timeline/screens/timeline_screen.dart
   The main home screen for parents — a feed of all events and updates.
   
   AppBar: "RV Trust · {student_name}" (Cormorant italic title)
   Language toggle in AppBar (Kannada/English/Hindi selector)
   
   Filter chips below AppBar (horizontally scrollable):
   All | Attendance | Calls | Marks | Fees | Assignments | Circulars
   
   Event feed (ListView with pull-to-refresh):
   
   Each event is a RaycraftCard with left-edge color strip:
   - ABSENT_MARKED: red strip, phone icon, "Absent today — {subject}"
   - CALL_COMPLETED: blue strip, headphone icon, "Call summary: {summary_snippet}"
     → Shows sentiment badge (Concerned/Neutral/Positive)
     → "View full transcript" link
   - MARKS_PUBLISHED: purple strip, chart icon, "{subject}: {score}/{max}"
   - ASSIGNMENT_MISSED: orange strip, alert icon, "Missed: {assignment_name}"
   - FEE_DUE: red strip, rupee icon, "₹{amount} due on {date}" + "Pay Now" button
   - WEEKLY_REPORT: green strip, star icon, weekly summary card (expandable)
   - PTM_SCHEDULED: blue strip, calendar icon, "PTM on {date}" + "Confirm" button
   
   Weekly Report card (expanded view):
     "Week of {date_range}"
     Attendance: {N}% (week) — color-coded
     Assignments: {submitted}/{total}
     Highlights: {positive_text} (in parent's language)
     Concerns (if any): {concern_text}
     
   Empty state (RaycraftEmptyState): no events yet

2. lib/features/timeline/widgets/weekly_report_card.dart
   A rich expandable card for weekly reports.
   - Summary line: attendance % + assignment completion
   - Expandable body: full positive highlights + concerns
   - Call recording button if weekly call was made
   - "Reply to teacher" button (sends WhatsApp to class teacher)

3. lib/features/timeline/widgets/ptm_booking_card.dart
   PTM invitation card:
   - "A Parent-Teacher Meeting has been requested for {student_name}"
   - "Suggested slots:" — 3 time buttons (OutlinedButton Raycraft)
   - Parent taps slot → opens confirmation sheet
   - Confirmed state: shows "PTM confirmed: {date} at {time}" with calendar add button

All cards use RaycraftColors and RaycraftTextStyles.
All status badges use RaycraftStatusBadge.
Smooth AnimatedSwitcher transitions between filter states.
```

---

# FEATURE 5 — INTELLIGENT AI CHATBOT
## Student doubt resolution, parent query answering

---

### BACKEND STEP 5.1 — Chatbot Service
**Folder: `edai-backend/services/chatbot`**

```
In edai-backend/services/chatbot/:

Build the AI Chatbot NestJS service that provides:
1. Student doubt resolution (academic questions)
2. Parent contextual query answering ("Why did my child score low?")

ENTITIES:

ChatSession:
  id (uuid), user_id, user_role (STUDENT|PARENT), student_id (for parent sessions),
  institution_id, started_at, last_activity_at, is_active

ChatMessage:
  id, session_id, role (USER|ASSISTANT|SYSTEM), content (text),
  confidence_score (float, nullable — for AI responses),
  escalated_to_teacher (boolean, default false),
  created_at

TeacherEscalation:
  id, session_id, student_id, teacher_id, question (text),
  ai_attempted_answer (text), ai_confidence_score (float),
  student_profile_summary (text), suggested_approach (text),
  related_class_queries (jsonb), status (PENDING|RESPONDED|CLOSED), created_at

ENDPOINTS:
  POST /chatbot/sessions                   Start new chat session
  POST /chatbot/sessions/:id/messages      Send message, get AI response
  GET  /chatbot/sessions/:id/history       Full chat history
  GET  /chatbot/escalations/teacher/:id    Teacher's pending escalations
  POST /chatbot/escalations/:id/respond    Teacher responds to escalation

STUDENT DOUBT RESOLUTION:
  When student sends a message:
  1. Call ai-engine POST /llm/chat with:
     - System prompt: "You are an academic assistant for {institution_name}.
       Student: {name}, Class: {class}, Subject context: {recent_subjects}.
       Answer academic questions clearly. If confidence < 0.7, escalate to teacher.
       Provide: concept explanation, example, related resources."
     - conversation_history: last 10 messages
     - current_message: student's question
  2. Get AI response with confidence_score
  3. If confidence_score >= 0.7: return AI answer directly
  4. If confidence_score < 0.7: create TeacherEscalation:
     - Package: original question + AI attempted answer + student profile +
       suggested teaching approach + related past queries from class
     - Notify teacher via push notification
     - Tell student: "I've forwarded this to your teacher for a detailed answer"

PARENT CONTEXTUAL QUERY:
  When parent asks "Why did my child score low?":
  1. Extract student context from database:
     - Last 6 test scores for all subjects
     - Attendance last 30 days (days present/absent)
     - Assignment submission history
     - Concept-wise performance (if available)
  2. AI performs root cause analysis:
     - Identify primary factor: "3 missed classes during Algebra unit"
     - Identify secondary factors
     - Map to specific remediation
  3. Return structured response:
     - Root cause (specific, not vague)
     - Actions already taken by institution
     - Resources shared (links to recorded lessons, practice problems)
     - Teacher office hour info
     - Expected improvement timeline: "+12-18% in next 2 weeks"
  
  AI system prompt for parent queries:
  "You are a helpful assistant for parents at {institution_name}.
   You have access to {student_name}'s academic data. Be empathetic, 
   specific, and solution-focused. Never give vague answers.
   Always: identify root cause + list actions taken + set realistic expectations.
   Language: {parent_language} (translate response before returning)"

ADD to ai-engine (Python):
  POST /llm/chat
  Input: { user_role, student_context, conversation_history, message, language }
  Output: { response, response_original_lang, confidence_score, sources: [] }
```

---

### FRONTEND STEP 5.2 — AI Chatbot Screen (Mobile)
**Folder: `edai-frontend/apps/mobile/lib/features/chatbot`**

```
Build the AI chatbot interface for students and parents (Raycraft theme).

1. lib/features/chatbot/screens/chatbot_screen.dart
   AppBar: "AI Assistant" (Cormorant italic) + language selector
   
   Chat interface:
   - Messages list (ListView.builder, bottom-to-top scroll)
   - User messages: right-aligned, RaycraftColors.primary (#1C1810) background,
     cream text, 18px radius top-right 4px
   - AI messages: left-aligned, RaycraftColors.surface (#EAE6DE) background,
     espresso text, 18px radius top-left 4px
   - Timestamp below each message in RaycraftColors.textMuted
   - "Forwarded to teacher" notice (if escalated): 
     small info card with RaycraftColors.infoLight background
   
   For parent role — pre-built quick query chips above input:
   "Why did my child score low?"
   "What is the attendance today?"
   "When is the next fee due?"
   "Show me this week's report"
   
   For student role — pre-built chips:
   "Explain this concept"
   "Help with assignment"
   "Practice problems"
   "Upcoming deadlines"
   
   Input area: 
   - TextField (Raycraft styled) + Send button (#1C1810 circle)
   - Voice input button (mic icon) → records and sends audio
   
   AI typing indicator: 3-dot pulse animation in RaycraftColors.surface

2. lib/features/chatbot/widgets/teacher_escalation_notice.dart
   When a question is escalated:
   Small notice card inside the chat:
   "Your question has been sent to {teacher_name}.
    Expected response: within 24 hours."
   Subtle RaycraftColors.infoLight background, borderStrong border.
   
3. lib/features/chatbot/widgets/source_citation_card.dart
   When AI cites a source:
   Small expandable card showing:
   - Source type (Recorded Lesson / Textbook / Practice Set)
   - Title + link button
   - "Open" button → opens in-app webview or downloads file
```

---

# FEATURE 6 — FINANCIAL INTELLIGENCE
## Automated fee collection, smart personalization, scholarship auto-discovery

---

### BACKEND STEP 6.1 — Finance Service
**Folder: `edai-backend/services/finance`**

```
In edai-backend/services/finance/:

Build the Financial Intelligence NestJS service.

ENTITIES:

FeeStructure:
  id, institution_id, class_id, academic_year, components (jsonb array:
  [{code, name, amount, due_date, late_fee_per_day, grace_period_days}])

FeeRecord:
  id, student_id, institution_id, component_code, amount_due, amount_paid,
  due_date, paid_at (nullable), receipt_no (nullable), days_overdue (computed),
  late_fee_accumulated (decimal), payment_history (jsonb, array of partial payments),
  payer_profile (enum: CONSISTENT|FIRST_LATE|HARDSHIP|SIBLING), created_at

PaymentTransaction:
  id, student_id, fee_record_ids (array), amount, gateway (RAZORPAY|PAYU),
  gateway_order_id, gateway_payment_id, status (INITIATED|SUCCESS|FAILED),
  receipt_s3_url, gst_amount, created_at

Scholarship:
  id, institution_id, name, eligibility_criteria (jsonb:
  {min_gpa, max_income, attendance_min, category}),
  amount, renewable_annually, deadline, is_active

StudentScholarship:
  id, student_id, scholarship_id, status (ELIGIBLE|APPLIED|AWARDED|REJECTED),
  detected_at, applied_at, awarded_at, awarded_amount

FEE COLLECTION WORKFLOW (Bull queue scheduler):

Day -3 (3 days before due):
  Channel: Student app push notification
  Tone: "Friendly reminder: {fee_name} of ₹{amount} due in 3 days"

Day -1 (1 day before):
  Channel: WhatsApp to parent
  Template: "Fee of ₹{amount} due tomorrow. Pay now: {payment_link}"

Day 0 (due date, 10 AM):
  Channel: Email + WhatsApp
  Tone: "Fee due today. Avoid late charges."

Day +3:
  Channel: AI voice call to parent
  Tone: "Your fee payment is 3 days overdue. You can pay online at {link}."
  SMART PERSONALIZATION:
    - CONSISTENT payer: "We know you're always on time. Just a reminder in case this was overlooked."
    - FIRST_LATE: "This appears to be the first time. Please pay at your earliest convenience."
    - HARDSHIP: Automatically route call to offer EMI / scholarship options
    - SIBLING: Consolidate both children's dues into one call/message

Day +7:
  Channel: AI voice call (firmer tone) + WhatsApp
  Tone: Mentions consequences (academic hold, exam permission)

Day +10:
  Channel: Admin dashboard flag — manual intervention required
  No automated messages — human must handle

SCHOLARSHIP AUTO-DISCOVERY:
  Run daily after marks/attendance sync:
  For each active Scholarship:
    Query students who match eligibility_criteria (GPA, attendance, category)
    For newly eligible students not yet alerted:
      Create StudentScholarship(ELIGIBLE)
      Send push notification to student: "You may be eligible for {scholarship_name}!"
      Send WhatsApp to parent: "Good news! {student_name} qualifies for {name} scholarship."
      Show in student app with "Apply Now" button

PAYMENT FLOW:
  POST /finance/payment/initiate:
    Create Razorpay order, store PaymentTransaction(INITIATED), return order_id + key
  POST /finance/payment/verify:
    Verify HMAC signature → mark FeeRecord paid → generate PDF receipt → upload S3
    Emit 'finance.fee.paid' Kafka event → timeline event created
  POST /finance/webhook/razorpay:
    Handle async payment status from Razorpay (backup for verify)

ENDPOINTS:
  GET  /finance/students/:id/dues          All outstanding fees + late fees
  GET  /finance/students/:id/history       Payment history + receipts
  POST /finance/payment/initiate           Create payment order
  POST /finance/payment/verify             Verify and record payment
  GET  /finance/receipt/:transactionId     Pre-signed S3 receipt URL
  GET  /finance/overdue                    All overdue students (admin)
  GET  /finance/scholarships/eligible      Students eligible for scholarships
  POST /finance/scholarships/apply/:id     Student applies for scholarship
```

---

### FRONTEND STEP 6.2 — Fee Payment (Mobile) + Finance Dashboard (Web)
**Folder: mobile `features/fees` + web `app/(dashboard)/finance`**

```
MOBILE — lib/features/fees/:

1. fees_screen.dart (Raycraft theme)
   AppBar: "Fees & Payments" (Cormorant italic)
   
   Summary card (RaycraftCard, full width):
     "Total Outstanding" — large Cormorant italic number in danger red (#8B2F2F) if >0
     "₹{amount}" — formatted in Indian number system (₹1,23,456)
     Below: "Pay Now" ElevatedButton (Raycraft primary)
   
   Fee components list:
   Each component card (RaycraftCard):
     Component name + amount + due date
     Status badge (RaycraftStatusBadge): Paid/Due/Overdue
     Overdue cards: left border in danger (#8B2F2F), warningLight (#F5EDDB) background tint
     Late fee accumulated: small red text below
   
   Scholarship eligibility banner (if eligible):
     RaycraftColors.successLight background card:
     "🎓 You may be eligible for {scholarship_name}" + "Apply Now" button
   
   Payment history link at bottom

2. payment_screen.dart
   Checkbox selection of fee components to pay
   Total calculation with GST breakdown
   "Proceed to Pay" → Razorpay checkout (razorpay_flutter)
   Success screen: Lottie animation + receipt download button
   
WEB — src/app/(dashboard)/finance/page.tsx (Raycraft theme):

PageHeader: title="Financial Intelligence", subtitle="FEE COLLECTION & SCHOLARSHIP TRACKER"

Stats row:
  - This Month Target: ₹X Cr
  - Collected: ₹X Cr (% bar)
  - Outstanding: ₹X Cr (red)
  - Overdue Students: N (link to overdue list)

Fee Collection Trend (Recharts BarChart, Raycraft palette):
  Monthly collected vs target, last 6 months

Overdue Students Table (AG Grid Raycraft):
  Student | Class | Component | Amount | Days Overdue | Payer Profile | Next Action | Status

Payer Profile badges:
  CONSISTENT → info badge (longer grace, shown courteously)
  FIRST_LATE  → warning badge (gentle reminder)
  HARDSHIP    → special badge (route to EMI/scholarship)
  SIBLING     → muted badge (consolidated communication)

Scholarship Panel:
  List of active scholarships + number of newly eligible students
  "Notify All Eligible" bulk action button

Smart Personalization toggle (admin setting):
  Toggle to enable/disable tone personalization per payer profile.
```

---

# FEATURE 7 — ADMINISTRATIVE COMMAND CENTER
## Real-time dashboard, risk scoring, AI audit intelligence

---

### BACKEND STEP 7.1 — Analytics Service
**Folder: `edai-backend/services/analytics`**

```
In edai-backend/services/analytics/:

Build the Administrative Command Center analytics service.
Uses ClickHouse for aggregated KPIs and PostgreSQL for live operational data.

ClickHouse tables (create in scripts/clickhouse-migrations/):

attendance_daily_agg:
  institution_id, class_id, date, total_students, present, absent, late,
  avg_pct Float32, at_risk_count UInt32
  Engine: ReplacingMergeTree() PARTITION BY toYYYYMM(date) ORDER BY (institution_id, date)

student_risk_scores:
  student_id, institution_id, calculated_at, 
  risk_score UInt8 (0-100), 
  attendance_risk UInt8, academic_risk UInt8, financial_risk UInt8, behavioral_risk UInt8,
  primary_risk_factor String, recommended_action String
  Engine: ReplacingMergeTree() ORDER BY (student_id, calculated_at)

teacher_workload:
  teacher_id, institution_id, week_start, classes_per_week UInt8,
  papers_graded UInt16, ptms_held UInt8, workload_index Float32,
  is_overloaded Bool
  Engine: ReplacingMergeTree() ORDER BY (teacher_id, week_start)

subject_intelligence:
  subject_id, institution_id, class_id, assessment_date,
  avg_score Float32, pass_rate Float32, concept_difficulty String,
  struggling_student_count UInt16
  Engine: ReplacingMergeTree()

RISK SCORE CALCULATION (Bull cron, daily at 22:00):
  For each active student:
    attendance_risk = map(100 - attendance_pct) to 0-100 scale
    academic_risk   = map(avg_performance_drop, consecutive_misses) to 0-100
    financial_risk  = map(days_overdue, fee_default_history) to 0-100
    behavioral_risk = map(incident_count_30days, severity_weights) to 0-100
    
    risk_score = max(attendance_risk*0.35, academic_risk*0.35,
                     financial_risk*0.20, behavioral_risk*0.10)
    
    if risk_score >= 70: primary_risk_factor = highest scoring risk category
    recommended_action = lookup action matrix by risk factors
    
    Store in student_risk_scores ClickHouse table

AI AUDIT INTELLIGENCE:
  Daily anomaly detection (Bull cron at 23:00):
  
  Check 1 — Attendance edit pattern:
    "Attendance edited {N} times for {class} on {date}.
     Pattern: {N/total} edits by same user between {time_range}"
    If N > 5 from same user in <30 min: flag for admin
  
  Check 2 — Grade clustering:
    "Grade distribution shows unusual clustering — {N} students scored exactly {score}/100.
     Statistical review recommended."
    If >20% of class has identical score: flag
  
  Check 3 — Parent callback spike:
    "Parent callback requests increased {pct}% on {date}.
     Traced to: {possible_cause}"
  
  Check 4 — Teacher workload:
    "Ms./Mr. {name} at {workload_index}% of department average for {N} weeks.
     Recommend: Redistribute {N} sections OR assign teaching assistant"

ENDPOINTS:
  GET /analytics/dashboard              Full command center KPIs
  GET /analytics/students/at-risk       Ranked risk list with scores
  GET /analytics/teachers/workload      Teacher workload matrix
  GET /analytics/subjects/intelligence  Subject difficulty + pass rates
  GET /analytics/audit/anomalies        AI-detected anomalies
  GET /analytics/attendance/heatmap     Heatmap data by dept/section
  GET /analytics/trends/yoy             Year-over-year comparison

Each endpoint accepts: institutionId, from, to, granularity
Returns time-series data suitable for Recharts.
```

---

### FRONTEND STEP 7.2 — Admin Command Center (Web)
**Folder: `edai-frontend/apps/web/src/app/(dashboard)/page.tsx`**

```
Build the Administrative Command Center — the default dashboard for admins/principals.
Full Raycraft design system throughout.

1. src/app/(dashboard)/page.tsx — Main Dashboard

PageHeader: title="Administrative Command Centre" 
            subtitle="REAL-TIME INSTITUTIONAL INTELLIGENCE"
            (Cormorant italic title, uppercase tracked subtitle, thin rule)

TOP KPI CARDS (6 cards in 2 rows of 3):
Row 1:
  - Overall Attendance Today: X% (delta from yesterday)
  - Fee Collection This Month: ₹X Cr (% of target)
  - AI Calls Today: X completed / Y escalated

Row 2:
  - At-Risk Students: X (red count badge)
  - Overdue Fees: ₹X / N students
  - Pending Assignments: N across M subjects

Each card uses RaycraftStatCard pattern:
  Background: #EAE6DE, border: 1px #D0C9BC
  Label: uppercase Inter 11px (label-track)
  Value: Cormorant italic 48px
  Delta: Inter 13px with ↑↓ arrows

2. AT-RISK STUDENTS PANEL (most important section):

Title: "At-Risk Students" (Cormorant italic 28px) + thin rule

Table (AG Grid Raycraft):
Columns:
  Student Name | Class | Risk Score (0-100) | Attendance Risk | 
  Academic Risk | Financial Risk | Behavioral Risk | Owner | Action Status

Risk Score column: colored badge
  0-30:  green chip "Low"
  31-60: yellow chip "Medium"  
  61-80: orange chip "High"
  81-100: red chip "Critical"

Each row expandable → shows AI recommended next steps:
  "Primary: {factor}. Recommended: {action}. Assigned to: {name}"

"Assign Intervention" button per row → assigns to a teacher/counsellor
"View Full Timeline" → navigates to student profile

3. DEPARTMENT PERFORMANCE HEATMAP:

Title: "Department Performance Heatmap" (Cormorant italic)

Recharts Heatmap (custom — use a grid of colored cells):
  Rows: departments / sections
  Columns: weeks
  Color scale: danger (#8B2F2F) → warning (#8B6914) → success (#3D6B4F)
  Cell value: attendance % or assignment completion %

Tab selector: Attendance | Assignment Completion | Test Scores

4. SUBJECT INTELLIGENCE PANEL:

"42% of students struggle with Linear Equations" — AI insight card
Shows: concept difficulty rankings per subject
Pass/fail projections by class
Resource allocation recommendations

5. TEACHER WORKLOAD MATRIX:

Table: Teacher | Classes/Week | Papers Graded | PTMs | Workload Index | Status
Workload Index badges: <90% optimal (green) | 90-110% slightly high (yellow) | >110% overloaded (red)
AI Alert card for overloaded teachers:
  "Ms. Sharma at 132% of dept average for 3 weeks.
   Recommend: Redistribute 2 sections OR assign teaching assistant"

6. AI AUDIT ANOMALIES:

List of AI-detected anomalies (last 7 days):
  Each anomaly: severity badge + description + detected at + "Investigate" button
  Severity: INFO / WARNING / CRITICAL (Raycraft status colors)

7. src/features/analytics/components/AttendanceHeatmap.tsx
   Color-coded grid of departments × weeks.
   Hover tooltip: dept name + week + exact %.

8. src/features/analytics/components/RiskMatrix.tsx
   Recharts ScatterChart:
   X: attendance %, Y: academic score %
   4 quadrants with background shading (very subtle, Raycraft warm tones)
   Each dot = student. Hover = name + class + risk score.
   Click dot → student profile drawer.

Apply Raycraft theme everywhere. All charts use RAYCRAFT_COLORS.
```

---

# FEATURE 8 — BEHAVIORAL INTELLIGENCE
## Incident classification, pattern recognition, 3-tier response

---

### BACKEND STEP 8.1 — Behavior Service
**Folder: `edai-backend/services/behavior`**

```
In edai-backend/services/behavior/:

Build the Behavioral Intelligence NestJS service.

ENTITIES:

BehavioralIncident:
  id (uuid), student_id, institution_id, class_id,
  reported_by (teacher_id), reported_at (timestamptz),
  incident_type (enum: DISRUPTION|DRESS_CODE|LATE_ARRIVAL|ASSIGNMENT_REFUSAL|
                        PHYSICAL|MISCONDUCT|SAFETY_VIOLATION|SUBSTANCE|OTHER),
  description (text), location (e.g. "Lab C", "Classroom 204"),
  time_of_day (timestamptz),
  severity (enum: LOW|MEDIUM|HIGH — AI computed),
  ai_classification_confidence (float),
  action_taken (text, nullable), status (enum: OPEN|MONITORING|ESCALATED|RESOLVED),
  parent_notified (boolean), counsellor_assigned (boolean),
  resolution_notes (text, nullable), created_at

IncidentPattern:
  id, student_id, institution_id, pattern_type 
  (enum: TEMPORAL|LOCATION|SUBJECT|PEER_GROUP),
  detected_at, confidence (float),
  description (text), ai_recommendation (text), created_at

AI INCIDENT CLASSIFICATION:
  On POST /behavior/incidents:
  1. Send incident description to ai-engine POST /llm/classify-incident:
     Input: { description, incidentType, studentHistory }
     Output: { severity: LOW|MEDIUM|HIGH, confidence, reasoning, recommendedActions }
  2. Save incident with AI severity
  3. Trigger response based on severity:

  LOW SEVERITY (Minor disruption, dress code, late arrival):
    - Student receives in-app nudge + counselling resource link
    - No parent notification unless repeated (same incident type 3rd time in 30 days)
    - Start 3-day monitoring period
    - Status: MONITORING

  MEDIUM SEVERITY (Repeated issues, classroom disruption, assignment refusal):
    - Send parent WhatsApp notification immediately
    - Add student profile remark
    - Teacher check-in conversation required within 24h
    - 7-day monitoring + counsellor flag if continues
    - Status: ESCALATED

  HIGH SEVERITY (Physical incident, serious misconduct, safety violation):
    - Immediate push notification to admin + counsellor
    - Auto-schedule mandatory PTM
    - AI voice call to parent within 1 hour
    - 30-day intervention plan activated
    - Status: ESCALATED (highest priority)

PATTERN RECOGNITION ENGINE (Bull cron, daily at 21:00):
  For each student with ≥3 incidents in last 30 days:
  
  Temporal patterns:
    Cluster incidents by hour of day → "67% of incidents occur 2-3 PM post-lunch"
    → Recommendation: "Possible fatigue-related behavior"
  
  Location patterns:
    Cluster by location → "80% occur in Lab C"
    → Recommendation: "Possible overcrowding issue — {actual_capacity} in {max_capacity}-capacity room"
  
  Subject-specific patterns:
    Correlate with academic performance → 
    "Behavioral spikes during Physics. Student's Physics score: 62% — academic frustration"
  
  Peer group patterns:
    Find common students across incidents → "Same 3-student group in 5/8 incidents"
    → Recommendation: "Seating change or group separation"
  
  Store as IncidentPattern records.
  Emit 'behavior.pattern.detected' Kafka event → admin dashboard alert.

ADD to ai-engine (Python):
  POST /llm/classify-incident
  Input: { description, incident_type, student_history (incident count, types) }
  Output: { severity, confidence, reasoning, recommended_actions: [] }
  Use Claude Sonnet with educational context system prompt.

ENDPOINTS:
  POST /behavior/incidents                    Log new incident (teacher)
  GET  /behavior/incidents/student/:id        Student's incident history
  GET  /behavior/incidents/class/:id          Class incident overview
  GET  /behavior/patterns/student/:id         AI-detected patterns for a student
  GET  /behavior/patterns/institution/:id     Institution-wide patterns + recommendations
  PUT  /behavior/incidents/:id/resolve        Mark resolved with notes
  GET  /behavior/dashboard                    Admin overview (counts, severity breakdown)
```

---

### FRONTEND STEP 8.2 — Behavioral Management (Web)
**Folder: `edai-frontend/apps/web/src/app/(dashboard)/behavior`**

```
Build the behavioral incident management interface (Raycraft theme).

1. src/app/(dashboard)/behavior/page.tsx

PageHeader: title="Behavioral Intelligence", subtitle="INCIDENT TRACKING & PATTERN ANALYSIS"

Stats row:
  - Total Incidents This Month | Low | Medium | High (color-coded)
  - Resolved | In Monitoring | Escalated

2. "Log New Incident" button (primary Raycraft) → LogIncidentDialog:
   - Student selector (search autocomplete)
   - Incident type (select with icons)
   - Description (textarea, min 30 chars)
   - Location (text input — e.g. "Lab C")
   - Date/time (datetime picker)
   - "AI will classify severity automatically" notice (italic Cormorant)
   Submit → POST /behavior/incidents
   Response shows: "AI classified as {SEVERITY} with {confidence}% confidence"
   Shows recommended actions in a colored card

3. Incidents Table (AG Grid Raycraft):
   Columns: Date | Student | Class | Type | Description (truncated) | 
            Severity (badge) | AI Confidence % | Status | Actions

4. src/features/behavior/components/PatternInsightsPanel.tsx
   AI Pattern Analysis section (below table):
   
   Students with ≥3 incidents:
     Each student card (RaycraftCard):
       Student name + incident count badge
       Detected patterns listed as chips:
         "2-3 PM Temporal Pattern" | "Lab C Location" | "Physics Correlation"
       AI recommendation in italic Cormorant:
         "Behavioral spikes during Physics lectures correlate with 62% score.
          Consider: academic support, seating review, counsellor session."
       Action buttons: "Schedule Counsellor" | "Notify Parent" | "Seating Review"

5. src/features/behavior/components/ThreeTierResponseCard.tsx
   Visual explainer of the 3-tier response system shown in the UI:
   LOW → MEDIUM → HIGH with icons, colors (RaycraftColors), and actions.
   Displayed in a help section below the log form.

6. Severity Badge colors (Raycraft palette):
   LOW:    successLight bg + success text
   MEDIUM: warningLight bg + warning text  
   HIGH:   dangerLight bg + danger text
```

---

## PART 4 — FOUNDATION SETUP

---

### STEP F-1 — Backend Foundation
**Folder: `edai-backend/`**

```
Set up the complete edai-backend repository foundation.

1. docker-compose.yml — add ALL required services:

version: "3.9"
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: edai
      POSTGRES_PASSWORD: edai_dev
      POSTGRES_DB: edai
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./scripts/init-databases.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    command: redis-server --appendonly yes

  redpanda:
    image: redpandadata/redpanda:v23.3.1
    command: redpanda start --overprovisioned --smp 1 --memory 1G
    ports: ["9092:9092", "8082:8082", "9644:9644"]

  keycloak:
    image: quay.io/keycloak/keycloak:24.0
    command: start-dev
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin_dev
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/keycloak
      KC_DB_USERNAME: edai
      KC_DB_PASSWORD: edai_dev
    ports: ["8080:8080"]
    depends_on: [postgres]

  clickhouse:
    image: clickhouse/clickhouse-server:23.8
    ports: ["8123:8123", "9000:9000"]

  mailhog:
    image: mailhog/mailhog
    ports: ["1025:1025", "8025:8025"]

  grafana:
    image: grafana/grafana:10.0.0
    ports: ["3100:3000"]

volumes: [pgdata, chdata, redisdata, grafanadata]

2. scripts/init-databases.sql:
   CREATE DATABASE identity_db;
   CREATE DATABASE attendance_db;
   CREATE DATABASE academics_db;
   CREATE DATABASE assignments_db;
   CREATE DATABASE communications_db;
   CREATE DATABASE finance_db;
   CREATE DATABASE behavior_db;
   CREATE DATABASE analytics_db;
   CREATE DATABASE chatbot_db;
   CREATE DATABASE keycloak;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS vector;

3. Root package.json (NestJS services workspace):
   {
     "name": "edai-backend",
     "private": true,
     "workspaces": ["services/*"],
     "scripts": {
       "dev:all": "concurrently \"cd services/identity && npm run start:dev\" ...",
       "build:all": "turbo run build",
       "test:all": "turbo run test",
       "migrate:all": "scripts/run-all-migrations.sh"
     },
     "devDependencies": {
       "turbo": "latest",
       "concurrently": "latest"
     }
   }

4. shared/kafka/schemas/ — create these Avro event files:
   - attendance.absent.marked.avsc
   - voice.call.completed.avsc
   - assignments.missed.avsc
   - academics.performance.drop.avsc
   - finance.fee.overdue.avsc
   - finance.fee.paid.avsc
   - behavior.incident.logged.avsc
   - behavior.pattern.detected.avsc
   - escalation.triggered.avsc

5. shared/types/index.ts — shared TypeScript interfaces:
   All entity interfaces + event payload interfaces used across services.

6. .github/workflows/ci.yml — GitHub Actions:
   On PR to main: lint, typecheck, test (parallel matrix per service)
   On merge to main: Docker build + push to ECR + deploy to staging
```

---

### STEP F-2 — Frontend Foundation
**Folder: `edai-frontend/`**

```
Set up the complete edai-frontend repository with Raycraft theme.

1. Initialize monorepo with pnpm workspaces:
   pnpm init
   Create pnpm-workspace.yaml: packages: ['apps/*', 'packages/*']

2. apps/web — Next.js 14 setup:
   pnpm create next-app@latest apps/web --typescript --tailwind --app --src-dir
   
   Install dependencies:
   pnpm add --filter web next-auth@beta @auth/core
   pnpm add --filter web @tanstack/react-query zustand
   pnpm add --filter web ag-grid-react ag-grid-community
   pnpm add --filter web recharts
   pnpm add --filter web lucide-react
   pnpm add --filter web class-variance-authority clsx tailwind-merge
   pnpm add --filter web tailwindcss-animate
   pnpm dlx --filter web shadcn-ui@latest init

3. Apply complete Raycraft theme to apps/web:
   - Replace tailwind.config.ts with full Raycraft config (from Theme Guide)
   - Replace globals.css with Raycraft CSS variables + Cormorant Garamond + Inter fonts
   - Update layout.tsx with Google Font imports (next/font/google)
   - Override all shadcn/ui components with Raycraft styles
   - Create src/styles/ag-grid-raycraft.css
   - Create src/lib/chart-theme.ts with RAYCRAFT_COLORS
   - Create all shared components: PageHeader, Sidebar, TopBar, RaycraftGrid,
     RaycraftTooltip, RaycraftStatCard, RaycraftSkeleton, RaycraftSpinner

4. apps/mobile — Flutter setup:
   flutter create apps/mobile --org in.raycraft.edai --template=app
   
   Add to pubspec.yaml:
     flutter_riverpod: ^2.5.0
     riverpod_annotation: ^2.3.0
     go_router: ^13.0.0
     dio: ^5.4.0
     flutter_secure_storage: ^9.0.0
     local_auth: ^2.1.0
     google_fonts: ^6.1.0
     isar: ^3.1.0
     isar_flutter_libs: ^3.1.0
     easy_localization: ^3.0.0
     table_calendar: ^3.0.9
     razorpay_flutter: ^1.3.6
     firebase_core: ^2.24.0
     firebase_messaging: ^14.7.9
     flutter_local_notifications: ^16.3.0
     lottie: ^3.0.0
   
   Apply Raycraft theme to Flutter:
   - Create lib/core/theme/raycraft_colors.dart
   - Create lib/core/theme/raycraft_text_styles.dart
   - Create lib/core/theme/raycraft_theme.dart (full ThemeData)
   - Apply in lib/main.dart: MaterialApp(theme: raycraftTheme())
   - Create all shared widgets:
     RaycraftScaffold, RaycraftCard, RaycraftLabel, RaycraftStatCard,
     RaycraftSectionHeader, RaycraftStatusBadge, RaycraftDivider,
     RaycraftEmptyState, RaycraftListTile

5. packages/shared-types — TypeScript types:
   pnpm init in packages/shared-types/
   Create index.ts with all shared interfaces from backend entities.

6. Set up translations for mobile (easy_localization):
   Create assets/translations/:
   - en.json (English — all UI strings)
   - kn.json (Kannada — ಕನ್ನಡ)
   - hi.json (Hindi — हिंदी)
   - ta.json (Tamil — தமிழ்)
   - te.json (Telugu — తెలుగు)
   - ml.json (Malayalam — മലയാളം)
```

---

## PART 5 — ENVIRONMENT VARIABLES

```bash
# ── All NestJS services (common) ──────────────────────────────
NODE_ENV=development
PORT=3001                        # Increment per service
DATABASE_URL=postgresql://edai:edai_dev@localhost:5432/{service}_db
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
JWT_SECRET=your-256-bit-secret
INSTITUTION_ID=rvitm             # Override per deployment

# ── Identity service ──────────────────────────────────────────
KEYCLOAK_BASE_URL=http://localhost:8080
KEYCLOAK_REALM=edai
KEYCLOAK_CLIENT_ID=edai-backend
KEYCLOAK_CLIENT_SECRET=your-secret
AWS_KMS_KEY_ARN=arn:aws:kms:ap-south-1:...

# ── Voice service (Go) ────────────────────────────────────────
EXOTEL_API_KEY=your-key
EXOTEL_API_TOKEN=your-token
EXOTEL_SID=your-sid
EXOTEL_VIRTUAL_NUMBER=+9100000000
AI_ENGINE_URL=http://ai-engine:8000
AWS_S3_BUCKET=edai-recordings
AWS_REGION=ap-south-1

# ── AI Engine (Python) ────────────────────────────────────────
SARVAM_API_KEY=your-key           # Kannada/Hindi ASR+TTS
AI4BHARAT_API_KEY=your-key        # Tamil/Telugu/Malayalam
BHASHINI_API_KEY=your-key         # Translation
ANTHROPIC_API_KEY=your-key        # Claude Sonnet for LLM
LITELLM_BASE_URL=http://litellm:4000
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=your-key           # Whisper fallback

# ── Communications service ────────────────────────────────────
META_WHATSAPP_ACCESS_TOKEN=your-token
META_WHATSAPP_PHONE_NUMBER_ID=your-id
META_WHATSAPP_BUSINESS_ACCOUNT_ID=your-id
FIREBASE_PROJECT_ID=edai-prod
FIREBASE_PRIVATE_KEY=your-key
SENDGRID_API_KEY=your-key
KARIX_API_KEY=your-key

# ── Finance service ───────────────────────────────────────────
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret

# ── Web Frontend (.env.local) ─────────────────────────────────
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret
KEYCLOAK_BASE_URL=http://localhost:8080
KEYCLOAK_REALM=edai
KEYCLOAK_CLIENT_ID=edai-web
KEYCLOAK_CLIENT_SECRET=your-secret
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001

# ── Mobile Frontend ───────────────────────────────────────────
API_BASE_URL=http://10.0.2.2:3001
KEYCLOAK_BASE_URL=http://10.0.2.2:8080
RAZORPAY_KEY_ID=rzp_test_xxxxx
```

---

## PART 6 — QUICK REFERENCE

### Feature → Repo Mapping

| Feature | Backend Service | Web Page | Mobile Screen |
|---------|----------------|----------|---------------|
| Smart Attendance | `services/attendance` + `services/voice` + `services/ai-engine` | `/attendance` | `features/attendance` + `features/voice_calls` |
| Assignment Intelligence | `services/assignments` + `services/academics` | `/assignments` | `features/assignments` |
| Teacher Productivity | `services/academics` (reports) | `/marks` | — |
| Parent Engagement | `services/communications` (weekly scheduler) | `/voice` | `features/timeline` |
| AI Chatbot | `services/chatbot` + `services/ai-engine` | `/chatbot` | `features/chatbot` |
| Financial Intelligence | `services/finance` | `/finance` | `features/fees` |
| Admin Command Center | `services/analytics` | `/` (dashboard) | — |
| Behavioral Intelligence | `services/behavior` | `/behavior` | — |

### Kafka Event Bus

| Event Topic | Published by | Consumed by |
|-------------|-------------|-------------|
| `attendance.absent.marked` | attendance | voice, communications |
| `voice.call.completed` | voice | attendance, communications, analytics |
| `assignments.missed` | assignments | communications, voice |
| `academics.performance.drop` | academics | communications, chatbot |
| `finance.fee.overdue` | finance | communications, voice |
| `finance.fee.paid` | finance | communications, analytics |
| `behavior.incident.logged` | behavior | communications, analytics |
| `behavior.pattern.detected` | behavior | analytics |
| `escalation.triggered` | attendance | voice, communications, analytics |

### Voice Call Types

| Call Type | Trigger | Language | Script File |
|-----------|---------|----------|-------------|
| `ABSENT_CALL` | Attendance marked absent | Parent's preferred lang | `absent_call.yaml` |
| `ASSIGNMENT_MISS` | 24h after deadline, not submitted | Parent's preferred lang | `assignment_miss.yaml` |
| `FEE_REMINDER` | Day +3 overdue | Parent's preferred lang | `fee_reminder.yaml` |
| `WEEKLY_UPDATE` | Every Friday 6 PM | Parent's preferred lang | `weekly_update.yaml` |
| `PERFORMANCE_DROP` | Score drops >15% | Parent's preferred lang | `performance_drop.yaml` |
| `BEHAVIORAL_HIGH` | High severity incident | Parent's preferred lang | `behavioral_alert.yaml` |

---

*EdAI Complete Build Guide — v1.0 · 18 April 2026*
*Built by Raycraft Technologies · Abhijat Dakshesh*
*Endorsed by RVITM Principal · Rashtreeya Sikshana Samithi Trust*
