import json
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.all_models import (
    User, UserProfile, MedicationSchedule, HealthMeasurement,
    ChatThread, ChatMessage, MedicalDocument, DocumentExtraction
)
from app.schemas.all_schemas import (
    ChatMessageCreate, ChatThreadCreate, ChatThreadUpdate
)
from app.services.ai_service import AiService
from app.services.ocr_service import OcrService
from app.services.storage_service import StorageService

logger = logging.getLogger("vitacare.chat")

router = APIRouter(tags=["AI Health Copilot"])

# ------------------------------------------------------------------------------
# 1. THREAD MANAGEMENT (Multi-conversation support)
# ------------------------------------------------------------------------------
@router.get("/threads")
@router.get("/chat/threads")
@router.get("/ai/threads")
def list_threads(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    threads = db.query(ChatThread).filter(
        ChatThread.user_id == current_user.id
    ).order_by(ChatThread.updated_at.desc()).all()
    return {"threads": threads}

@router.post("/threads")
@router.post("/chat/threads")
@router.post("/ai/threads")
def create_thread(req: ChatThreadCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    thread = ChatThread(
        user_id=current_user.id,
        title=req.title or "New Health Consultation"
    )
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return {"thread": thread}

@router.put("/threads/{thread_id}")
@router.put("/chat/threads/{thread_id}")
@router.put("/ai/threads/{thread_id}")
def update_thread(thread_id: str, req: ChatThreadUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    thread = db.query(ChatThread).filter(ChatThread.id == thread_id, ChatThread.user_id == current_user.id).first()
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found.")
    thread.title = req.title.strip()
    db.commit()
    db.refresh(thread)
    return {"thread": thread}

@router.delete("/threads/{thread_id}")
@router.delete("/chat/threads/{thread_id}")
@router.delete("/ai/threads/{thread_id}")
def delete_thread(thread_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    thread = db.query(ChatThread).filter(ChatThread.id == thread_id, ChatThread.user_id == current_user.id).first()
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found.")
    db.delete(thread)
    db.commit()
    return {"success": True, "message": "Thread deleted."}

@router.get("/threads/{thread_id}/messages")
@router.get("/chat/threads/{thread_id}/messages")
@router.get("/ai/threads/{thread_id}/messages")
def get_thread_messages(thread_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Gracefully handle "default" thread without 404
    if thread_id == "default":
        thread = db.query(ChatThread).filter(
            ChatThread.user_id == current_user.id
        ).order_by(ChatThread.updated_at.desc()).first()
        if not thread:
            return {"messages": [], "thread": None}
        thread_id = thread.id
    else:
        thread = db.query(ChatThread).filter(ChatThread.id == thread_id, ChatThread.user_id == current_user.id).first()
        if not thread:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found.")

    messages = db.query(ChatMessage).filter(
        ChatMessage.thread_id == thread_id, ChatMessage.user_id == current_user.id
    ).order_by(ChatMessage.created_at.asc()).all()

    formatted = []
    for m in messages:
        breakdown = json.loads(m.clinical_breakdown_json) if m.clinical_breakdown_json else None
        formatted.append({
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "language": m.language,
            "clinicalBreakdown": breakdown,
            "attachmentUrl": m.attachment_url,
            "createdAt": m.created_at.isoformat() if m.created_at else None
        })

    return {"messages": formatted, "thread": thread}

# ------------------------------------------------------------------------------
# 2. CHAT INFERENCE & INTERACTION (Short & Sweet, RAG, Safety)
# ------------------------------------------------------------------------------
@router.post("/message")
@router.post("/chat/message")
@router.post("/chat")
@router.post("/ai/chat")
async def send_chat_message(
    req: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Ensure thread exists or create new
    thread_id = req.threadId
    if not thread_id or thread_id == "default":
        new_thread = ChatThread(
            user_id=current_user.id,
            title=req.message[:30] + "..." if len(req.message) > 30 else req.message
        )
        db.add(new_thread)
        db.commit()
        db.refresh(new_thread)
        thread_id = new_thread.id

    # Gather patient clinical context for isolated grounding
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    allergies = json.loads(profile.allergies) if profile and profile.allergies else []
    conditions = json.loads(profile.chronic_conditions) if profile and profile.chronic_conditions else []
    schedules = db.query(MedicationSchedule).filter(
        MedicationSchedule.user_id == current_user.id, MedicationSchedule.is_active == True
    ).all()
    med_names = [f"{s.name} ({s.dosage})" for s in schedules]

    user_context = {
        "allergies": allergies,
        "conditions": conditions,
        "medications": med_names
    }

    # Record User Message
    user_msg = ChatMessage(
        thread_id=thread_id,
        user_id=current_user.id,
        role="user",
        content=req.message,
        language=req.language or req.preferred_language or "en",
        attachment_url=req.attachmentUrl
    )
    db.add(user_msg)
    db.commit()

    # Process via AI Health Copilot Engine with RAG & Guardrails
    ai_result = await AiService.process_chat(
        user_id=current_user.id,
        message=req.message,
        language=req.language or req.preferred_language or "en",
        mode=req.mode or "simple",
        user_context=user_context,
        db=db
    )

    # Record Assistant Message
    assistant_msg = ChatMessage(
        thread_id=thread_id,
        user_id=current_user.id,
        role="assistant",
        content=ai_result["reply"],
        language=req.language or req.preferred_language or "en",
        clinical_breakdown_json=json.dumps(ai_result.get("clinicalBreakdown") or {})
    )
    db.add(assistant_msg)
    db.commit()

    return {
        **ai_result,
        "threadId": thread_id,
        "messageId": assistant_msg.id
    }

# ------------------------------------------------------------------------------
# 3. DOCUMENT ANALYSIS DIRECTLY WITHIN AI HEALTH COPILOT
# ------------------------------------------------------------------------------
@router.post("/chat/analyze-document")
@router.post("/ai/analyze-document")
@router.post("/analyze-document")
async def analyze_document_in_chat(
    file: UploadFile = File(...),
    document_type: str = Form("report"), # "report" or "prescription"
    mode: str = Form("simple"), # "simple", "standard", "detailed"
    language: str = Form("en"),
    thread_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Direct document analysis for AI Health Copilot:
    - PDF text extraction & OCR
    - Structured parameters (test names, results, reference ranges, medicines, dosages)
    - Guardrail: 'Unable to read clearly — please confirm with your pharmacist or prescriber'
    - Creates user document record + generates short & sweet explanation
    """
    # 1. Save uploaded file to secure user storage
    file_url, file_path, file_size = await StorageService.save_uploaded_file(file, subfolder="chat_documents")

    # 2. Extract OCR text
    ocr_result = await OcrService.extract_text_from_file(file_path, file.content_type)
    extracted_text = ocr_result.get("text", "")

    # 3. Parse based on document_type
    doc_type_clean = document_type.lower()
    if "prescription" in doc_type_clean or "rx" in doc_type_clean:
        parsed_doc = OcrService.parse_prescription_text(extracted_text)
        doc_type = "prescription"
    else:
        parsed_doc = OcrService.parse_medical_report_text(extracted_text)
        doc_type = "report"

    # 4. Save to user's private medical documents collection
    med_doc = MedicalDocument(
        user_id=current_user.id,
        document_type=doc_type,
        original_filename=file.filename or "Uploaded_Document",
        private_storage_key=file_path,
        mime_type=file.content_type or "application/octet-stream",
        file_size=file_size,
        file_url=file_url,
        ocr_raw_text=extracted_text,
        extracted_data_json=json.dumps(parsed_doc),
        processing_status="completed",
        is_verified=False
    )
    db.add(med_doc)
    db.commit()
    db.refresh(med_doc)

    # 5. Generate AI Explanation grounded in the document and clinical references
    ai_result = await AiService.process_chat(
        user_id=current_user.id,
        message=f"Please analyze my uploaded {doc_type}: {file.filename}",
        language=language,
        mode=mode,
        db=db,
        document_id=med_doc.id,
        document_analysis={
            "documentId": med_doc.id,
            "documentType": doc_type,
            "filename": file.filename,
            **parsed_doc
        }
    )

    # 6. Record messages in thread if specified
    active_thread_id = thread_id
    if not active_thread_id or active_thread_id == "default":
        new_th = ChatThread(user_id=current_user.id, title=f"Analysis: {file.filename[:25]}")
        db.add(new_th)
        db.commit()
        db.refresh(new_th)
        active_thread_id = new_th.id

    user_msg = ChatMessage(
        thread_id=active_thread_id,
        user_id=current_user.id,
        role="user",
        content=f"📎 Uploaded document for analysis: {file.filename}",
        language=language,
        attachment_url=file_url
    )
    db.add(user_msg)

    assistant_msg = ChatMessage(
        thread_id=active_thread_id,
        user_id=current_user.id,
        role="assistant",
        content=ai_result["reply"],
        language=language,
        clinical_breakdown_json=json.dumps(ai_result.get("clinicalBreakdown") or {})
    )
    db.add(assistant_msg)
    db.commit()

    return {
        "success": True,
        "documentId": med_doc.id,
        "threadId": active_thread_id,
        "documentType": doc_type,
        "filename": file.filename,
        "fileUrl": file_url,
        "extractedData": parsed_doc,
        "reply": ai_result["reply"],
        "clinicalBreakdown": ai_result.get("clinicalBreakdown"),
        "citations": ai_result.get("citations", []),
        "disclaimer": ai_result.get("disclaimer")
    }

# ------------------------------------------------------------------------------
# 4. USER'S SAVED DOCUMENTS PICKER FOR CHAT CONVERSATIONS
# ------------------------------------------------------------------------------
@router.get("/chat/user-documents")
@router.get("/ai/user-documents")
@router.get("/user-documents")
def get_user_chat_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns the current user's authorized documents list so they can select
    a previous report or prescription to discuss with AI Health Copilot.
    """
    docs = db.query(MedicalDocument).filter(
        MedicalDocument.user_id == current_user.id,
        MedicalDocument.deleted_at == None
    ).order_by(MedicalDocument.uploaded_at.desc()).all()

    out = []
    for d in docs:
        out.append({
            "id": d.id,
            "title": d.original_filename or d.title or "Document",
            "category": d.document_type,
            "documentType": d.document_type,
            "uploadedAt": d.uploaded_at.strftime("%Y-%m-%d"),
            "fileUrl": d.file_url,
            "processingStatus": d.processing_status
        })

    return {"documents": out, "count": len(out)}

# ------------------------------------------------------------------------------
# 5. CHAT HISTORY CLEAR / GET
# ------------------------------------------------------------------------------
@router.get("/history")
@router.get("/chat/history")
@router.get("/ai/history")
def get_chat_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msgs = db.query(ChatMessage).filter(
        ChatMessage.user_id == current_user.id
    ).order_by(ChatMessage.created_at.desc()).limit(50).all()
    return {"history": msgs}

@router.delete("/history")
@router.delete("/chat/history")
@router.delete("/ai/history")
def clear_chat_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id).delete(synchronize_session=False)
    db.query(ChatThread).filter(ChatThread.user_id == current_user.id).delete(synchronize_session=False)
    db.commit()
    return {"success": True, "message": "Conversation history cleared successfully."}
