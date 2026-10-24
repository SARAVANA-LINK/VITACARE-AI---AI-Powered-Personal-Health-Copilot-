import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.all_models import User, UserProfile, Guardian
from app.schemas.all_schemas import ProfileUpdateRequest, GuardianCreate

router = APIRouter(prefix="/users", tags=["User Profiles"])

@router.get("/profile")
def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    allergies = json.loads(profile.allergies) if profile and profile.allergies else []
    conditions = json.loads(profile.chronic_conditions) if profile and profile.chronic_conditions else []
    meds = json.loads(profile.current_medications) if profile and profile.current_medications else []
    contacts = json.loads(profile.emergency_contacts) if profile and profile.emergency_contacts else []

    return {
        "user": current_user,
        "profile": {
            "allergies": allergies,
            "chronicConditions": conditions,
            "currentMedications": meds,
            "heightCm": profile.height_cm if profile else None,
            "weightKg": profile.weight_kg if profile else None,
            "primaryPhysician": profile.primary_physician if profile else "",
            "emergencyContacts": contacts
        }
    }

@router.put("/profile")
def update_profile(req: ProfileUpdateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Update User base fields
    if req.name is not None: current_user.name = req.name.strip()
    if req.age is not None: current_user.age = req.age
    if req.gender is not None: current_user.gender = req.gender
    if req.bloodGroup is not None: current_user.blood_group = req.bloodGroup
    if req.emergencyPhone is not None: current_user.emergency_phone = req.emergencyPhone
    if req.preferredLanguage is not None: current_user.preferred_language = req.preferredLanguage

    # Update UserProfile clinical fields
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)

    if req.allergies is not None: profile.allergies = json.dumps(req.allergies)
    if req.chronicConditions is not None: profile.chronic_conditions = json.dumps(req.chronicConditions)
    if req.currentMedications is not None: profile.current_medications = json.dumps(req.currentMedications)
    if req.heightCm is not None: profile.height_cm = req.heightCm
    if req.weightKg is not None: profile.weight_kg = req.weightKg
    if req.primaryPhysician is not None: profile.primary_physician = req.primaryPhysician

    db.commit()
    db.refresh(current_user)
    db.refresh(profile)

    return {
        "success": True,
        "message": "Clinical health profile updated successfully.",
        "user": current_user,
        "profile": {
            "allergies": json.loads(profile.allergies),
            "chronicConditions": json.loads(profile.chronic_conditions),
            "currentMedications": json.loads(profile.current_medications),
            "heightCm": profile.height_cm,
            "weightKg": profile.weight_kg,
            "primaryPhysician": profile.primary_physician
        }
    }

@router.put("/language")
def update_user_language(body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lang = body.get("language") or body.get("preferredLanguage")
    if lang:
        current_user.preferred_language = str(lang).strip()
        profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
        if profile:
            profile.preferred_language = str(lang).strip()
        db.commit()
        db.refresh(current_user)
    return {
        "success": True,
        "message": f"Language preference set to {current_user.preferred_language}.",
        "preferredLanguage": current_user.preferred_language,
        "user": current_user
    }

@router.get("/guardians")
def list_guardians(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    guardians = db.query(Guardian).filter(Guardian.user_id == current_user.id).all()
    return {"guardians": guardians, "count": len(guardians)}

@router.post("/guardians")
def create_guardian(req: GuardianCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    guardian = Guardian(
        user_id=current_user.id,
        name=req.name.strip(),
        relationship_type=req.relationship,
        phone_number=req.phoneNumber.strip(),
        email=req.email.strip() if req.email else None,
        allow_medication_escalation=req.allowMedicationEscalation,
        allow_emergency_notification=req.allowEmergencyNotification,
        allow_care_connect_access=req.allowCareConnectAccess,
        allow_health_view=req.allowHealthView
    )
    db.add(guardian)
    db.commit()
    db.refresh(guardian)
    return {"success": True, "guardian": guardian}

@router.delete("/guardians/{guardian_id}")
def delete_guardian(guardian_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    guardian = db.query(Guardian).filter(Guardian.id == guardian_id, Guardian.user_id == current_user.id).first()
    if not guardian:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guardian not found.")
    db.delete(guardian)
    db.commit()
    return {"success": True, "message": "Guardian proxy removed successfully."}
