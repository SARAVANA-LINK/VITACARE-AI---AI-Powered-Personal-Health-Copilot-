import os
import json
import datetime
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, UploadFile, File, Form, Request, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.all_models import (
    User, MedicalDocument, DocumentExtraction, Medication, MedicationSchedule, Notification
)
from app.services.storage_service import StorageService
from app.services.ocr_service import OcrService

logger = logging.getLogger("vitacare.prescriptions")

router = APIRouter(prefix="/prescriptions", tags=["Prescription OCR & Verification"])

@router.post("/upload")
async def upload_prescription(
    request: Request,
    document: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    imageBase64: Optional[str] = Form(None),
    sampleText: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Accepts doctor prescription via:
    1. Multipart file upload ('document' or 'file' form field) - JPG, PNG, WEBP, PDF
    2. Base64 camera photo JSON or form field ('imageBase64')
    3. Sample prescription text JSON or form field ('sampleText')
    """
    uploaded_file = document or file
    b64_image = imageBase64
    raw_sample = sampleText

    # If request has JSON body (e.g. from CameraCaptureModal or handleUseSample)
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
            b64_image = b64_image or body.get("imageBase64")
            raw_sample = raw_sample or body.get("sampleText")
        except Exception as json_err:
            logger.debug(f"JSON body parsing note: {json_err}")

    file_url = ""
    file_path = ""
    file_size = 0
    original_filename = "prescription.png"
    mime_type = "image/png"

    # Step 1: Storage and Format Dispatch
    try:
        if uploaded_file and uploaded_file.filename:
            original_filename = uploaded_file.filename
            mime_type = uploaded_file.content_type or "image/png"
            file_url, file_path, file_size = await StorageService.save_uploaded_file(uploaded_file, subfolder="prescriptions")
            ocr_result = await OcrService.process_prescription(file_path=file_path, mime_type=mime_type)

        elif b64_image:
            original_filename = "camera_capture_prescription.jpg"
            mime_type = "image/jpeg"
            file_url, file_path, file_size = StorageService.save_base64_file(b64_image, subfolder="prescriptions")
            ocr_result = await OcrService.process_prescription(image_base64=b64_image)

        elif raw_sample:
            original_filename = "sample_prescription.txt"
            mime_type = "text/plain"
            file_url, file_path, file_size = StorageService.save_text_file(raw_sample, subfolder="prescriptions")
            ocr_result = await OcrService.process_prescription(sample_text=raw_sample)

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please upload a prescription image/PDF, capture a photo, or provide sample text."
            )
    except HTTPException:
        raise
    except Exception as proc_err:
        logger.error(f"Prescription OCR processing error: {proc_err}", exc_info=True)
        return {
            "success": False,
            "error": "We couldn't read this prescription clearly. Please upload a clearer image or enter the medicine details manually.",
            "detail": str(proc_err),
            "draft": {
                "doctorName": "",
                "clinicName": "",
                "prescriptionDate": datetime.date.today().isoformat(),
                "originalFilename": original_filename,
                "filePath": file_path,
                "fileUrl": file_url,
                "rawOcrText": "",
                "ocrConfidence": 0,
                "isReadable": False,
                "unreadableReason": "We couldn't read this prescription clearly. Please upload a clearer image or enter the medicine details manually.",
                "medicines": []
            }
        }

    # Step 2: Persist Document Record
    doc = MedicalDocument(
        user_id=current_user.id,
        title=f"Prescription ({original_filename})",
        category="prescription",
        original_filename=original_filename,
        file_url=file_url,
        file_path=file_path,
        file_size=file_size,
        mime_type=mime_type,
        ocr_status="completed" if ocr_result.get("isReadable") else "failed",
        ocr_raw_text=ocr_result.get("rawOcrText", ""),
        extracted_data_json=json.dumps(ocr_result),
        is_verified=False
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Step 3: Record Extraction Attempt
    extraction = DocumentExtraction(
        document_id=doc.id,
        extraction_version="v2.0-clinical-vision",
        extracted_data_json=json.dumps(ocr_result),
        extraction_confidence=0.95 if ocr_result.get("isReadable") else 0.40,
        review_status="unverified"
    )
    db.add(extraction)
    db.commit()

    # Step 4: Return Reviewable Draft
    draft = {
        "tempId": f"draft-{doc.id}",
        "documentId": doc.id,
        "userId": current_user.id,
        "doctorName": ocr_result.get("doctorName") or "Prescribing Physician",
        "clinicName": ocr_result.get("clinicName") or "Medical Clinic",
        "prescriptionDate": ocr_result.get("prescriptionDate") or datetime.date.today().isoformat(),
        "doctorNotes": ocr_result.get("doctorNotes") or "",
        "originalFilename": original_filename,
        "filePath": file_path,
        "fileUrl": file_url,
        "rawOcrText": ocr_result.get("rawOcrText", ""),
        "ocrConfidence": 95 if ocr_result.get("isReadable") else 35,
        "isReadable": ocr_result.get("isReadable", True),
        "unreadableReason": ocr_result.get("unreadableReason", ""),
        "medicines": ocr_result.get("medicines", [])
    }

    return {
        "success": True,
        "draft": draft,
        "message": "Prescription processed. Please review and verify extracted medications before saving."
    }

@router.post("/verify")
def verify_prescription(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Patient or clinician review and confirmation of extracted prescription medications.
    Creates permanent Medication and MedicationSchedule records, marks document verified,
    and returns scheduled items.
    """
    doctor_name = payload.get("doctorName", "Physician")
    clinic_name = payload.get("clinicName", "Medical Clinic")
    rx_date = payload.get("prescriptionDate") or datetime.date.today().isoformat()
    original_filename = payload.get("originalFilename", "prescription.pdf")
    file_path = payload.get("filePath", "")
    file_url = payload.get("fileUrl", "")
    raw_ocr_text = payload.get("rawOcrText", "")
    document_id = payload.get("documentId")
    medicines = payload.get("medicines", [])

    if not medicines or len(medicines) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prescription must contain at least one verified medicine before confirming."
        )

    # 1. Update or create MedicalDocument
    doc = None
    if document_id:
        doc = db.query(MedicalDocument).filter(
            MedicalDocument.id == document_id, MedicalDocument.user_id == current_user.id
        ).first()

    if not doc:
        doc = MedicalDocument(
            user_id=current_user.id,
            title=f"Verified Prescription - Dr. {doctor_name}",
            category="prescription",
            original_filename=original_filename,
            file_url=file_url,
            file_path=file_path,
            mime_type="application/octet-stream",
            ocr_status="completed",
            ocr_raw_text=raw_ocr_text,
            is_verified=True
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
    else:
        doc.is_verified = True
        doc.title = f"Verified Prescription - Dr. {doctor_name}"

    # Update extraction status
    extraction = db.query(DocumentExtraction).filter(
        DocumentExtraction.document_id == doc.id
    ).first()
    if extraction:
        extraction.review_status = "verified"
        extraction.user_confirmed_at = datetime.datetime.utcnow()
        extraction.extracted_data_json = json.dumps(payload)
    else:
        extraction = DocumentExtraction(
            document_id=doc.id,
            extraction_version="v2.0-verified",
            extracted_data_json=json.dumps(payload),
            extraction_confidence=1.0,
            review_status="verified",
            user_confirmed_at=datetime.datetime.utcnow()
        )
        db.add(extraction)

    # 2. Persist confirmed medicines & schedules
    created_meds = []
    created_schedules = []

    for med in medicines:
        med_name = (med.get("medicineName") or med.get("name") or "Prescribed Medication").strip()
        strength = (med.get("strength") or med.get("dosage") or "Standard dose").strip()
        dose = (med.get("dose") or "1 tablet").strip()
        frequency = (med.get("frequency") or "Once daily").strip()
        instructions = (med.get("instructions") or med.get("mealRelation") or "Take after food").strip()
        duration = (med.get("duration") or "30 days").strip()
        intake_times = med.get("intakeTimes") or ["08:00 AM"]
        if not isinstance(intake_times, list):
            intake_times = [str(intake_times)]

        # Save Medication
        new_med = Medication(
            user_id=current_user.id,
            medication_name=med_name,
            strength=strength,
            dosage_instructions=f"{dose} - {frequency} ({instructions})",
            source_document_id=doc.id,
            verification_status="verified_by_user",
            start_date=rx_date,
            status="active"
        )
        db.add(new_med)
        db.flush()

        # Save Medication Schedule
        new_schedule = MedicationSchedule(
            user_id=current_user.id,
            medication_id=new_med.id,
            name=med_name,
            dosage=strength,
            instructions=instructions,
            frequency=frequency,
            times_of_day=json.dumps(intake_times),
            start_date=rx_date,
            remaining_doses=30,
            is_active=True
        )
        db.add(new_schedule)
        db.flush()

        created_meds.append({
            "id": new_med.id,
            "name": new_med.medication_name,
            "dosage": new_med.strength,
            "frequency": frequency,
            "intakeTimes": intake_times,
            "duration": duration,
            "instructions": instructions,
            "startDate": rx_date,
            "isActive": True
        })
        created_schedules.append({
            "id": new_schedule.id,
            "medicationId": new_med.id,
            "name": new_schedule.name,
            "dosage": new_schedule.dosage,
            "frequency": new_schedule.frequency,
            "timesOfDay": intake_times
        })

    # 3. Notification
    notif = Notification(
        user_id=current_user.id,
        title="Prescription Verified & Schedules Created",
        message=f"Successfully verified {len(created_meds)} medications from Dr. {doctor_name}.",
        type="report_verified",
        is_read=False
    )
    db.add(notif)
    db.commit()

    return {
        "success": True,
        "message": "Prescription verified and active medication schedules generated.",
        "prescription": {
            "id": doc.id,
            "doctorName": doctor_name,
            "clinicName": clinic_name,
            "prescriptionDate": rx_date,
            "originalFilename": doc.original_filename,
            "fileUrl": doc.file_url,
            "isVerified": True
        },
        "medicines": created_meds,
        "schedulesGenerated": len(created_schedules)
    }

@router.get("")
@router.get("/")
def list_prescriptions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns all uploaded prescriptions and their extracted/verified medicine records.
    """
    docs = db.query(MedicalDocument).filter(
        MedicalDocument.user_id == current_user.id,
        MedicalDocument.document_type == "prescription"
    ).order_by(MedicalDocument.uploaded_at.desc()).all()

    results = []
    for d in docs:
        draft = json.loads(d.extracted_data_json) if d.extracted_data_json else {}
        meds = db.query(Medication).filter(
            Medication.source_document_id == d.id,
            Medication.user_id == current_user.id
        ).all()

        results.append({
            "id": d.id,
            "title": d.title,
            "originalFilename": d.original_filename,
            "fileUrl": d.file_url,
            "filePath": d.file_path,
            "fileSize": d.file_size,
            "isVerified": d.is_verified,
            "ocrStatus": d.processing_status,
            "uploadedAt": d.uploaded_at.isoformat() if d.uploaded_at else None,
            "doctorName": draft.get("doctorName", "Physician"),
            "clinicName": draft.get("clinicName", "Clinic"),
            "prescriptionDate": draft.get("prescriptionDate", ""),
            "medicinesCount": len(meds) if len(meds) > 0 else len(draft.get("medicines", [])),
            "medicines": [
                {
                    "id": m.id,
                    "name": m.medication_name,
                    "strength": m.strength,
                    "instructions": m.dosage_instructions,
                    "status": m.status
                }
                for m in meds
            ] or draft.get("medicines", [])
        })

    return {"prescriptions": results, "count": len(results)}

@router.get("/{prescription_id}")
def get_prescription(
    prescription_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(MedicalDocument).filter(
        MedicalDocument.id == prescription_id,
        MedicalDocument.user_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prescription not found.")

    draft = json.loads(doc.extracted_data_json) if doc.extracted_data_json else {}
    meds = db.query(Medication).filter(
        Medication.source_document_id == doc.id,
        Medication.user_id == current_user.id
    ).all()

    return {
        "prescription": {
            "id": doc.id,
            "title": doc.title,
            "originalFilename": doc.original_filename,
            "fileUrl": doc.file_url,
            "isVerified": doc.is_verified,
            "rawOcrText": doc.ocr_raw_text,
            "uploadedAt": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
            **draft
        },
        "medicines": meds
    }

@router.delete("/{prescription_id}")
def delete_prescription(
    prescription_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(MedicalDocument).filter(
        MedicalDocument.id == prescription_id,
        MedicalDocument.user_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prescription not found.")

    StorageService.delete_file(doc.file_path)
    db.delete(doc)
    db.commit()
    return {"success": True, "message": "Prescription deleted successfully."}
