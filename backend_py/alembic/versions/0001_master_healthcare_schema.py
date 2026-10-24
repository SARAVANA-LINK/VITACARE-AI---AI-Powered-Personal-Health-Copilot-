"""Master Healthcare Schema Migration

Revision ID: 0001_master_healthcare_schema
Revises: 
Create Date: 2026-10-24 16:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0001_master_healthcare_schema'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. users
    op.create_table(
        'users',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('phone_number', sa.String(length=30), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False, server_default='Patient'),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False, server_default='patient'),
        sa.Column('account_status', sa.String(length=30), nullable=False, server_default='active'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('phone_verified_at', sa.DateTime(), nullable=True),
        sa.Column('age', sa.Integer(), nullable=True),
        sa.Column('gender', sa.String(length=50), server_default='Unspecified'),
        sa.Column('blood_group', sa.String(length=10), server_default='A+'),
        sa.Column('preferred_language', sa.String(length=10), server_default='en'),
        sa.Column('emergency_phone', sa.String(length=30), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_phone_number', 'users', ['phone_number'], unique=True)

    # 2. user_profiles
    op.create_table(
        'user_profiles',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('display_name', sa.String(length=255), nullable=True),
        sa.Column('date_of_birth', sa.String(length=30), nullable=True),
        sa.Column('gender', sa.String(length=50), server_default='Unspecified'),
        sa.Column('blood_group', sa.String(length=10), server_default='A+'),
        sa.Column('profile_photo_reference', sa.String(length=500), nullable=True),
        sa.Column('preferred_language', sa.String(length=10), server_default='en'),
        sa.Column('timezone', sa.String(length=50), nullable=False, server_default='Asia/Kolkata'),
        sa.Column('emergency_contact_reference', sa.String(length=255), nullable=True),
        sa.Column('allergies', sa.Text(), server_default='[]'),
        sa.Column('chronic_conditions', sa.Text(), server_default='[]'),
        sa.Column('current_medications', sa.Text(), server_default='[]'),
        sa.Column('height_cm', sa.Float(), nullable=True),
        sa.Column('weight_kg', sa.Float(), nullable=True),
        sa.Column('primary_physician', sa.String(length=255), nullable=True),
        sa.Column('emergency_contacts', sa.Text(), server_default='[]'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )

    # 3. authentication_sessions
    op.create_table(
        'authentication_sessions',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('session_or_token_hash', sa.String(length=64), unique=True, nullable=False),
        sa.Column('issued_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('device_metadata', sa.Text(), server_default='{}'),
        sa.Column('ip_address', sa.String(length=50), nullable=True),
    )
    op.create_index('idx_auth_sessions_user', 'authentication_sessions', ['user_id'])
    op.create_index('idx_auth_sessions_hash', 'authentication_sessions', ['session_or_token_hash'])

    # 4. privacy_consents
    op.create_table(
        'privacy_consents',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('consent_type', sa.String(length=100), nullable=False),
        sa.Column('policy_version', sa.String(length=20), nullable=False, server_default='v1.0'),
        sa.Column('granted', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('granted_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('withdrawn_at', sa.DateTime(), nullable=True),
        sa.Column('purpose_and_scope', sa.Text(), nullable=False),
        sa.UniqueConstraint('user_id', 'consent_type', 'policy_version', name='uq_user_consent_version'),
    )
    op.create_index('idx_privacy_consents_user', 'privacy_consents', ['user_id', 'consent_type'])

    # Legacy user_consents table
    op.create_table(
        'user_consents',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('data_processing_accepted', sa.Boolean(), server_default='1'),
        sa.Column('guardian_sharing_accepted', sa.Boolean(), server_default='1'),
        sa.Column('emergency_alerts_accepted', sa.Boolean(), server_default='1'),
        sa.Column('teleconsult_accepted', sa.Boolean(), server_default='0'),
        sa.Column('terms_accepted_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
    )

    # 5. chat_conversations & chat_messages
    op.create_table(
        'chat_conversations',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False, server_default='Health Consultation'),
        sa.Column('language', sa.String(length=10), nullable=False, server_default='en'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('archived_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
    )
    op.create_index('idx_chat_conversations_user', 'chat_conversations', ['user_id'])

    op.create_table(
        'chat_messages',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('conversation_id', sa.String(length=36), sa.ForeignKey('chat_conversations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
        sa.Column('sender_role', sa.String(length=20), nullable=False, server_default='user'),
        sa.Column('message_text', sa.Text(), nullable=False),
        sa.Column('model_identifier', sa.String(length=100), nullable=True),
        sa.Column('response_metadata', sa.Text(), server_default='{}'),
        sa.Column('safety_status', sa.String(length=30), nullable=False, server_default='safe'),
        sa.Column('language', sa.String(length=10), server_default='en'),
        sa.Column('attachment_url', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('idx_chat_messages_conv', 'chat_messages', ['conversation_id', 'created_at'])

    # 6. medical_documents & extractions
    op.create_table(
        'medical_documents',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('document_type', sa.String(length=50), nullable=False, server_default='prescription'),
        sa.Column('original_filename', sa.String(length=255), nullable=False, server_default='document.pdf'),
        sa.Column('private_storage_key', sa.String(length=500), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False, server_default='application/octet-stream'),
        sa.Column('file_size', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('checksum', sa.String(length=64), nullable=False, server_default=''),
        sa.Column('upload_status', sa.String(length=30), nullable=False, server_default='uploaded'),
        sa.Column('processing_status', sa.String(length=30), nullable=False, server_default='completed'),
        sa.Column('title', sa.String(length=255), nullable=True),
        sa.Column('file_url', sa.String(length=500), nullable=True),
        sa.Column('ocr_raw_text', sa.Text(), nullable=True),
        sa.Column('extracted_data_json', sa.Text(), server_default='{}'),
        sa.Column('is_verified', sa.Boolean(), server_default='0'),
        sa.Column('uploaded_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('processed_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
    )
    op.create_index('idx_medical_docs_user', 'medical_documents', ['user_id', 'document_type'])

    op.create_table(
        'document_extractions',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('document_id', sa.String(length=36), sa.ForeignKey('medical_documents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('extraction_version', sa.String(length=20), nullable=False, server_default='v1.0'),
        sa.Column('extracted_data_json', sa.Text(), nullable=False, server_default='{}'),
        sa.Column('extraction_confidence', sa.Float(), nullable=True),
        sa.Column('review_status', sa.String(length=30), nullable=False, server_default='unverified'),
        sa.Column('user_confirmed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('idx_doc_extractions_doc', 'document_extractions', ['document_id'])

    # 7. health_records & health_measurements
    op.create_table(
        'health_records',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('record_type', sa.String(length=50), nullable=False),
        sa.Column('biomarker_name', sa.String(length=100), nullable=False),
        sa.Column('record_date', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('numeric_value', sa.Float(), nullable=True),
        sa.Column('string_value', sa.String(length=255), nullable=True),
        sa.Column('structured_value', sa.Text(), nullable=True),
        sa.Column('unit', sa.String(length=50), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='normal'),
        sa.Column('source_type', sa.String(length=50), nullable=False, server_default='manual_entry'),
        sa.Column('source_document_id', sa.String(length=36), sa.ForeignKey('medical_documents.id', ondelete='SET NULL'), nullable=True),
        sa.Column('user_verified_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('idx_health_records_user_type_date', 'health_records', ['user_id', 'record_type', 'biomarker_name', 'record_date'])

    op.create_table(
        'health_measurements',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('unit', sa.String(length=30), nullable=False),
        sa.Column('status', sa.String(length=30), server_default='normal'),
        sa.Column('source', sa.String(length=50), server_default='manual'),
        sa.Column('source_document_id', sa.String(length=36), nullable=True),
        sa.Column('measured_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('ix_health_measurements_user_id', 'health_measurements', ['user_id'])

    # 8. medications, medication_schedules, medication_intake_logs
    op.create_table(
        'medications',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('medication_name', sa.String(length=255), nullable=False),
        sa.Column('strength', sa.String(length=100), nullable=True),
        sa.Column('dosage_instructions', sa.Text(), nullable=False),
        sa.Column('source_document_id', sa.String(length=36), sa.ForeignKey('medical_documents.id', ondelete='SET NULL'), nullable=True),
        sa.Column('verification_status', sa.String(length=50), nullable=False, server_default='unverified'),
        sa.Column('start_date', sa.String(length=30), nullable=True),
        sa.Column('end_date', sa.String(length=30), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('idx_medications_user_status', 'medications', ['user_id', 'status'])

    op.create_table(
        'medication_schedules',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('medication_id', sa.String(length=36), sa.ForeignKey('medications.id', ondelete='CASCADE'), nullable=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('dosage', sa.String(length=100), nullable=False),
        sa.Column('instructions', sa.String(length=255), server_default='Take with water'),
        sa.Column('frequency', sa.String(length=100), server_default='Once daily'),
        sa.Column('times_of_day', sa.Text(), server_default='["08:00 AM"]'),
        sa.Column('schedule_definition', sa.Text(), server_default='{"frequency": "once_daily", "times_of_day": ["08:00 AM"]}'),
        sa.Column('timezone', sa.String(length=50), nullable=False, server_default='Asia/Kolkata'),
        sa.Column('start_date', sa.String(length=30), nullable=True),
        sa.Column('end_date', sa.String(length=30), nullable=True),
        sa.Column('start_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('end_at', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='1'),
        sa.Column('refill_reminder', sa.Boolean(), server_default='1'),
        sa.Column('remaining_doses', sa.Integer(), server_default='30'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('idx_med_schedules_active', 'medication_schedules', ['medication_id', 'is_active'])

    op.create_table(
        'medication_intake_logs',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('medication_id', sa.String(length=36), sa.ForeignKey('medications.id', ondelete='CASCADE'), nullable=False),
        sa.Column('schedule_id', sa.String(length=36), sa.ForeignKey('medication_schedules.id', ondelete='SET NULL'), nullable=True),
        sa.Column('scheduled_at', sa.DateTime(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('recorded_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('user_note', sa.String(length=500), nullable=True),
        sa.UniqueConstraint('medication_id', 'scheduled_at', name='uq_med_intake_occurrence'),
    )
    op.create_index('idx_intake_logs_med_date', 'medication_intake_logs', ['medication_id', 'scheduled_at'])

    op.create_table(
        'adherence_logs',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('schedule_id', sa.String(length=36), sa.ForeignKey('medication_schedules.id', ondelete='CASCADE'), nullable=True),
        sa.Column('medicine_name', sa.String(length=255), nullable=False),
        sa.Column('scheduled_time', sa.String(length=50), nullable=True),
        sa.Column('action', sa.String(length=30), server_default='taken'),
        sa.Column('reason', sa.String(length=255), nullable=True),
        sa.Column('recorded_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
    )

    # 9. appointments
    op.create_table(
        'appointments',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('clinician_or_facility_reference', sa.String(length=255), nullable=True),
        sa.Column('appointment_title', sa.String(length=255), nullable=False, server_default='Doctor Appointment'),
        sa.Column('specialty', sa.String(length=150), server_default='General Medicine'),
        sa.Column('clinic_name', sa.String(length=255), server_default='Outpatient Clinic'),
        sa.Column('scheduled_start', sa.DateTime(), nullable=True),
        sa.Column('scheduled_end', sa.DateTime(), nullable=True),
        sa.Column('appointment_date', sa.String(length=30), nullable=False),
        sa.Column('appointment_time', sa.String(length=30), server_default='10:00 AM'),
        sa.Column('timezone', sa.String(length=50), nullable=False, server_default='Asia/Kolkata'),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('contact_phone', sa.String(length=50), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='confirmed'),
        sa.Column('reminder_enabled', sa.Boolean(), server_default='1'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('idx_appointments_user_time', 'appointments', ['user_id', 'scheduled_start'])

    # 10. notifications
    op.create_table(
        'notifications',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('notification_type', sa.String(length=50), nullable=False, server_default='info'),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('scheduled_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.Column('delivery_status', sa.String(length=30), nullable=False, server_default='pending'),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('idempotency_key', sa.String(length=100), unique=True, nullable=True),
        sa.Column('is_read', sa.Boolean(), server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('idx_notifications_pending', 'notifications', ['user_id', 'scheduled_at'])

    # 11. audit_events & audit_logs
    op.create_table(
        'audit_events',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('actor_user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action_type', sa.String(length=100), nullable=False),
        sa.Column('target_type', sa.String(length=100), nullable=False),
        sa.Column('target_id', sa.String(length=100), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('minimal_metadata', sa.Text(), server_default='{}'),
        sa.Column('ip_address', sa.String(length=50), nullable=True),
    )
    op.create_index('idx_audit_events_actor_time', 'audit_events', ['actor_user_id', 'timestamp'])
    op.create_index('idx_audit_events_action', 'audit_events', ['action_type', 'timestamp'])

    op.create_table(
        'audit_logs',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('ip_address', sa.String(length=50), nullable=True),
        sa.Column('timestamp', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
    )

    # 12. data_deletion_requests
    op.create_table(
        'data_deletion_requests',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('requested_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='pending'),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('outcome_summary', sa.Text(), nullable=True),
    )
    op.create_index('idx_deletion_requests_status', 'data_deletion_requests', ['status', 'requested_at'])

    # 13. medical_knowledge_sources & chunks
    op.create_table(
        'medical_knowledge_sources',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('source_name', sa.String(length=255), nullable=False),
        sa.Column('authoritative_body', sa.String(length=255), nullable=False),
        sa.Column('publication_date', sa.Date(), nullable=False),
        sa.Column('version', sa.String(length=50), nullable=False, server_default='1.0'),
        sa.Column('license_type', sa.String(length=100), server_default='Approved Clinical Guidelines'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )

    op.create_table(
        'medical_knowledge_chunks',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('source_id', sa.String(length=36), sa.ForeignKey('medical_knowledge_sources.id', ondelete='CASCADE'), nullable=False),
        sa.Column('topic', sa.String(length=100), nullable=False),
        sa.Column('keywords', sa.String(length=255), nullable=False),
        sa.Column('clinical_guideline_text', sa.Text(), nullable=False),
        sa.Column('target_demographic', sa.String(length=100), server_default='General Adult'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('idx_knowledge_chunks_topic', 'medical_knowledge_chunks', ['topic'])

    # 14. guardians
    op.create_table(
        'guardians',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('relationship', sa.String(length=100), nullable=False, server_default='Caregiver'),
        sa.Column('phone_number', sa.String(length=30), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('allow_medication_escalation', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('allow_emergency_notification', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('allow_care_connect_access', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('allow_health_view', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('idx_guardians_user', 'guardians', ['user_id'])

    # 15. wellness_logs
    op.create_table(
        'wellness_logs',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('date', sa.String(length=30), nullable=False),
        sa.Column('water_glasses', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('water_ml', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('target_water_ml', sa.Integer(), nullable=False, server_default='2500'),
        sa.Column('steps', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('target_steps', sa.Integer(), nullable=False, server_default='7000'),
        sa.Column('active_minutes', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sleep_hours', sa.Float(), nullable=False, server_default='7.0'),
        sa.Column('nutrition_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.UniqueConstraint('user_id', 'date', name='uq_user_wellness_date'),
    )
    op.create_index('idx_wellness_user_date', 'wellness_logs', ['user_id', 'date'])

    # 16. symptom_assessments
    op.create_table(
        'symptom_assessments',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('symptoms', sa.Text(), nullable=False),
        sa.Column('duration', sa.String(length=50), nullable=False, server_default='1-2 days'),
        sa.Column('severity', sa.Integer(), nullable=False, server_default='5'),
        sa.Column('urgency_level', sa.String(length=50), nullable=False, server_default='ROUTINE_CONSULT'),
        sa.Column('is_emergency', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('possible_explanations_json', sa.Text(), nullable=False, server_default='[]'),
        sa.Column('doctor_questions_json', sa.Text(), nullable=False, server_default='[]'),
        sa.Column('safe_next_steps_json', sa.Text(), nullable=False, server_default='[]'),
        sa.Column('assessed_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('idx_symptom_assessments_user', 'symptom_assessments', ['user_id', 'assessed_at'])

def downgrade() -> None:
    tables = [
        'symptom_assessments', 'wellness_logs', 'guardians', 'medical_knowledge_chunks',
        'medical_knowledge_sources', 'data_deletion_requests', 'audit_logs', 'audit_events',
        'notifications', 'appointments', 'adherence_logs', 'medication_intake_logs',
        'medication_schedules', 'medications', 'health_measurements', 'health_records',
        'document_extractions', 'medical_documents', 'chat_messages', 'chat_conversations',
        'user_consents', 'privacy_consents', 'authentication_sessions', 'user_profiles', 'users'
    ]
    for tbl in tables:
        op.drop_table(tbl)
