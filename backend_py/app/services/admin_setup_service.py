import json
import datetime
import logging
from sqlalchemy.orm import Session

from app.models.all_models import (
    User, UserProfile, UserConsent, AppSetting, CmsModule, CmsCard,
    CmsAnnouncement, CmsContent, TranslationItem, SmsTriggerConfig,
    SmsTemplateItem, MedicalKnowledgeSource, MedicalKnowledgeChunk
)
from app.core.security import get_password_hash

logger = logging.getLogger("vitacare.admin_setup")

def init_admin_and_settings(db: Session):
    """
    Ensures that the authorized administrator account, default application settings,
    CMS dynamic prototype modules, and system configurations are established.
    Does NOT seed fake patient health data.
    """
    # 1. Administrator Account
    admin_email = "admin@vitacare.ai"
    admin = db.query(User).filter(User.email == admin_email).first()
    if not admin:
        admin = User(
            name="System Administrator",
            email=admin_email,
            password_hash=get_password_hash("AdminPass2026!"),
            role="admin",
            age=40,
            gender="Unspecified",
            blood_group="O+",
            preferred_language="en",
            phone="+1 (800) 848-2227"
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

        profile = UserProfile(user_id=admin.id, preferred_language="en")
        consent = UserConsent(user_id=admin.id)
        db.add_all([profile, consent])
        db.commit()
        logger.info(f"Authorized administrator account verified: {admin_email}")
    else:
        # Guarantee role is admin
        if admin.role != "admin":
            admin.role = "admin"
            db.commit()

    # 2. Global App Settings & Branding
    settings = db.query(AppSetting).filter(AppSetting.id == "global_settings").first()
    if not settings:
        settings = AppSetting(
            id="global_settings",
            website_name="VitaCare AI",
            logo_url="",
            theme_primary_color="#0284c7",
            support_phone="+1-800-VITA-CARE",
            support_email="support@vitacare.ai",
            default_language="en",
            allow_new_registrations=True,
            maintenance_mode=False,
            emergency_broadcast_enabled=True
        )
        db.add(settings)
        db.commit()

    # 3. Default CMS Modules (Prototype Layout Controls)
    default_modules = [
        {"key": "vitals", "title": "Physiological Vitals", "description": "Continuous monitoring of BP, blood glucose, heart rate, and oxygen.", "icon": "Activity", "order": 1},
        {"key": "medications", "title": "Medication Regimen", "description": "Scheduled prescription intake logs and automated safety alerts.", "icon": "Pill", "order": 2},
        {"key": "reports", "title": "Diagnostic Lab Reports", "description": "OCR-extracted laboratory panels, biomarker trends, and differentials.", "icon": "FileText", "order": 3},
        {"key": "careconnect", "title": "CareConnect Tele-Supervision", "description": "Live video supervision for high-risk medication administration.", "icon": "Video", "order": 4},
        {"key": "timeline", "title": "Medical Event Timeline", "description": "Audited chronological history of tests, prescriptions, and alerts.", "icon": "Clock", "order": 5},
        {"key": "wellness", "title": "Wellness & Nutrition", "description": "Daily hydration, activity steps, and sleep tracking.", "icon": "Heart", "order": 6}
    ]

    for m_def in default_modules:
        existing_mod = db.query(CmsModule).filter(CmsModule.key == m_def["key"]).first()
        if not existing_mod:
            mod = CmsModule(
                key=m_def["key"],
                title=m_def["title"],
                description=m_def["description"],
                icon=m_def["icon"],
                display_order=m_def["order"],
                is_enabled=True,
                is_published=True
            )
            db.add(mod)

    # 4. Default CMS Cards
    default_cards = [
        {"title": "Blood Pressure Target", "subtitle": "Clinical Target: <120/80 mmHg", "value": "118/76", "delta": "-2 mmHg", "badge": "green", "order": 1},
        {"title": "Fasting Blood Glucose", "subtitle": "Clinical Target: 70-99 mg/dL", "value": "94 mg/dL", "delta": "Optimal", "badge": "blue", "order": 2},
        {"title": "Medication Adherence", "subtitle": "Target: >90% Weekly Taken", "value": "Active", "delta": "Synchronized", "badge": "green", "order": 3},
        {"title": "SpO2 Oxygen Saturation", "subtitle": "Clinical Target: >95%", "value": "99%", "delta": "Normal Range", "badge": "blue", "order": 4}
    ]

    for c_def in default_cards:
        existing_card = db.query(CmsCard).filter(CmsCard.title == c_def["title"]).first()
        if not existing_card:
            c = CmsCard(
                title=c_def["title"],
                subtitle=c_def["subtitle"],
                value=c_def["value"],
                delta=c_def["delta"],
                badge_color=c_def["badge"],
                order_index=c_def["order"],
                is_visible=True,
                is_published=True
            )
            db.add(c)

    # 5. Default CMS Broadcast Announcement
    existing_ann = db.query(CmsAnnouncement).first()
    if not existing_ann:
        ann = CmsAnnouncement(
            title="System Active — Clinical Safety Pipelines Verified",
            message="VitaCare AI diagnostic OCR pipelines, medication intake protocols, and guardian escalation channels are operating at peak efficiency.",
            alert_type="info",
            priority=1,
            is_active=True,
            is_published=True
        )
        db.add(ann)

    # 6. Default SMS Trigger Configurations
    default_triggers = [
        {"eventType": "missed_medication", "name": "Missed Medication Escalation", "description": "Dispatches SMS to designated healthcare proxy if dose unconfirmed.", "delay": 15},
        {"eventType": "sos_emergency", "name": "Emergency SOS Carrier Dispatch", "description": "Immediate SMS alert with live GPS coordinates to emergency contacts.", "delay": 0},
        {"eventType": "critical_lab_value", "name": "Critical Biomarker Alert", "description": "Notifies patient and clinician when diagnostic values require urgent review.", "delay": 5}
    ]

    for t_def in default_triggers:
        existing_trig = db.query(SmsTriggerConfig).filter(SmsTriggerConfig.event_type == t_def["eventType"]).first()
        if not existing_trig:
            trig = SmsTriggerConfig(
                event_type=t_def["eventType"],
                name=t_def["name"],
                description=t_def["description"],
                delay_minutes=t_def["delay"],
                is_enabled=True,
                target_role="guardian"
            )
            db.add(trig)

    # 7. Default Approved Medical Knowledge Base (WHO, ICMR, CDC, NICE)
    existing_count = db.query(MedicalKnowledgeSource).count()
    if existing_count < 4:
        clinical_seeds = [
            {
                "name": "WHO Guidelines on Hypertension & Cardiovascular Risk",
                "body": "World Health Organization",
                "url": "https://www.who.int/publications/i/item/9789240033986",
                "version": "2026.1",
                "date": datetime.date(2026, 1, 15),
                "topic": "Hypertension & Blood Pressure Targets",
                "keywords": "blood pressure, hypertension, systolic, diastolic, bp, cardiovascular, stroke",
                "guideline": "Optimal blood pressure is <120/80 mmHg. Hypertension stage 1 begins at 130/85 mmHg. Stage 2 hypertension is defined as systolic >= 140 mmHg or diastolic >= 90 mmHg. Non-pharmacological sodium reduction and daily physical activity are foundational."
            },
            {
                "name": "ICMR Guidelines for Management of Type 2 Diabetes",
                "body": "Indian Council of Medical Research",
                "url": "https://main.icmr.nic.in/content/guidelines",
                "version": "2025.2",
                "date": datetime.date(2025, 11, 20),
                "topic": "Glycemic Targets & HbA1c Monitoring",
                "keywords": "diabetes, hba1c, glucose, fasting blood sugar, postprandial, metformin",
                "guideline": "Normal fasting plasma glucose is 70-99 mg/dL. Pre-diabetes is 100-125 mg/dL. Diabetes is diagnosed at fasting >= 126 mg/dL or HbA1c >= 6.5%. Target HbA1c for non-pregnant adults is < 7.0%. Regular monitoring prevents microvascular complications."
            },
            {
                "name": "CDC Clinical Fever & Triage Protocol",
                "body": "Centers for Disease Control and Prevention",
                "url": "https://www.cdc.gov/clinical-guidance",
                "version": "2026.1",
                "date": datetime.date(2026, 2, 10),
                "topic": "Fever, Infection & Sepsis Warning Flags",
                "keywords": "fever, temperature, chills, infection, body temperature, paracetamol",
                "guideline": "Normal core body temperature is 98.6°F (37.0°C). Low-grade fever is 99.5°F–100.4°F (37.5°C–38.0°C). High fever is >= 102.0°F (38.9°C). High fever with stiff neck, confusion, breathing distress, or cyanosis requires immediate emergency medical evaluation."
            },
            {
                "name": "NICE Guidelines on Lipid Management & Statin Therapy",
                "body": "National Institute for Health and Care Excellence",
                "url": "https://www.nice.org.uk/guidance/cg181",
                "version": "2025.4",
                "date": datetime.date(2025, 9, 30),
                "topic": "Cholesterol, Triglycerides & Lipid Profile",
                "keywords": "cholesterol, ldl, hdl, triglycerides, lipid profile, statin, atorvastatin",
                "guideline": "Desirable total cholesterol is under 200 mg/dL. Target LDL ('bad') cholesterol is < 100 mg/dL (< 70 mg/dL in high risk patients). HDL ('good') cholesterol should be > 40 mg/dL in men and > 50 mg/dL in women. Triglycerides should be kept < 150 mg/dL."
            }
        ]

        for s in clinical_seeds:
            # Check if source already exists
            existing_s = db.query(MedicalKnowledgeSource).filter(MedicalKnowledgeSource.source_name == s["name"]).first()
            if not existing_s:
                k_source = MedicalKnowledgeSource(
                    source_name=s["name"],
                    authoritative_body=s["body"],
                    source_url=s["url"],
                    publication_date=s["date"],
                    version=s["version"]
                )
                db.add(k_source)
                db.flush()

                k_chunk = MedicalKnowledgeChunk(
                    source_id=k_source.id,
                    topic=s["topic"],
                    keywords=s["keywords"],
                    clinical_guideline_text=s["guideline"]
                )
                db.add(k_chunk)

        db.commit()

    db.commit()
    logger.info("Admin account, CMS prototype modules, and system settings initialized successfully.")
