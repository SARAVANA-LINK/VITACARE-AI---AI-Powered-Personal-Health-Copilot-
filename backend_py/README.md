# VitaCare AI — Production FastAPI Healthcare Backend

A modern, production-grade, asynchronous AI healthcare backend built with **Python 3.13**, **FastAPI**, **PostgreSQL**, **SQLAlchemy ORM**, **Alembic Migrations**, and **Pydantic v2**, backed by a **7-Step Clinical Safety Pipeline**.

---

## 🌟 Core Architecture & Technology Stack

| Component | Technology | Description |
|---|---|---|
| **Web Framework** | **FastAPI** (v0.115+) | Asynchronous, OpenAPI 3.1 spec, automated interactive Swagger UI at `/docs`. |
| **Relational Database** | **PostgreSQL** + **SQLAlchemy 2.0** | Relational ORM with connection pooling, declarative models, and SQLite dev fallback. |
| **Migrations** | **Alembic** | Full schema version tracking, autogeneration, and deployment scripts. |
| **Data Validation** | **Pydantic v2** | Strict input/output schemas with type coercion and clinical validation. |
| **Clinical Safety Pipeline** | Custom Healthcare Engine | 7-step pre-inference screening: emergency triage, red flag detection, isolated RAG. |
| **AI Integration** | Configurable Provider | Supports Google Gemini 1.5, OpenAI, Anthropic, and local RAG engine. |
| **Auth & Security** | JWT (HS256) + Bcrypt + RBAC | Access & refresh tokens, rate limiting, and role-based access control. |
| **Phone OTP** | Pluggable SMS Service | TTL (10m), max attempts (5), 60s cooldowns, mock & Twilio/Fast2SMS drivers. |
| **Document Storage** | S3 / Local Secure Filesystem | Multi-part uploads, MIME and size (15MB) validation, unguessable UUID filenames. |
| **Containerization** | Docker + Docker Compose | Multi-stage image, unprivileged user (`vitacare`), PostgreSQL & Redis services. |

---

## 🛡️ 7-Step Healthcare Safety Pipeline

Every AI interaction traverses a strict clinical boundary:
1. **Request & Caller Authentication**: Validates JWT session and active user permissions.
2. **Acute Red-Flag Emergency Screening**: Detects emergency indicators (FAST stroke signs, chest pain, dyspnea, coughing blood, anaphylaxis). Automatically triggers an immediate emergency escalation response directing the user to **108 / 112 / 911**.
3. **Isolated Patient Context Retrieval (RAG)**: Retrieves only verified patient records (allergies, chronic conditions, active prescriptions) without cross-user leakage.
4. **Guardrailed Inference**: Injects medical system prompts instructing the AI never to diagnose, never to modify prescribed dosages, and never to guarantee a symptom is harmless.
5. **Post-Inference Sanitation**: Regex output filter replacing diagnostic assertions with educational discussions.
6. **Structured Clinical Formatting**: Formats responses into concise summaries, expandable clinical breakdowns, questions for the doctor, and safe next steps.
7. **Operational Audit Trail**: Logs operational telemetry without recording sensitive PHI.

---

## 🚀 Getting Started

### 1. Local Environment Setup

```bash
# Navigate to backend directory
cd backend_py

# Activate Python virtual environment
.venv\Scripts\activate   # On Windows
source .venv/bin/activate # On Linux/macOS

# Install dependencies (if not already installed)
pip install -r requirements.txt
```

### 2. Database Migrations (Alembic)

```bash
# Run latest migrations
alembic upgrade head
```

### 3. Run FastAPI Development Server

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- **Interactive Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Documentation**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

## 🧪 Automated Test Suite

Run the full pytest suite (covering authentication, OTP, AI safety, cross-user isolation, and GDPR erasure):

```bash
python -m pytest -v
```

All 11 unit and integration test suites pass with 100% success.

---

## 🐳 Docker Deployment

Deploy the complete multi-container stack (FastAPI + PostgreSQL 16 + Redis 7):

```bash
docker compose up -d --build
```

---

## 📋 Versioned REST API Index (`/api/v1/*`)

| Endpoint Prefix | Description |
|---|---|
| `/api/v1/auth/*` | Registration, password login, phone OTP send & verify, demo login, session info. |
| `/api/v1/users/*` | Profile CRUD, emergency contacts, authorized healthcare proxies (guardians). |
| `/api/v1/consents/*` | Privacy policy and data processing consent directives. |
| `/api/v1/chat/*` | Multi-turn AI health threads, clinical messages, multilingual RAG inference. |
| `/api/v1/documents/*` | Upload prescriptions/labs, OCR draft review, verification workflows. |
| `/api/v1/medications/*` | Medication schedules, daily intake reminders, taken/skipped/missed logging. |
| `/api/v1/health-records/*` | Vitals logging (BP, Glucose, SpO2, HbA1c), longitudinal biomarker trends. |
| `/api/v1/appointments/*` | Consultation bookings, doctor specialty filters, rescheduling, cancellations. |
| `/api/v1/hospitals/*` | 24/7 trauma centers, emergency hotlines (108, 112), distance filtering. |
| `/api/v1/symptoms/*` | Symptom assessment, urgency categorization, doctor discussion questions. |
| `/api/v1/wellness/*` | Daily water intake logging, BMI calculation, activity and sleep metrics. |
| `/api/v1/privacy/*` | GDPR complete structured JSON health record export and Right-to-be-Forgotten erasure. |

*(Note: Dual-mounting is active so existing frontend routes under `/api/*` operate seamlessly without configuration changes).*
