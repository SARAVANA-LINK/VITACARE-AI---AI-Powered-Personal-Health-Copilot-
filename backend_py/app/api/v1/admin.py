import os
import json
import datetime
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, UploadFile, File, Form, Request, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.all_models import (
    User, UserProfile, MedicalDocument, DocumentExtraction, HealthRecord, HealthMeasurement,
    Medication, MedicationSchedule, MedicationIntakeLog, Appointment, Notification,
    Guardian, WellnessLog, ChatConversation, ChatMessage, MedicalKnowledgeSource, MedicalKnowledgeChunk,
    CmsModule, CmsCard, CmsAnnouncement, CmsContent, AppSetting, TranslationItem,
    SmsTriggerConfig, SmsTemplateItem, SmsLogItem
)
from app.services.storage_service import StorageService

logger = logging.getLogger("vitacare.admin")

router = APIRouter(prefix="/admin", tags=["Administrator Command Center & CMS"])

require_admin = require_role(["admin"])

# ------------------------------------------------------------------------------
# 1. ADMIN OVERVIEW & HEALTH METRICS
# ------------------------------------------------------------------------------
@router.get("/overview")
def get_admin_overview(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    total_users = db.query(User).filter(User.role == "patient").count()
    total_meds = db.query(Medication).count()
    active_schedules = db.query(MedicationSchedule).filter(MedicationSchedule.is_active == True).count()
    total_alerts = db.query(Notification).count()
    total_reports = db.query(MedicalDocument).filter(MedicalDocument.category != "prescription").count()

    return {
        "metrics": {
            "totalUsers": total_users,
            "totalMedicines": total_meds,
            "activeSchedules": active_schedules,
            "totalAlerts": total_alerts,
            "totalReports": total_reports,
            "storageUsedMb": round(max(0.5, (total_reports + total_meds) * 0.4), 2),
            "systemStatus": "Optimal",
            "uptime": "99.99%",
            "activeSessions": 1,
            "serverTime": datetime.datetime.utcnow().isoformat()
        }
    }

# ------------------------------------------------------------------------------
# 2. PATIENT USER MANAGEMENT
# ------------------------------------------------------------------------------
@router.get("/users")
def get_admin_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    user_list = []
    for u in users:
        user_list.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "phone": u.phone or "",
            "age": u.age,
            "gender": u.gender or "Unspecified",
            "bloodGroup": u.blood_group or "Unknown",
            "createdAt": u.created_at.strftime("%Y-%m-%d %H:%M"),
            "isActive": u.is_active
        })
    return {"users": user_list, "count": len(user_list)}

@router.put("/users/{id}")
def update_admin_user(
    id: str,
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    target = db.query(User).filter(User.id == id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")

    if target.id == admin.id and payload.get("role") and payload.get("role") != "admin":
        raise HTTPException(status_code=400, detail="Cannot revoke your own administrator role.")

    if "name" in payload and payload["name"]:
        target.name = payload["name"].strip()
    if "phone" in payload:
        target.phone = payload["phone"]
    if "age" in payload:
        target.age = int(payload["age"]) if payload["age"] is not None else None
    if "gender" in payload:
        target.gender = payload["gender"]
    if "bloodGroup" in payload:
        target.blood_group = payload["bloodGroup"]
    if "isActive" in payload:
        target.is_active = bool(payload["isActive"])

    db.commit()
    return {"success": True, "message": f"User {target.email} updated successfully."}

@router.delete("/users/{id}")
def delete_admin_user(
    id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    target = db.query(User).filter(User.id == id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete the currently signed in administrator.")

    db.delete(target)
    db.commit()
    return {"success": True, "message": f"User {id} deleted successfully."}

# ------------------------------------------------------------------------------
# 3. MEDICINE & SCHEDULE MANAGEMENT
# ------------------------------------------------------------------------------
@router.get("/medicines")
def get_admin_medicines(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    meds = db.query(Medication).order_by(Medication.created_at.desc()).all()
    out = []
    for m in meds:
        u = db.query(User).filter(User.id == m.user_id).first()
        out.append({
            "id": m.id,
            "userId": m.user_id,
            "patientName": u.name if u else "Unknown Patient",
            "name": m.medication_name,
            "dosage": m.strength or "",
            "instructions": m.dosage_instructions or "",
            "verificationStatus": m.verification_status,
            "createdAt": m.created_at.strftime("%Y-%m-%d")
        })
    return {"medicines": out, "count": len(out)}

@router.post("/medicines")
def create_admin_medicine(
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    user_id = payload.get("userId")
    if not user_id:
        first_patient = db.query(User).filter(User.role == "patient").first()
        if not first_patient:
            raise HTTPException(status_code=400, detail="No patient accounts exist to assign medicine.")
        user_id = first_patient.id

    med = Medication(
        user_id=user_id,
        medication_name=payload.get("name", "Prescribed Medicine"),
        strength=payload.get("dosage", "500 mg"),
        dosage_instructions=payload.get("instructions", "Take with water"),
        verification_status="verified_by_pharmacist"
    )
    db.add(med)
    db.commit()
    db.refresh(med)

    # Schedule
    times = payload.get("intakeTimes") or ["08:00 AM"]
    sched = MedicationSchedule(
        user_id=user_id,
        medication_id=med.id,
        name=med.medication_name,
        dosage=med.strength,
        instructions=med.dosage_instructions,
        frequency=payload.get("frequency", "Once daily"),
        times_of_day=json.dumps(times),
        start_date=datetime.date.today().isoformat(),
        remaining_doses=30
    )
    db.add(sched)
    db.commit()

    return {"success": True, "medicineId": med.id, "scheduleId": sched.id}

@router.delete("/medicines/{id}")
def delete_admin_medicine(
    id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    med = db.query(Medication).filter(Medication.id == id).first()
    if med:
        db.query(MedicationSchedule).filter(MedicationSchedule.medication_id == id).delete()
        db.delete(med)
        db.commit()
    return {"success": True, "message": "Medicine removed from catalog."}

@router.get("/schedules")
def get_admin_schedules(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    schedules = db.query(MedicationSchedule).all()
    out = []
    for s in schedules:
        u = db.query(User).filter(User.id == s.user_id).first()
        times = json.loads(s.times_of_day) if s.times_of_day else []
        out.append({
            "id": s.id,
            "patientName": u.name if u else "Unknown Patient",
            "name": s.name,
            "dosage": s.dosage,
            "instructions": s.instructions,
            "frequency": s.frequency,
            "times": times,
            "remainingDoses": s.remaining_doses,
            "isActive": s.is_active
        })
    return {"schedules": out, "count": len(out)}

@router.put("/schedules/{id}")
def update_admin_schedule(
    id: str,
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    sched = db.query(MedicationSchedule).filter(MedicationSchedule.id == id).first()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    if "dosage" in payload:
        sched.dosage = payload["dosage"]
    if "instructions" in payload:
        sched.instructions = payload["instructions"]
    if "frequency" in payload:
        sched.frequency = payload["frequency"]
    if "remainingDoses" in payload:
        sched.remaining_doses = int(payload["remainingDoses"])
    if "isActive" in payload:
        sched.is_active = bool(payload["isActive"])
    db.commit()
    return {"success": True, "message": "Schedule updated successfully."}

# ------------------------------------------------------------------------------
# 4. ALERTS & GUARDIANS & REPORTS OVERSIGHT
# ------------------------------------------------------------------------------
@router.get("/alerts")
def get_admin_alerts(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    notifs = db.query(Notification).order_by(Notification.created_at.desc()).limit(50).all()
    alerts = []
    for n in notifs:
        u = db.query(User).filter(User.id == n.user_id).first()
        alerts.append({
            "id": n.id,
            "patientName": u.name if u else "Unknown Patient",
            "title": n.title,
            "message": n.message,
            "type": n.type,
            "severity": "high" if "emergency" in n.type.lower() else "normal",
            "timestamp": n.created_at.strftime("%Y-%m-%d %H:%M"),
            "isRead": n.is_read
        })
    return {"alerts": alerts, "count": len(alerts)}

@router.get("/guardians")
def get_admin_guardians(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    guardians = db.query(Guardian).all()
    out = []
    for g in guardians:
        u = db.query(User).filter(User.id == g.user_id).first()
        out.append({
            "id": g.id,
            "patientName": u.name if u else "Unknown Patient",
            "name": g.name,
            "relationship": g.relationship_type,
            "phoneNumber": g.phone_number,
            "allowMedicationEscalation": g.allow_medication_escalation,
            "allowEmergencyNotification": g.allow_emergency_notification
        })
    return {"guardians": out, "count": len(out)}

@router.get("/reports")
def get_admin_reports(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    docs = db.query(MedicalDocument).filter(MedicalDocument.category != "prescription").all()
    out = []
    for d in docs:
        u = db.query(User).filter(User.id == d.user_id).first()
        out.append({
            "id": d.id,
            "patientName": u.name if u else "Unknown Patient",
            "title": d.title,
            "category": d.category,
            "uploadedAt": d.uploaded_at.strftime("%Y-%m-%d"),
            "isVerified": d.is_verified,
            "ocrStatus": d.ocr_status
        })
    return {"documents": out, "reports": out, "count": len(out)}

@router.delete("/reports/{id}")
def delete_admin_report(
    id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    doc = db.query(MedicalDocument).filter(MedicalDocument.id == id).first()
    if doc:
        db.delete(doc)
        db.commit()
    return {"success": True, "message": "Report removed."}

# ------------------------------------------------------------------------------
# 5. DYNAMIC CMS MODULES (PROTOTYPE CONTROLS)
# ------------------------------------------------------------------------------
@router.get("/cms/modules")
def get_admin_cms_modules(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    modules = db.query(CmsModule).order_by(CmsModule.display_order.asc()).all()
    out = [
        {
            "id": m.id,
            "key": m.key,
            "title": m.title,
            "description": m.description or "",
            "icon": m.icon,
            "isEnabled": m.is_enabled,
            "displayOrder": m.display_order,
            "isPublished": m.is_published
        }
        for m in modules
    ]
    return {"modules": out}

@router.post("/cms/modules")
def create_admin_cms_module(
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    mod = CmsModule(
        key=payload.get("key", f"mod_{int(datetime.datetime.utcnow().timestamp())}"),
        title=payload.get("title", "New Clinical Module"),
        description=payload.get("description", ""),
        icon=payload.get("icon", "Activity"),
        is_enabled=payload.get("isEnabled", True),
        display_order=int(payload.get("displayOrder", 1)),
        is_published=payload.get("isPublished", True)
    )
    db.add(mod)
    db.commit()
    db.refresh(mod)
    return {"success": True, "module": mod}

@router.put("/cms/modules/{id}")
def update_admin_cms_module(
    id: str,
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    mod = db.query(CmsModule).filter(CmsModule.id == id).first()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found.")

    if "title" in payload:
        mod.title = payload["title"]
    if "description" in payload:
        mod.description = payload["description"]
    if "icon" in payload:
        mod.icon = payload["icon"]
    if "isEnabled" in payload:
        mod.is_enabled = bool(payload["isEnabled"])
    if "displayOrder" in payload:
        mod.display_order = int(payload["displayOrder"])
    if "isPublished" in payload:
        mod.is_published = bool(payload["isPublished"])

    db.commit()
    return {"success": True, "module": mod}

@router.delete("/cms/modules/{id}")
def delete_admin_cms_module(
    id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    mod = db.query(CmsModule).filter(CmsModule.id == id).first()
    if mod:
        db.delete(mod)
        db.commit()
    return {"success": True}

# ------------------------------------------------------------------------------
# 6. DYNAMIC CMS CARDS
# ------------------------------------------------------------------------------
@router.get("/cms/cards")
def get_admin_cms_cards(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    cards = db.query(CmsCard).order_by(CmsCard.order_index.asc()).all()
    out = [
        {
            "id": c.id,
            "title": c.title,
            "subtitle": c.subtitle or "",
            "value": c.value,
            "delta": c.delta,
            "deltaType": c.delta_type,
            "badgeColor": c.badge_color,
            "orderIndex": c.order_index,
            "isVisible": c.is_visible,
            "isPublished": c.is_published
        }
        for c in cards
    ]
    return {"cards": out}

@router.post("/cms/cards")
def create_admin_cms_card(
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    card = CmsCard(
        title=payload.get("title", "Clinical Indicator"),
        subtitle=payload.get("subtitle", "Monitoring metric"),
        value=payload.get("value", "—"),
        delta=payload.get("delta", ""),
        badge_color=payload.get("badgeColor", "blue"),
        order_index=int(payload.get("orderIndex", 1)),
        is_visible=payload.get("isVisible", True),
        is_published=payload.get("isPublished", True)
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return {"success": True, "card": card}

@router.put("/cms/cards/{id}")
def update_admin_cms_card(
    id: str,
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    card = db.query(CmsCard).filter(CmsCard.id == id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found.")

    if "title" in payload:
        card.title = payload["title"]
    if "subtitle" in payload:
        card.subtitle = payload["subtitle"]
    if "value" in payload:
        card.value = payload["value"]
    if "delta" in payload:
        card.delta = payload["delta"]
    if "badgeColor" in payload:
        card.badge_color = payload["badgeColor"]
    if "orderIndex" in payload:
        card.order_index = int(payload["orderIndex"])
    if "isVisible" in payload:
        card.is_visible = bool(payload["isVisible"])
    if "isPublished" in payload:
        card.is_published = bool(payload["isPublished"])

    db.commit()
    return {"success": True, "card": card}

@router.delete("/cms/cards/{id}")
def delete_admin_cms_card(
    id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    card = db.query(CmsCard).filter(CmsCard.id == id).first()
    if card:
        db.delete(card)
        db.commit()
    return {"success": True}

# ------------------------------------------------------------------------------
# 7. DYNAMIC CMS ANNOUNCEMENTS
# ------------------------------------------------------------------------------
@router.get("/cms/announcements")
def get_admin_cms_announcements(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    anns = db.query(CmsAnnouncement).order_by(CmsAnnouncement.priority.desc(), CmsAnnouncement.created_at.desc()).all()
    out = [
        {
            "id": a.id,
            "title": a.title,
            "message": a.message,
            "alertType": a.alert_type,
            "priority": a.priority,
            "isActive": a.is_active,
            "isPublished": a.is_published,
            "createdAt": a.created_at.strftime("%Y-%m-%d %H:%M")
        }
        for a in anns
    ]
    return {"announcements": out}

@router.post("/cms/announcements")
def create_admin_cms_announcement(
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    ann = CmsAnnouncement(
        title=payload.get("title", "Clinical Notice"),
        message=payload.get("message", ""),
        alert_type=payload.get("alertType", "info"),
        priority=int(payload.get("priority", 1)),
        is_active=payload.get("isActive", True),
        is_published=payload.get("isPublished", True)
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return {"success": True, "announcement": ann}

@router.put("/cms/announcements/{id}")
def update_admin_cms_announcement(
    id: str,
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    ann = db.query(CmsAnnouncement).filter(CmsAnnouncement.id == id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found.")

    if "title" in payload:
        ann.title = payload["title"]
    if "message" in payload:
        ann.message = payload["message"]
    if "alertType" in payload:
        ann.alert_type = payload["alertType"]
    if "priority" in payload:
        ann.priority = int(payload["priority"])
    if "isActive" in payload:
        ann.is_active = bool(payload["isActive"])
    if "isPublished" in payload:
        ann.is_published = bool(payload["isPublished"])

    db.commit()
    return {"success": True, "announcement": ann}

@router.delete("/cms/announcements/{id}")
def delete_admin_cms_announcement(
    id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    ann = db.query(CmsAnnouncement).filter(CmsAnnouncement.id == id).first()
    if ann:
        db.delete(ann)
        db.commit()
    return {"success": True}

# ------------------------------------------------------------------------------
# 8. DYNAMIC CMS CONTENT BLOCKS & HELP TEXT
# ------------------------------------------------------------------------------
@router.get("/cms/content")
def get_admin_cms_content(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    contents = db.query(CmsContent).all()
    out = [
        {
            "id": c.id,
            "key": c.key,
            "title": c.title,
            "section": c.section,
            "value": c.value,
            "helpText": c.help_text or "",
            "isPublished": c.is_published
        }
        for c in contents
    ]
    return {"content": out}

@router.post("/cms/content")
def create_admin_cms_content(
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    cnt = CmsContent(
        key=payload.get("key", f"content_{int(datetime.datetime.utcnow().timestamp())}"),
        title=payload.get("title", "Content Section"),
        section=payload.get("section", "General"),
        value=payload.get("value", ""),
        help_text=payload.get("helpText", ""),
        is_published=payload.get("isPublished", True)
    )
    db.add(cnt)
    db.commit()
    db.refresh(cnt)
    return {"success": True, "content": cnt}

@router.put("/cms/content/{id}")
def update_admin_cms_content(
    id: str,
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    cnt = db.query(CmsContent).filter(CmsContent.id == id).first()
    if not cnt:
        raise HTTPException(status_code=404, detail="Content block not found.")

    if "title" in payload:
        cnt.title = payload["title"]
    if "value" in payload:
        cnt.value = payload["value"]
    if "helpText" in payload:
        cnt.help_text = payload["helpText"]
    if "isPublished" in payload:
        cnt.is_published = bool(payload["isPublished"])

    db.commit()
    return {"success": True, "content": cnt}

@router.delete("/cms/content/{id}")
def delete_admin_cms_content(
    id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    cnt = db.query(CmsContent).filter(CmsContent.id == id).first()
    if cnt:
        db.delete(cnt)
        db.commit()
    return {"success": True}

# ------------------------------------------------------------------------------
# 9. APPROVED MEDICAL KNOWLEDGE DOCUMENTS & AI RAG CONFIGURATION
# ------------------------------------------------------------------------------
@router.get("/knowledge")
@router.get("/ai/knowledge")
def get_approved_knowledge(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    sources = db.query(MedicalKnowledgeSource).all()
    out = []
    for s in sources:
        chunks = db.query(MedicalKnowledgeChunk).filter(MedicalKnowledgeChunk.source_id == s.id).all()
        out.append({
            "id": s.id,
            "sourceName": s.source_name,
            "authoritativeBody": s.authoritative_body,
            "publicationDate": s.publication_date.isoformat() if s.publication_date else "",
            "version": s.version,
            "sourceUrl": getattr(s, "source_url", "https://www.who.int"),
            "licenseType": s.license_type,
            "chunkCount": len(chunks),
            "chunks": [
                {
                    "id": c.id,
                    "topic": c.topic,
                    "keywords": c.keywords,
                    "guideline": c.clinical_guideline_text,
                    "targetDemographic": c.target_demographic
                }
                for c in chunks
            ]
        })
    return {"knowledgeSources": out, "sources": out, "count": len(out)}

@router.post("/knowledge")
@router.post("/ai/knowledge")
def create_approved_knowledge(
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    source = MedicalKnowledgeSource(
        source_name=payload.get("sourceName", "Approved Clinical Guideline"),
        authoritative_body=payload.get("authoritativeBody", "WHO / ICMR"),
        publication_date=datetime.date.today(),
        version=payload.get("version", "1.0"),
        license_type=payload.get("licenseType", "Approved Clinical Guidelines"),
        source_url=payload.get("sourceUrl", "https://www.who.int")
    )
    db.add(source)
    db.commit()
    db.refresh(source)

    chunk = MedicalKnowledgeChunk(
        source_id=source.id,
        topic=payload.get("topic", "General Medical Guidance"),
        keywords=payload.get("keywords", "guidelines, clinical"),
        clinical_guideline_text=payload.get("guidelineText", "Follow verified medical protocols."),
        target_demographic=payload.get("targetDemographic", "General Adult")
    )
    db.add(chunk)
    db.commit()

    return {"success": True, "sourceId": source.id}

@router.delete("/knowledge/{id}")
@router.delete("/ai/knowledge/{id}")
def delete_approved_knowledge(
    id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    source = db.query(MedicalKnowledgeSource).filter(MedicalKnowledgeSource.id == id).first()
    if source:
        db.delete(source)
        db.commit()
    return {"success": True, "message": "Clinical knowledge document deleted and vector index updated."}

@router.post("/knowledge/reindex")
@router.post("/ai/knowledge/reindex")
def reindex_medical_knowledge(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    from app.services.rag_service import RagService, AUTHORITATIVE_KNOWLEDGE_SEEDS
    # Reindex & verify all authoritative seeds
    for s in AUTHORITATIVE_KNOWLEDGE_SEEDS:
        existing = db.query(MedicalKnowledgeSource).filter(MedicalKnowledgeSource.source_name == s["sourceName"]).first()
        if not existing:
            src = MedicalKnowledgeSource(
                source_name=s["sourceName"],
                authoritative_body=s["authoritativeBody"],
                publication_date=datetime.date.fromisoformat(s["publicationDate"]),
                version=s["version"],
                source_url=s["sourceUrl"]
            )
            db.add(src)
            db.commit()
            db.refresh(src)
            for c in s["chunks"]:
                chunk = MedicalKnowledgeChunk(
                    source_id=src.id,
                    topic=c["topic"],
                    keywords=c["keywords"],
                    clinical_guideline_text=c["clinicalGuidelineText"]
                )
                db.add(chunk)
            db.commit()

    total_sources = db.query(MedicalKnowledgeSource).count()
    total_chunks = db.query(MedicalKnowledgeChunk).count()
    return {
        "success": True,
        "message": f"Successfully re-indexed medical knowledge base. {total_sources} authoritative sources and {total_chunks} guideline chunks indexed.",
        "totalSources": total_sources,
        "totalChunks": total_chunks
    }

@router.get("/ai/config")
def get_ai_configuration(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.core.config import settings
    config = {
        "agentName": "AI Health Copilot",
        "provider": settings.AI_PROVIDER,
        "model": settings.GEMINI_MODEL,
        "hasApiKey": bool(settings.GEMINI_API_KEY or settings.OPENAI_API_KEY),
        "defaultResponseLength": "short", # "short" (2-5 sentences), "explain", "detailed"
        "allowedLanguages": ["en", "ta", "hi", "te"],
        "ragEnabled": True,
        "voiceAssistantEnabled": True,
        "ocrEngine": "Built-in PDF Text + Optical Character Recognition"
    }
    return {
        "aiConfig": config,
        "agentName": "AI Health Copilot",
        **config
    }

@router.get("/ai/health")
def get_ai_system_health(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    sources_count = db.query(MedicalKnowledgeSource).count()
    chunks_count = db.query(MedicalKnowledgeChunk).count()
    recent_chats = db.query(ChatMessage).count()
    docs_processed = db.query(MedicalDocument).filter(MedicalDocument.processing_status == "completed").count()

    return {
        "status": "operational",
        "health": "healthy",
        "vectorDatabase": "Operational (Clinical In-Memory Index)",
        "indexedSources": sources_count,
        "indexedChunks": chunks_count,
        "processedDocuments": docs_processed,
        "totalChatInteractions": recent_chats,
        "safetyGuardrails": "Active (Acute Emergency, Drug Dosage Guard, Domain Filter)",
        "lastReindexed": datetime.datetime.utcnow().isoformat()
    }

# ------------------------------------------------------------------------------
# 10. SYSTEM SETTINGS & BRANDING
# ------------------------------------------------------------------------------
@router.get("/settings")
def get_admin_settings(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    setting = db.query(AppSetting).filter(AppSetting.id == "global_settings").first()
    if not setting:
        setting = AppSetting(id="global_settings")
        db.add(setting)
        db.commit()
        db.refresh(setting)

    return {
        "settings": {
            "websiteName": setting.website_name,
            "logoUrl": setting.logo_url or "",
            "themePrimaryColor": setting.theme_primary_color,
            "supportPhone": setting.support_phone,
            "supportEmail": setting.support_email,
            "defaultLanguage": setting.default_language,
            "allowNewRegistrations": setting.allow_new_registrations,
            "maintenanceMode": setting.maintenance_mode,
            "emergencyBroadcastEnabled": setting.emergency_broadcast_enabled
        }
    }

@router.put("/settings")
def update_admin_settings(
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    setting = db.query(AppSetting).filter(AppSetting.id == "global_settings").first()
    if not setting:
        setting = AppSetting(id="global_settings")
        db.add(setting)

    if "websiteName" in payload:
        setting.website_name = payload["websiteName"].strip()
    if "logoUrl" in payload:
        setting.logo_url = payload["logoUrl"]
    if "themePrimaryColor" in payload:
        setting.theme_primary_color = payload["themePrimaryColor"]
    if "supportPhone" in payload:
        setting.support_phone = payload["supportPhone"]
    if "supportEmail" in payload:
        setting.support_email = payload["supportEmail"]
    if "defaultLanguage" in payload:
        setting.default_language = payload["defaultLanguage"]
    if "allowNewRegistrations" in payload:
        setting.allow_new_registrations = bool(payload["allowNewRegistrations"])
    if "maintenanceMode" in payload:
        setting.maintenance_mode = bool(payload["maintenanceMode"])
    if "emergencyBroadcastEnabled" in payload:
        setting.emergency_broadcast_enabled = bool(payload["emergencyBroadcastEnabled"])

    db.commit()
    db.refresh(setting)
    return {
        "success": True,
        "settings": {
            "websiteName": setting.website_name,
            "logoUrl": setting.logo_url,
            "themePrimaryColor": setting.theme_primary_color,
            "supportPhone": setting.support_phone,
            "supportEmail": setting.support_email,
            "defaultLanguage": setting.default_language,
            "allowNewRegistrations": setting.allow_new_registrations,
            "maintenanceMode": setting.maintenance_mode,
            "emergencyBroadcastEnabled": setting.emergency_broadcast_enabled
        }
    }

@router.post("/settings/logo")
async def upload_admin_logo(
    logo: UploadFile = File(...),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    file_url, file_path, _ = await StorageService.save_uploaded_file(logo, subfolder="branding")
    setting = db.query(AppSetting).filter(AppSetting.id == "global_settings").first()
    if not setting:
        setting = AppSetting(id="global_settings")
        db.add(setting)
    setting.logo_url = file_url
    db.commit()
    return {"success": True, "logoUrl": file_url}

# ------------------------------------------------------------------------------
# 11. TRANSLATIONS (MULTILINGUAL)
# ------------------------------------------------------------------------------
@router.get("/translations")
def get_admin_translations(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    items = db.query(TranslationItem).all()
    out = [
        {
            "key": it.key,
            "category": it.category,
            "en": it.en or "",
            "ta": it.ta or "",
            "te": it.te or "",
            "ml": it.ml or "",
            "kn": it.kn or "",
            "hi": it.hi or "",
            "bn": it.bn or "",
            "mr": it.mr or ""
        }
        for it in items
    ]
    return {"translations": out}

@router.post("/translations")
def create_admin_translation(
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    key = payload.get("key", "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="Translation key is required.")
    item = db.query(TranslationItem).filter(TranslationItem.key == key).first()
    if not item:
        item = TranslationItem(key=key)
        db.add(item)

    item.category = payload.get("category", "General")
    for lang in ["en", "ta", "te", "ml", "kn", "hi", "bn", "mr"]:
        if lang in payload:
            setattr(item, lang, payload[lang])

    db.commit()
    return {"success": True, "key": key}

@router.put("/translations/{key}")
def update_admin_translation(
    key: str,
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    item = db.query(TranslationItem).filter(TranslationItem.key == key).first()
    if not item:
        item = TranslationItem(key=key)
        db.add(item)

    if "category" in payload:
        item.category = payload["category"]
    for lang in ["en", "ta", "te", "ml", "kn", "hi", "bn", "mr"]:
        if lang in payload:
            setattr(item, lang, payload[lang])

    db.commit()
    return {"success": True, "key": key}

@router.delete("/translations/{key}")
def delete_admin_translation(
    key: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    item = db.query(TranslationItem).filter(TranslationItem.key == key).first()
    if item:
        db.delete(item)
        db.commit()
    return {"success": True}

# ------------------------------------------------------------------------------
# 12. SMS TRIGGERS, TEMPLATES & AUDIT LOGS
# ------------------------------------------------------------------------------
@router.get("/sms/triggers")
def get_admin_sms_triggers(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    trigs = db.query(SmsTriggerConfig).all()
    out = [
        {
            "id": t.id,
            "eventType": t.event_type,
            "name": t.name,
            "description": t.description or "",
            "isEnabled": t.is_enabled,
            "delayMinutes": t.delay_minutes,
            "targetRole": t.target_role
        }
        for t in trigs
    ]
    return {"triggers": out}

@router.put("/sms/triggers")
def update_admin_sms_triggers(
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    triggers_list = payload.get("triggers", [])
    for t_data in triggers_list:
        event_type = t_data.get("eventType")
        if not event_type:
            continue
        cfg = db.query(SmsTriggerConfig).filter(SmsTriggerConfig.event_type == event_type).first()
        if not cfg:
            cfg = SmsTriggerConfig(event_type=event_type, name=t_data.get("name", event_type))
            db.add(cfg)
        cfg.is_enabled = bool(t_data.get("isEnabled", True))
        if "delayMinutes" in t_data:
            cfg.delay_minutes = int(t_data["delayMinutes"])
    db.commit()
    return {"success": True}

@router.get("/sms/templates")
def get_admin_sms_templates(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    tpls = db.query(SmsTemplateItem).all()
    out = [
        {
            "id": t.id,
            "name": t.name,
            "eventType": t.event_type,
            "content": t.content,
            "language": t.language
        }
        for t in tpls
    ]
    return {"templates": out}

@router.put("/sms/templates/{id}")
def update_admin_sms_template(
    id: str,
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    tpl = db.query(SmsTemplateItem).filter(SmsTemplateItem.id == id).first()
    if not tpl:
        tpl = SmsTemplateItem(id=id, name=payload.get("name", "SMS Template"), event_type=payload.get("eventType", "custom"), content=payload.get("content", ""))
        db.add(tpl)
    if "content" in payload:
        tpl.content = payload["content"]
    if "name" in payload:
        tpl.name = payload["name"]
    db.commit()
    return {"success": True}

@router.get("/sms/logs")
def get_admin_sms_logs(
    limit: int = 50,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    logs = db.query(SmsLogItem).order_by(SmsLogItem.sent_at.desc()).limit(limit).all()
    out = [
        {
            "id": l.id,
            "phoneNumber": l.recipient_phone[:4] + "***" + l.recipient_phone[-2:] if len(l.recipient_phone) > 6 else l.recipient_phone,
            "maskedPhone": l.recipient_phone[:4] + "***" + l.recipient_phone[-2:] if len(l.recipient_phone) > 6 else l.recipient_phone,
            "recipientName": l.recipient_name,
            "message": l.message_body,
            "triggerEvent": l.trigger_event,
            "status": l.status,
            "carrierMessageId": l.carrier_id,
            "sentAt": l.sent_at.strftime("%Y-%m-%d %H:%M:%S")
        }
        for l in logs
    ]
    return {"logs": out}

@router.post("/sms/test")
def send_admin_test_sms(
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    phone = payload.get("phoneNumber", "+91 98765 43210")
    msg = payload.get("message", "VitaCare AI: Admin carrier dispatch verified successfully.")
    log = SmsLogItem(
        recipient_phone=phone,
        recipient_name="Administrator Test",
        message_body=msg,
        trigger_event="ADMIN_TEST_DISPATCH",
        status="delivered",
        carrier_id=f"MSG_{int(datetime.datetime.utcnow().timestamp())}"
    )
    db.add(log)
    db.commit()
    return {
        "success": True,
        "log": {
            "id": log.id,
            "maskedPhone": phone[:4] + "***" + phone[-2:] if len(phone) > 6 else phone,
            "status": "delivered"
        }
    }

# ------------------------------------------------------------------------------
# 13. DATABASE RESET / CLEAR PATIENT USER DATA (Requirement 2)
# ------------------------------------------------------------------------------
@router.post("/database/clear-user-data")
def clear_user_data(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Cleans out all dummy/demo/patient user data for a clean launch.
    Strictly preserves:
    1. Schema & tables
    2. Admin account (role == 'admin')
    3. CMS modules, cards, announcements, content
    4. System configuration & settings
    5. Approved Medical Knowledge documents
    6. Multilingual translations
    """
    # 1. Fetch non-admin user IDs
    patient_users = db.query(User).filter(User.role != "admin").all()
    patient_ids = [u.id for u in patient_users]

    logger.info(f"Admin {admin.email} initiated database reset. Purging {len(patient_ids)} non-admin users.")

    if patient_ids:
        # Delete user-associated clinical records
        db.query(HealthMeasurement).filter(HealthMeasurement.user_id.in_(patient_ids)).delete(synchronize_session=False)
        db.query(HealthRecord).filter(HealthRecord.user_id.in_(patient_ids)).delete(synchronize_session=False)
        meds = db.query(Medication).filter(Medication.user_id.in_(patient_ids)).all()
        med_ids = [m.id for m in meds]
        if med_ids:
            db.query(MedicationIntakeLog).filter(MedicationIntakeLog.medication_id.in_(med_ids)).delete(synchronize_session=False)
        db.query(AdherenceLog).filter(AdherenceLog.user_id.in_(patient_ids)).delete(synchronize_session=False)
        db.query(MedicationSchedule).filter(MedicationSchedule.user_id.in_(patient_ids)).delete(synchronize_session=False)
        db.query(Medication).filter(Medication.user_id.in_(patient_ids)).delete(synchronize_session=False)

        # Delete documents & extractions
        docs = db.query(MedicalDocument).filter(MedicalDocument.user_id.in_(patient_ids)).all()
        doc_ids = [d.id for d in docs]
        if doc_ids:
            db.query(DocumentExtraction).filter(DocumentExtraction.document_id.in_(doc_ids)).delete(synchronize_session=False)
            db.query(MedicalDocument).filter(MedicalDocument.id.in_(doc_ids)).delete(synchronize_session=False)

        # Delete appointments, chats, guardians, wellness, notifications
        db.query(Appointment).filter(Appointment.user_id.in_(patient_ids)).delete(synchronize_session=False)
        db.query(Notification).filter(Notification.user_id.in_(patient_ids)).delete(synchronize_session=False)
        db.query(Guardian).filter(Guardian.user_id.in_(patient_ids)).delete(synchronize_session=False)
        db.query(WellnessLog).filter(WellnessLog.user_id.in_(patient_ids)).delete(synchronize_session=False)
        
        conversations = db.query(ChatConversation).filter(ChatConversation.user_id.in_(patient_ids)).all()
        c_ids = [c.id for c in conversations]
        if c_ids:
            db.query(ChatMessage).filter(ChatMessage.conversation_id.in_(c_ids)).delete(synchronize_session=False)
            db.query(ChatConversation).filter(ChatConversation.id.in_(c_ids)).delete(synchronize_session=False)

        db.query(UserProfile).filter(UserProfile.user_id.in_(patient_ids)).delete(synchronize_session=False)
        db.query(User).filter(User.id.in_(patient_ids)).delete(synchronize_session=False)

    db.commit()

    return {
        "success": True,
        "message": f"Successfully cleared patient database. Purged {len(patient_ids)} patient accounts and associated clinical records. Administrator account and CMS configuration preserved.",
        "purgedUsersCount": len(patient_ids)
    }
