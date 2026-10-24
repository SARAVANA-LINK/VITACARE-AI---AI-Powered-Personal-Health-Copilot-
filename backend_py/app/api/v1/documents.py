import json
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.all_models import User, MedicalDocument, MedicationSchedule, HealthMeasurement
from app.services.storage_service import StorageService
from app.services.ocr_service import OcrService

router = APIRouter(prefix="/documents", tags=["Medical Documents"])

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form("prescription"), # "prescription", "lab_report", "discharge_summary", "medical_image"
    title: str = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc_title = title or file.filename or f"Medical Document ({category})"

    # Save file
    file_url, file_path, file_size = await StorageService.save_uploaded_file(file, subfolder=category)

    # Perform OCR Extraction
    raw_text = OcrService.extract_text_from_file(file_path, file.content_type)

    if category == "lab_report":
        extracted_draft = OcrService.parse_lab_report_draft(raw_text)
    else:
        extracted_draft = OcrService.parse_prescription_draft(raw_text)

    # Save Document record
    doc = MedicalDocument(
        user_id=current_user.id,
        title=doc_title,
        category=category,
        file_url=file_url,
        file_path=file_path,
        file_size=file_size,
        mime_type=file.content_type,
        ocr_status="completed",
        ocr_raw_text=raw_text,
        extracted_data_json=json.dumps(extracted_draft),
        is_verified=False
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return {
        "success": True,
        "message": "Medical document uploaded and processed successfully.",
        "document": {
            "id": doc.id,
            "title": doc.title,
            "category": doc.category,
            "fileUrl": doc.file_url,
            "fileSize": doc.file_size,
            "uploadedAt": doc.uploaded_at.isoformat(),
            "extractedDraft": extracted_draft,
            "isVerified": False
        }
    }

@router.get("")
@router.get("/")
def list_documents(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    docs = db.query(MedicalDocument).filter(
        MedicalDocument.user_id == current_user.id
    ).order_by(MedicalDocument.uploaded_at.desc()).all()

    results = []
    for d in docs:
        draft = json.loads(d.extracted_data_json) if d.extracted_data_json else {}
        results.append({
            "id": d.id,
            "title": d.title,
            "category": d.category,
            "fileUrl": d.file_url,
            "fileSize": d.file_size,
            "ocrStatus": d.ocr_status,
            "isVerified": d.is_verified,
            "extractedData": draft,
            "uploadedAt": d.uploaded_at.isoformat() if d.uploaded_at else None
        })

    return {"documents": results, "count": len(results)}

@router.delete("/{document_id}")
def delete_document(document_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(MedicalDocument).filter(
        MedicalDocument.id == document_id, MedicalDocument.user_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    StorageService.delete_file(doc.file_path)
    db.delete(doc)
    db.commit()
    return {"success": True, "message": "Document deleted successfully."}

@router.post("/{document_id}/verify")
def verify_extracted_draft(
    document_id: str,
    verification_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Patient or pharmacist confirmation of extracted draft.
    Saves confirmed items into official MedicationSchedule or HealthMeasurement.
    """
    doc = db.query(MedicalDocument).filter(
        MedicalDocument.id == document_id, MedicalDocument.user_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    confirmed_meds = verification_data.get("medications", [])
    for med in confirmed_meds:
        schedule = MedicationSchedule(
            user_id=current_user.id,
            name=med.get("name", "Medication"),
            dosage=med.get("dosage", "As directed"),
            instructions=med.get("instructions", "Take with water"),
            frequency=med.get("frequency", "Once daily"),
            times_of_day=json.dumps(med.get("timesOfDay", ["08:00 AM"]))
        )
        db.add(schedule)

    doc.is_verified = True
    db.commit()

    return {"success": True, "message": "Extracted data verified and added to health records."}
