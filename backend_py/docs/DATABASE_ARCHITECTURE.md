# VitaCare AI — Database Architecture, Connection & Security Guide

This document describes the production database connection management, environment configuration, Row-Level Security (RLS), least-privilege role separation, and retention policies.

---

## 1. Connection Management & Engine Pooling

The application connects to PostgreSQL using SQLAlchemy 2.0 with a high-throughput connection pool:

```python
# app/core/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_size=20,            # Steady-state open connections
    max_overflow=40,         # Maximum surge connections during traffic spikes
    pool_timeout=30,         # Max seconds to wait before raising TimeoutError
    pool_recycle=1800,       # Recycle idle connections every 30 minutes to prevent stale socket drops
    pool_pre_ping=True,      # Tests liveness (SELECT 1) before handing connection to worker
    echo=False               # Never log raw SQL statements containing PHI in production logs
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
```

### Environment Configuration (`.env`)

```ini
# Production PostgreSQL Connection URI
DATABASE_URL=postgresql+psycopg2://vitacare_app:SuperSecureAppPassword2026!@postgres-primary.internal:5432/vitacare_prod?sslmode=verify-full&sslrootcert=/etc/ssl/certs/rds-combined-ca-bundle.pem

# Connection Pool Tuning
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=40
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=1800

# Security Context & Key Management
DATA_ENCRYPTION_KEY=base64:32ByteSecretKeyForFieldLevelEncryption
OBJECT_STORAGE_BUCKET=vitacare-medical-vault-prod
```

---

## 2. PostgreSQL Row-Level Security (RLS)

In addition to application-level tenant isolation in the repository layer, PostgreSQL Row-Level Security (RLS) provides a defense-in-depth security barrier preventing cross-patient data leaks even if an application bug or SQL injection vulnerability occurs.

### Activation on Clinical Tables
```sql
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_intake_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
```

### Transaction-Scoped Session Context Policy
At the beginning of each HTTP request transaction, the API sets the authenticated patient's UUID:
```sql
-- Executed inside transaction before running queries:
SET LOCAL app.current_user_id = '097b0603-ecf6-43c2-a80a-36affd188f4d';
```

RLS policies enforce access:
```sql
CREATE POLICY patient_isolation_health_records ON health_records
    FOR ALL
    USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

CREATE POLICY patient_isolation_documents ON medical_documents
    FOR ALL
    USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

CREATE POLICY patient_isolation_chat ON chat_conversations
    FOR ALL
    USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
```

---

## 3. Least-Privilege Database Roles

Never run the application under `postgres` or a database superuser. The database is partitioned into four distinct roles:

```sql
-- 1. Application Runtime Role (DML Only)
CREATE ROLE vitacare_app WITH LOGIN PASSWORD 'SecureAppPass2026!' NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE;
GRANT CONNECT ON DATABASE vitacare_prod TO vitacare_app;
GRANT USAGE ON SCHEMA public TO vitacare_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vitacare_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vitacare_app;

-- 2. Schema Migration Role (DDL Only - used exclusively by CI/CD during alembic upgrade)
CREATE ROLE vitacare_migrator WITH LOGIN PASSWORD 'SecureMigratorPass2026!' NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT ALL PRIVILEGES ON SCHEMA public TO vitacare_migrator;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO vitacare_migrator;

-- 3. Read-Only Analytics & De-Identified Research Role
CREATE ROLE vitacare_analytics WITH LOGIN PASSWORD 'AnalyticsPass2026!' NOSUPERUSER NOINHERIT;
GRANT CONNECT ON DATABASE vitacare_prod TO vitacare_analytics;
GRANT USAGE ON SCHEMA public TO vitacare_analytics;
-- Restricted to approved clinical knowledge and anonymized views only:
GRANT SELECT ON medical_knowledge_sources, medical_knowledge_chunks TO vitacare_analytics;

-- 4. Backup & Disaster Recovery Role
CREATE ROLE vitacare_backup WITH LOGIN PASSWORD 'BackupWorkerPass2026!' NOSUPERUSER NOINHERIT;
GRANT CONNECT ON DATABASE vitacare_prod TO vitacare_backup;
GRANT USAGE ON SCHEMA public TO vitacare_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO vitacare_backup;
```

---

## 4. Data Retention & Erasure Policies

| Data Domain | Storage Location | Retention Policy | Purge Mechanism |
| :--- | :--- | :--- | :--- |
| **Authentication Sessions** | `authentication_sessions` | 30 days post-expiry | Automated nightly cron deletes where `expires_at < NOW() - INTERVAL '30 days'` |
| **AI Chat History** | `chat_conversations`, `chat_messages` | Configurable (Default: 90 days) | User-initiated deletion or scheduled hard purge via `enforce_retention_policy()` |
| **Medical Documents** | Private Object Storage + `medical_documents` | 7 years statutory medical record retention | Soft deletion (`deleted_at`); cryptographic erasure upon verified statutory deletion request |
| **Biomarkers & Vitals** | `health_records` | Patient account lifetime | Exported via GDPR ZIP and hard purged upon account closure request |
| **Audit Compliance Logs** | `audit_events` | 6 years (HIPAA standard) | Immutable append-only log; actor user ID set to NULL if account is erased |
