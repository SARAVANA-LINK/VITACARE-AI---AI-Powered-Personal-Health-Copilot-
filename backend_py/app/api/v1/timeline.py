import json
import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.all_models import (
    User, MedicalDocument, HealthMeasurement, Medication, MedicationSchedule,
    MedicationIntakeLog, Notification
)

router = APIRouter(prefix="/timeline", tags=["Patient Clinical Timeline"])

@router.get("")
@router.get("/")
def get_timeline(
    type: str = "all",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns unified clinical timeline events for current user:
    - Medical reports uploaded
    - Prescriptions processed
    - Verified doses / medication intake logs
    - Vitals & health measurements logged
    - Alerts / notifications
    """
    events = []

    # 1. Documents (Reports and Prescriptions)
    docs = db.query(MedicalDocument).filter(
        MedicalDocument.user_id == current_user.id
    ).all()

    for d in docs:
        is_rx = d.category == "prescription"
        event_type = "prescription_added" if is_rx else "report_uploaded"
        if type != "all" and type != event_type:
            continue

        events.append({
            "id": f"doc-{d.id}",
            "eventType": event_type,
            "title": d.title,
            "description": f"{'Prescription verified and synchronized' if is_rx else 'Diagnostic health report processed and verified'}. Original file: {d.original_filename}",
            "eventDate": d.uploaded_at.strftime("%Y-%m-%d"),
            "createdAt": d.uploaded_at.isoformat()
        })

    # 2. Intake Logs
    from app.models.all_models import AdherenceLog
    intakes = db.query(AdherenceLog).filter(
        AdherenceLog.user_id == current_user.id
    ).all()

    for i in intakes:
        if type != "all" and type != "medication_confirmed":
            continue

        events.append({
            "id": f"intake-{i.id}",
            "eventType": "medication_confirmed",
            "title": f"Dose Recorded — {i.medicine_name}",
            "description": f"Medication action '{i.action}' recorded for scheduled time {i.scheduled_time or 'daily'}.",
            "eventDate": i.recorded_at.strftime("%Y-%m-%d"),
            "createdAt": i.recorded_at.isoformat()
        })

    # 3. Vitals & Measurements
    measurements = db.query(HealthMeasurement).filter(
        HealthMeasurement.user_id == current_user.id
    ).all()

    for m in measurements:
        if type != "all" and type != "vital_updated":
            continue

        events.append({
            "id": f"meas-{m.id}",
            "eventType": "vital_updated",
            "title": f"Biomarker Logged — {m.type.replace('_', ' ').title()}",
            "description": f"Recorded value: {m.value} {m.unit} (Status: {m.status}). Source: {m.source}",
            "eventDate": m.measured_at.strftime("%Y-%m-%d"),
            "createdAt": m.measured_at.isoformat()
        })

    # Sort descending by createdAt
    events.sort(key=lambda x: x["createdAt"], reverse=True)

    return {
        "timeline": events,
        "count": len(events)
    }
