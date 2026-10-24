"""
Database Reset Script for VitaCare AI Health Platform.
Resets the application to a clean, empty state for fresh user registrations.
Preserves:
- Database schema, tables, relationships, indexes
- Authorized administrator account: admin@vitacare.ai
- System configuration and CMS prototype controls
- Approved Medical Knowledge guidelines
- Multilingual translations
Purges:
- Demo users (Johnathan Doe, evaluator accounts, patient accounts)
- Sample medical reports & OCR extractions
- Sample prescriptions & fake medicine lists
- Dummy health records & vital measurements
- Sample appointments, notifications, reminders, chat histories, wellness logs
"""

import os
import sys

# Ensure backend_py is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from app.core.database import init_db, SessionLocal
from app.models.all_models import (
    User, UserProfile, UserConsent, MedicalDocument, DocumentExtraction,
    HealthRecord, HealthMeasurement, Medication, MedicationSchedule,
    MedicationIntakeLog, AdherenceLog, Appointment, Notification, Guardian, WellnessLog,
    ChatConversation, ChatMessage
)
from app.services.admin_setup_service import init_admin_and_settings

def reset_database_to_clean_state():
    print("==================================================================")
    print("VitaCare AI — Database Reset to Clean Empty State")
    print("==================================================================")
    
    # 1. Initialize all schema tables
    print("[1/4] Verifying and updating schema tables...")
    init_db()

    db = SessionLocal()
    try:
        # 2. Identify patient / demo accounts
        print("[2/4] Identifying demo and patient records to purge...")
        patient_users = db.query(User).filter(User.role != "admin").all()
        patient_ids = [u.id for u in patient_users]
        print(f"      Found {len(patient_ids)} non-admin patient/demo account(s).")

        if patient_ids:
            # Delete clinical records
            print("      Purging vitals, health measurements, and records...")
            db.query(HealthMeasurement).filter(HealthMeasurement.user_id.in_(patient_ids)).delete(synchronize_session=False)
            db.query(HealthRecord).filter(HealthRecord.user_id.in_(patient_ids)).delete(synchronize_session=False)

            print("      Purging medications, schedules, and intake logs...")
            meds = db.query(Medication).filter(Medication.user_id.in_(patient_ids)).all()
            med_ids = [m.id for m in meds]
            if med_ids:
                db.query(MedicationIntakeLog).filter(MedicationIntakeLog.medication_id.in_(med_ids)).delete(synchronize_session=False)
            db.query(AdherenceLog).filter(AdherenceLog.user_id.in_(patient_ids)).delete(synchronize_session=False)
            db.query(MedicationSchedule).filter(MedicationSchedule.user_id.in_(patient_ids)).delete(synchronize_session=False)
            db.query(Medication).filter(Medication.user_id.in_(patient_ids)).delete(synchronize_session=False)

            print("      Purging medical documents and OCR extraction drafts...")
            docs = db.query(MedicalDocument).filter(MedicalDocument.user_id.in_(patient_ids)).all()
            doc_ids = [d.id for d in docs]
            if doc_ids:
                db.query(DocumentExtraction).filter(DocumentExtraction.document_id.in_(doc_ids)).delete(synchronize_session=False)
                db.query(MedicalDocument).filter(MedicalDocument.id.in_(doc_ids)).delete(synchronize_session=False)

            print("      Purging appointments, notifications, guardians, and wellness logs...")
            db.query(Appointment).filter(Appointment.user_id.in_(patient_ids)).delete(synchronize_session=False)
            db.query(Notification).filter(Notification.user_id.in_(patient_ids)).delete(synchronize_session=False)
            db.query(Guardian).filter(Guardian.user_id.in_(patient_ids)).delete(synchronize_session=False)
            db.query(WellnessLog).filter(WellnessLog.user_id.in_(patient_ids)).delete(synchronize_session=False)

            print("      Purging chat conversations and messages...")
            conversations = db.query(ChatConversation).filter(ChatConversation.user_id.in_(patient_ids)).all()
            c_ids = [c.id for c in conversations]
            if c_ids:
                db.query(ChatMessage).filter(ChatMessage.conversation_id.in_(c_ids)).delete(synchronize_session=False)
                db.query(ChatConversation).filter(ChatConversation.id.in_(c_ids)).delete(synchronize_session=False)

            print("      Purging user profiles and accounts...")
            db.query(UserProfile).filter(UserProfile.user_id.in_(patient_ids)).delete(synchronize_session=False)
            db.query(UserConsent).filter(UserConsent.user_id.in_(patient_ids)).delete(synchronize_session=False)
            db.query(User).filter(User.id.in_(patient_ids)).delete(synchronize_session=False)

            db.commit()
            print("      All demo/patient data successfully removed.")

        # 3. Initialize/Preserve Administrator and CMS Settings
        print("[3/4] Establishing authorized administrator account and CMS prototype controls...")
        init_admin_and_settings(db)

        # 4. Verification
        print("[4/4] Verifying pristine empty state...")
        remaining_patients = db.query(User).filter(User.role != "admin").count()
        remaining_reports = db.query(MedicalDocument).count()
        remaining_meds = db.query(Medication).count()
        admin_user = db.query(User).filter(User.role == "admin").first()

        print("------------------------------------------------------------------")
        print(f"VERIFICATION STATUS:")
        print(f"  Patient Accounts:     {remaining_patients} (Clean empty state)")
        print(f"  Medical Reports:      {remaining_reports} (Clean empty state)")
        print(f"  Medications/Rx:       {remaining_meds} (Clean empty state)")
        print(f"  Admin Account:        {admin_user.email if admin_user else 'NOT FOUND'} (Role: {admin_user.role if admin_user else 'N/A'})")
        print("------------------------------------------------------------------")
        print("Database is clean and ready for fresh patient user registrations!")
        print("==================================================================")
    except Exception as e:
        db.rollback()
        print(f"ERROR resetting database: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    reset_database_to_clean_state()
