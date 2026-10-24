"""
VitaCare AI — Complete Healthcare SQLAlchemy ORM Models
HIPAA/GDPR-compliant, normalized architecture supporting authentication,
user profiles, AI chat, medical documents, OCR extractions, health records,
medication adherence, appointments, notifications, audit logging,
data deletion requests, and clinical knowledge sources.
"""

import uuid
import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime, Date, Numeric,
    ForeignKey, Index, UniqueConstraint, CheckConstraint
)
from sqlalchemy.orm import relationship, synonym
from app.core.database import Base

def generate_uuid():
    return str(uuid.uuid4())

# ==============================================================================
# 1. USERS & IDENTITY
# ==============================================================================
class User(Base):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    phone_number = Column(String(30), unique=True, index=True, nullable=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False, default="Patient")
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="patient", nullable=False)  # "patient", "guardian", "clinician", "admin"
    account_status = Column(String(30), default="active", nullable=False)  # "active", "pending_verification", "suspended", "deleted"
    is_active = Column(Boolean, default=True)
    phone_verified_at = Column(DateTime, nullable=True)
    
    # Demographic fields kept on User for fast identity/triage access
    age = Column(Integer, nullable=True)
    gender = Column(String(50), default="Unspecified")
    blood_group = Column(String(10), default="A+")
    preferred_language = Column(String(10), default="en")
    emergency_phone = Column(String(30), nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    
    # Synonym for backwards-compatibility with existing routes referencing user.phone
    phone = synonym("phone_number")
    preferredLanguage = synonym("preferred_language")
    
    # Relationships
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    auth_sessions = relationship("AuthenticationSession", back_populates="user", cascade="all, delete-orphan")
    consents = relationship("UserConsent", back_populates="user", uselist=False, cascade="all, delete-orphan")
    privacy_consents = relationship("PrivacyConsent", back_populates="user", cascade="all, delete-orphan")
    guardians = relationship("Guardian", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("MedicalDocument", back_populates="user", cascade="all, delete-orphan")
    health_records = relationship("HealthRecord", back_populates="user", cascade="all, delete-orphan")
    measurements = relationship("HealthMeasurement", back_populates="user", cascade="all, delete-orphan")
    medications = relationship("Medication", back_populates="user", cascade="all, delete-orphan")
    schedules = relationship("MedicationSchedule", back_populates="user", cascade="all, delete-orphan")
    adherence_logs = relationship("AdherenceLog", back_populates="user", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="user", cascade="all, delete-orphan")
    conversations = relationship("ChatConversation", back_populates="user", cascade="all, delete-orphan")
    threads = synonym("conversations")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    wellness_logs = relationship("WellnessLog", back_populates="user", cascade="all, delete-orphan")
    symptom_assessments = relationship("SymptomAssessment", back_populates="user", cascade="all, delete-orphan")
    deletion_requests = relationship("DataDeletionRequest", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("role IN ('patient', 'guardian', 'clinician', 'admin')", name="chk_user_role"),
        CheckConstraint("account_status IN ('active', 'pending_verification', 'suspended', 'deleted')", name="chk_user_account_status"),
    )

# ==============================================================================
# 2. USER PROFILES
# ==============================================================================
class UserProfile(Base):
    __tablename__ = "user_profiles"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    display_name = Column(String(255), nullable=True)
    date_of_birth = Column(String(30), nullable=True)
    gender = Column(String(50), default="Unspecified")
    blood_group = Column(String(10), default="A+")
    profile_photo_reference = Column(String(500), nullable=True)
    preferred_language = Column(String(10), default="en")
    timezone = Column(String(50), default="Asia/Kolkata", nullable=False)
    emergency_contact_reference = Column(String(255), nullable=True)
    
    allergies = Column(Text, default="[]")  # JSON string
    chronic_conditions = Column(Text, default="[]")  # JSON string
    current_medications = Column(Text, default="[]")  # JSON string
    height_cm = Column(Float, nullable=True)
    weight_kg = Column(Float, nullable=True)
    primary_physician = Column(String(255), nullable=True)
    emergency_contacts = Column(Text, default="[]")  # JSON string
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    
    user = relationship("User", back_populates="profile")

# ==============================================================================
# 3. AUTHENTICATION SESSIONS
# ==============================================================================
class AuthenticationSession(Base):
    __tablename__ = "authentication_sessions"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_or_token_hash = Column(String(64), unique=True, index=True, nullable=False)
    issued_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    revoked_at = Column(DateTime, nullable=True)
    device_metadata = Column(Text, default="{}")  # JSON string
    ip_address = Column(String(50), nullable=True)
    
    user = relationship("User", back_populates="auth_sessions")

# ==============================================================================
# 4. PRIVACY CONSENTS
# ==============================================================================
class PrivacyConsent(Base):
    __tablename__ = "privacy_consents"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    consent_type = Column(String(100), nullable=False)  # 'account_terms', 'ai_processing', 'guardian_sharing', 'emergency_alerts', 'marketing', 'teleconsult'
    policy_version = Column(String(20), default="v1.0", nullable=False)
    granted = Column(Boolean, default=True, nullable=False)
    granted_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    withdrawn_at = Column(DateTime, nullable=True)
    purpose_and_scope = Column(Text, nullable=False)
    
    user = relationship("User", back_populates="privacy_consents")
    
    __table_args__ = (
        UniqueConstraint("user_id", "consent_type", "policy_version", name="uq_user_consent_version"),
    )

class UserConsent(Base):
    """Legacy consent model for backward compatibility with existing routes."""
    __tablename__ = "user_consents"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    data_processing_accepted = Column(Boolean, default=True)
    guardian_sharing_accepted = Column(Boolean, default=True)
    emergency_alerts_accepted = Column(Boolean, default=True)
    teleconsult_accepted = Column(Boolean, default=False)
    terms_accepted_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    user = relationship("User", back_populates="consents")

# ==============================================================================
# 5. CHAT CONVERSATIONS & MESSAGES
# ==============================================================================
class ChatConversation(Base):
    __tablename__ = "chat_conversations"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), default="Health Consultation", nullable=False)
    language = Column(String(10), default="en", nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    archived_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    
    user = relationship("User", back_populates="conversations")
    messages = relationship("ChatMessage", back_populates="conversation", cascade="all, delete-orphan", order_by="ChatMessage.created_at")

# Alias for backwards-compatibility
ChatThread = ChatConversation

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(36), ForeignKey("chat_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    sender_role = Column(String(20), nullable=False, default="user")  # "user", "assistant", "system"
    message_text = Column(Text, nullable=False)
    model_identifier = Column(String(100), nullable=True)
    response_metadata = Column(Text, default="{}")  # JSON string
    safety_status = Column(String(30), default="safe", nullable=False)  # "safe", "escalated_emergency", "warning", "flagged"
    language = Column(String(10), default="en")
    attachment_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    conversation = relationship("ChatConversation", back_populates="messages")
    user = relationship("User")
    
    # Synonyms for route convenience
    thread_id = synonym("conversation_id")
    role = synonym("sender_role")
    content = synonym("message_text")
    clinical_breakdown_json = synonym("response_metadata")

    def __init__(self, **kwargs):
        if "thread_id" in kwargs and "conversation_id" not in kwargs:
            kwargs["conversation_id"] = kwargs.pop("thread_id")
        if "role" in kwargs and "sender_role" not in kwargs:
            kwargs["sender_role"] = kwargs.pop("role")
        if "content" in kwargs and "message_text" not in kwargs:
            kwargs["message_text"] = kwargs.pop("content")
        if "clinical_breakdown_json" in kwargs and "response_metadata" not in kwargs:
            kwargs["response_metadata"] = kwargs.pop("clinical_breakdown_json")
        super().__init__(**kwargs)

    __table_args__ = (
        CheckConstraint("sender_role IN ('user', 'assistant', 'system')", name="chk_chat_sender_role"),
        CheckConstraint("safety_status IN ('safe', 'escalated_emergency', 'warning', 'flagged')", name="chk_chat_safety_status"),
    )

# ==============================================================================
# 6. MEDICAL DOCUMENTS & EXTRACTIONS
# ==============================================================================
class MedicalDocument(Base):
    __tablename__ = "medical_documents"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    document_type = Column(String(50), default="prescription", nullable=False)  # "prescription", "lab_report", "discharge_summary", "imaging", "other"
    original_filename = Column(String(255), nullable=False, default="document.pdf")
    private_storage_key = Column(String(500), nullable=False, default="")
    mime_type = Column(String(100), default="application/octet-stream", nullable=False)
    file_size = Column(Integer, default=0, nullable=False)
    checksum = Column(String(64), default="", nullable=False)
    upload_status = Column(String(30), default="uploaded", nullable=False)  # "pending", "uploaded", "failed"
    processing_status = Column(String(30), default="completed", nullable=False)  # "unprocessed", "queued", "processing", "completed", "failed"
    
    # Legacy fields supported directly
    title = Column(String(255), nullable=True)
    category = synonym("document_type")
    file_url = Column(String(500), nullable=True)
    file_path = synonym("private_storage_key")
    ocr_status = synonym("processing_status")
    ocr_raw_text = Column(Text, nullable=True)
    extracted_data_json = Column(Text, default="{}")  # Draft review JSON
    is_verified = Column(Boolean, default=False)
    
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    
    user = relationship("User", back_populates="documents")
    extractions = relationship("DocumentExtraction", back_populates="document", cascade="all, delete-orphan")
    health_records = relationship("HealthRecord", back_populates="source_document")
    medications = relationship("Medication", back_populates="source_document")

    def __init__(self, **kwargs):
        if "category" in kwargs and "document_type" not in kwargs:
            kwargs["document_type"] = kwargs.pop("category")
        if "title" in kwargs and "original_filename" not in kwargs:
            kwargs["original_filename"] = kwargs["title"]
        if "file_path" in kwargs and "private_storage_key" not in kwargs:
            kwargs["private_storage_key"] = kwargs.pop("file_path")
        if "ocr_status" in kwargs and "processing_status" not in kwargs:
            kwargs["processing_status"] = kwargs.pop("ocr_status")
        super().__init__(**kwargs)

    __table_args__ = (
        CheckConstraint("file_size >= 0", name="chk_doc_file_size_nonnegative"),
        CheckConstraint("upload_status IN ('pending', 'uploaded', 'failed')", name="chk_doc_upload_status"),
        CheckConstraint("processing_status IN ('unprocessed', 'queued', 'processing', 'completed', 'failed')", name="chk_doc_processing_status"),
    )

class DocumentExtraction(Base):
    __tablename__ = "document_extractions"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("medical_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    extraction_version = Column(String(20), default="v1.0", nullable=False)
    extracted_data_json = Column(Text, default="{}", nullable=False)
    extraction_confidence = Column(Float, nullable=True)
    review_status = Column(String(30), default="unverified", nullable=False)  # "unverified", "partially_verified", "verified", "rejected"
    user_confirmed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    document = relationship("MedicalDocument", back_populates="extractions")

    __table_args__ = (
        CheckConstraint("extraction_confidence IS NULL OR (extraction_confidence >= 0.0 AND extraction_confidence <= 1.0)", name="chk_extraction_confidence_range"),
        CheckConstraint("review_status IN ('unverified', 'partially_verified', 'verified', 'rejected')", name="chk_extraction_review_status"),
    )

# ==============================================================================
# 7. HEALTH RECORDS & BIOMARKERS
# ==============================================================================
class HealthRecord(Base):
    __tablename__ = "health_records"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    record_type = Column(String(50), nullable=False)  # 'vital_sign', 'lab_result', 'allergy', 'condition', 'immunization', 'history'
    biomarker_name = Column(String(100), nullable=False)
    record_date = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    numeric_value = Column(Float, nullable=True)
    string_value = Column(String(255), nullable=True)
    structured_value = Column(Text, nullable=True)  # JSON string
    unit = Column(String(50), nullable=True)
    status = Column(String(30), default="normal", nullable=False)  # 'normal', 'elevated', 'low', 'critical', 'abnormal'
    source_type = Column(String(50), default="manual_entry", nullable=False)  # 'manual_entry', 'ocr_extraction', 'device_sync', 'clinical_import'
    source_document_id = Column(String(36), ForeignKey("medical_documents.id", ondelete="SET NULL"), nullable=True)
    user_verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    
    user = relationship("User", back_populates="health_records")
    source_document = relationship("MedicalDocument", back_populates="health_records")

    __table_args__ = (
        CheckConstraint("record_type IN ('vital_sign', 'lab_result', 'allergy', 'condition', 'immunization', 'history')", name="chk_record_type"),
        CheckConstraint("status IN ('normal', 'elevated', 'low', 'critical', 'abnormal')", name="chk_health_record_status"),
        Index("idx_health_records_user_type_date", "user_id", "record_type", "biomarker_name", "record_date"),
    )

class HealthMeasurement(Base):
    """Legacy measurement model for backward compatibility with existing routes."""
    __tablename__ = "health_measurements"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(50), nullable=False)
    value = Column(Float, nullable=False)
    unit = Column(String(30), nullable=False)
    status = Column(String(30), default="normal")
    source = Column(String(50), default="manual")
    source_document_id = Column(String(36), nullable=True)
    measured_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    user = relationship("User", back_populates="measurements")

# ==============================================================================
# 8. MEDICATIONS & SCHEDULES & INTAKE LOGS
# ==============================================================================
class Medication(Base):
    __tablename__ = "medications"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    medication_name = Column(String(255), nullable=False)
    strength = Column(String(100), nullable=True)
    dosage_instructions = Column(Text, nullable=False)
    source_document_id = Column(String(36), ForeignKey("medical_documents.id", ondelete="SET NULL"), nullable=True)
    verification_status = Column(String(50), default="unverified", nullable=False)  # 'unverified', 'verified_by_user', 'verified_by_pharmacist'
    start_date = Column(String(30), nullable=True)
    end_date = Column(String(30), nullable=True)
    status = Column(String(30), default="active", nullable=False)  # 'active', 'paused', 'completed', 'discontinued'
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    
    user = relationship("User", back_populates="medications")
    source_document = relationship("MedicalDocument", back_populates="medications")
    schedules = relationship("MedicationSchedule", back_populates="medication", cascade="all, delete-orphan")
    intake_logs = relationship("MedicationIntakeLog", back_populates="medication", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("verification_status IN ('unverified', 'verified_by_user', 'verified_by_pharmacist')", name="chk_med_verification_status"),
        CheckConstraint("status IN ('active', 'paused', 'completed', 'discontinued')", name="chk_med_status"),
    )

class MedicationSchedule(Base):
    __tablename__ = "medication_schedules"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    medication_id = Column(String(36), ForeignKey("medications.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    dosage = Column(String(100), nullable=False)
    instructions = Column(String(255), default="Take with water")
    frequency = Column(String(100), default="Once daily")
    times_of_day = Column(Text, default='["08:00 AM"]')  # JSON array
    schedule_definition = Column(Text, default='{"frequency": "once_daily", "times_of_day": ["08:00 AM"]}')  # JSON
    timezone = Column(String(50), default="Asia/Kolkata", nullable=False)
    start_date = Column(String(30), nullable=True)
    end_date = Column(String(30), nullable=True)
    start_at = Column(DateTime, default=datetime.datetime.utcnow)
    end_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    active = synonym("is_active")
    refill_reminder = Column(Boolean, default=True)
    remaining_doses = Column(Integer, default=30)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    
    user = relationship("User", back_populates="schedules")
    medication = relationship("Medication", back_populates="schedules")
    adherence_logs = relationship("AdherenceLog", back_populates="schedule", cascade="all, delete-orphan")
    intake_logs = relationship("MedicationIntakeLog", back_populates="schedule", cascade="all, delete-orphan")

class MedicationIntakeLog(Base):
    __tablename__ = "medication_intake_logs"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    medication_id = Column(String(36), ForeignKey("medications.id", ondelete="CASCADE"), nullable=False, index=True)
    schedule_id = Column(String(36), ForeignKey("medication_schedules.id", ondelete="SET NULL"), nullable=True)
    scheduled_at = Column(DateTime, nullable=False)
    status = Column(String(20), default="pending", nullable=False)  # 'taken', 'skipped', 'missed', 'pending'
    recorded_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    user_note = Column(String(500), nullable=True)
    
    medication = relationship("Medication", back_populates="intake_logs")
    schedule = relationship("MedicationSchedule", back_populates="intake_logs")

    __table_args__ = (
        CheckConstraint("status IN ('taken', 'skipped', 'missed', 'pending')", name="chk_intake_status"),
        UniqueConstraint("medication_id", "scheduled_at", name="uq_med_intake_occurrence"),
        Index("idx_intake_logs_med_date", "medication_id", "scheduled_at"),
    )

class AdherenceLog(Base):
    """Legacy adherence log model for backwards compatibility with existing medication routes."""
    __tablename__ = "adherence_logs"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    schedule_id = Column(String(36), ForeignKey("medication_schedules.id", ondelete="CASCADE"), nullable=True)
    medicine_name = Column(String(255), nullable=False)
    scheduled_time = Column(String(50), nullable=True)
    action = Column(String(30), default="taken")  # "taken", "skipped", "missed"
    reason = Column(String(255), nullable=True)
    recorded_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    user = relationship("User", back_populates="adherence_logs")
    schedule = relationship("MedicationSchedule", back_populates="adherence_logs")

# ==============================================================================
# 9. APPOINTMENTS
# ==============================================================================
class Appointment(Base):
    __tablename__ = "appointments"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    clinician_or_facility_reference = Column(String(255), nullable=True)
    appointment_title = Column(String(255), nullable=False, default="Doctor Appointment")
    doctor_name = synonym("clinician_or_facility_reference")
    specialty = Column(String(150), default="General Medicine")
    clinic_name = Column(String(255), default="Outpatient Clinic")
    scheduled_start = Column(DateTime, nullable=True)
    scheduled_end = Column(DateTime, nullable=True)
    appointment_date = Column(String(30), nullable=False)  # YYYY-MM-DD
    appointment_time = Column(String(30), default="10:00 AM")
    timezone = Column(String(50), default="Asia/Kolkata", nullable=False)
    location = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    status = Column(String(50), default="confirmed", nullable=False)  # "scheduled", "confirmed", "completed", "cancelled", "rescheduled"
    reminder_enabled = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    
    user = relationship("User", back_populates="appointments")

    def __init__(self, **kwargs):
        if "doctor_name" in kwargs and "clinician_or_facility_reference" not in kwargs:
            kwargs["clinician_or_facility_reference"] = kwargs["doctor_name"]
        if "appointment_title" not in kwargs:
            dr = kwargs.get("clinician_or_facility_reference") or kwargs.get("doctor_name") or "Doctor"
            kwargs["appointment_title"] = f"Appointment with {dr}"
        super().__init__(**kwargs)

    __table_args__ = (
        CheckConstraint("status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled')", name="chk_appointment_status"),
        Index("idx_appointments_user_time", "user_id", "scheduled_start"),
    )

# ==============================================================================
# 10. NOTIFICATIONS
# ==============================================================================
class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    notification_type = Column(String(50), default="info", nullable=False)  # "medication_reminder", "appointment_alert", "lab_ready", "emergency_sos", "system"
    type = synonym("notification_type")
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    scheduled_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    sent_at = Column(DateTime, nullable=True)
    delivery_status = Column(String(30), default="pending", nullable=False)  # "pending", "delivered", "failed", "cancelled"
    retry_count = Column(Integer, default=0, nullable=False)
    idempotency_key = Column(String(100), unique=True, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    user = relationship("User", back_populates="notifications")

    __table_args__ = (
        CheckConstraint("retry_count >= 0", name="chk_notification_retry_count"),
        CheckConstraint("delivery_status IN ('pending', 'delivered', 'failed', 'cancelled')", name="chk_notification_delivery_status"),
        Index("idx_notifications_pending", "user_id", "scheduled_at"),
    )

# ==============================================================================
# 11. AUDIT EVENTS
# ==============================================================================
class AuditEvent(Base):
    __tablename__ = "audit_events"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    actor_user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action_type = Column(String(100), nullable=False)
    target_type = Column(String(100), nullable=False)
    target_id = Column(String(100), nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    minimal_metadata = Column(Text, default="{}")  # JSON string
    ip_address = Column(String(50), nullable=True)
    
    # Aliases for AuditLog legacy compatibility
    action = synonym("action_type")
    details = synonym("minimal_metadata")
    user_id = synonym("actor_user_id")

    __table_args__ = (
        Index("idx_audit_events_actor_time", "actor_user_id", "timestamp"),
        Index("idx_audit_events_action", "action_type", "timestamp"),
    )

class AuditLog(Base):
    """Legacy audit_logs table for backwards compatibility."""
    __tablename__ = "audit_logs"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), nullable=True)
    action = Column(String(100), nullable=False)
    details = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

# ==============================================================================
# 12. DATA DELETION REQUESTS (GDPR / DPDP COMPLIANCE)
# ==============================================================================
class DataDeletionRequest(Base):
    __tablename__ = "data_deletion_requests"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    status = Column(String(30), default="pending", nullable=False)  # "pending", "processing", "completed", "rejected"
    completed_at = Column(DateTime, nullable=True)
    outcome_summary = Column(Text, nullable=True)
    
    user = relationship("User", back_populates="deletion_requests")

    __table_args__ = (
        CheckConstraint("status IN ('pending', 'processing', 'completed', 'rejected')", name="chk_deletion_request_status"),
        Index("idx_deletion_requests_status", "status", "requested_at"),
    )

# ==============================================================================
# 13. APPROVED MEDICAL KNOWLEDGE BASE (ISOLATED FROM PATIENTS)
# ==============================================================================
class MedicalKnowledgeSource(Base):
    __tablename__ = "medical_knowledge_sources"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    source_name = Column(String(255), nullable=False)
    authoritative_body = Column(String(255), nullable=False)
    publication_date = Column(Date, nullable=False)
    version = Column(String(50), default="1.0", nullable=False)
    license_type = Column(String(100), default="Approved Clinical Guidelines")
    source_url = Column(String(500), nullable=True, default="https://www.who.int")
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    chunks = relationship("MedicalKnowledgeChunk", back_populates="source", cascade="all, delete-orphan")

class MedicalKnowledgeChunk(Base):
    __tablename__ = "medical_knowledge_chunks"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    source_id = Column(String(36), ForeignKey("medical_knowledge_sources.id", ondelete="CASCADE"), nullable=False, index=True)
    topic = Column(String(100), nullable=False)
    keywords = Column(String(255), nullable=False)
    clinical_guideline_text = Column(Text, nullable=False)
    target_demographic = Column(String(100), default="General Adult")
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    source = relationship("MedicalKnowledgeSource", back_populates="chunks")

    __table_args__ = (
        Index("idx_knowledge_chunks_topic", "topic"),
    )

# ==============================================================================
# 14. HEALTHCARE PROXIES (GUARDIANS)
# ==============================================================================
class Guardian(Base):
    __tablename__ = "guardians"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    relationship_type = Column("relationship", String(100), default="Caregiver")
    phone_number = Column(String(30), nullable=False)
    email = Column(String(255), nullable=True)
    allow_medication_escalation = Column(Boolean, default=True)
    allow_emergency_notification = Column(Boolean, default=True)
    allow_care_connect_access = Column(Boolean, default=True)
    allow_health_view = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    user = relationship("User", back_populates="guardians")

# ==============================================================================
# 15. WELLNESS & HYDRATION TRACKING
# ==============================================================================
class WellnessLog(Base):
    __tablename__ = "wellness_logs"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(String(30), nullable=False)  # YYYY-MM-DD
    water_glasses = Column(Integer, default=0, nullable=False)
    water_ml = Column(Integer, default=0, nullable=False)
    target_water_ml = Column(Integer, default=2500, nullable=False)
    steps = Column(Integer, default=0, nullable=False)
    target_steps = Column(Integer, default=7000, nullable=False)
    active_minutes = Column(Integer, default=0, nullable=False)
    sleep_hours = Column(Float, default=7.0, nullable=False)
    nutrition_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    user = relationship("User", back_populates="wellness_logs")

    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_user_wellness_date"),
        Index("idx_wellness_user_date", "user_id", "date"),
    )

# ==============================================================================
# 16. SYMPTOM ASSESSMENTS
# ==============================================================================
class SymptomAssessment(Base):
    __tablename__ = "symptom_assessments"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    symptoms = Column(Text, nullable=False)
    duration = Column(String(50), default="1-2 days", nullable=False)
    severity = Column(Integer, default=5, nullable=False)
    urgency_level = Column(String(50), default="ROUTINE_CONSULT", nullable=False)  # "EMERGENCY_IMMEDIATE", "URGENT_EVALUATION", "ROUTINE_CONSULT", "MONITOR_SELF_CARE"
    is_emergency = Column(Boolean, default=False, nullable=False)
    possible_explanations_json = Column(Text, default="[]", nullable=False)
    doctor_questions_json = Column(Text, default="[]", nullable=False)
    safe_next_steps_json = Column(Text, default="[]", nullable=False)
    assessed_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    user = relationship("User", back_populates="symptom_assessments")

    __table_args__ = (
        CheckConstraint("severity >= 1 AND severity <= 10", name="chk_symptom_severity_range"),
        CheckConstraint("urgency_level IN ('EMERGENCY_IMMEDIATE', 'URGENT_EVALUATION', 'ROUTINE_CONSULT', 'MONITOR_SELF_CARE')", name="chk_symptom_urgency_level"),
        Index("idx_symptom_assessments_user", "user_id", "assessed_at"),
    )

# ==============================================================================
# 17. CMS DYNAMIC MODULES, CARDS, ANNOUNCEMENTS, AND CONTENT
# ==============================================================================
class CmsModule(Base):
    __tablename__ = "cms_modules"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    key = Column(String(50), unique=True, nullable=False)
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(50), default="Activity")
    is_enabled = Column(Boolean, default=True)
    display_order = Column(Integer, default=1)
    is_published = Column(Boolean, default=True)

class CmsCard(Base):
    __tablename__ = "cms_cards"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(100), nullable=False)
    subtitle = Column(String(150), nullable=True)
    value = Column(String(50), default="")
    delta = Column(String(50), default="")
    delta_type = Column(String(20), default="neutral")
    badge_color = Column(String(30), default="blue")
    order_index = Column(Integer, default=1)
    is_visible = Column(Boolean, default=True)
    is_published = Column(Boolean, default=True)

class CmsAnnouncement(Base):
    __tablename__ = "cms_announcements"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    alert_type = Column(String(30), default="info")
    priority = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    is_published = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class CmsContent(Base):
    __tablename__ = "cms_content"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    key = Column(String(100), unique=True, nullable=False)
    title = Column(String(150), nullable=False)
    section = Column(String(50), default="General")
    value = Column(Text, nullable=False)
    help_text = Column(Text, nullable=True)
    is_published = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class AppSetting(Base):
    __tablename__ = "app_settings"
    
    id = Column(String(36), primary_key=True, default="global_settings")
    website_name = Column(String(100), default="VitaCare AI")
    logo_url = Column(String(500), default="")
    theme_primary_color = Column(String(30), default="#0284c7")
    support_phone = Column(String(50), default="+1-800-VITA-CARE")
    support_email = Column(String(100), default="support@vitacare.ai")
    default_language = Column(String(10), default="en")
    allow_new_registrations = Column(Boolean, default=True)
    maintenance_mode = Column(Boolean, default=False)
    emergency_broadcast_enabled = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class TranslationItem(Base):
    __tablename__ = "translation_items"
    
    key = Column(String(100), primary_key=True)
    category = Column(String(50), default="General")
    en = Column(Text, nullable=True)
    ta = Column(Text, nullable=True)
    te = Column(Text, nullable=True)
    ml = Column(Text, nullable=True)
    kn = Column(Text, nullable=True)
    hi = Column(Text, nullable=True)
    bn = Column(Text, nullable=True)
    mr = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class SmsTriggerConfig(Base):
    __tablename__ = "sms_trigger_configs"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    event_type = Column(String(100), unique=True, nullable=False)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    is_enabled = Column(Boolean, default=True)
    delay_minutes = Column(Integer, default=15)
    target_role = Column(String(50), default="guardian")

class SmsTemplateItem(Base):
    __tablename__ = "sms_templates"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(150), nullable=False)
    event_type = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    language = Column(String(10), default="en")

class SmsLogItem(Base):
    __tablename__ = "sms_logs"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    recipient_phone = Column(String(50), nullable=False)
    recipient_name = Column(String(100), default="Recipient")
    message_body = Column(Text, nullable=False)
    trigger_event = Column(String(100), nullable=False)
    status = Column(String(30), default="delivered")
    carrier_id = Column(String(100), default="MOCK_TWILIO_SUCCESS")
    sent_at = Column(DateTime, default=datetime.datetime.utcnow)

class CareConnectSession(Base):
    __tablename__ = "careconnect_sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    caregiver_name = Column(String(255), nullable=True)
    guardian_id = Column(String(36), nullable=True)
    medicine_id = Column(String(36), nullable=True)
    schedule_id = Column(String(36), nullable=True)
    status = Column(String(50), default="in_progress")
    adherence_confirmed = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    connection_quality = Column(String(50), default="Good")
    call_duration_seconds = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


