import json
import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.safety import ClinicalSafetyPipeline
from app.models.all_models import User, SymptomAssessment
from app.schemas.all_schemas import SymptomAssessRequest

router = APIRouter(prefix="/symptoms", tags=["Symptom Guidance & Triage"])

@router.post("/assess")
def assess_symptoms(
    req: SymptomAssessRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not req.symptoms or not req.symptoms.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please describe the symptoms you are experiencing."
        )

    text = f"{req.symptoms} {req.context or ''}".lower()
    severity = req.severity or 5
    duration = req.duration or "1-2 days"

    # Emergency Red Flag Check
    is_emergency, detected_flags = ClinicalSafetyPipeline.detect_emergency(text)
    if severity >= 9 and ("pain" in text or "breath" in text):
        is_emergency = True
        if not detected_flags:
            detected_flags = ["Severe pain scale (9+/10) requiring immediate emergency triage"]

    if is_emergency:
        urgency_level = "EMERGENCY_IMMEDIATE"
        recommended_facility = "Immediate Emergency Department (Call 108 / 112 / 911)"
    elif severity >= 7 or ("fever" in text and "week" in duration):
        urgency_level = "URGENT_EVALUATION"
        recommended_facility = "Urgent Care Center or Same-Day Outpatient Clinic (within 6–12 hours)"
    elif severity >= 4 or "day" in duration or req.fever:
        urgency_level = "ROUTINE_CONSULT"
        recommended_facility = "Primary Care Physician / Outpatient Clinic (within 24–48 hours)"
    else:
        urgency_level = "MONITOR_SELF_CARE"
        recommended_facility = "Home Observation & Supportive Hydration"

    # Generate explanations
    explanations = []
    if "cough" in text or "cold" in text or "throat" in text:
        explanations.append({
            "title": "Upper Respiratory Tract Viral Infection",
            "description": "Common viral pathogens (rhinovirus, adenovirus) commonly induce cough and throat irritation.",
            "likelihood": "Common"
        })
    if "headache" in text or "fever" in text:
        explanations.append({
            "title": "Tension Headache or Viral Prodrome",
            "description": "Systemic viral responses or hydration deficits frequently present with cephalic pressure.",
            "likelihood": "Common"
        })
    if not explanations:
        explanations.append({
            "title": "Non-Specific Symptom Presentation",
            "description": "Symptom constellation requires direct clinical evaluation and history taking.",
            "likelihood": "Possible"
        })

    doctor_questions = [
        "What diagnostic blood panels or imaging do you recommend to clarify the etiology?",
        "What warning signs should prompt me to seek immediate emergency care?",
        "Could any of my current medications or dietary habits contribute to these symptoms?"
    ]

    safe_next_steps = [
        "Maintain adequate resting hydration with electrolytes and water.",
        "Log symptom fluctuations and temperatures in your VitaCare Timeline.",
        "Do not start unprescribed medications without direct clinician consultation."
    ]

    # Save assessment
    assessment = SymptomAssessment(
        user_id=current_user.id,
        symptoms=req.symptoms.strip(),
        duration=duration,
        severity=severity,
        urgency_level=urgency_level,
        is_emergency=is_emergency,
        possible_explanations_json=json.dumps(explanations),
        doctor_questions_json=json.dumps(doctor_questions),
        safe_next_steps_json=json.dumps(safe_next_steps)
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)

    return {
        "success": True,
        "assessment": {
            "id": assessment.id,
            "urgencyLevel": urgency_level,
            "isEmergency": is_emergency,
            "detectedFlags": detected_flags,
            "recommendedFacility": recommended_facility,
            "possibleExplanations": explanations,
            "doctorQuestions": doctor_questions,
            "safeNextSteps": safe_next_steps,
            "disclaimer": "Symptom guidance is educational and does not constitute a formal diagnosis. Discuss all symptoms with a certified medical provider."
        }
    }

@router.get("/history")
def get_symptom_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(SymptomAssessment).filter(
        SymptomAssessment.user_id == current_user.id
    ).order_by(SymptomAssessment.assessed_at.desc()).all()

    formatted = []
    for item in items:
        formatted.append({
            "id": item.id,
            "symptoms": item.symptoms,
            "duration": item.duration,
            "severity": item.severity,
            "urgencyLevel": item.urgency_level,
            "isEmergency": item.is_emergency,
            "date": item.assessed_at.strftime("%b %d, %Y")
        })

    return {"history": formatted}
