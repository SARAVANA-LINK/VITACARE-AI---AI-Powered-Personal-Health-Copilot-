"""
VitaCare AI — Appointment & Clinical Scheduling Repository
"""

import datetime
from typing import Optional, List
from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.all_models import Appointment

class AppointmentRepository(BaseRepository[Appointment]):
    def __init__(self, db: Session):
        super().__init__(Appointment, db)

    def book_appointment(
        self, user_id: str, appointment_title: str, scheduled_start: datetime.datetime,
        clinician_or_facility_reference: Optional[str] = None, specialty: str = "General Medicine",
        scheduled_end: Optional[datetime.datetime] = None, timezone: str = "Asia/Kolkata",
        location: Optional[str] = None, contact_phone: Optional[str] = None, notes: Optional[str] = None
    ) -> Appointment:
        """Create and schedule an outpatient appointment."""
        appt = Appointment(
            user_id=user_id,
            appointment_title=appointment_title,
            clinician_or_facility_reference=clinician_or_facility_reference,
            specialty=specialty,
            scheduled_start=scheduled_start,
            scheduled_end=scheduled_end,
            appointment_date=scheduled_start.strftime("%Y-%m-%d"),
            appointment_time=scheduled_start.strftime("%I:%M %p"),
            timezone=timezone,
            location=location,
            contact_phone=contact_phone,
            status="confirmed",
            notes=notes
        )
        self.db.add(appt)
        self.db.commit()
        self.db.refresh(appt)
        return appt

    def get_upcoming_appointments(self, user_id: str, limit: int = 10) -> List[Appointment]:
        """Fetch future confirmed appointments ordered chronologically."""
        now = datetime.datetime.utcnow()
        return self.db.query(Appointment).filter(
            Appointment.user_id == user_id,
            Appointment.status.in_(["scheduled", "confirmed"]),
            Appointment.scheduled_start >= now
        ).order_by(Appointment.scheduled_start.asc()).limit(limit).all()

    def cancel_appointment(self, appointment_id: str, user_id: str, reason: Optional[str] = None) -> Optional[Appointment]:
        """Cancel an appointment ensuring patient ownership."""
        appt = self.get_by_id_for_user(appointment_id, user_id)
        if appt:
            appt.status = "cancelled"
            if reason:
                appt.notes = f"{appt.notes or ''} [Cancelled: {reason}]"
            self.db.commit()
            self.db.refresh(appt)
        return appt
