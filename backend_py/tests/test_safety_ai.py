from app.core.safety import ClinicalSafetyPipeline

def test_emergency_red_flag_detection():
    # FAST stroke indicators
    is_emg, flags = ClinicalSafetyPipeline.detect_emergency("Patient has sudden facial drooping and slurred speech")
    assert is_emg is True
    assert any("slurred speech" in f or "face" in f for f in flags)

    # Acute myocardial infarction
    is_emg2, flags2 = ClinicalSafetyPipeline.detect_emergency("I feel crushing chest pain radiating to left arm")
    assert is_emg2 is True
    assert any("chest" in f or "radiating" in f for f in flags2)

    # Benign symptom - no emergency
    is_emg3, flags3 = ClinicalSafetyPipeline.detect_emergency("I have a mild runny nose and sneezing after dusting")
    assert is_emg3 is False
    assert len(flags3) == 0

def test_ai_chat_emergency_escalation(client):
    # Log in as demo user
    login_res = client.post("/api/v1/auth/demo-login")
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Ask an emergency query
    emg_res = client.post("/api/v1/chat/message", json={
        "message": "I am experiencing severe chest pressure and cannot breathe",
        "language": "en"
    }, headers=headers)

    assert emg_res.status_code == 200
    data = emg_res.json()
    assert data["is_emergency"] is True
    assert data["urgency_level"] == "EMERGENCY_IMMEDIATE"
    assert "108" in data["reply"] or "911" in data["reply"]

def test_symptom_triage_assessment(client):
    login_res = client.post("/api/v1/auth/demo-login")
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Routine consult symptom
    res = client.post("/api/v1/symptoms/assess", json={
        "symptoms": "Low grade fever and throbbing headache for 2 days",
        "duration": "2 days",
        "severity": 5,
        "fever": True
    }, headers=headers)

    assert res.status_code == 200
    data = res.json()["assessment"]
    assert data["urgencyLevel"] in ["ROUTINE_CONSULT", "URGENT_EVALUATION"]
    assert len(data["possibleExplanations"]) > 0
    assert len(data["doctorQuestions"]) > 0
    assert len(data["safeNextSteps"]) > 0

def test_multilingual_responses(client):
    login_res = client.post("/api/v1/auth/demo-login")
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Tamil
    res_ta = client.post("/api/v1/chat/message", json={
        "message": "What is healthy blood pressure?",
        "language": "ta"
    }, headers=headers)
    assert res_ta.status_code == 200
    assert "இரத்த" in res_ta.json()["reply"]

    # Hindi
    res_hi = client.post("/api/v1/chat/message", json={
        "message": "What is normal blood pressure?",
        "language": "hi"
    }, headers=headers)
    assert res_hi.status_code == 200
    reply_hi = res_hi.json()["reply"]
    assert "रक्तचाप" in reply_hi or "blood pressure" in reply_hi.lower() or "namaste" in reply_hi.lower() or "120/80" in reply_hi

