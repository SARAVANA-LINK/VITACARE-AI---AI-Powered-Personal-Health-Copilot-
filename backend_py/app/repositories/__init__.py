"""
VitaCare AI — Database Repositories Package
"""

from app.repositories.base import BaseRepository
from app.repositories.user_repo import UserRepository
from app.repositories.health_record_repo import HealthRecordRepository
from app.repositories.medication_repo import MedicationRepository
from app.repositories.document_repo import DocumentRepository
from app.repositories.chat_repo import ChatRepository
from app.repositories.appointment_repo import AppointmentRepository

__all__ = [
    "BaseRepository",
    "UserRepository",
    "HealthRecordRepository",
    "MedicationRepository",
    "DocumentRepository",
    "ChatRepository",
    "AppointmentRepository"
]
