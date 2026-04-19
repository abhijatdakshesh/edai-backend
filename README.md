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
