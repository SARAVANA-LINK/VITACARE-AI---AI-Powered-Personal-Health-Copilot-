import os
import json
import datetime
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, UploadFile, File, Form, Request, HTTPException, status
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.all_models import (
    User, MedicalDocument, DocumentExtraction, HealthRecord, HealthMeasurement, AuditEvent
)
from app.services.storage_service import StorageService
from app.services.ocr_service import OcrService

logger = logging.getLogger("vitacare.reports")

router = APIRouter(prefix="/reports", tags=["Diagnostic Lab Reports & OCR"])

@router.post("/upload")
async def upload_report(
    request: Request,
    document: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    imageBase64: Optional[str] = Form(None),
    sampleText: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Accepts medical / diagnostic lab report via:
    1. Multipart file upload ('document' or 'file' form field) - PDF, JPG, PNG, WEBP
    2. Base64 camera capture ('imageBase64' form or JSON)
    3. Sample lab report text ('sampleText' form or JSON)
    """
    uploaded_file = document or file
    b64_image = imageBase64
    raw_sample = sampleText

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
    original_filename = "medical_report.pdf"
    mime_type = "application/pdf"

    try:
        if uploaded_file and uploaded_file.filename:
            original_filename = uploaded_file.filename
            mime_type = uploaded_file.content_type or "application/octet-stream"
            file_url, file_path, file_size = await StorageService.save_uploaded_file(uploaded_file, subfolder="reports")
            ocr_result = await OcrService.process_health_report(file_path=file_path, mime_type=mime_type)

        elif b64_image:
            original_filename = "camera_capture_report.jpg"
            mime_type = "image/jpeg"
            file_url, file_path, file_size = StorageService.save_base64_file(b64_image, subfolder="reports")
            ocr_result = await OcrService.process_health_report(image_base64=b64_image)

        elif raw_sample:
            original_filename = "sample_lab_report.txt"
            mime_type = "text/plain"
            file_url, file_path, file_size = StorageService.save_text_file(raw_sample, subfolder="reports")
            ocr_result = await OcrService.process_health_report(sample_text=raw_sample)

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please upload a health report document, take a photo, or provide report text."
            )
    except HTTPException:
        raise
    except Exception as proc_err:
        logger.error(f"Report OCR processing error: {proc_err}", exc_info=True)
        return {
            "success": False,
            "error": "We couldn't process this medical report clearly. Please verify file format or enter details manually.",
            "detail": str(proc_err),
            "draft": {
                "reportType": "General Health Report",
                "labName": "Diagnostic Pathology Lab",
                "doctorName": "",
                "reportDate": datetime.date.today().isoformat(),
                "originalFilename": original_filename,
                "filePath": file_path,
                "fileUrl": file_url,
                "rawOcrText": "",
                "extractedValues": []
            }
        }

    # Persist document record
    doc = MedicalDocument(
        user_id=current_user.id,
        title=f"{ocr_result.get('reportType', 'Lab Report')} ({original_filename})",
        category="lab_report",
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

    # Document extraction draft
    extraction = DocumentExtraction(
        document_id=doc.id,
        extraction_version="v1.0",
        extracted_data_json=json.dumps(ocr_result),
        extraction_confidence=ocr_result.get("ocrConfidence", 0.95),
        review_status="unverified"
    )
    db.add(extraction)
    db.commit()

    return {
        "success": True,
        "documentId": doc.id,
        "draft": {
            "documentId": doc.id,
            "reportType": ocr_result.get("reportType", "Diagnostic Health Report"),
            "labName": ocr_result.get("labName", "Reference Pathology Laboratory"),
            "doctorName": ocr_result.get("doctorName", "Attending Physician"),
            "reportDate": ocr_result.get("reportDate", datetime.date.today().isoformat()),
            "originalFilename": original_filename,
            "filePath": file_path,
            "fileUrl": file_url,
            "rawOcrText": ocr_result.get("rawOcrText", ""),
            "extractedValues": ocr_result.get("extractedValues", [])
        }
    }

@router.post("/verify")
def verify_report(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Saves verified clinical report and commits all confirmed biomarkers
    to health_records and health_measurements tables.
    """
    doc_id = payload.get("documentId")
    doc = None
    if doc_id:
        doc = db.query(MedicalDocument).filter(
            MedicalDocument.id == doc_id,
            MedicalDocument.user_id == current_user.id
        ).first()

    report_type = payload.get("reportType") or "Diagnostic Health Report"
    lab_name = payload.get("labName") or "Clinical Laboratory"
    doctor_name = payload.get("doctorName") or ""
    report_date_str = payload.get("reportDate") or datetime.date.today().isoformat()
    extracted_values = payload.get("extractedValues") or []

    try:
        report_dt = datetime.datetime.strptime(report_date_str[:10], "%Y-%m-%d")
    except Exception:
        report_dt = datetime.datetime.utcnow()

    if not doc:
        # Create record if not already created during upload draft
        doc = MedicalDocument(
            user_id=current_user.id,
            title=f"{report_type} - {lab_name}",
            category="lab_report",
            original_filename=payload.get("originalFilename") or "lab_report.pdf",
            file_url=payload.get("fileUrl") or "",
            file_path=payload.get("filePath") or "",
            file_size=0,
            mime_type="application/pdf",
            ocr_status="completed",
            ocr_raw_text=payload.get("rawOcrText") or "",
            extracted_data_json=json.dumps(payload),
            is_verified=True
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
    else:
        doc.is_verified = True
        doc.title = f"{report_type} - {lab_name}"
        doc.extracted_data_json = json.dumps(payload)
        db.commit()

    # Clear previous measurements from this document if re-verifying
    db.query(HealthMeasurement).filter(
        HealthMeasurement.user_id == current_user.id,
        HealthMeasurement.source_document_id == doc.id
    ).delete()
    db.query(HealthRecord).filter(
        HealthRecord.user_id == current_user.id,
        HealthRecord.source_document_id == doc.id
    ).delete()

    # Insert confirmed measurements and records
    created_measurements = []
    for val_item in extracted_values:
        metric_key = val_item.get("metricKey") or "custom_metric"
        metric_name = val_item.get("metricName") or metric_key.replace("_", " ").title()
        val_str = str(val_item.get("value", "")).strip()
        unit = val_item.get("unit") or ""
        ref_range = val_item.get("referenceRange") or ""
        status_indicator = val_item.get("statusIndicator") or "normal"

        numeric_val = None
        try:
            # Extract leading numeric portion
            cleaned_num = "".join(ch for ch in val_str if ch.isdigit() or ch in ".-")
            if cleaned_num:
                numeric_val = float(cleaned_num)
        except Exception:
            numeric_val = None

        if numeric_val is not None:
            meas = HealthMeasurement(
                user_id=current_user.id,
                type=metric_key,
                value=numeric_val,
                unit=unit,
                status=status_indicator,
                source="lab_report",
                source_document_id=doc.id,
                measured_at=report_dt
            )
            db.add(meas)
            created_measurements.append(meas)

        # HealthRecord entry
        rec = HealthRecord(
            user_id=current_user.id,
            record_type="lab_result",
            biomarker_name=metric_name,
            record_date=report_dt,
            numeric_value=numeric_val,
            string_value=val_str,
            unit=unit,
            status=status_indicator,
            source_type="ocr_extraction",
            source_document_id=doc.id,
            user_verified_at=datetime.datetime.utcnow()
        )
        db.add(rec)

    db.commit()

    return {
        "success": True,
        "message": "Medical report successfully verified and saved to clinical timeline.",
        "report": {
            "id": doc.id,
            "title": doc.title,
            "reportType": report_type,
            "labName": lab_name,
            "doctorName": doctor_name,
            "reportDate": report_date_str,
            "isVerified": True,
            "metricsCount": len(extracted_values),
            "extractedValues": extracted_values
        }
    }

@router.get("")
@router.get("/")
def get_reports(
    search: Optional[str] = None,
    type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns verified and uploaded medical reports for the current user.
    New users receive genuine empty state (reports: []).
    """
    query = db.query(MedicalDocument).filter(
        MedicalDocument.user_id == current_user.id,
        MedicalDocument.category.in_(["lab_report", "diagnostic_report", "medical_report", "discharge_summary"])
    )

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.filter(MedicalDocument.title.ilike(term))

    documents = query.order_by(MedicalDocument.uploaded_at.desc()).all()

    formatted_reports = []
    for doc in documents:
        parsed_data = {}
        if doc.extracted_data_json:
            try:
                parsed_data = json.loads(doc.extracted_data_json)
            except Exception:
                parsed_data = {}

        rep_type = parsed_data.get("reportType") or doc.title or "Diagnostic Lab Report"
        if type and type.lower() not in rep_type.lower():
            continue

        values = parsed_data.get("extractedValues") or []
        formatted_reports.append({
            "id": doc.id,
            "title": doc.title,
            "category": doc.category,
            "reportType": rep_type,
            "labName": parsed_data.get("labName") or "Pathology Diagnostic Services",
            "doctorName": parsed_data.get("doctorName") or "",
            "reportDate": parsed_data.get("reportDate") or doc.uploaded_at.strftime("%Y-%m-%d"),
            "uploadedAt": doc.uploaded_at.strftime("%Y-%m-%d"),
            "originalFilename": doc.original_filename,
            "fileUrl": doc.file_url,
            "isVerified": doc.is_verified,
            "metricsCount": len(values),
            "extractedValues": values
        })

    return {
        "reports": formatted_reports,
        "count": len(formatted_reports)
    }

@router.get("/compare/diff")
def compare_reports(
    report1Id: str,
    report2Id: str,
    language: str = "en",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generates side-by-side clinical comparison of two lab reports
    for the current user, detailing biomarker trends and progress.
    """
    doc1 = db.query(MedicalDocument).filter(
        MedicalDocument.id == report1Id,
        MedicalDocument.user_id == current_user.id
    ).first()
    doc2 = db.query(MedicalDocument).filter(
        MedicalDocument.id == report2Id,
        MedicalDocument.user_id == current_user.id
    ).first()

    if not doc1 or not doc2:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or both selected reports could not be found."
        )

    data1 = json.loads(doc1.extracted_data_json) if doc1.extracted_data_json else {}
    data2 = json.loads(doc2.extracted_data_json) if doc2.extracted_data_json else {}

    vals1 = {v.get("metricKey", v.get("metricName")): v for v in data1.get("extractedValues", [])}
    vals2 = {v.get("metricKey", v.get("metricName")): v for v in data2.get("extractedValues", [])}

    all_keys = list(dict.fromkeys(list(vals1.keys()) + list(vals2.keys())))
    comparisons = []

    improved_count = 0
    stable_count = 0
    warning_count = 0

    for k in all_keys:
        v1 = vals1.get(k)
        v2 = vals2.get(k)
        metric_name = (v2 and v2.get("metricName")) or (v1 and v1.get("metricName")) or k.replace("_", " ").title()
        unit = (v2 and v2.get("unit")) or (v1 and v1.get("unit")) or ""
        ref = (v2 and v2.get("referenceRange")) or (v1 and v1.get("referenceRange")) or "Normal Target"

        val1_str = v1.get("value") if v1 else "N/A"
        val2_str = v2.get("value") if v2 else "N/A"
        status1 = v1.get("statusIndicator", "normal") if v1 else "unknown"
        status2 = v2.get("statusIndicator", "normal") if v2 else "unknown"

        # Check numeric delta
        delta_str = "—"
        trend = "stable"
        try:
            n1 = float(val1_str)
            n2 = float(val2_str)
            diff = round(n2 - n1, 2)
            delta_str = f"{'+' if diff > 0 else ''}{diff} {unit}".strip()

            if status1 == "elevated" and status2 == "normal":
                trend = "improved"
                improved_count += 1
            elif status1 == "normal" and status2 == "elevated":
                trend = "worsened"
                warning_count += 1
            elif status1 == status2:
                trend = "stable"
                stable_count += 1
            else:
                trend = "changed"
        except Exception:
            stable_count += 1

        comparisons.append({
            "metricKey": k,
            "metricName": metric_name,
            "report1Value": val1_str,
            "report1Status": status1,
            "report2Value": val2_str,
            "report2Status": status2,
            "unit": unit,
            "referenceRange": ref,
            "delta": delta_str,
            "trend": trend
        })

    # Multilingual plain summary
    summary_text = (
        f"Compared {len(comparisons)} biomarker parameters. "
        f"{improved_count} values improved towards target range, "
        f"{stable_count} values remained consistent, and "
        f"{warning_count} values showed elevated variance. "
        f"Continue your prescribed regimen and share these results with your healthcare provider."
    )

    return {
        "report1": {
            "id": doc1.id,
            "title": doc1.title,
            "date": data1.get("reportDate") or doc1.uploaded_at.strftime("%Y-%m-%d"),
            "lab": data1.get("labName") or "Diagnostic Lab"
        },
        "report2": {
            "id": doc2.id,
            "title": doc2.title,
            "date": data2.get("reportDate") or doc2.uploaded_at.strftime("%Y-%m-%d"),
            "lab": data2.get("labName") or "Diagnostic Lab"
        },
        "comparisons": comparisons,
        "summary": summary_text,
        "language": language
    }

@router.get("/{id}")
def get_report_details(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(MedicalDocument).filter(
        MedicalDocument.id == id,
        MedicalDocument.user_id == current_user.id
    ).first()

    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical report not found.")

    parsed_data = {}
    if doc.extracted_data_json:
        try:
            parsed_data = json.loads(doc.extracted_data_json)
        except Exception:
            parsed_data = {}

    return {
        "report": {
            "id": doc.id,
            "title": doc.title,
            "category": doc.category,
            "reportType": parsed_data.get("reportType") or doc.title,
            "labName": parsed_data.get("labName") or "Diagnostic Pathology Laboratory",
            "doctorName": parsed_data.get("doctorName") or "",
            "reportDate": parsed_data.get("reportDate") or doc.uploaded_at.strftime("%Y-%m-%d"),
            "uploadedAt": doc.uploaded_at.strftime("%Y-%m-%d"),
            "originalFilename": doc.original_filename,
            "fileUrl": doc.file_url,
            "isVerified": doc.is_verified,
            "rawOcrText": doc.ocr_raw_text or parsed_data.get("rawOcrText", ""),
            "extractedValues": parsed_data.get("extractedValues", [])
        }
    }

@router.get("/{id}/document")
def get_report_document(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns report document binary blob with appropriate Content-Type header.
    """
    doc = db.query(MedicalDocument).filter(
        MedicalDocument.id == id,
        MedicalDocument.user_id == current_user.id
    ).first()

    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report document not found.")

    if doc.file_path and os.path.exists(doc.file_path):
        return FileResponse(
            path=doc.file_path,
            filename=doc.original_filename,
            media_type=doc.mime_type or "application/pdf"
        )

    # If physical file missing, return generated clinical summary HTML/PDF stream
    html_content = f"""<!DOCTYPE html>
<html>
<head><title>{doc.title}</title><style>body{{font-family:sans-serif;padding:30px;line-height:1.6;color:#1e293b;}}h1{{color:#0284c7;}}</style></head>
<body>
<h1>{doc.title}</h1>
<p><strong>Patient Record ID:</strong> {current_user.id}</p>
<p><strong>Original File:</strong> {doc.original_filename}</p>
<p><strong>Date:</strong> {doc.uploaded_at.strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
<hr/>
<h3>Clinical OCR Transcribed Content:</h3>
<pre>{doc.ocr_raw_text or 'No raw OCR text available.'}</pre>
</body></html>"""
    return Response(content=html_content, media_type="text/html")

@router.get("/{id}/pages")
def get_report_pages(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(MedicalDocument).filter(
        MedicalDocument.id == id,
        MedicalDocument.user_id == current_user.id
    ).first()

    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    return {
        "pages": [
            {
                "pageNumber": 1,
                "url": f"/api/reports/{id}/document",
                "label": "Page 1 - Diagnostic Laboratory Evaluation"
            }
        ]
    }

@router.delete("/{id}")
def delete_report(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(MedicalDocument).filter(
        MedicalDocument.id == id,
        MedicalDocument.user_id == current_user.id
    ).first()

    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical report not found.")

    # Remove associated measurements and records
    db.query(HealthMeasurement).filter(
        HealthMeasurement.user_id == current_user.id,
        HealthMeasurement.source_document_id == id
    ).delete()
    db.query(HealthRecord).filter(
        HealthRecord.user_id == current_user.id,
        HealthRecord.source_document_id == id
    ).delete()

    # Delete physical file if exists
    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception as e:
            logger.warning(f"Could not remove physical file {doc.file_path}: {e}")

    db.delete(doc)
    db.commit()

    return {"success": True, "message": "Medical report and associated measurements deleted successfully."}
