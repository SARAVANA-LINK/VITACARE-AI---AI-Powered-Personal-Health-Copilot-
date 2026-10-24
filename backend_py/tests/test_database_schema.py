"""
Automated Database Schema, Constraints, Referential Integrity,
and Tenant Isolation Test Suite.
"""

import uuid
import datetime
import pytest
from sqlalchemy.exc import IntegrityError
from app.core.database import Base, engine, SessionLocal
from app.models.all_models import (
    User, UserProfile, MedicalDocument, DocumentExtraction,
    HealthRecord, Medication, MedicationSchedule, MedicationIntakeLog,
    Appointment, Notification, AuditEvent, ChatConversation, ChatMessage,
    PrivacyConsent
)
from app.repositories.user_repo import UserRepository
from app.repositories.health_record_repo import HealthRecordRepository
from app.repositories.medication_repo import MedicationRepository
from app.repositories.document_repo import DocumentRepository
from app.repositories.chat_repo import ChatRepository
from app.core.security import get_password_hash

def test_user_creation_and_defaults(db_session):
    """Test user creation with UUID generation and default status."""
    user = User(
        email=f"test_{uuid.uuid4().hex[:8]}@example.com",
        phone_number=f"+1555{uuid.uuid4().int % 10000000:07d}",
        password_hash=get_password_hash("Secret123!"),
        name="Test Patient"
    )
    db_session.add(user)
    db_session.commit()

    assert user.id is not None
    assert user.account_status == "active"
    assert user.is_active is True
    assert user.role == "patient"
    assert user.created_at is not None

def test_medication_intake_duplicate_occurrence_rejection(db_session):
    """
    Test that the unique constraint (medication_id, scheduled_at)
    prevents duplicate intake entries for the exact same scheduled occurrence.
    """
    user = User(
        email=f"patient_{uuid.uuid4().hex[:8]}@example.com",
        password_hash="hash",
        name="Med Patient"
    )
    db_session.add(user)
    db_session.commit()

    med = Medication(
        user_id=user.id,
        medication_name="Metformin",
        strength="500mg",
        dosage_instructions="Twice daily"
    )
    db_session.add(med)
    db_session.commit()

    scheduled_time = datetime.datetime(2026, 10, 24, 8, 0, 0)

    # First intake log
    intake1 = MedicationIntakeLog(
        medication_id=med.id,
        scheduled_at=scheduled_time,
        status="taken",
        recorded_at=datetime.datetime.utcnow()
    )
    db_session.add(intake1)
    db_session.commit()

    # Second intake log with the EXACT same scheduled occurrence
    intake2 = MedicationIntakeLog(
        medication_id=med.id,
        scheduled_at=scheduled_time,
        status="taken",
        recorded_at=datetime.datetime.utcnow()
    )
    db_session.add(intake2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

def test_notification_idempotency_key_uniqueness(db_session):
    """Test that idempotency_key prevents duplicate push notification dispatches."""
    user = User(
        email=f"notif_{uuid.uuid4().hex[:8]}@example.com",
        password_hash="hash",
        name="Notif Patient"
    )
    db_session.add(user)
    db_session.commit()

    idempotency_key = f"key_{uuid.uuid4().hex}"

    notif1 = Notification(
        user_id=user.id,
        title="Dose Alert",
        message="Take medication",
        idempotency_key=idempotency_key
    )
    db_session.add(notif1)
    db_session.commit()

    notif2 = Notification(
        user_id=user.id,
        title="Dose Alert Duplicate",
        message="Take medication duplicate",
        idempotency_key=idempotency_key
    )
    db_session.add(notif2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

def test_privacy_consent_version_uniqueness(db_session):
    """Test unique constraint on (user_id, consent_type, policy_version)."""
    user = User(
        email=f"consent_{uuid.uuid4().hex[:8]}@example.com",
        password_hash="hash",
        name="Consent Patient"
    )
    db_session.add(user)
    db_session.commit()

    c1 = PrivacyConsent(
        user_id=user.id,
        consent_type="ai_processing",
        policy_version="v1.0",
        granted=True,
        purpose_and_scope="AI Consultation"
    )
    db_session.add(c1)
    db_session.commit()

    c2 = PrivacyConsent(
        user_id=user.id,
        consent_type="ai_processing",
        policy_version="v1.0",
        granted=False,
        purpose_and_scope="AI Consultation Duplicate"
    )
    db_session.add(c2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

def test_cascade_deletion_of_patient_data(db_session):
    """
    Test that deleting a patient cascades and cleanly deletes all related
    records (profiles, documents, extractions, health records, conversations).
    """
    user = User(
        email=f"cascade_{uuid.uuid4().hex[:8]}@example.com",
        password_hash="hash",
        name="Cascade Patient"
    )
    db_session.add(user)
    db_session.commit()
    u_id = user.id

    # Create profile
    profile = UserProfile(user_id=u_id, timezone="Asia/Kolkata")
    # Create document
    doc = MedicalDocument(
        user_id=u_id,
        original_filename="scan.pdf",
        private_storage_key=f"vault/{u_id}/scan.pdf",
        file_size=1024,
        checksum="sha256abc"
    )
    # Create conversation
    conv = ChatConversation(user_id=u_id, title="Consultation")
    db_session.add_all([profile, doc, conv])
    db_session.commit()

    d_id = doc.id
    c_id = conv.id

    # Create extraction and message
    ext = DocumentExtraction(document_id=d_id, extracted_data_json="{}")
    msg = ChatMessage(conversation_id=c_id, user_id=u_id, message_text="Hello", sender_role="user")
    db_session.add_all([ext, msg])
    db_session.commit()

    # Now delete the user
    db_session.delete(user)
    db_session.commit()

    # Verify cascading removal
    assert db_session.query(UserProfile).filter(UserProfile.user_id == u_id).first() is None
    assert db_session.query(MedicalDocument).filter(MedicalDocument.id == d_id).first() is None
    assert db_session.query(DocumentExtraction).filter(DocumentExtraction.document_id == d_id).first() is None
    assert db_session.query(ChatConversation).filter(ChatConversation.id == c_id).first() is None
    assert db_session.query(ChatMessage).filter(ChatMessage.conversation_id == c_id).first() is None

def test_audit_event_retains_log_on_actor_deletion(db_session):
    """
    Test that audit events are retained when an actor user is deleted,
    setting actor_user_id to NULL rather than deleting the compliance trail.
    """
    user = User(
        email=f"actor_{uuid.uuid4().hex[:8]}@example.com",
        password_hash="hash",
        name="Actor Patient"
    )
    db_session.add(user)
    db_session.commit()
    u_id = user.id

    event = AuditEvent(
        actor_user_id=u_id,
        action_type="PATIENT_EXPORT",
        target_type="health_records",
        target_id="all"
    )
    db_session.add(event)
    db_session.commit()
    e_id = event.id

    # Delete actor user
    db_session.delete(user)
    db_session.commit()

    retained_event = db_session.query(AuditEvent).filter(AuditEvent.id == e_id).first()
    assert retained_event is not None
    assert retained_event.actor_user_id is None  # ON DELETE SET NULL

def test_repository_tenant_isolation(db_session):
    """
    Verify that repository methods strictly isolate data between tenants,
    preventing User A from reading or modifying User B's clinical records.
    """
    user_a = User(email=f"usera_{uuid.uuid4().hex[:8]}@example.com", password_hash="hash", name="User A")
    user_b = User(email=f"userb_{uuid.uuid4().hex[:8]}@example.com", password_hash="hash", name="User B")
    db_session.add_all([user_a, user_b])
    db_session.commit()

    doc_repo = DocumentRepository(db_session)
    chat_repo = ChatRepository(db_session)

    # User A uploads a private medical document
    doc_a = doc_repo.register_document(
        user_id=user_a.id,
        original_filename="private_scan_user_a.pdf",
        private_storage_key=f"vault/{user_a.id}/private_scan.pdf",
        mime_type="application/pdf",
        file_size=2048,
        checksum="hash_a"
    )

    # User B attempts to access User A's document by ID
    unauthorized_doc = doc_repo.get_by_id_for_user(doc_a.id, user_b.id)
    assert unauthorized_doc is None

    # User A creates a chat conversation
    conv_a = chat_repo.create_conversation(user_id=user_a.id, title="User A Confidential")

    # User B attempts to post a message into User A's conversation
    with pytest.raises(ValueError, match="Conversation not found or access denied"):
        chat_repo.add_message(
            conversation_id=conv_a.id,
            user_id=user_b.id,
            sender_role="user",
            message_text="Attempted intrusion"
        )
