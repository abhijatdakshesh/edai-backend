# RV Trust AI ERP — Backend Monorepo

AI-native engagement ERP for 25,000+ students across RVCE, RVITM and sister institutions.

## Repository Structure

```
rv-trust-backend/
├── services/
│   ├── identity/          # NestJS — SSO, RBAC, parent-student linkage
│   ├── attendance/        # NestJS — biometric ingestion, early warning
│   ├── academics/         # NestJS — marks, assessments, early warning
│   ├── fees/              # NestJS — payments, EMI, receipts, SAP write-back
│   ├── voice/             # Go    — SIP/RTP bridge, telephony, ASR streaming
│   ├── ai-platform/       # Python FastAPI — ASR, TTS, NMT, LLM orchestration
│   ├── comms/             # NestJS — WhatsApp, SMS, push, email, timeline
│   ├── mentorship/        # NestJS — mentor mapping, counselling, screening
│   ├── placements/        # NestJS — CRM, drive scheduling, alumni
│   ├── grievance/         # NestJS — grievance lifecycle, feedback, sentiment
│   ├── compliance/        # NestJS — NAAC/NBA/UGC auto-reports, evidence vault
│   ├── analytics/         # NestJS — KPI dashboards, accreditation metrics
│   └── sap-bridge/        # NestJS — OData/IDoc/BAPI SAP SLCM integration
├── shared/
│   ├── kafka/schemas/     # Avro event schemas (shared across services)
│   ├── types/             # Shared TypeScript interfaces
│   └── dto/               # Shared DTOs
├── infra/
│   ├── terraform/         # AWS EKS, RDS, MSK, S3, KMS
│   ├── k8s/               # Kubernetes manifests (base + overlays)
│   └── helm/              # Helm charts per service
├── scripts/               # DB migrations, seed scripts, dev utilities
└── .github/workflows/     # CI/CD pipelines
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| ERP Services | TypeScript + NestJS + Node 20 |
| AI Services | Python 3.12 + FastAPI |
| Voice/Telephony | Go 1.22 |
| Database | PostgreSQL 16 + pgvector |
| Analytics DB | ClickHouse |
| Cache | Redis 7 |
| Message Bus | Apache Kafka (AWS MSK) |
| Storage | Amazon S3 (ap-south-1) |
| Container | Docker + Amazon EKS |
| IaC | Terraform + Argo CD |

## Prerequisites

- Node.js 20+
- Python 3.12+
- Go 1.22+
- Docker + Docker Compose
- AWS CLI configured

## Deploy identity API on Vercel

The NestJS **identity** service can run as a single serverless function (cold starts apply; WebSockets are not suitable for this mode).

1. Import [this repository](https://github.com/abhijatdakshesh/EdAI-Backend) in [Vercel](https://vercel.com/new).
2. Set **Root Directory** to `services/identity`.
3. Framework preset: **Other** (leave default or pick “Other”; `vercel.json` supplies `buildCommand`).
4. Add environment variable **`JWT_SECRET`** (use a long random string; must match what you expect for token verification in production).
5. Optional: **`CORS_ORIGINS`** — comma-separated list of allowed browser origins (e.g. `https://your-app.vercel.app,http://localhost:3000`). If unset, localhost and `10.x.x.x` patterns are allowed for dev.
6. Deploy. API base URL is `https://<project>.vercel.app/api` (e.g. `POST .../api/auth/login`). Swagger UI: `https://<project>.vercel.app/docs`.

Point the frontend `NEXT_PUBLIC_API_BASE_URL` (or equivalent) at this URL.

## Quick Start (Local Dev)

```bash
# 1. Start infrastructure
docker-compose up -d

# 2. Run migrations
npm run migrate:all

# 3. Start all services (development)
npm run dev:all

# Or start a single service
cd services/identity && npm run start:dev
```

## Environment Variables

Copy `.env.example` to `.env` in each service directory. See each service's README for required variables.

## Kafka Event Schemas

All events follow the Avro schema definitions in `shared/kafka/schemas/`. Key events:
- `attendance.AbsenteeDetected`
- `voice.CallCompleted`
- `academics.AtRiskFlagged`
- `fees.PaymentReceived`
- `timeline.EventCreated`

---
*Confidential — RV Trust engineering team*
