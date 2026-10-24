-- ==============================================================================
-- VitaCare AI Health Platform — PostgreSQL Seed Data
-- Fictional Users, Clinicians, Documents, Extractions, and Clinical Records
-- ==============================================================================

-- 1. APPROVED MEDICAL KNOWLEDGE SOURCES & CLINICAL GUIDELINES
INSERT INTO medical_knowledge_sources (id, source_name, authoritative_body, publication_date, version, license_type)
VALUES
('a0000001-0000-0000-0000-000000000001', 'Standards of Medical Care in Diabetes 2026', 'American Diabetes Association (ADA)', '2026-01-15', '2026.1', 'Open Clinical Guideline'),
('a0000001-0000-0000-0000-000000000002', 'Clinical Practice Guideline for the Management of High Blood Pressure', 'American Heart Association (AHA) / ACC', '2025-11-20', '2025.2', 'Open Clinical Guideline'),
('a0000001-0000-0000-0000-000000000003', 'Emergency Triage & Red-Flag Clinical Protocols', 'World Health Organization (WHO)', '2026-03-01', '3.4', 'Public Clinical Framework')
ON CONFLICT (id) DO NOTHING;

INSERT INTO medical_knowledge_chunks (id, source_id, topic, keywords, clinical_guideline_text, target_demographic)
VALUES
('b0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'Glycemic Targets', 'diabetes,hba1c,fasting glucose,hypoglycemia', 'For non-pregnant adults with type 2 diabetes: Target HbA1c is generally < 7.0% (53 mmol/mol). Preprandial capillary plasma glucose should be 80-130 mg/dL (4.4-7.2 mmol/L). Peak postprandial capillary plasma glucose < 180 mg/dL (10.0 mmol/L). Re-evaluate pharmacotherapy if HbA1c remains > 7.0% over two consecutive quarters.', 'Adults with T2D'),
('b0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000002', 'Hypertension Staging & Titration', 'blood pressure,hypertension,systolic,diastolic,lisinopril', 'Stage 1 Hypertension is defined as systolic BP 130-139 mmHg or diastolic BP 80-89 mmHg. Stage 2 Hypertension is systolic BP >= 140 mmHg or diastolic BP >= 90 mmHg. First-line pharmacologic agents include ACE inhibitors, ARBs, CCBs, or thiazide diuretics.', 'Adults >= 18 years'),
('b0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000003', 'Cardiovascular Emergency Red Flags', 'chest pain,radiating pain,shortness of breath,myocardial infarction,emergency', 'Acute crushing retrosternal chest pain radiating to the left arm, jaw, or shoulder accompanied by diaphoresis, dyspnea, or dizziness indicates possible acute coronary syndrome (ACS). Immediate activation of emergency medical services (e.g. 911 / 112) is mandatory. Do not delay for clinic consultation.', 'All Demographics')
ON CONFLICT (id) DO NOTHING;

-- 2. FICTIONAL USERS
-- Password hash corresponds to bcrypt of 'DemoSecure2026!'
INSERT INTO users (id, phone_number, email, password_hash, role, account_status, phone_verified_at, created_at, updated_at)
VALUES
('097b0603-ecf6-43c2-a80a-36affd188f4d', '+15551234567', 'johnathan.doe@vitacare.ai', '$2b$12$Z0.U4bCqBfq5Zg60G1e0te5y6s82VvH3pB2rLg1c3A8vK4rQ0G1e0', 'patient', 'active', NOW(), NOW(), NOW()),
('11111111-2222-3333-4444-555555555555', '+15559876543', 'eleanor.doe@example.com', '$2b$12$Z0.U4bCqBfq5Zg60G1e0te5y6s82VvH3pB2rLg1c3A8vK4rQ0G1e0', 'guardian', 'active', NOW(), NOW(), NOW()),
('22222222-3333-4444-5555-666666666666', '+15552345678', 'dr.sarah.lin@stjudespecialty.org', '$2b$12$Z0.U4bCqBfq5Zg60G1e0te5y6s82VvH3pB2rLg1c3A8vK4rQ0G1e0', 'clinician', 'active', NOW(), NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. USER PROFILES
INSERT INTO user_profiles (
    id, user_id, display_name, date_of_birth, gender, blood_group,
    profile_photo_reference, preferred_language, timezone, emergency_contact_reference,
    allergies_json, chronic_conditions_json, current_medications_json,
    height_cm, weight_kg, primary_physician
) VALUES (
    'c0000001-0000-0000-0000-000000000001',
    '097b0603-ecf6-43c2-a80a-36affd188f4d',
    'Johnathan Doe',
    '1978-05-14',
    'Male',
    'A+',
    'profile_photos/johnathan_doe.jpg',
    'en',
    'Asia/Kolkata',
    'Eleanor Doe (+1 555-987-6543)',
    '["Penicillin", "Peanuts (Mild)"]'::jsonb,
    '["Type 2 Diabetes Mellitus", "Stage 1 Essential Hypertension"]'::jsonb,
    '["Metformin 500mg", "Lisinopril 10mg", "Atorvastatin 20mg"]'::jsonb,
    178.0,
    82.0,
    'Dr. Sarah Lin, MD (St. Jude Specialty Care Clinic)'
) ON CONFLICT (user_id) DO NOTHING;

-- 4. PRIVACY CONSENTS (SEPARATE PURPOSE & SCOPE RECORDS)
INSERT INTO privacy_consents (id, user_id, consent_type, policy_version, granted, granted_at, purpose_and_scope)
VALUES
('d0000001-0000-0000-0000-000000000001', '097b0603-ecf6-43c2-a80a-36affd188f4d', 'account_terms', 'v1.0', TRUE, NOW(), 'Core health platform operation, authentication, and secure profile management.'),
('d0000001-0000-0000-0000-000000000002', '097b0603-ecf6-43c2-a80a-36affd188f4d', 'ai_processing', 'v1.0', TRUE, NOW(), 'AI health copilot consultations, clinical document OCR extraction, and triage synthesis.'),
('d0000001-0000-0000-0000-000000000003', '097b0603-ecf6-43c2-a80a-36affd188f4d', 'guardian_sharing', 'v1.0', TRUE, NOW(), 'Sharing missed medication alerts and emergency health status with designated healthcare proxy.'),
('d0000001-0000-0000-0000-000000000004', '097b0603-ecf6-43c2-a80a-36affd188f4d', 'emergency_alerts', 'v1.0', TRUE, NOW(), 'Automated urgent dispatch and SMS alerting for detected critical red-flag symptoms.')
ON CONFLICT (user_id, consent_type, policy_version) DO NOTHING;

-- 5. GUARDIANS / HEALTHCARE PROXIES
INSERT INTO guardians (id, user_id, name, relationship, phone_number, email, allow_medication_escalation, allow_emergency_notification, allow_care_connect_access, allow_health_view)
VALUES (
    'e0000001-0000-0000-0000-000000000001',
    '097b0603-ecf6-43c2-a80a-36affd188f4d',
    'Eleanor Doe',
    'Spouse / Primary Healthcare Proxy',
    '+15559876543',
    'eleanor.doe@example.com',
    TRUE,
    TRUE,
    TRUE,
    TRUE
) ON CONFLICT (id) DO NOTHING;

-- 6. MEDICAL DOCUMENTS & EXTRACTIONS
INSERT INTO medical_documents (
    id, user_id, document_type, original_filename, private_storage_key, mime_type,
    file_size, checksum, upload_status, processing_status, uploaded_at, processed_at
) VALUES
(
    'f0000001-0000-0000-0000-000000000001',
    '097b0603-ecf6-43c2-a80a-36affd188f4d',
    'prescription',
    'dr_lin_prescription_sep2026.pdf',
    'vault/patients/097b0603/prescriptions/20260901_rx.pdf',
    'application/pdf',
    245760,
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'uploaded',
    'completed',
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '45 days'
),
(
    'f0000001-0000-0000-0000-000000000002',
    '097b0603-ecf6-43c2-a80a-36affd188f4d',
    'lab_report',
    'comprehensive_metabolic_panel_oct2026.pdf',
    'vault/patients/097b0603/lab_reports/20261015_cmp.pdf',
    'application/pdf',
    512000,
    '7d793037a0760186574b0282f2f435e7090a6ff414b2d41b52a514d8727289f0',
    'uploaded',
    'completed',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '7 days'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO document_extractions (
    id, document_id, extraction_version, extracted_data_json, extraction_confidence, review_status, user_confirmed_at
) VALUES
(
    '10000001-0000-0000-0000-000000000001',
    'f0000001-0000-0000-0000-000000000001',
    'v1.2',
    '{"prescriber": "Dr. Sarah Lin, MD", "clinic": "St. Jude Specialty Care Clinic", "medications": [{"name": "Metformin", "strength": "500mg", "frequency": "twice daily"}, {"name": "Lisinopril", "strength": "10mg", "frequency": "once daily"}]}'::jsonb,
    0.985,
    'verified',
    NOW() - INTERVAL '44 days'
),
(
    '10000001-0000-0000-0000-000000000002',
    'f0000001-0000-0000-0000-000000000002',
    'v1.2',
    '{"panel": "Comprehensive Metabolic Panel + Lipid Profile", "results": [{"test": "HbA1c", "value": 6.8, "unit": "%", "status": "elevated"}, {"test": "Fasting Blood Glucose", "value": 136, "unit": "mg/dL", "status": "elevated"}]}'::jsonb,
    0.992,
    'verified',
    NOW() - INTERVAL '6 days'
) ON CONFLICT (id) DO NOTHING;

-- 7. HEALTH RECORDS & BIOMARKERS
INSERT INTO health_records (
    id, user_id, record_type, biomarker_name, record_date, numeric_value, unit,
    status, source_type, source_document_id, user_verified_at
) VALUES
('20000001-0000-0000-0000-000000000001', '097b0603-ecf6-43c2-a80a-36affd188f4d', 'vital_sign', 'bp_systolic', NOW() - INTERVAL '2 days', 124.0, 'mmHg', 'normal', 'manual_entry', NULL, NOW()),
('20000001-0000-0000-0000-000000000002', '097b0603-ecf6-43c2-a80a-36affd188f4d', 'vital_sign', 'bp_diastolic', NOW() - INTERVAL '2 days', 82.0, 'mmHg', 'normal', 'manual_entry', NULL, NOW()),
('20000001-0000-0000-0000-000000000003', '097b0603-ecf6-43c2-a80a-36affd188f4d', 'lab_result', 'blood_glucose', NOW() - INTERVAL '1 days', 136.0, 'mg/dL', 'elevated', 'ocr_extraction', 'f0000001-0000-0000-0000-000000000002', NOW()),
('20000001-0000-0000-0000-000000000004', '097b0603-ecf6-43c2-a80a-36affd188f4d', 'lab_result', 'hba1c', NOW() - INTERVAL '7 days', 6.8, '%', 'elevated', 'ocr_extraction', 'f0000001-0000-0000-0000-000000000002', NOW()),
('20000001-0000-0000-0000-000000000005', '097b0603-ecf6-43c2-a80a-36affd188f4d', 'vital_sign', 'heart_rate', NOW(), 72.0, 'bpm', 'normal', 'device_sync', NULL, NOW())
ON CONFLICT (id) DO NOTHING;

-- 8. MEDICATIONS & SCHEDULES & INTAKE LOGS
INSERT INTO medications (
    id, user_id, medication_name, strength, dosage_instructions,
    source_document_id, verification_status, start_date, end_date, status
) VALUES
('30000001-0000-0000-0000-000000000001', '097b0603-ecf6-43c2-a80a-36affd188f4d', 'Metformin', '500 mg', 'Take twice daily with breakfast and dinner to minimize GI disturbance.', 'f0000001-0000-0000-0000-000000000001', 'verified_by_user', '2026-09-01', NULL, 'active'),
('30000001-0000-0000-0000-000000000002', '097b0603-ecf6-43c2-a80a-36affd188f4d', 'Lisinopril', '10 mg', 'Take once daily in the morning with a full glass of water.', 'f0000001-0000-0000-0000-000000000001', 'verified_by_user', '2026-09-01', NULL, 'active'),
('30000001-0000-0000-0000-000000000003', '097b0603-ecf6-43c2-a80a-36affd188f4d', 'Atorvastatin', '20 mg', 'Take once daily at bedtime.', NULL, 'verified_by_user', '2026-09-01', NULL, 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO medication_schedules (
    id, medication_id, schedule_definition, timezone, start_at, active
) VALUES
('40000001-0000-0000-0000-000000000001', '30000001-0000-0000-0000-000000000001', '{"frequency": "twice_daily", "times_of_day": ["08:00 AM", "08:00 PM"]}'::jsonb, 'Asia/Kolkata', NOW() - INTERVAL '30 days', TRUE),
('40000001-0000-0000-0000-000000000002', '30000001-0000-0000-0000-000000000002', '{"frequency": "once_daily", "times_of_day": ["08:00 AM"]}'::jsonb, 'Asia/Kolkata', NOW() - INTERVAL '30 days', TRUE),
('40000001-0000-0000-0000-000000000003', '30000001-0000-0000-0000-000000000003', '{"frequency": "once_daily", "times_of_day": ["09:30 PM"]}'::jsonb, 'Asia/Kolkata', NOW() - INTERVAL '30 days', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO medication_intake_logs (
    id, medication_id, schedule_id, scheduled_at, status, recorded_at, user_note
) VALUES
('50000001-0000-0000-0000-000000000001', '30000001-0000-0000-0000-000000000001', '40000001-0000-0000-0000-000000000001', (CURRENT_DATE || ' 08:00:00')::timestamptz, 'taken', NOW() - INTERVAL '7 hours', 'Taken with breakfast oatmeal'),
('50000001-0000-0000-0000-000000000002', '30000001-0000-0000-0000-000000000002', '40000001-0000-0000-0000-000000000002', (CURRENT_DATE || ' 08:00:00')::timestamptz, 'taken', NOW() - INTERVAL '7 hours', 'Morning dose completed'),
('50000001-0000-0000-0000-000000000003', '30000001-0000-0000-0000-000000000001', '40000001-0000-0000-0000-000000000001', (CURRENT_DATE || ' 20:00:00')::timestamptz, 'pending', NOW(), 'Scheduled for dinner')
ON CONFLICT (medication_id, scheduled_at) DO NOTHING;

-- 9. APPOINTMENTS
INSERT INTO appointments (
    id, user_id, clinician_or_facility_reference, appointment_title, specialty,
    clinic_name, scheduled_start, scheduled_end, appointment_date, appointment_time,
    timezone, location, contact_phone, status, notes
) VALUES (
    '60000001-0000-0000-0000-000000000001',
    '097b0603-ecf6-43c2-a80a-36affd188f4d',
    'Dr. Sarah Lin, MD',
    'Quarterly HbA1c & Blood Pressure Consultation',
    'Endocrinology & Internal Medicine',
    'St. Jude Specialty Care Clinic',
    NOW() + INTERVAL '12 days',
    NOW() + INTERVAL '12 days' + INTERVAL '45 minutes',
    TO_CHAR(NOW() + INTERVAL '12 days', 'YYYY-MM-DD'),
    '10:30 AM',
    'Asia/Kolkata',
    'Suite 400, St. Jude Medical Plaza',
    '+15552345678',
    'confirmed',
    'Quarterly HbA1c review and medication titration review.'
) ON CONFLICT (id) DO NOTHING;

-- 10. NOTIFICATIONS
INSERT INTO notifications (
    id, user_id, notification_type, title, message, scheduled_at,
    delivery_status, retry_count, idempotency_key
) VALUES
(
    '70000001-0000-0000-0000-000000000001',
    '097b0603-ecf6-43c2-a80a-36affd188f4d',
    'medication_reminder',
    'Evening Medication Reminder',
    'Time to take Metformin 500 mg with dinner.',
    NOW() + INTERVAL '4 hours',
    'pending',
    0,
    'notif_med_rem_097b_20261024_eve'
),
(
    '70000001-0000-0000-0000-000000000002',
    '097b0603-ecf6-43c2-a80a-36affd188f4d',
    'appointment_alert',
    'Upcoming Consultation Reminder',
    'Upcoming visit with Dr. Sarah Lin in 12 days.',
    NOW() - INTERVAL '1 days',
    'delivered',
    0,
    'notif_appt_rem_097b_20261023'
) ON CONFLICT (idempotency_key) DO NOTHING;

-- 11. AUDIT EVENTS (HIPAA / GDPR LOGGING WITHOUT RAW PHI)
INSERT INTO audit_events (
    id, actor_user_id, action_type, target_type, target_id, timestamp, minimal_metadata, ip_address
) VALUES
('80000001-0000-0000-0000-000000000001', '097b0603-ecf6-43c2-a80a-36affd188f4d', 'USER_LOGIN', 'users', '097b0603-ecf6-43c2-a80a-36affd188f4d', NOW() - INTERVAL '2 hours', '{"method": "password_grant", "status": "success"}'::jsonb, '127.0.0.1'),
('80000001-0000-0000-0000-000000000002', '097b0603-ecf6-43c2-a80a-36affd188f4d', 'MEDICATION_LOGGED', 'medication_intake_logs', '50000001-0000-0000-0000-000000000001', NOW() - INTERVAL '7 hours', '{"medication_id": "30000001-0000-0000-0000-000000000001", "status": "taken"}'::jsonb, '127.0.0.1')
ON CONFLICT (id) DO NOTHING;

-- 12. CHAT CONVERSATIONS & MESSAGES
INSERT INTO chat_conversations (id, user_id, title, language, created_at, updated_at)
VALUES (
    '2dc4df3d-614c-4813-b7c8-f02dfdf7b654',
    '097b0603-ecf6-43c2-a80a-36affd188f4d',
    'Diabetes & Nutrition Consultation',
    'en',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '1 days'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO chat_messages (
    id, conversation_id, sender_role, message_text, model_identifier, safety_status, created_at
) VALUES
(
    '90000001-0000-0000-0000-000000000001',
    '2dc4df3d-614c-4813-b7c8-f02dfdf7b654',
    'user',
    'What should I eat before my morning workout to keep my blood sugar stable?',
    NULL,
    'safe',
    NOW() - INTERVAL '3 days'
),
(
    '90000001-0000-0000-0000-000000000002',
    '2dc4df3d-614c-4813-b7c8-f02dfdf7b654',
    'assistant',
    'Hello Johnathan. Because you are managing Type 2 Diabetes and taking Metformin, having a small snack combining complex carbohydrates with lean protein (such as Greek yogurt with a few berries or a slice of whole-grain toast with almond butter) 30-45 minutes before moderate exercise helps sustain normal glucose without inducing hypoglycemia.',
    'claude-3-7-sonnet',
    'safe',
    NOW() - INTERVAL '3 days'
) ON CONFLICT (id) DO NOTHING;

-- 13. WELLNESS & HYDRATION
INSERT INTO wellness_logs (
    id, user_id, date, water_glasses, water_ml, target_water_ml,
    steps, target_steps, active_minutes, sleep_hours, nutrition_notes
) VALUES (
    'a1000001-0000-0000-0000-000000000001',
    '097b0603-ecf6-43c2-a80a-36affd188f4d',
    CURRENT_DATE,
    6,
    1500,
    2500,
    5420,
    7000,
    40,
    7.4,
    'Mediterranean diet, controlled carbohydrates, reduced sodium.'
) ON CONFLICT (user_id, date) DO NOTHING;

-- 14. SYMPTOM ASSESSMENTS
INSERT INTO symptom_assessments (
    id, user_id, symptoms, duration, severity, urgency_level, is_emergency,
    possible_explanations_json, doctor_questions_json, safe_next_steps_json, assessed_at
) VALUES (
    'b1000001-0000-0000-0000-000000000001',
    '097b0603-ecf6-43c2-a80a-36affd188f4d',
    'Mild afternoon headache after outdoor walk in heat',
    '2 hours',
    3,
    'MONITOR_SELF_CARE',
    FALSE,
    '["Mild dehydration", "Heat-induced tension headache"]'::jsonb,
    '["Is there any vision blurring or dizziness?", "Have you consumed enough electrolytes today?"]'::jsonb,
    '["Drink 500ml of room temperature water with electrolytes", "Rest in a cool, shaded environment for 30 minutes"]'::jsonb,
    NOW() - INTERVAL '4 hours'
) ON CONFLICT (id) DO NOTHING;
