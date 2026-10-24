"""
VitaCare AI — Medical Document & OCR Extraction Repository
"""

import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.all_models import MedicalDocument, DocumentExtraction

class DocumentRepository(BaseRepository[MedicalDocument]):
    def __init__(self, db: Session):
        super().__init__(MedicalDocument, db)

    def register_document(
        self, user_id: str, original_filename: str, private_storage_key: str,
        mime_type: str, file_size: int, checksum: str, document_type: str = "prescription",
        upload_status: str = "uploaded", processing_status: str = "unprocessed"
    ) -> MedicalDocument:
        """Register a medical file uploaded to private object storage."""
        doc = MedicalDocument(
            user_id=user_id,
            document_type=document_type,
            original_filename=original_filename,
            private_storage_key=private_storage_key,
            mime_type=mime_type,
            file_size=file_size,
            checksum=checksum,
            upload_status=upload_status,
            processing_status=processing_status
        )
        self.db.add(doc)
        self.db.commit()
        self.db.refresh(doc)
        return doc

    def save_extraction_result(
        self, document_id: str, user_id: str, extracted_data_json: str,
        extraction_confidence: float = 0.95, extraction_version: str = "v1.0"
    ) -> DocumentExtraction:
        """Store AI/OCR extraction result linked to source document."""
        doc = self.get_by_id_for_user(document_id, user_id)
        if not doc:
            raise ValueError("Document not found or access denied")

        extraction = DocumentExtraction(
            document_id=document_id,
            extraction_version=extraction_version,
            extracted_data_json=extracted_data_json,
            extraction_confidence=extraction_confidence,
            review_status="unverified"
        )
        doc.processing_status = "completed"
        doc.processed_at = datetime.datetime.utcnow()
        self.db.add(extraction)
        self.db.commit()
        self.db.refresh(extraction)
        return extraction

    def confirm_extraction(self, extraction_id: str, user_id: str) -> Optional[DocumentExtraction]:
        """Record patient confirmation of extracted medical values."""
        extraction = self.db.query(DocumentExtraction).join(MedicalDocument).filter(
            DocumentExtraction.id == extraction_id,
            MedicalDocument.user_id == user_id
        ).first()

        if extraction:
            extraction.review_status = "verified"
            extraction.user_confirmed_at = datetime.datetime.utcnow()
            self.db.commit()
            self.db.refresh(extraction)
        return extraction

    def soft_delete_document(self, document_id: str, user_id: str) -> bool:
        """Soft delete a medical document preserving audit references."""
        doc = self.get_by_id_for_user(document_id, user_id)
        if doc:
            doc.deleted_at = datetime.datetime.utcnow()
            self.db.commit()
            return True
        return False

    def list_active_documents(self, user_id: str, document_type: Optional[str] = None) -> List[MedicalDocument]:
        """List active un-deleted medical documents for user."""
        query = self.db.query(MedicalDocument).filter(
            MedicalDocument.user_id == user_id,
            MedicalDocument.deleted_at.is_(None)
        )
        if document_type:
            query = query.filter(MedicalDocument.document_type == document_type)
        return query.order_by(MedicalDocument.uploaded_at.desc()).all()
