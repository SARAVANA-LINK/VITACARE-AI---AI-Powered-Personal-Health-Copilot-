"""
VitaCare AI — Health Record & Biomarker Measurement Repository
"""

import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.repositories.base import BaseRepository
from app.models.all_models import HealthRecord

class HealthRecordRepository(BaseRepository[HealthRecord]):
    def __init__(self, db: Session):
        super().__init__(HealthRecord, db)

    def add_record(
        self, user_id: str, record_type: str, biomarker_name: str,
        numeric_value: Optional[float] = None, string_value: Optional[str] = None,
        structured_value: Optional[str] = None, unit: Optional[str] = None,
        status: str = "normal", source_type: str = "manual_entry",
        source_document_id: Optional[str] = None, record_date: Optional[datetime.datetime] = None
    ) -> HealthRecord:
        """Create and persist a validated health record / biomarker."""
        record = HealthRecord(
            user_id=user_id,
            record_type=record_type,
            biomarker_name=biomarker_name,
            numeric_value=numeric_value,
            string_value=string_value,
            structured_value=structured_value,
            unit=unit,
            status=status,
            source_type=source_type,
            source_document_id=source_document_id,
            record_date=record_date or datetime.datetime.utcnow()
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def get_biomarker_history(
        self, user_id: str, biomarker_name: str,
        start_date: Optional[datetime.datetime] = None,
        end_date: Optional[datetime.datetime] = None,
        limit: int = 50
    ) -> List[HealthRecord]:
        """Fetch chronological trend data for a specific clinical biomarker."""
        query = self.db.query(HealthRecord).filter(
            HealthRecord.user_id == user_id,
            HealthRecord.biomarker_name == biomarker_name
        )
        if start_date:
            query = query.filter(HealthRecord.record_date >= start_date)
        if end_date:
            query = query.filter(HealthRecord.record_date <= end_date)

        return query.order_by(HealthRecord.record_date.desc()).limit(limit).all()

    def get_latest_vitals_summary(self, user_id: str) -> Dict[str, Any]:
        """Retrieve the most recent entry for each standard vital sign."""
        vital_types = ["bp_systolic", "bp_diastolic", "blood_glucose", "heart_rate", "spo2", "temperature", "hba1c"]
        summary = {}
        for vt in vital_types:
            latest = self.db.query(HealthRecord).filter(
                HealthRecord.user_id == user_id,
                HealthRecord.biomarker_name == vt
            ).order_by(HealthRecord.record_date.desc()).first()
            if latest:
                summary[vt] = {
                    "value": latest.numeric_value,
                    "unit": latest.unit,
                    "status": latest.status,
                    "measured_at": latest.record_date.isoformat(),
                    "source": latest.source_type
                }
        return summary

    def verify_record(self, record_id: str, user_id: str) -> Optional[HealthRecord]:
        """Mark an unverified OCR extracted health record as clinically verified by user."""
        record = self.get_by_id_for_user(record_id, user_id)
        if record:
            record.user_verified_at = datetime.datetime.utcnow()
            self.db.commit()
            self.db.refresh(record)
        return record
