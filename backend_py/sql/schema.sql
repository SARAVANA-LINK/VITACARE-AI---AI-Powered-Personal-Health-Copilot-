-- ==============================================================================
-- VitaCare AI Health Platform — PostgreSQL Master Database DDL Schema
-- Production-Ready, HIPAA/GDPR-Compliant, Normalized Architecture
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. USERS & IDENTITY
-- ==============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(30) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'guardian', 'clinician', 'admin')),
    account_status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'pending_verification', 'suspended', 'deleted')),
    phone_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_phone ON users(phone_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(account_status);

-- ==============================================================================
-- 2. USER PROFILES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(255) NOT NULL,
    date_of_birth DATE,
    gender VARCHAR(50) DEFAULT 'Unspecified' CHECK (gender IN ('Male', 'Female', 'Non-Binary', 'Other', 'Unspecified')),
    blood_group VARCHAR(10) DEFAULT 'A+' CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    profile_photo_reference VARCHAR(500),
    preferred_language VARCHAR(10) NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'ta', 'hi', 'te', 'ml', 'kn')),
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    emergency_contact_reference VARCHAR(255),
    allergies_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    chronic_conditions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    current_medications_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    height_cm NUMERIC(5, 2) CHECK (height_cm IS NULL OR (height_cm > 30 AND height_cm < 280)),
    weight_kg NUMERIC(5, 2) CHECK (weight_kg IS NULL OR (weight_kg > 1 AND weight_kg < 400)),
    primary_physician VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);

-- ==============================================================================
-- 3. AUTHENTICATION SESSIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS authentication_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_or_token_hash VARCHAR(64) UNIQUE NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    device_metadata JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45)
);

CREATE INDEX idx_auth_sessions_user_id ON authentication_sessions(user_id);
CREATE INDEX idx_auth_sessions_hash ON authentication_sessions(session_or_token_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_auth_sessions_expiry ON authentication_sessions(expires_at);

-- ==============================================================================
-- 4. PRIVACY CONSENTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS privacy_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type VARCHAR(100) NOT NULL CHECK (consent_type IN ('account_terms', 'ai_processing', 'guardian_sharing', 'emergency_alerts', 'marketing', 'teleconsult')),
    policy_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    granted BOOLEAN NOT NULL DEFAULT TRUE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    withdrawn_at TIMESTAMPTZ,
    purpose_and_scope TEXT NOT NULL,
    CONSTRAINT uq_user_consent_version UNIQUE (user_id, consent_type, policy_version)
);

CREATE INDEX idx_privacy_consents_user ON privacy_consents(user_id, consent_type);

-- ==============================================================================
-- 5. CHAT CONVERSATIONS & MESSAGES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'Health Consultation',
    language VARCHAR(10) NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'ta', 'hi', 'te')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_chat_conversations_user ON chat_conversations(user_id, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('user', 'assistant', 'system')),
    message_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    model_identifier VARCHAR(100),
    response_metadata JSONB DEFAULT '{}'::jsonb,
    safety_status VARCHAR(30) NOT NULL DEFAULT 'safe' CHECK (safety_status IN ('safe', 'escalated_emergency', 'warning', 'flagged'))
);

CREATE INDEX idx_chat_messages_conv_created ON chat_messages(conversation_id, created_at ASC);

-- ==============================================================================
-- 6. MEDICAL DOCUMENTS & OCR EXTRACTIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS medical_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('prescription', 'lab_report', 'discharge_summary', 'imaging', 'other')),
    original_filename VARCHAR(255) NOT NULL,
    private_storage_key VARCHAR(500) UNIQUE NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL CHECK (file_size >= 0),
    checksum VARCHAR(64) NOT NULL,
    upload_status VARCHAR(30) NOT NULL DEFAULT 'uploaded' CHECK (upload_status IN ('pending', 'uploaded', 'failed')),
    processing_status VARCHAR(30) NOT NULL DEFAULT 'completed' CHECK (processing_status IN ('unprocessed', 'queued', 'processing', 'completed', 'failed')),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_medical_docs_user ON medical_documents(user_id, document_type, uploaded_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS document_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES medical_documents(id) ON DELETE CASCADE,
    extraction_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    extracted_data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    extraction_confidence NUMERIC(4, 3) CHECK (extraction_confidence IS NULL OR (extraction_confidence >= 0.0 AND extraction_confidence <= 1.0)),
    review_status VARCHAR(30) NOT NULL DEFAULT 'unverified' CHECK (review_status IN ('unverified', 'partially_verified', 'verified', 'rejected')),
    user_confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doc_extractions_doc ON document_extractions(document_id, created_at DESC);

-- ==============================================================================
-- 7. HEALTH RECORDS & BIOMARKERS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS health_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    record_type VARCHAR(50) NOT NULL CHECK (record_type IN ('vital_sign', 'lab_result', 'allergy', 'condition', 'immunization', 'history')),
    biomarker_name VARCHAR(100) NOT NULL,
    record_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    numeric_value NUMERIC(10, 3),
    string_value VARCHAR(255),
    structured_value JSONB,
    unit VARCHAR(50),
    status VARCHAR(30) NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'elevated', 'low', 'critical', 'abnormal')),
    source_type VARCHAR(50) NOT NULL DEFAULT 'manual_entry' CHECK (source_type IN ('manual_entry', 'ocr_extraction', 'device_sync', 'clinical_import')),
    source_document_id UUID REFERENCES medical_documents(id) ON DELETE SET NULL,
    user_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_health_records_user_type_date ON health_records(user_id, record_type, biomarker_name, record_date DESC);

-- ==============================================================================
-- 8. MEDICATIONS & REMINDER SCHEDULES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    medication_name VARCHAR(255) NOT NULL,
    strength VARCHAR(100),
    dosage_instructions TEXT NOT NULL,
    source_document_id UUID REFERENCES medical_documents(id) ON DELETE SET NULL,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified_by_user', 'verified_by_pharmacist')),
    start_date DATE,
    end_date DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'discontinued')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_medication_date_range CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_medications_user_status ON medications(user_id, status);

CREATE TABLE IF NOT EXISTS medication_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    schedule_definition JSONB NOT NULL DEFAULT '{"frequency": "once_daily", "times_of_day": ["08:00 AM"]}'::jsonb,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_at TIMESTAMPTZ,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_schedule_dates CHECK (end_at IS NULL OR end_at >= start_at)
);

CREATE INDEX idx_med_schedules_active ON medication_schedules(medication_id, active);

CREATE TABLE IF NOT EXISTS medication_intake_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES medication_schedules(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('taken', 'skipped', 'missed', 'pending')),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_note VARCHAR(500),
    CONSTRAINT uq_med_intake_occurrence UNIQUE (medication_id, scheduled_at)
);

CREATE INDEX idx_intake_logs_med_date ON medication_intake_logs(medication_id, scheduled_at DESC);

-- ==============================================================================
-- 9. APPOINTMENTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    clinician_or_facility_reference VARCHAR(255),
    appointment_title VARCHAR(255) NOT NULL,
    specialty VARCHAR(100) NOT NULL DEFAULT 'General Medicine',
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    status VARCHAR(30) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_appt_duration CHECK (scheduled_end IS NULL OR scheduled_end >= scheduled_start)
);

CREATE INDEX idx_appointments_user_time ON appointments(user_id, scheduled_start ASC);

-- ==============================================================================
-- 10. NOTIFICATIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('medication_reminder', 'appointment_alert', 'lab_ready', 'emergency_sos', 'system')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    delivery_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'delivered', 'failed', 'cancelled')),
    retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    idempotency_key VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_pending ON notifications(user_id, scheduled_at ASC) WHERE delivery_status = 'pending';

-- ==============================================================================
-- 11. AUDIT EVENTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL,
    target_type VARCHAR(100) NOT NULL,
    target_id VARCHAR(100),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    minimal_metadata JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45)
);

CREATE INDEX idx_audit_events_actor_time ON audit_events(actor_user_id, timestamp DESC);
CREATE INDEX idx_audit_events_action ON audit_events(action_type, timestamp DESC);

-- ==============================================================================
-- 12. DATA DELETION REQUESTS (GDPR / DPDP ACT COMPLIANCE)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS data_deletion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
    completed_at TIMESTAMPTZ,
    outcome_summary TEXT
);

CREATE INDEX idx_deletion_requests_status ON data_deletion_requests(status, requested_at);

-- ==============================================================================
-- 13. APPROVED MEDICAL KNOWLEDGE BASE (ISOLATED FROM PATIENTS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS medical_knowledge_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name VARCHAR(255) NOT NULL,
    authoritative_body VARCHAR(255) NOT NULL,
    publication_date DATE NOT NULL,
    version VARCHAR(50) NOT NULL DEFAULT '1.0',
    license_type VARCHAR(100) DEFAULT 'Approved Clinical Guidelines',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medical_knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES medical_knowledge_sources(id) ON DELETE CASCADE,
    topic VARCHAR(100) NOT NULL,
    keywords VARCHAR(255) NOT NULL,
    clinical_guideline_text TEXT NOT NULL,
    target_demographic VARCHAR(100) DEFAULT 'General Adult',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_knowledge_chunks_topic ON medical_knowledge_chunks(topic);

-- ==============================================================================
-- 14. HEALTHCARE PROXIES (GUARDIANS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS guardians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(100) NOT NULL DEFAULT 'Caregiver',
    phone_number VARCHAR(30) NOT NULL,
    email VARCHAR(255),
    allow_medication_escalation BOOLEAN NOT NULL DEFAULT TRUE,
    allow_emergency_notification BOOLEAN NOT NULL DEFAULT TRUE,
    allow_care_connect_access BOOLEAN NOT NULL DEFAULT TRUE,
    allow_health_view BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_guardians_user ON guardians(user_id);

-- ==============================================================================
-- 15. WELLNESS & HYDRATION TRACKING
-- ==============================================================================
CREATE TABLE IF NOT EXISTS wellness_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    water_glasses INTEGER NOT NULL DEFAULT 0 CHECK (water_glasses >= 0),
    water_ml INTEGER NOT NULL DEFAULT 0 CHECK (water_ml >= 0),
    target_water_ml INTEGER NOT NULL DEFAULT 2500 CHECK (target_water_ml > 0),
    steps INTEGER NOT NULL DEFAULT 0 CHECK (steps >= 0),
    target_steps INTEGER NOT NULL DEFAULT 7000 CHECK (target_steps > 0),
    active_minutes INTEGER NOT NULL DEFAULT 0 CHECK (active_minutes >= 0),
    sleep_hours NUMERIC(3, 1) NOT NULL DEFAULT 7.0 CHECK (sleep_hours >= 0.0 AND sleep_hours <= 24.0),
    nutrition_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_wellness_date UNIQUE (user_id, date)
);

CREATE INDEX idx_wellness_user_date ON wellness_logs(user_id, date DESC);

-- ==============================================================================
-- 16. SYMPTOM ASSESSMENTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS symptom_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symptoms TEXT NOT NULL,
    duration VARCHAR(50) NOT NULL DEFAULT '1-2 days',
    severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 10),
    urgency_level VARCHAR(50) NOT NULL CHECK (urgency_level IN ('EMERGENCY_IMMEDIATE', 'URGENT_EVALUATION', 'ROUTINE_CONSULT', 'MONITOR_SELF_CARE')),
    is_emergency BOOLEAN NOT NULL DEFAULT FALSE,
    possible_explanations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    doctor_questions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    safe_next_steps_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_symptom_assessments_user ON symptom_assessments(user_id, assessed_at DESC);

-- ==============================================================================
-- 17. POSTGRESQL ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
-- Enables RLS so each application session accesses ONLY its authorized patient context
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

-- Transaction context helper policy example:
-- In production, the API executes: SET LOCAL app.current_user_id = '<user_uuid>';
-- CREATE POLICY user_records_isolation ON health_records
--     USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
