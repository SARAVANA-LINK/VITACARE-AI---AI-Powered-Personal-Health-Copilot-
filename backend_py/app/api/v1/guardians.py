import json
import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.all_models import User, Guardian, Notification

router = APIRouter(prefix="/guardians", tags=["Authorized Healthcare Proxies & Guardians"])

@router.get("")
@router.get("/")
def get_guardians(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    guardians = db.query(Guardian).filter(Guardian.user_id == current_user.id).all()
    out = [
        {
            "id": g.id,
            "name": g.name,
            "relationship": g.relationship_type,
            "phoneNumber": g.phone_number,
            "email": g.email or "",
            "allowMedicationEscalation": g.allow_medication_escalation,
            "allowEmergencyNotification": g.allow_emergency_notification,
            "allowCareConnectAccess": g.allow_care_connect_access,
            "allowHealthView": g.allow_health_view
        }
        for g in guardians
    ]
    return {"guardians": out, "count": len(out)}

@router.post("")
@router.post("/")
def create_guardian(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    name = payload.get("name", "").strip()
    phone = (payload.get("phoneNumber") or payload.get("phone") or "").strip()
    if not name or not phone:
        raise HTTPException(status_code=400, detail="Caregiver name and phone number are required.")

    guardian = Guardian(
        user_id=current_user.id,
        name=name,
        relationship_type=payload.get("relationship", "Family Member"),
        phone_number=phone,
        email=payload.get("email", ""),
        allow_medication_escalation=bool(payload.get("allowMedicationEscalation", True)),
        allow_emergency_notification=bool(payload.get("allowEmergencyNotification", True)),
        allow_care_connect_access=bool(payload.get("allowCareConnectAccess", True)),
        allow_health_view=bool(payload.get("allowHealthView", False))
    )
    db.add(guardian)
    db.commit()
    db.refresh(guardian)

    return {"success": True, "guardian": {
        "id": guardian.id,
        "name": guardian.name,
        "phoneNumber": guardian.phone_number,
        "relationship": guardian.relationship_type
    }}

@router.put("/{id}")
def update_guardian(
    id: str,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    guardian = db.query(Guardian).filter(
        Guardian.id == id,
        Guardian.user_id == current_user.id
    ).first()
    if not guardian:
        raise HTTPException(status_code=404, detail="Caregiver proxy not found.")

    if "name" in payload:
        guardian.name = payload["name"].strip()
    if "relationship" in payload:
        guardian.relationship_type = payload["relationship"]
    if "phoneNumber" in payload:
        guardian.phone_number = payload["phoneNumber"]
    if "email" in payload:
        guardian.email = payload["email"]
    if "allowMedicationEscalation" in payload:
        guardian.allow_medication_escalation = bool(payload["allowMedicationEscalation"])
    if "allowEmergencyNotification" in payload:
        guardian.allow_emergency_notification = bool(payload["allowEmergencyNotification"])
    if "allowCareConnectAccess" in payload:
        guardian.allow_care_connect_access = bool(payload["allowCareConnectAccess"])
    if "allowHealthView" in payload:
        guardian.allow_health_view = bool(payload["allowHealthView"])

    db.commit()
    return {"success": True}

@router.delete("/{id}")
def delete_guardian(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    guardian = db.query(Guardian).filter(
        Guardian.id == id,
        Guardian.user_id == current_user.id
    ).first()
    if guardian:
        db.delete(guardian)
        db.commit()
    return {"success": True, "message": "Caregiver proxy removed."}

@router.post("/escalate")
def escalate_to_guardians(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    guardians = db.query(Guardian).filter(
        Guardian.user_id == current_user.id,
        Guardian.allow_medication_escalation == True
    ).all()

    med_name = payload.get("medicineName") or "critical medicine"
    for g in guardians:
        # Create notification record
        notif = Notification(
            user_id=current_user.id,
            title="Guardian Alert Dispatched",
            message=f"SMS notification triggered for {g.name} regarding scheduled dose of {med_name}.",
            type="guardian_escalation"
        )
        db.add(notif)
    db.commit()

    return {
        "success": True,
        "notifiedCount": len(guardians),
        "message": f"Escalation notification dispatched to {len(guardians)} authorized caregivers."
    }
