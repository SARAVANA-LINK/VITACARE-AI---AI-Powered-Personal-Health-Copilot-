import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.all_models import User, Appointment, Notification
from app.schemas.all_schemas import AppointmentCreate, AppointmentUpdate

router = APIRouter(prefix="/appointments", tags=["Doctor Appointments"])

@router.get("")
@router.get("/")
def list_appointments(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    appts = db.query(Appointment).filter(
        Appointment.user_id == current_user.id
    ).order_by(Appointment.appointment_date.asc()).all()

    formatted = []
    for a in appts:
        formatted.append({
            "id": a.id,
            "doctorName": a.doctor_name,
            "specialty": a.specialty,
            "clinicName": a.clinic_name,
            "facilityName": a.clinic_name,
            "appointmentDate": a.appointment_date,
            "date": a.appointment_date,
            "appointmentTime": a.appointment_time,
            "time": a.appointment_time,
            "location": a.location,
            "contactPhone": a.contact_phone,
            "status": a.status,
            "reminderEnabled": a.reminder_enabled,
            "notes": a.notes
        })

    return {"appointments": formatted, "count": len(formatted)}

@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_appointment(
    req: AppointmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    date = req.appointmentDate or req.date
    time_str = req.appointmentTime or req.time or "10:00 AM"
    clinic = req.clinicName or req.facilityName or "Outpatient Clinic"
    notes_str = req.notes or req.reason or ""

    if not req.doctorName or not date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Doctor name and appointment date are required."
        )

    appt = Appointment(
        user_id=current_user.id,
        doctor_name=req.doctorName.strip(),
        specialty=req.specialty or "General Medicine",
        clinic_name=clinic,
        appointment_date=date,
        appointment_time=time_str,
        location=req.location or "Clinic Suite",
        contact_phone=req.contactPhone or "",
        status="confirmed",
        reminder_enabled=req.reminderEnabled if req.reminderEnabled is not None else True,
        notes=notes_str
    )
    db.add(appt)

    # In-app notification
    notif = Notification(
        user_id=current_user.id,
        title="Appointment Confirmed",
        message=f"Consultation with {appt.doctor_name} scheduled on {appt.appointment_date} at {appt.appointment_time}.",
        type="reminder"
    )
    db.add(notif)
    db.commit()
    db.refresh(appt)

    return {
        "success": True,
        "appointment": {
            "id": appt.id,
            "doctorName": appt.doctor_name,
            "specialty": appt.specialty,
            "clinicName": appt.clinic_name,
            "appointmentDate": appt.appointment_date,
            "appointmentTime": appt.appointment_time,
            "status": appt.status
        }
    }

@router.put("/{appointment_id}")
def update_appointment(
    appointment_id: str,
    req: AppointmentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    appt = db.query(Appointment).filter(
        Appointment.id == appointment_id, Appointment.user_id == current_user.id
    ).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")

    if req.status: appt.status = req.status
    if req.appointmentDate: appt.appointment_date = req.appointmentDate
    if req.appointmentTime: appt.appointment_time = req.appointmentTime
    if req.notes: appt.notes = req.notes

    db.commit()
    db.refresh(appt)
    return {
        "success": True,
        "appointment": {
            "id": appt.id,
            "doctorName": appt.doctor_name,
            "specialty": appt.specialty,
            "clinicName": appt.clinic_name,
            "appointmentDate": appt.appointment_date,
            "appointmentTime": appt.appointment_time,
            "status": appt.status,
            "notes": appt.notes
        }
    }

@router.delete("/{appointment_id}")
def delete_appointment(
    appointment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    appt = db.query(Appointment).filter(
        Appointment.id == appointment_id, Appointment.user_id == current_user.id
    ).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")
    db.delete(appt)
    db.commit()
    return {"success": True, "message": "Appointment cancelled successfully."}
