import pytest
from app.models.all_models import User, Appointment, HealthRecord, MedicationSchedule
from app.services.agent_tools_service import AgentToolsService
from app.services.ai_service import AiService

def test_duplicate_email_exact_rejection(client):
    """Verify duplicate emails (including case variations) are rejected with exact error message."""
    email = "tenant.doctor@vitacare.ai"
    reg_payload = {
        "name": "Dr. Tenant",
        "email": email,
        "password": "Password123!",
        "phone": "+919988776655"
    }
    res1 = client.post("/api/v1/auth/register", json=reg_payload)
    assert res1.status_code == 201

    # Attempt registration with exact same email
    res2 = client.post("/api/v1/auth/register", json=reg_payload)
    assert res2.status_code in (400, 409)
    assert res2.json()["detail"] == "This email address is already registered. Please log in or use Forgot Password."

    # Attempt registration with UPPERCASE variation of same email
    reg_upper = dict(reg_payload)
    reg_upper["email"] = "TENANT.DOCTOR@VITACARE.AI"
    res3 = client.post("/api/v1/auth/register", json=reg_upper)
    assert res3.status_code in (400, 409)
    assert res3.json()["detail"] == "This email address is already registered. Please log in or use Forgot Password."

def test_new_user_starts_with_completely_empty_personal_database(client):
    """Verify newly registered user has a clean slate: 0 reports, 0 prescriptions, 0 schedules, 0 appointments, 0 vitals."""
    reg_res = client.post("/api/v1/auth/register", json={
        "name": "Empty Slate Patient",
        "email": "clean.slate@vitacare.ai",
        "password": "SecurePassword123!",
        "phone": "+919111222333"
    })
    assert reg_res.status_code == 201
    token = reg_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Reports must be empty
    reports_res = client.get("/api/v1/reports", headers=headers)
    assert reports_res.status_code == 200
    assert len(reports_res.json()["reports"]) == 0

    # 2. Prescriptions must be empty
    rx_res = client.get("/api/v1/prescriptions", headers=headers)
    assert rx_res.status_code == 200
    assert len(rx_res.json()["prescriptions"]) == 0

    # 3. Medication schedules must be empty
    sched_res = client.get("/api/v1/medications/schedules/today", headers=headers)
    assert sched_res.status_code == 200
    assert len(sched_res.json().get("schedules", [])) == 0

    # 4. Appointments must be empty
    app_res = client.get("/api/v1/appointments", headers=headers)
    assert app_res.status_code == 200
    assert len(app_res.json().get("appointments", [])) == 0

    # 5. Chat threads must be empty
    th_res = client.get("/api/ai/threads", headers=headers)
    assert th_res.status_code == 200
    assert len(th_res.json().get("threads", [])) == 0

def test_agent_tools_execution(client, db_session):
    """Verify backend agent tools execute with tenant isolation and real DB operations."""
    # Register test user
    reg = client.post("/api/v1/auth/register", json={
        "name": "Agentic Patient",
        "email": "agentic.patient@vitacare.ai",
        "password": "Password123!",
        "phone": "+919000111222"
    })
    assert reg.status_code == 201
    user_id = reg.json()["user"]["id"]
    user = db_session.query(User).filter(User.id == user_id).first()

    # 1. Tool: get_user_profile
    profile_res = AgentToolsService.execute_tool("get_user_profile", {}, user_id, db_session)
    assert profile_res["success"] is True
    assert profile_res["data"]["name"] == "Agentic Patient"
    assert profile_res["data"]["email"] == "agentic.patient@vitacare.ai"

    # 2. Tool: change_user_language_preference to Tanglish
    lang_res = AgentToolsService.execute_tool("change_user_language_preference", {"language_code": "tanglish"}, user_id, db_session)
    assert lang_res["success"] is True
    assert lang_res["language"] == "tanglish"
    assert user.preferred_language == "tanglish"

    # 3. Tool: get_medication_schedules on clean slate
    meds = AgentToolsService.execute_tool("get_medication_schedules", {}, user_id, db_session)
    assert meds["success"] is True
    assert meds["count"] == 0

    # 4. Tool: create_appointment
    apt_res = AgentToolsService.execute_tool("create_appointment", {
        "doctor_name": "Dr. A. Sharma",
        "specialty": "Cardiology",
        "appointment_date": "2026-11-01",
        "appointment_time": "10:00 AM",
        "reason": "Routine Blood Pressure Check"
    }, user_id, db_session)
    assert apt_res["success"] is True
    assert apt_res["appointment"]["doctor"] == "Dr. A. Sharma"

    # 5. Tool: get_appointments
    apts = AgentToolsService.execute_tool("get_appointments", {}, user_id, db_session)
    assert apts["success"] is True
    assert apts["count"] == 1
    assert apts["data"][0]["doctorName"] == "Dr. A. Sharma"

    # 6. Tool: list_authorized_health_records
    records = AgentToolsService.execute_tool("list_authorized_health_records", {}, user_id, db_session)
    assert records["success"] is True
    assert records["count"] == 0

def test_strict_tenant_isolation_with_tools(client, db_session):
    """Verify User B cannot access User A's appointments or data through Agent tools."""
    # User A creates appointment
    reg_a = client.post("/api/v1/auth/register", json={
        "name": "User A",
        "email": "user.a.tools@vitacare.ai",
        "password": "Password123!"
    })
    user_a_id = reg_a.json()["user"]["id"]
    AgentToolsService.execute_tool("create_appointment", {
        "doctor_name": "Dr. Confidential",
        "appointment_date": "2026-12-01",
        "reason": "Confidential Consultation"
    }, user_a_id, db_session)

    # User B checks appointments
    reg_b = client.post("/api/v1/auth/register", json={
        "name": "User B",
        "email": "user.b.tools@vitacare.ai",
        "password": "Password123!"
    })
    user_b_id = reg_b.json()["user"]["id"]

    apts_b = AgentToolsService.execute_tool("get_appointments", {}, user_b_id, db_session)
    assert apts_b["success"] is True
    assert apts_b["count"] == 0
    assert len(apts_b["data"]) == 0

def test_tanglish_multilingual_responses(client):
    """Verify Tanglish, Tamil, Hindi, Telugu response generation in AI Copilot."""
    login_res = client.post("/api/v1/auth/demo-login")
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Tanglish query
    tanglish_res = client.post("/api/ai/chat", json={
        "message": "Enakku light-ah fever irukku, enna pannanum?",
        "language": "tanglish"
    }, headers=headers)
    assert tanglish_res.status_code == 200
    tanglish_data = tanglish_res.json()
    assert len(tanglish_data["reply"]) > 20
    # Must contain Latin characters suitable for Tanglish
    assert any(c.isascii() and c.isalpha() for c in tanglish_data["reply"])

    # Hindi query
    hi_res = client.post("/api/ai/chat", json={
        "message": "Mujhe halka bukhar hai, kya karna chahiye?",
        "language": "hi"
    }, headers=headers)
    assert hi_res.status_code == 200
    assert len(hi_res.json()["reply"]) > 20

    # Tamil query
    ta_res = client.post("/api/ai/chat", json={
        "message": "எனக்கு லேசான காய்ச்சல் உள்ளது, என்ன செய்ய வேண்டும்?",
        "language": "ta"
    }, headers=headers)
    assert ta_res.status_code == 200
    assert len(ta_res.json()["reply"]) > 20

    # Telugu query
    te_res = client.post("/api/ai/chat", json={
        "message": "నాకు కొద్దిగా జ్వరం ఉంది, ఏమి చేయాలి?",
        "language": "te"
    }, headers=headers)
    assert te_res.status_code == 200
    assert len(te_res.json()["reply"]) > 20
