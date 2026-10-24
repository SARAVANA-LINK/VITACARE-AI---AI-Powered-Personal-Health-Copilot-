import json
import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.all_models import (
    User, UserProfile, UserConsent, Guardian, MedicalDocument,
    HealthMeasurement, MedicationSchedule, AdherenceLog, Appointment,
    ChatThread, Notification, WellnessLog, SymptomAssessment
)
from app.services.storage_service import StorageService

router = APIRouter(prefix="/privacy", tags=["Privacy & GDPR Directives"])

@router.get("/export")
def export_user_data(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    GDPR-compliant complete personal health records structured JSON export.
    """
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    consents = db.query(UserConsent).filter(UserConsent.user_id == current_user.id).first()
    guardians = db.query(Guardian).filter(Guardian.user_id == current_user.id).all()
    vitals = db.query(HealthMeasurement).filter(HealthMeasurement.user_id == current_user.id).all()
    schedules = db.query(MedicationSchedule).filter(MedicationSchedule.user_id == current_user.id).all()
    adherence = db.query(AdherenceLog).filter(AdherenceLog.user_id == current_user.id).all()
    appointments = db.query(Appointment).filter(Appointment.user_id == current_user.id).all()
    documents = db.query(MedicalDocument).filter(MedicalDocument.user_id == current_user.id).all()
    symptoms = db.query(SymptomAssessment).filter(SymptomAssessment.user_id == current_user.id).all()

    return {
        "title": "VitaCare AI Patient Health Record Export",
        "exportedAt": datetime.datetime.utcnow().isoformat(),
        "patient": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "phone": current_user.phone,
            "age": current_user.age,
            "gender": current_user.gender,
            "bloodGroup": current_user.blood_group,
            "preferredLanguage": current_user.preferred_language
        },
        "profile": {
            "allergies": json.loads(profile.allergies) if profile and profile.allergies else [],
            "chronicConditions": json.loads(profile.chronic_conditions) if profile and profile.chronic_conditions else [],
            "currentMedications": json.loads(profile.current_medications) if profile and profile.current_medications else [],
            "heightCm": profile.height_cm if profile else None,
            "weightKg": profile.weight_kg if profile else None,
            "primaryPhysician": profile.primary_physician if profile else ""
        },
        "guardians": [{"name": g.name, "phone": g.phone_number, "relationship": g.relationship_type} for g in guardians],
        "vitals": [{"type": v.type, "value": v.value, "unit": v.unit, "date": v.measured_at.isoformat()} for v in vitals],
        "prescriptions": [{"name": s.name, "dosage": s.dosage, "frequency": s.frequency} for s in schedules],
        "adherenceHistory": [{"medicine": a.medicine_name, "action": a.action, "time": a.scheduled_time} for a in adherence],
        "appointments": [{"doctor": ap.doctor_name, "date": ap.appointment_date, "status": ap.status} for ap in appointments],
        "symptomAssessments": [{"symptoms": s.symptoms, "urgency": s.urgency_level} for s in symptoms],
        "documents": [{"title": d.title, "category": d.category, "url": d.file_url} for d in documents]
    }

@router.delete("/account")
def delete_account(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    GDPR Right-to-be-Forgotten: Permanently erases user account and all personal medical data.
    """
    # Delete uploaded files
    docs = db.query(MedicalDocument).filter(MedicalDocument.user_id == current_user.id).all()
    for d in docs:
        StorageService.delete_file(d.file_path)

    # Cascading database delete
    db.delete(current_user)
    db.commit()

    return {
        "success": True,
        "message": "Account, personal profile, and associated medical records have been permanently erased."
    }
