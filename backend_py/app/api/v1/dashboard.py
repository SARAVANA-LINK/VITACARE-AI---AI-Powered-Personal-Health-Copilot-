import datetime
import json
from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.all_models import (
    User, UserProfile, MedicalDocument, HealthMeasurement, MedicationSchedule, AdherenceLog
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard Overview"])

@router.get("/overview")
def get_dashboard_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    today_str = datetime.date.today().isoformat()

    # Vitals
    measurements = db.query(HealthMeasurement).filter(
        HealthMeasurement.user_id == current_user.id
    ).order_by(HealthMeasurement.measured_at.desc()).all()

    latest_vitals_map = {}
    for m in measurements:
        if m.type not in latest_vitals_map:
            latest_vitals_map[m.type] = {
                "metricKey": m.type,
                "metricName": m.type.replace("_", " ").title(),
                "value": str(m.value),
                "unit": m.unit,
                "date": m.measured_at.strftime("%Y-%m-%d"),
                "statusIndicator": m.status or "normal"
            }
    latest_vitals = list(latest_vitals_map.values())

    # Schedules
    today = datetime.date.today()
    today_start = datetime.datetime.combine(today, datetime.time.min)
    today_end = datetime.datetime.combine(today, datetime.time.max)

    schedules = db.query(MedicationSchedule).filter(
        MedicationSchedule.user_id == current_user.id,
        MedicationSchedule.is_active == True
    ).all()

    today_logs = db.query(AdherenceLog).filter(
        AdherenceLog.user_id == current_user.id,
        AdherenceLog.action == "taken",
        AdherenceLog.recorded_at >= today_start,
        AdherenceLog.recorded_at <= today_end
    ).all()

    today_schedules = []
    for s in schedules:
        times = json.loads(s.times_of_day) if s.times_of_day else ["08:00 AM"]
        for t in times:
            t_norm = t.replace(" ", "").lower()
            matching_log = next(
                (
                    l for l in today_logs
                    if (l.schedule_id == s.id or (l.schedule_id and l.schedule_id.startswith(s.id))) and (
                        len(times) == 1 or
                        not l.scheduled_time or
                        (l.scheduled_time or "").replace(" ", "").lower() == t_norm or
                        t_norm in (l.scheduled_time or "").replace(" ", "").lower()
                    )
                ),
                None
            )
            is_taken = matching_log is not None
            today_schedules.append({
                "id": f"{s.id}-{t.replace(' ', '')}",
                "scheduleId": s.id,
                "name": s.name,
                "medicineName": s.name,
                "dosage": s.dosage,
                "instructions": s.instructions,
                "scheduledTime": t,
                "status": "Verified" if is_taken else "Pending",
                "rawStatus": "VERIFIED" if is_taken else "PENDING",
                "isVerified": is_taken,
                "taken": is_taken,
                "takenAt": matching_log.recorded_at.strftime("%I:%M %p") if matching_log and matching_log.recorded_at else None
            })

    # Recent Prescriptions & Reports
    documents = db.query(MedicalDocument).filter(
        MedicalDocument.user_id == current_user.id
    ).order_by(MedicalDocument.uploaded_at.desc()).limit(5).all()

    recent_reports = [
        {
            "id": d.id,
            "title": d.title,
            "category": d.category,
            "uploadedAt": d.uploaded_at.strftime("%Y-%m-%d"),
            "isVerified": d.is_verified
        }
        for d in documents
    ]

    # Calculate accurate adherence score from real logs
    adherence_logs = db.query(AdherenceLog).filter(AdherenceLog.user_id == current_user.id).all()
    if adherence_logs:
        total_taken = sum(1 for a in adherence_logs if getattr(a, "action", None) == "taken" or getattr(a, "status", None) == "taken")
        adherence_score = round((total_taken / len(adherence_logs)) * 100, 1)
        streak = min(len(adherence_logs), 7)
    elif schedules:
        adherence_score = 100.0
        streak = 1
    else:
        adherence_score = 0.0
        streak = 0

    verified_count = sum(1 for s in today_schedules if s["status"] == "Verified")
    pending_count = len(today_schedules) - verified_count

    next_pending = next((s for s in today_schedules if s["status"] == "Pending"), None)
    next_med = next_pending or (today_schedules[0] if today_schedules else None)

    return {
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "role": current_user.role
        },
        "latestVitals": latest_vitals,
        "todaySchedules": today_schedules,
        "nextMedicine": next_med,
        "adherence": {"score": adherence_score, "streakDays": streak, "verified": verified_count, "pending": pending_count, "total": len(today_schedules)},
        "recentReports": recent_reports,
        "summary": [
            f"Active healthcare: {verified_count} verified, {pending_count} pending doses today." if today_schedules else "Welcome to VitaCare AI. No medications scheduled yet.",
            f"You have {len(today_schedules)} prescribed doses scheduled for today." if today_schedules else "Upload your medical reports or prescriptions to get started."
        ]
    }

@router.get("/cms-config")
def get_cms_config(db: Session = Depends(get_db)):
    """
    Returns published CMS modules, dashboard cards, and clinical announcements.
    Public and read-only for regular patient users.
    """
    from app.models.all_models import CmsModule, CmsCard, CmsAnnouncement

    modules = db.query(CmsModule).filter(
        CmsModule.is_published == True,
        CmsModule.is_enabled == True
    ).order_by(CmsModule.display_order.asc()).all()

    cards = db.query(CmsCard).filter(
        CmsCard.is_published == True,
        CmsCard.is_visible == True
    ).order_by(CmsCard.order_index.asc()).all()

    announcements = db.query(CmsAnnouncement).filter(
        CmsAnnouncement.is_published == True,
        CmsAnnouncement.is_active == True
    ).order_by(CmsAnnouncement.priority.desc(), CmsAnnouncement.created_at.desc()).all()

    return {
        "modules": [
            {
                "id": m.id,
                "key": m.key,
                "title": m.title,
                "description": m.description or "",
                "icon": m.icon,
                "isEnabled": m.is_enabled,
                "displayOrder": m.display_order
            }
            for m in modules
        ],
        "cards": [
            {
                "id": c.id,
                "title": c.title,
                "subtitle": c.subtitle or "",
                "value": c.value,
                "delta": c.delta,
                "deltaType": c.delta_type,
                "badgeColor": c.badge_color,
                "orderIndex": c.order_index
            }
            for c in cards
        ],
        "announcements": [
            {
                "id": a.id,
                "title": a.title,
                "message": a.message,
                "alertType": a.alert_type,
                "priority": a.priority,
                "createdAt": a.created_at.strftime("%Y-%m-%d %H:%M")
            }
            for a in announcements
        ]
    }

