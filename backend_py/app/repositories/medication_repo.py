"""
VitaCare AI — Medication, Reminder Schedule, and Adherence Intake Repository
"""

import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.repositories.base import BaseRepository
from app.models.all_models import Medication, MedicationSchedule, MedicationIntakeLog

class MedicationRepository(BaseRepository[Medication]):
    def __init__(self, db: Session):
        super().__init__(Medication, db)

    def add_medication(
        self, user_id: str, medication_name: str, dosage_instructions: str,
        strength: Optional[str] = None, source_document_id: Optional[str] = None,
        verification_status: str = "unverified", start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Medication:
        """Create a medication record with explicit safety verification tracking."""
        med = Medication(
            user_id=user_id,
            medication_name=medication_name,
            dosage_instructions=dosage_instructions,
            strength=strength,
            source_document_id=source_document_id,
            verification_status=verification_status,
            start_date=start_date,
            end_date=end_date,
            status="active"
        )
        self.db.add(med)
        self.db.commit()
        self.db.refresh(med)
        return med

    def create_schedule(
        self, medication_id: str, user_id: str, schedule_definition: str,
        timezone: str = "Asia/Kolkata", start_at: Optional[datetime.datetime] = None
    ) -> MedicationSchedule:
        """Create a recurring reminder schedule for a medication."""
        med = self.get_by_id_for_user(medication_id, user_id)
        if not med:
            raise ValueError("Medication not found or unauthorized")

        schedule = MedicationSchedule(
            medication_id=medication_id,
            user_id=user_id,
            name=med.medication_name,
            dosage=med.strength or "Standard dose",
            instructions=med.dosage_instructions,
            schedule_definition=schedule_definition,
            timezone=timezone,
            start_at=start_at or datetime.datetime.utcnow(),
            is_active=True
        )
        self.db.add(schedule)
        self.db.commit()
        self.db.refresh(schedule)
        return schedule

    def log_intake(
        self, medication_id: str, user_id: str, scheduled_at: datetime.datetime,
        status: str = "taken", schedule_id: Optional[str] = None, user_note: Optional[str] = None
    ) -> MedicationIntakeLog:
        """
        Record a medication intake event.
        Guarantees idempotency and prevents duplicate intake logs for the same scheduled occurrence
        via the unique constraint on (medication_id, scheduled_at).
        """
        med = self.get_by_id_for_user(medication_id, user_id)
        if not med:
            raise ValueError("Medication not found or unauthorized")

        # Check existing occurrence
        existing = self.db.query(MedicationIntakeLog).filter(
            MedicationIntakeLog.medication_id == medication_id,
            MedicationIntakeLog.scheduled_at == scheduled_at
        ).first()

        if existing:
            # Update status idempotently
            existing.status = status
            existing.user_note = user_note
            existing.recorded_at = datetime.datetime.utcnow()
            self.db.commit()
            self.db.refresh(existing)
            return existing

        log_entry = MedicationIntakeLog(
            medication_id=medication_id,
            schedule_id=schedule_id,
            scheduled_at=scheduled_at,
            status=status,
            user_note=user_note,
            recorded_at=datetime.datetime.utcnow()
        )
        self.db.add(log_entry)
        try:
            self.db.commit()
            self.db.refresh(log_entry)
            return log_entry
        except IntegrityError:
            self.db.rollback()
            # Race condition caught by unique constraint: return existing row
            return self.db.query(MedicationIntakeLog).filter(
                MedicationIntakeLog.medication_id == medication_id,
                MedicationIntakeLog.scheduled_at == scheduled_at
            ).first()

    def get_user_active_medications(self, user_id: str) -> List[Medication]:
        """Fetch all currently active medications for user."""
        return self.db.query(Medication).filter(
            Medication.user_id == user_id,
            Medication.status == "active"
        ).order_by(Medication.created_at.desc()).all()

    def get_adherence_summary(self, user_id: str, days: int = 30) -> Dict[str, Any]:
        """Calculate percentage adherence over the past N days."""
        since = datetime.datetime.utcnow() - datetime.timedelta(days=days)
        med_ids = [m.id for m in self.get_user_active_medications(user_id)]
        if not med_ids:
            return {"total_scheduled": 0, "taken": 0, "skipped": 0, "missed": 0, "adherence_rate_pct": 100.0}

        logs = self.db.query(MedicationIntakeLog).filter(
            MedicationIntakeLog.medication_id.in_(med_ids),
            MedicationIntakeLog.scheduled_at >= since
        ).all()

        total = len(logs)
        taken = sum(1 for l in logs if l.status == "taken")
        skipped = sum(1 for l in logs if l.status == "skipped")
        missed = sum(1 for l in logs if l.status == "missed")
        rate = round((taken / total * 100.0), 1) if total > 0 else 100.0

        return {
            "total_logged": total,
            "taken": taken,
            "skipped": skipped,
            "missed": missed,
            "adherence_rate_pct": rate
        }
