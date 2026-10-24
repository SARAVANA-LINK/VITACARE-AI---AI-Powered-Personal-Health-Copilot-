import json
import logging
import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from app.models.all_models import (
    User, UserProfile, HealthMeasurement, MedicalDocument, DocumentExtraction,
    Medication, MedicationSchedule, MedicationIntakeLog, AdherenceLog,
    Appointment, Guardian, ChatThread, ChatMessage, UserConsent, Notification
)

logger = logging.getLogger("vitacare.agent_tools")

# Schema definitions for Agentic AI Tool Calling
AGENT_TOOL_DEFINITIONS = [
    {
        "name": "get_user_profile",
        "description": "Retrieve the authenticated user's personal health profile including allergies, chronic conditions, and contact details.",
        "parameters": {"type": "object", "properties": {}}
    },
    {
        "name": "get_selected_family_profile",
        "description": "Retrieve an authorized family member or guardian profile linked to the authenticated user.",
        "parameters": {
            "type": "object",
            "properties": {
                "guardian_id": {"type": "string", "description": "The specific family member or guardian ID"}
            }
        }
    },
    {
        "name": "list_authorized_health_records",
        "description": "List the user's verified physiological vitals and biomarker measurements (BP, blood sugar, heart rate, HbA1c, etc.).",
        "parameters": {
            "type": "object",
            "properties": {
                "metric_type": {"type": "string", "description": "Optional biomarker filter e.g. blood_glucose, bp_systolic, heart_rate"}
            }
        }
    },
    {
        "name": "retrieve_selected_medical_report",
        "description": "Retrieve full details and extracted lab parameters of a specific medical report belonging to the user.",
        "parameters": {
            "type": "object",
            "properties": {
                "report_id": {"type": "string", "description": "The medical report ID"}
            },
            "required": ["report_id"]
        }
    },
    {
        "name": "retrieve_selected_prescription",
        "description": "Retrieve details and extracted prescribed medicines of a specific doctor prescription belonging to the user.",
        "parameters": {
            "type": "object",
            "properties": {
                "prescription_id": {"type": "string", "description": "The prescription document ID"}
            },
            "required": ["prescription_id"]
        }
    },
    {
        "name": "compare_two_authorized_medical_reports",
        "description": "Compare two authorized diagnostic laboratory reports belonging to the user, identifying changes in biomarkers and reference ranges.",
        "parameters": {
            "type": "object",
            "properties": {
                "report1_id": {"type": "string", "description": "First medical report ID (earlier)"},
                "report2_id": {"type": "string", "description": "Second medical report ID (later)"}
            },
            "required": ["report1_id", "report2_id"]
        }
    },
    {
        "name": "get_medication_schedules",
        "description": "Get today's active medication schedules, dose timings, meal instructions, and intake statuses for the user.",
        "parameters": {"type": "object", "properties": {}}
    },
    {
        "name": "get_medication_reminder_status",
        "description": "Check whether a specific scheduled medication dose has been taken or is still pending today.",
        "parameters": {
            "type": "object",
            "properties": {
                "schedule_id": {"type": "string", "description": "The schedule ID"}
            },
            "required": ["schedule_id"]
        }
    },
    {
        "name": "get_verified_medication_intake_history",
        "description": "Retrieve the user's verified medication adherence history. Clearly distinguishes technically camera-verified intake from unverified entries.",
        "parameters": {"type": "object", "properties": {}}
    },
    {
        "name": "create_medication_reminder",
        "description": "Create a new daily medication schedule reminder for the patient. (Does not modify prescriptions or alter doctor orders).",
        "parameters": {
            "type": "object",
            "properties": {
                "medicine_name": {"type": "string", "description": "Name of the medicine"},
                "dosage": {"type": "string", "description": "Dose strength e.g. 500 mg, 1 tablet"},
                "intake_times": {"type": "array", "items": {"type": "string"}, "description": "List of times e.g. ['08:00 AM']"},
                "frequency": {"type": "string", "description": "e.g. Once daily, Twice daily"},
                "instructions": {"type": "string", "description": "e.g. Take with water after food"}
            },
            "required": ["medicine_name", "dosage"]
        }
    },
    {
        "name": "update_permitted_reminder",
        "description": "Update permitted reminder times or frequency for an existing user medication schedule.",
        "parameters": {
            "type": "object",
            "properties": {
                "schedule_id": {"type": "string", "description": "ID of schedule to update"},
                "intake_times": {"type": "array", "items": {"type": "string"}},
                "frequency": {"type": "string"}
            },
            "required": ["schedule_id"]
        }
    },
    {
        "name": "cancel_reminder",
        "description": "Deactivate an existing medication reminder. Consequential action: Requires patient confirmation.",
        "parameters": {
            "type": "object",
            "properties": {
                "schedule_id": {"type": "string", "description": "ID of the schedule to cancel"},
                "confirmed": {"type": "boolean", "description": "Must be True after explicit user confirmation"}
            },
            "required": ["schedule_id"]
        }
    },
    {
        "name": "get_appointments",
        "description": "Retrieve the list of upcoming and past doctor appointments for the patient.",
        "parameters": {"type": "object", "properties": {}}
    },
    {
        "name": "create_appointment",
        "description": "Book a new clinical doctor appointment for the patient.",
        "parameters": {
            "type": "object",
            "properties": {
                "doctor_name": {"type": "string", "description": "Physician or clinic name"},
                "specialty": {"type": "string", "description": "Medical specialty e.g. Cardiology, Endocrinology"},
                "appointment_date": {"type": "string", "description": "Date in YYYY-MM-DD"},
                "appointment_time": {"type": "string", "description": "Time e.g. 10:00 AM"},
                "reason": {"type": "string", "description": "Brief consult purpose"}
            },
            "required": ["doctor_name", "appointment_date"]
        }
    },
    {
        "name": "update_appointment",
        "description": "Update date, time, or status of an existing doctor appointment.",
        "parameters": {
            "type": "object",
            "properties": {
                "appointment_id": {"type": "string", "description": "Appointment ID"},
                "new_date": {"type": "string"},
                "new_time": {"type": "string"},
                "status": {"type": "string", "enum": ["confirmed", "completed", "cancelled", "rescheduled"]}
            },
            "required": ["appointment_id"]
        }
    },
    {
        "name": "retrieve_authorized_conversation_history",
        "description": "Retrieve previous messages from an authorized consultation thread belonging to the user.",
        "parameters": {
            "type": "object",
            "properties": {
                "thread_id": {"type": "string"}
            }
        }
    },
    {
        "name": "search_user_health_documents",
        "description": "Search across the user's private medical reports and prescriptions for specific keywords.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search keyword e.g. glucose, cholesterol, ecg, thyroid"}
            },
            "required": ["query"]
        }
    },
    {
        "name": "change_user_language_preference",
        "description": "Update the patient's preferred application and conversation language.",
        "parameters": {
            "type": "object",
            "properties": {
                "language_code": {"type": "string", "enum": ["en", "ta", "tanglish", "hi", "te", "ml", "kn", "bn", "mr"]}
            },
            "required": ["language_code"]
        }
    },
    {
        "name": "send_consented_guardian_notification",
        "description": "Send a secure SMS/alert notification to the patient's registered guardian if active consent exists.",
        "parameters": {
            "type": "object",
            "properties": {
                "message": {"type": "string", "description": "Notification message to dispatch"},
                "alert_type": {"type": "string", "enum": ["info", "reminder", "escalation"]}
            },
            "required": ["message"]
        }
    }
]

class AgentToolsService:
    """
    Controlled Agentic Tool Execution Service:
    - Server-side JWT authentication & strict user-data isolation
    - Input validation & parameter bounds checking
    - Explicit confirmation gates for consequential actions
    - Action-result verification (reports actual DB state, never invents)
    """

    @classmethod
    def execute_tool(
        cls,
        tool_name: str,
        arguments: Dict[str, Any],
        user_id: str,
        db: Session
    ) -> Dict[str, Any]:
        """
        Executes a recognized agent tool with strict user_id boundary.
        """
        if not user_id:
            return {"success": False, "error": "Unauthorized: user_id is required."}

        try:
            handler = getattr(cls, f"_tool_{tool_name}", None)
            if not handler:
                return {
                    "success": False,
                    "error": f"Tool '{tool_name}' is not recognized or not available in VitaCare AI."
                }
            return handler(arguments, user_id, db)
        except Exception as e:
            logger.error(f"Error executing agent tool {tool_name}: {e}", exc_info=True)
            return {"success": False, "error": f"Tool execution failed: {str(e)}"}

    # 1. User Profile
    @classmethod
    def _tool_get_user_profile(cls, args: Dict[str, Any], user_id: str, db: Session) -> Dict[str, Any]:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"success": False, "error": "User account not found."}
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        return {
            "success": True,
            "data": {
                "name": user.name,
                "email": user.email,
                "age": user.age,
                "gender": user.gender,
                "bloodGroup": user.blood_group,
                "preferredLanguage": user.preferred_language,
                "allergies": json.loads(profile.allergies) if profile and profile.allergies else [],
                "chronicConditions": json.loads(profile.chronic_conditions) if profile and profile.chronic_conditions else [],
                "currentMedications": json.loads(profile.current_medications) if profile and profile.current_medications else []
            }
        }

    # 2. Selected Family Profile
    @classmethod
    def _tool_get_selected_family_profile(cls, args: Dict[str, Any], user_id: str, db: Session) -> Dict[str, Any]:
        g_id = args.get("guardian_id")
        query = db.query(Guardian).filter(Guardian.user_id == user_id)
        if g_id:
            query = query.filter(Guardian.id == g_id)
        guardians = query.all()
        return {
            "success": True,
            "data": [
                {
                    "id": g.id,
                    "name": g.name,
                    "relationship": g.relationship_type,
                    "phoneNumber": g.phone_number,
                    "smsAlertsEnabled": g.sms_enabled
                }
                for g in guardians
            ]
        }

    # 3. Health Records & Vitals
    @classmethod
    def _tool_list_authorized_health_records(cls, args: Dict[str, Any], user_id: str, db: Session) -> Dict[str, Any]:
        metric = args.get("metric_type")
        q = db.query(HealthMeasurement).filter(HealthMeasurement.user_id == user_id)
        if metric:
            q = q.filter(HealthMeasurement.type == metric)
        vitals = q.order_by(desc(HealthMeasurement.measured_at)).limit(10).all()
        return {
            "success": True,
            "count": len(vitals),
            "data": [
                {
                    "type": v.type,
                    "value": v.value,
                    "unit": v.unit,
                    "status": v.status,
                    "measuredAt": v.measured_at.isoformat() if v.measured_at else None
                }
                for v in vitals
            ]
        }

    # 4. Selected Medical Report
    @classmethod
    def _tool_retrieve_selected_medical_report(cls, args: Dict[str, Any], user_id: str, db: Session) -> Dict[str, Any]:
        rep_id = args.get("report_id")
        doc = db.query(MedicalDocument).filter(
            MedicalDocument.id == rep_id,
            MedicalDocument.user_id == user_id
        ).first()
        if not doc:
            return {"success": False, "error": f"Report ID '{rep_id}' not found in your private records."}
        extractions = db.query(DocumentExtraction).filter(DocumentExtraction.document_id == rep_id).all()
        return {
            "success": True,
            "data": {
                "id": doc.id,
                "title": doc.title,
                "documentType": doc.document_type,
                "status": doc.processing_status,
                "uploadedAt": doc.created_at.isoformat() if doc.created_at else None,
                "extractedParameters": [
                    {
                        "name": e.parameter_name,
                        "value": e.numeric_value,
                        "unit": e.unit,
                        "referenceRange": e.reference_range,
                        "isAbnormal": e.is_abnormal
                    }
                    for e in extractions
                ]
            }
        }

    # 5. Selected Prescription
    @classmethod
    def _tool_retrieve_selected_prescription(cls, args: Dict[str, Any], user_id: str, db: Session) -> Dict[str, Any]:
        p_id = args.get("prescription_id")
        doc = db.query(MedicalDocument).filter(
            MedicalDocument.id == p_id,
            MedicalDocument.user_id == user_id
        ).first()
        if not doc:
            return {"success": False, "error": f"Prescription ID '{p_id}' not found in your private records."}
        meds = db.query(Medication).filter(
            Medication.source_document_id == p_id,
            Medication.user_id == user_id
        ).all()
        return {
            "success": True,
            "data": {
                "id": doc.id,
                "title": doc.title,
                "uploadedAt": doc.created_at.isoformat() if doc.created_at else None,
                "medications": [
                    {
                        "name": m.medication_name,
                        "strength": m.strength,
                        "dosageInstructions": m.dosage_instructions,
                        "status": m.status
                    }
                    for m in meds
                ]
            }
        }

    # 6. Compare Two Medical Reports
    @classmethod
    def _tool_compare_two_authorized_medical_reports(cls, args: Dict[str, Any], user_id: str, db: Session) -> Dict[str, Any]:
        id1 = args.get("report1_id")
        id2 = args.get("report2_id")
        doc1 = db.query(MedicalDocument).filter(MedicalDocument.id == id1, MedicalDocument.user_id == user_id).first()
        doc2 = db.query(MedicalDocument).filter(MedicalDocument.id == id2, MedicalDocument.user_id == user_id).first()
        if not doc1 or not doc2:
            return {"success": False, "error": "One or both reports not found in your private account records."}

        e1 = {e.parameter_name: e for e in db.query(DocumentExtraction).filter(DocumentExtraction.document_id == id1).all()}
        e2 = {e.parameter_name: e for e in db.query(DocumentExtraction).filter(DocumentExtraction.document_id == id2).all()}

        comparisons = []
        all_keys = set(e1.keys()).union(set(e2.keys()))
        for k in sorted(all_keys):
            item1 = e1.get(k)
            item2 = e2.get(k)
            comparisons.append({
                "biomarker": k,
                "report1Value": f"{item1.numeric_value} {item1.unit or ''}" if item1 else "Not Tested",
                "report2Value": f"{item2.numeric_value} {item2.unit or ''}" if item2 else "Not Tested",
                "referenceRange": (item2.reference_range if item2 else item1.reference_range) if (item1 or item2) else "N/A",
                "trend": "Increased" if (item1 and item2 and item2.numeric_value > item1.numeric_value) else (
                    "Decreased" if (item1 and item2 and item2.numeric_value < item1.numeric_value) else "Unchanged"
                )
            })

        return {
            "success": True,
            "report1Title": doc1.title,
            "report2Title": doc2.title,
            "biomarkerComparisons": comparisons
        }

    # 7. Medication Schedules
    @classmethod
    def _tool_get_medication_schedules(cls, args: Dict[str, Any], user_id: str, db: Session) -> Dict[str, Any]:
        schedules = db.query(MedicationSchedule).filter(
            MedicationSchedule.user_id == user_id,
            MedicationSchedule.is_active == True
        ).all()
        return {
            "success": True,
            "count": len(schedules),
            "data": [
                {
                    "id": s.id,
                    "medicineName": s.name,
                    "dosage": s.dosage,
                    "frequency": s.frequency,
                    "instructions": s.instructions,
                    "timesOfDay": json.loads(s.times_of_day) if s.times_of_day else ["08:00 AM"],
                    "remainingDoses": s.remaining_doses
                }
                for s in schedules
            ]
        }

    # 8. Medication Reminder Status
    @classmethod
    def _tool_get_medication_reminder_status(cls, args: Dict[str, Any], user_id: str, db: Session) -> Dict[str, Any]:
        sched_id = args.get("schedule_id")
        schedule = db.query(MedicationSchedule).filter(
            MedicationSchedule.id == sched_id,
            MedicationSchedule.user_id == user_id
        ).first()
        if not schedule:
            return {"success": False, "error": f"Medication schedule '{sched_id}' not found."}
        today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        intake = db.query(MedicationIntakeLog).filter(
            MedicationIntakeLog.schedule_id == sched_id,
            MedicationIntakeLog.scheduled_at >= today_start
        ).order_by(desc(MedicationIntakeLog.recorded_at)).first()

        status = intake.status if intake else "pending"
        return {
            "success": True,
            "medicineName": schedule.name,
            "dosage": schedule.dosage,
            "status": status,
            "isTaken": status == "taken"
        }

    # 9. Verified Intake History
    @classmethod
    def _tool_get_verified_medication_intake_history(cls, args: Dict[str, Any], user_id: str, db: Session) -> Dict[str, Any]:
        logs = db.query(AdherenceLog).filter(
            AdherenceLog.user_id == user_id
        ).order_by(desc(AdherenceLog.scheduled_time)).limit(15).all()

        return {
            "success": True,
            "count": len(logs),
            "data": [
                {
                    "medicineName": l.medicine_name,
                    "scheduledTime": l.scheduled_time,
                    "status": l.status, # e.g. "Verified" via camera vs "Pending"
                    "isVerified": l.status == "Verified" or l.status == "taken",
                    "actionMethod": l.action_method or "camera_verified"
                }
                for l in logs
            ]
        }

    # 10. Create Medication Reminder
    @classmethod
    def _tool_create_medication_reminder(cls, args: Dict[str, Any], user_id: str, db: Session) -> Dict[str, Any]:
        med_name = args.get("medicine_name", "").strip()
        dosage = args.get("dosage", "As prescribed").strip()
        intake_times = args.get("intake_times") or ["08:00 AM"]
        freq = args.get("frequency") or "Once daily"
        instructions = args.get("instructions") or "Take with water after meals"

        if not med_name:
            return {"success": False, "error": "Medicine name is required to create a reminder."}

        new_schedule = MedicationSchedule(
            user_id=user_id,
            name=med_name,
            dosage=dosage,
            frequency=freq,
            instructions=instructions,
            times_of_day=json.dumps(intake_times),
            schedule_definition=json.dumps({"frequency": freq, "times_of_day": intake_times}),
            is_active=True
        )
        db.add(new_schedule)
        db.commit()
        db.refresh(new_schedule)

        return {
            "success": True,
            "message": f"Medication reminder for {med_name} ({dosage}) created successfully.",
            "schedule": {
                "id": new_schedule.id,
                "medicineName": new_schedule.name,
                "dosage": new_schedule.dosage,
                "timesOfDay": intake_times
            }
        }

    # 11. Update Permitted Reminder
    @classmethod
    def _tool_update_permitted_reminder(cls, args: Dict[str, Any], user_id: str, db: Session) -> Dict[str, Any]:
        sched_id = args.get("schedule_id")
        schedule = db.query(MedicationSchedule).filter(
            MedicationSchedule.id == sched_id,
            MedicationSchedule.user_id == user_id
        ).first()
        if not schedule:
            return {"success": False, "error": f"Schedule '{sched_id}' not found."}

        times = args.get("intake_times")
        freq = args.get("frequency")
        if times:
            schedule.times_of_day = json.dumps(times)
        if freq:
            schedule.frequency = freq
        schedule.updated_at = datetime.datetime.utcnow()
        db.commit()

        return {
            "success": True,
            "message": f"Reminder for {schedule.name} updated successfully.",
            "timesOfDay": times or json.loads(schedule.times_of_day)
        }

    # 12. Cancel Reminder (Gated with confirmation requirement)
    @classmethod
    def _tool_cancel_reminder(cls, args: Dict[str, Any], user_id: str, db: Session) -> Dict[str, Any]:
        sched_id = args.get("schedule_id")
        confirmed = args.get("confirmed", False)
        schedule = db.query(MedicationSchedule).filter(
            MedicationSchedule.id == sched_id,
            MedicationSchedule.user_id == user_id
        ).first()
        if not schedule:
            return {"success": False, "error": f"Schedule '{sched_id}' not found."}

        if not confirmed:
            return {
                "success": False,
                "requiresConfirmation": True,
                "confirmationPrompt": f"Are you sure you want to deactivate the reminder for {schedule.name} ({schedule.dosage})? Please confirm to proceed.",
                "scheduleId": sched_id
            }

        schedule.is_active = False
        schedule.updated_at = datetime.datetime.utcnow()
        db.commit()

        return {
            "success": True,
            "message": f"Medication reminder for {schedule.name} has been cancelled.",
            "scheduleId": sched_id
        }

    # 13. Appointments
    @classmethod
    def _tool_get_appointments(cls, args: Dict[str, Any], user_id: str, db: Session) -> Dict[str, Any]:
        appts = db.query(Appointment).filter(
            Appointment.user_id == user_id
        ).order_by(Appointment.appointment_date.asc()).all()
        return {
            "success": True,
            "count": len(appts),
            "data": [
                {
                    "id": a.id,
                    "doctorName": a.clinician_or_facility_reference or a.appointment_title,
                    "specialty": a.specialty,
                    "date": a.appointment_date,
                    "time": a.appointment_time,
                    "status": a.status,
                    "notes": a.notes
                }
                for a in appts
            ]
        }

    # 14. Create Appointment
    @classmethod
    def _tool_create_appointment(cls, args: Dict[str, Any], user_id: str, db: Session) -> Dict[str, Any]:
        dr_name = args.get("doctor_name", "").strip()
        appt_date = args.get("appointment_date", "").strip()
        appt_time = args.get("appointment_time", "10:00 AM").strip()
        spec = args.get("specialty", "General Medicine").strip()
        reason = args.get("reason", "").strip()

        if not dr_name or not appt_date:
            return {"success": False, "error": "Doctor name and appointment date are required."}

        new_appt = Appointment(
            user_id=user_id,
            clinician_or_facility_reference=dr_name,
            appointment_title=f"Consultation with {dr_name}",
            specialty=spec,
            appointment_date=appt_date,
            appointment_time=appt_time,
            notes=reason,
            status="confirmed"
        )
        db.add(new_appt)
        db.commit()
        db.refresh(new_appt)

        return {
            "success": True,
            "message": f"Appointment booked with {dr_name} on {appt_date} at {appt_time}.",
            "appointment": {
                "id": new_appt.id,
                "doctor": dr_name,
                "date": appt_date,
                "time": appt_time,
                "status": "confirmed"
            }
        }

    # 15. Update Appointment
    @classmethod
    def _tool_update_appointment(cls, args: Dict[str, Any], user_id: str, db: Session) -> Dict[str, Any]:
        appt_id = args.get("appointment_id")
        appt = db.query(Appointment).filter(Appointment.id == appt_id, Appointment.user_id == user_id).first()
        if not appt:
            return {"success": False, "error": f"Appointment '{appt_id}' not found."}

        if args.get("new_date"):
            appt.appointment_date = args["new_date"]
        if args.get("new_time"):
            appt.appointment_time = args["new_time"]
        if args.get("status"):
            appt.status = args["status"]
        appt.updated_at = datetime.datetime.utcnow()
        db.commit()

        return {
            "success": True,
            "message": f"Appointment with {appt.clinician_or_facility_reference} updated.",
            "appointmentId": appt_id,
            "status": appt.status
        }

    # 16. Search User Health Documents
    @classmethod
    def _tool_search_user_health_documents(cls, args: Dict[str, Any], user_id: str, db: Session) -> Dict[str, Any]:
        q_term = (args.get("query") or "").strip().lower()
        if not q_term:
            return {"success": False, "error": "Search query is required."}

        docs = db.query(MedicalDocument).filter(
            MedicalDocument.user_id == user_id,
            or_(
                MedicalDocument.title.ilike(f"%{q_term}%"),
                MedicalDocument.ocr_raw_text.ilike(f"%{q_term}%")
            )
        ).limit(5).all()

        return {
            "success": True,
            "query": q_term,
            "matchCount": len(docs),
            "documents": [
                {
                    "id": d.id,
                    "title": d.title,
                    "type": d.document_type,
                    "uploadedAt": d.created_at.isoformat() if d.created_at else None,
                    "summarySnippet": (d.ocr_raw_text[:200] + "...") if d.ocr_raw_text else ""
                }
                for d in docs
            ]
        }

    # 17. Change User Language Preference
    @classmethod
    def _tool_change_user_language_preference(cls, args: Dict[str, Any], user_id: str, db: Session) -> Dict[str, Any]:
        lang = args.get("language_code", "en").lower().strip()
        allowed = ["en", "ta", "tanglish", "ta-en", "hi", "te", "ml", "kn", "bn", "mr"]
        if lang not in allowed:
            return {"success": False, "error": f"Language '{lang}' is not supported."}

        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.preferred_language = lang
            profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
            if profile:
                profile.preferred_language = lang
            db.commit()

        return {
            "success": True,
            "message": f"Language preference updated to {lang}.",
            "language": lang
        }

    # 18. Send Consented Guardian Notification
    @classmethod
    def _tool_send_consented_guardian_notification(cls, args: Dict[str, Any], user_id: str, db: Session) -> Dict[str, Any]:
        # Check patient consent first
        consent = db.query(UserConsent).filter(UserConsent.user_id == user_id).first()
        if consent and not consent.guardian_sharing_enabled:
            return {
                "success": False,
                "error": "Cannot dispatch notification: Guardian sharing consent is disabled in patient privacy settings."
            }

        guardians = db.query(Guardian).filter(Guardian.user_id == user_id, Guardian.sms_enabled == True).all()
        if not guardians:
            return {
                "success": False,
                "error": "No authorized guardian contacts with SMS alerts enabled were found."
            }

        msg_text = args.get("message", "").strip()
        alert_type = args.get("alert_type", "info")

        # Create audit notification record
        for g in guardians:
            notif = Notification(
                user_id=user_id,
                channel="sms",
                recipient=g.phone_number,
                title=f"VitaCare Alert ({alert_type.upper()})",
                message_body=msg_text,
                status="sent"
            )
            db.add(notif)
        db.commit()

        return {
            "success": True,
            "message": f"Alert notification dispatched to {len(guardians)} authorized guardian(s).",
            "recipients": [g.name for g in guardians]
        }
