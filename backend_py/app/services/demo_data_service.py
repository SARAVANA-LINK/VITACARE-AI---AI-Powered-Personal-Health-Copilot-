import json
import datetime
from sqlalchemy.orm import Session
from app.models.all_models import (
    User, UserProfile, UserConsent, Guardian, MedicalDocument,
    HealthMeasurement, MedicationSchedule, AdherenceLog, Appointment,
    ChatThread, ChatMessage, WellnessLog
)
from app.core.security import get_password_hash

def seed_demo_patient(db: Session) -> User:
    """
    Seeds evaluator demo patient Johnathan Doe with realistic clinical data.
    """
    user = db.query(User).filter(User.email == "johnathan.doe@vitacare.ai").first()
    if not user:
        user = User(
            email="johnathan.doe@vitacare.ai",
            name="Johnathan Doe",
            password_hash=get_password_hash("DemoSecure2026!"),
            role="patient",
            age=48,
            gender="Male",
            blood_group="A+",
            preferred_language="en",
            emergency_phone="+1 (555) 987-6543"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Profile
        profile = UserProfile(
            user_id=user.id,
            allergies=json.dumps(["Penicillin", "Peanuts (Mild)"]),
            chronic_conditions=json.dumps(["Type 2 Diabetes Mellitus", "Stage 1 Essential Hypertension"]),
            current_medications=json.dumps(["Metformin 500mg", "Lisinopril 10mg", "Atorvastatin 20mg"]),
            height_cm=178.0,
            weight_kg=82.0,
            primary_physician="Dr. Sarah Lin, MD (St. Jude Specialty Care Clinic)",
            emergency_contacts=json.dumps([{"name": "Eleanor Doe", "phone": "+1 (555) 987-6543", "relation": "Spouse"}]),
            preferred_language="en"
        )
        db.add(profile)

        # Consents
        consents = UserConsent(
            user_id=user.id,
            data_processing_accepted=True,
            guardian_sharing_accepted=True,
            emergency_alerts_accepted=True,
            teleconsult_accepted=False
        )
        db.add(consents)

        # Guardian / Healthcare Proxy
        guardian = Guardian(
            user_id=user.id,
            name="Eleanor Doe",
            relationship_type="Spouse / Primary Healthcare Proxy",
            phone_number="+1 (555) 987-6543",
            email="eleanor.doe@example.com",
            allow_medication_escalation=True,
            allow_emergency_notification=True,
            allow_care_connect_access=True,
            allow_health_view=True
        )
        db.add(guardian)

        # Medication Schedules
        sched1 = MedicationSchedule(
            user_id=user.id,
            name="Metformin",
            dosage="500 mg",
            instructions="Take with meals to prevent GI upset",
            frequency="Twice daily (Morning & Evening)",
            times_of_day=json.dumps(["08:00 AM", "08:00 PM"]),
            start_date="2026-09-01",
            remaining_doses=48
        )
        sched2 = MedicationSchedule(
            user_id=user.id,
            name="Lisinopril",
            dosage="10 mg",
            instructions="Take in the morning with water",
            frequency="Once daily",
            times_of_day=json.dumps(["08:00 AM"]),
            start_date="2026-09-01",
            remaining_doses=22
        )
        sched3 = MedicationSchedule(
            user_id=user.id,
            name="Atorvastatin",
            dosage="20 mg",
            instructions="Take at bedtime",
            frequency="Once daily",
            times_of_day=json.dumps(["09:30 PM"]),
            start_date="2026-09-01",
            remaining_doses=25
        )
        db.add_all([sched1, sched2, sched3])

        # Vitals Measurements
        now = datetime.datetime.utcnow()
        vitals = [
            HealthMeasurement(user_id=user.id, type="bp_systolic", value=124.0, unit="mmHg", status="normal", measured_at=now - datetime.timedelta(days=2)),
            HealthMeasurement(user_id=user.id, type="bp_diastolic", value=82.0, unit="mmHg", status="normal", measured_at=now - datetime.timedelta(days=2)),
            HealthMeasurement(user_id=user.id, type="blood_glucose", value=136.0, unit="mg/dL", status="elevated", measured_at=now - datetime.timedelta(days=1)),
            HealthMeasurement(user_id=user.id, type="hba1c", value=6.8, unit="%", status="elevated", measured_at=now - datetime.timedelta(days=7)),
            HealthMeasurement(user_id=user.id, type="heart_rate", value=72.0, unit="bpm", status="normal", measured_at=now)
        ]
        db.add_all(vitals)

        # Appointments
        appt = Appointment(
            user_id=user.id,
            doctor_name="Dr. Sarah Lin, MD",
            specialty="Endocrinology & Internal Medicine",
            clinic_name="St. Jude Specialty Care Clinic",
            appointment_date=(now + datetime.timedelta(days=12)).strftime("%Y-%m-%d"),
            appointment_time="10:30 AM",
            location="Suite 400, St. Jude Medical Plaza",
            contact_phone="+1 (555) 234-5678",
            notes="Quarterly HbA1c review and medication titration."
        )
        db.add(appt)

        # Wellness Log
        wellness = WellnessLog(
            user_id=user.id,
            date=now.strftime("%Y-%m-%d"),
            water_glasses=6,
            water_ml=1500,
            target_water_ml=2500,
            steps=5420,
            target_steps=7000,
            active_minutes=40,
            sleep_hours=7.4,
            nutrition_notes="Mediterranean diet, controlled carbohydrates, reduced sodium."
        )
        db.add(wellness)

        # AI Thread
        thread = ChatThread(user_id=user.id, title="Diabetes & Nutrition Guidance")
        db.add(thread)
        db.commit()
        db.refresh(thread)

        msg = ChatMessage(
            thread_id=thread.id,
            user_id=user.id,
            role="assistant",
            content="Hello Johnathan! I am your VitaCare AI Health Assistant. I am familiar with your clinical profile (Type 2 Diabetes, Stage 1 Hypertension). How may I assist you with your health today?",
            language="en"
        )
        db.add(msg)
        db.commit()

    return user
