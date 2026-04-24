# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

EdAI Backend — microservices ERP for Indian higher education (RVCE/RVITM pilot). 19 services across NestJS (TypeScript), FastAPI (Python), and Go. Event-driven via Kafka. Multi-tenant by `INSTITUTION_ID`.

---

## Local Dev Setup

```bash
docker-compose up -d        # Postgres, Redis, Redpanda, Keycloak, ClickHouse, Grafana, MailHog
npm install
npm run migrate:all
npm run dev:all             # Starts identity (3001), attendance (3002), academics (3003), fees, comms, analytics, placements, sap-bridge, assignments
```

**Single service:**
```bash
cd services/<name> && npm run start:dev
```

**Python AI services:**
```bash
cd services/ai-engine && pip install -r requirements.txt && python main.py
```

**Go voice service:**
```bash
cd services/voice && go build ./... && go run .
```

---

## Commands

| Task | Command |
|------|---------|
| Build all | `npm run build:all` |
| Lint all | `npm run lint:all` |
| Test all | `npm run test:all` |
| Single NestJS test | `cd services/<name> && npm test` |
| Single NestJS test (watch) | `cd services/<name> && npm test -- --watch` |
| Python lint | `cd services/ai-engine && ruff check src/ && mypy src/` |
| Python test | `cd services/ai-engine && pytest tests/ -v` |
| Go test | `cd services/voice && go test ./... -v` |
| Run migrations | `npm run migrate:all` |

---

## Architecture

### Service Map

| Service | Port | DB | Purpose |
|---------|------|----|---------|
| identity | 3001 | identity_db | Auth, RBAC, user/parent/student mgmt, Keycloak OIDC |
| attendance | 3002 | attendance_db | Biometric ingestion, early warning |
| academics | 3003 | academics_db | Marks, assessments, performance alerts |
| placements | 3007 | placements_db | CRM, drive scheduling, alumni |
| analytics | 3008 | analytics_db + ClickHouse | KPI dashboards, accreditation metrics |
| sap-bridge | 3011 | sap_bridge_db | SAP SLCM integration (OData/IDoc/BAPI) |
| communications | 3010 | communications_db | WhatsApp, SMS, push, email, timeline |
| finance | 3013 | finance_db | Fees, payments, EMI, SAP write-back |
| behavior | 3014 | behavior_db | Incident logging → ai-engine |
| chatbot | 3015 | chatbot_db | Conversational AI → ai-engine |
| ai-engine | 8001 | — | FastAPI: ASR, TTS, NMT, LLM (litellm + anthropic + openai) |
| voice | — | — | Go: SIP/RTP bridge, telephony |

All NestJS services share the same module pattern — see `services/identity/src/app.module.ts` as reference.

### Event Flow (Kafka via Avro)

Schemas live in `shared/kafka/schemas/*.avsc`. Key topics:
- `attendance.AbsenteeDetected` → communications (parent WhatsApp/voice call)
- `academics.performance.drop` → marks student at risk
- `behavior.incident.logged` → behavior tracking
- `finance.fee.paid` / `finance.fee.overdue` → payment workflows
- `voice.call.completed` → voice interaction audit

Use `shared/kafka/registry.ts` (`validateEvent`) before producing any event.

### Shared Types

`shared/types/index.ts` — `UserRole`, `Language`, `JwtPayload`, `InstitutionId`. Import from here, never redefine.

### Auth Pattern

JWT issued by identity service. All services validate via `@nestjs/jwt` + `@nestjs/passport`. Roles: `STUDENT`, `PARENT`, `FACULTY`, `HOD`, `DEAN`, `PRINCIPAL`, `TRUSTEE`, `COUNSELLOR`, `ADMIN`.

### Database

Each service owns one Postgres 16 DB (pgvector enabled on identity, academics, behavior, chatbot). ClickHouse for analytics. `scripts/init-databases.sql` creates all 24 DBs. Migration pattern: `services/*/src/migrations/run.ts`.

---

## Key Environment Variables

```bash
DATABASE_URL=postgresql://edai:edai_dev@localhost:5432/<service>_db
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
JWT_SECRET=<must match across all services>
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
INSTITUTION_ID=rvce          # Multi-tenant identifier
AI_ENGINE_URL=http://localhost:8001   # behavior + chatbot only
```

---

## Local Service URLs

| Service | URL |
|---------|-----|
| Any service Swagger | `http://localhost:<port>/docs` |
| Keycloak | `http://localhost:8080` |
| Grafana | `http://localhost:3100` (admin/admin_dev) |
| Prometheus | `http://localhost:9090` |
| ClickHouse | `http://localhost:8123` |
| MailHog | `http://localhost:8025` |

---

## Expert Panel

Agents at `~/.claude/agents/` — active globally. Pre-push hook triggers all 6 automatically.

| Invoke | Role | Blocks push |
|--------|------|-------------|
| `/daniel` | Code reviewer | BLOCK verdict |
| `/dev` | FAANG architect | REDESIGN REQUIRED |
| `/qa` (Priya) | ERP QA, 100% coverage | FIX TESTS FIRST |
| `/kaveri` | College Chairman | Advisory |
| `/sujit` | McKinsey ERP | Advisory |
| `/anand` | VC investor | Advisory |

Wire hooks: `git config core.hooksPath .githooks`

---

## Compliance

- Student PII must never appear in logs
- DPDP Act 2023: data residency in `ap-south-1`, consent required before WhatsApp/SMS
- NAAC report formats must exactly match official templates (compliance service owns this)
- VTU marks rounding rules are specific — do not generalise
