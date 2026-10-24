import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.all_models import User, HealthMeasurement
from app.schemas.all_schemas import MeasurementCreate

router = APIRouter(tags=["Health Records & Biomarkers"])

@router.get("/health-records/vitals")
@router.get("/health/vitals")
@router.get("/vitals")
def get_vitals(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    vitals = db.query(HealthMeasurement).filter(
        HealthMeasurement.user_id == current_user.id
    ).order_by(HealthMeasurement.measured_at.desc()).all()
    return {"vitals": vitals, "count": len(vitals)}

@router.post("/health-records/vitals", status_code=status.HTTP_201_CREATED)
@router.post("/health/vitals", status_code=status.HTTP_201_CREATED)
@router.post("/vitals", status_code=status.HTTP_201_CREATED)
def record_vital(
    req: MeasurementCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Determine clinical status
    status_label = "normal"
    val = req.value
    t = req.type.lower()

    if t == "bp_systolic":
        status_label = "elevated" if val >= 130 else ("critical" if val >= 180 else "normal")
    elif t == "bp_diastolic":
        status_label = "elevated" if val >= 85 else ("critical" if val >= 120 else "normal")
    elif t == "blood_glucose":
        status_label = "elevated" if val > 125 else ("low" if val < 70 else "normal")
    elif t == "hba1c":
        status_label = "elevated" if val >= 6.5 else "normal"
    elif t == "spo2":
        status_label = "critical" if val < 90 else ("low" if val < 95 else "normal")

    measurement = HealthMeasurement(
        user_id=current_user.id,
        type=req.type,
        value=req.value,
        unit=req.unit,
        status=status_label,
        source=req.source or "manual",
        measured_at=datetime.datetime.utcnow()
    )
    db.add(measurement)
    db.commit()
    db.refresh(measurement)

    return {"success": True, "measurement": measurement}

@router.get("/health-records/trends")
@router.get("/health/trends")
@router.get("/trends")
def get_trends(
    type: Optional[str] = None,
    metric: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_type = metric or type or "bp_systolic"
    readings = db.query(HealthMeasurement).filter(
        HealthMeasurement.user_id == current_user.id,
        HealthMeasurement.type == target_type
    ).order_by(HealthMeasurement.measured_at.asc()).all()

    points = [
        {
            "date": r.measured_at.strftime("%Y-%m-%d"),
            "value": r.value,
            "unit": r.unit,
            "status": r.status
        }
        for r in readings
    ]

    return {
        "type": target_type,
        "metric": target_type,
        "readings": points,
        "count": len(points),
        "hasEnoughData": len(points) >= 2,
        "notice": None if len(points) >= 2 else "At least 2 historical readings required to plot biomarker trends."
    }

@router.get("/health-records/history")
@router.get("/health/history")
@router.get("/history")
def get_history(
    metricKey: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(HealthMeasurement).filter(HealthMeasurement.user_id == current_user.id)
    if metricKey:
        query = query.filter(HealthMeasurement.type == metricKey)
    readings = query.order_by(HealthMeasurement.measured_at.desc()).all()

    return {
        "history": [
            {
                "id": r.id,
                "metricKey": r.type,
                "value": r.value,
                "unit": r.unit,
                "status": r.status,
                "source": r.source,
                "date": r.measured_at.strftime("%Y-%m-%d %H:%M")
            }
            for r in readings
        ],
        "count": len(readings)
    }

@router.post("/health-records/manual-vital")
@router.post("/health/manual-vital")
@router.post("/manual-vital")
def log_manual_vital(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    metric_type = body.get("type") or body.get("metricKey") or "blood_glucose"
    value = float(body.get("value", 0))
    unit = body.get("unit") or "mg/dL"
    status_label = body.get("status") or "normal"

    meas = HealthMeasurement(
        user_id=current_user.id,
        type=metric_type,
        value=value,
        unit=unit,
        status=status_label,
        source="manual_entry",
        measured_at=datetime.datetime.utcnow()
    )
    db.add(meas)
    db.commit()
    db.refresh(meas)

    return {"success": True, "measurement": meas}

@router.get("/health-records/summary")
@router.get("/health/summary")
@router.get("/summary")
def get_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    latest = {}
    types = ["bp_systolic", "bp_diastolic", "heart_rate", "blood_glucose", "spo2", "hba1c", "weight"]
    for t in types:
        item = db.query(HealthMeasurement).filter(
            HealthMeasurement.user_id == current_user.id, HealthMeasurement.type == t
        ).order_by(HealthMeasurement.measured_at.desc()).first()
        if item:
            latest[t] = {
                "value": item.value,
                "unit": item.unit,
                "status": item.status,
                "date": item.measured_at.strftime("%Y-%m-%d")
            }

    return {"latestVitals": latest}

