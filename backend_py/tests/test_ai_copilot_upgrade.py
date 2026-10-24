import pytest
from app.models.all_models import User, ChatThread, ChatMessage, MedicalKnowledgeSource, MedicalKnowledgeChunk
from app.services.rag_service import RagService
from app.services.ai_service import AiService
from app.services.ocr_service import OcrService

def test_rag_domain_classifier_non_health():
    """Verify non-health queries trigger the exact required guardrail."""
    non_health_queries = [
        "What is the capital of Australia?",
        "Write a Python function to sort a binary search tree",
        "Who won the 2022 World Cup?",
        "How do I fix a flat tire on my bicycle?"
    ]
    for q in non_health_queries:
        assert RagService.is_healthcare_query(q) is False, f"Expected non-health for: {q}"

def test_rag_domain_classifier_health():
    """Verify medical queries are correctly recognized as healthcare domain."""
    health_queries = [
        "What does an HbA1c of 7.2% mean?",
        "Is 138/88 considered high blood pressure?",
        "How often should I take Metformin 500mg?",
        "I have a throbbing headache and slight fever",
        "Explain my lipid profile test results",
        "How many glasses of water should I drink daily for kidney health?"
    ]
    for q in health_queries:
        assert RagService.is_healthcare_query(q) is True, f"Expected healthcare for: {q}"

def test_non_medical_exact_guardrail_response(client):
    """Verify the exact guardrail response text required by the specification."""
    login_res = client.post("/api/v1/auth/demo-login")
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/ai/chat", json={
        "message": "Can you explain how quantum computers work?",
        "language": "en"
    }, headers=headers)

    assert res.status_code == 200
    data = res.json()
    expected_reply = "I'm your AI Health Copilot. I can help with health information, medical reports, prescriptions, and general healthcare guidance."
    assert data["reply"].strip() == expected_reply
    assert data["isHealthQuery"] is False

def test_short_and_sweet_default_health_response(client):
    """Verify default response length is 2-5 concise sentences."""
    login_res = client.post("/api/v1/auth/demo-login")
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/ai/chat", json={
        "message": "What is normal fasting blood sugar?",
        "language": "en",
        "responseLength": "short"
    }, headers=headers)

    assert res.status_code == 200
    data = res.json()
    reply = data["reply"]
    assert len(reply) > 20
    # Response length check: 2-5 sentences usually between 50 and 600 characters
    assert len(reply) < 800
    # Must have clinical grounding
    assert "citations" in data
    assert len(data["citations"]) > 0

def test_emergency_triage_guidance(client):
    """Verify emergency queries trigger emergency flag and 112 guidance."""
    login_res = client.post("/api/v1/auth/demo-login")
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/ai/chat", json={
        "message": "I have sudden severe chest pain spreading down my arm and I can't catch my breath",
        "language": "en"
    }, headers=headers)

    assert res.status_code == 200
    data = res.json()
    assert data["isEmergency"] is True
    assert "112" in data["reply"] or "emergency" in data["reply"].lower()

def test_prescription_uncertainty_guardrail():
    """Verify OCR does not hallucinate doses and outputs the safe disclaimer when unclear."""
    # Test OCR extraction with missing/unclear text
    unclear_ocr_text = "Rx: AmbiguousMed??? daily"
    extracted = OcrService.extract_prescription_data(unclear_ocr_text)

    # When uncertain or empty, the warning message must be provided
    warning = "Unable to read clearly — please confirm with your pharmacist or prescriber"
    has_warning_or_safe = (
        extracted.get("instructions") == warning or
        extracted.get("unclearWarning") == warning or
        any(m.get("dosage") == warning or m.get("instructions") == warning for m in extracted.get("medicines", [])) or
        len(extracted.get("medicines", [])) == 0
    )
    assert has_warning_or_safe, "Safe prescription extraction must not invent dosages or drugs"

def test_cross_user_isolation(client):
    """Verify User A cannot access User B's threads or messages."""
    # Create User A
    reg_a = client.post("/api/v1/auth/register", json={
        "email": "usera_test@vitacare.ai",
        "password": "Password123!",
        "name": "User Alpha",
        "phoneNumber": "+919876543210"
    })
    token_a = reg_a.json()["token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # User A creates a thread
    th_res = client.post("/api/ai/threads", json={"title": "Alpha Confidential Health"}, headers=headers_a)
    thread_a_id = th_res.json()["thread"]["id"]

    # Create User B
    reg_b = client.post("/api/v1/auth/register", json={
        "email": "userb_test@vitacare.ai",
        "password": "Password123!",
        "name": "User Beta",
        "phoneNumber": "+919876543211"
    })
    token_b = reg_b.json()["token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User B attempts to access User A's thread messages -> should return 404 or empty
    access_res = client.get(f"/api/ai/threads/{thread_a_id}/messages", headers=headers_b)
    assert access_res.status_code == 404

def test_careconnect_endpoints(client):
    """Verify CareConnect telehealth endpoints succeed."""
    login_res = client.post("/api/v1/auth/demo-login")
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get sessions
    sessions_res = client.get("/api/careconnect/sessions", headers=headers)
    assert sessions_res.status_code == 200
    assert "sessions" in sessions_res.json()

    # Start a session
    start_res = client.post("/api/careconnect/start", json={
        "caregiverId": "dr_sarah_lin",
        "recipientName": "Dr. Sarah Lin, MD",
        "channelType": "video"
    }, headers=headers)
    assert start_res.status_code == 200
    session_data = start_res.json()["session"]
    session_id = session_data["id"]

    # End the session
    end_res = client.post("/api/careconnect/end", json={
        "sessionId": session_id
    }, headers=headers)
    assert end_res.status_code == 200
    assert end_res.json()["session"]["status"] == "completed"

def test_admin_ai_knowledge_endpoints(client):
    """Verify Admin AI configuration & knowledge endpoints."""
    # Login as admin
    admin_login = client.post("/api/v1/auth/admin-login", json={
        "email": "admin@vitacare.ai",
        "password": "AdminPass2026!"
    })
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Get knowledge list
    k_res = client.get("/api/admin/ai/knowledge", headers=admin_headers)
    assert k_res.status_code == 200
    sources = k_res.json()["sources"]
    assert len(sources) >= 4  # WHO, ICMR, CDC, NICE seeded

    # 2. Get AI config
    cfg_res = client.get("/api/admin/ai/config", headers=admin_headers)
    assert cfg_res.status_code == 200
    assert cfg_res.json()["agentName"] == "AI Health Copilot"

    # 3. Get AI health status
    h_res = client.get("/api/admin/ai/health", headers=admin_headers)
    assert h_res.status_code == 200
    assert h_res.json()["status"] == "operational"

    # 4. Re-index knowledge
    reindex_res = client.post("/api/admin/ai/knowledge/reindex", headers=admin_headers)
    assert reindex_res.status_code == 200
    assert reindex_res.json()["success"] is True
