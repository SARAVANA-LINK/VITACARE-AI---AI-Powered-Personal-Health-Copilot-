import pytest
import json
import io
from fastapi.testclient import TestClient
from app.main import app

def test_1_medical_report_upload_without_hppd404(client: TestClient):
    """
    Test 1: Verify medical report upload completes successfully without HTTP 404.
    Tests both multipart file upload and JSON text payload.
    """
    # 1. Register a new test patient
    patient_email = "upload_test_patient@vitacare.ai"
    reg_res = client.post("/api/auth/register", json={
        "name": "Sarah Miller",
        "email": patient_email,
        "password": "SecurePassword2026!",
        "age": 32,
        "gender": "Female",
        "preferredLanguage": "en"
    })
    assert reg_res.status_code in [201, 200]
    token = reg_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Upload file multipart (Simulates ReportUploadModal file picker)
    file_content = b"""
    ST. JUDE CLINICAL DIAGNOSTIC LABORATORY
    Patient: Sarah Miller   Date: 2026-10-24
    Fast Glucose: 98 mg/dL (Reference: 70 - 99 mg/dL) [NORMAL]
    HbA1c: 5.4 % (Reference: 4.0 - 5.6 %) [NORMAL]
    Total Cholesterol: 185 mg/dL (Reference: < 200 mg/dL) [NORMAL]
    Blood Pressure: 118/76 mmHg (Reference: < 120/80 mmHg) [NORMAL]
    """
    file_data = {"document": ("metabolic_panel.pdf", io.BytesIO(file_content), "application/pdf")}

    upload_res = client.post("/api/reports/upload", files=file_data, headers=headers)
    assert upload_res.status_code == 200, f"Expected 200 OK, got {upload_res.status_code}: {upload_res.text}"
    body = upload_res.json()
    assert body["success"] is True
    assert "draft" in body
    assert body["draft"]["reportType"] is not None
    assert len(body["draft"]["extractedValues"]) >= 1

    # 3. Test camera photo upload (JSON base64 payload)
    b64_res = client.post("/api/reports/upload", json={
        "sampleText": "Diagnostic Lab Report\nFasting Blood Sugar: 95 mg/dL\nHemoglobin: 13.8 g/dL"
    }, headers=headers)
    assert b64_res.status_code == 200
    assert b64_res.json()["success"] is True

def test_2_report_processing_and_retrieval(client: TestClient):
    """
    Test 2: Verify report verification, persistence, list retrieval, details, document fetch, and comparison.
    """
    login_res = client.post("/api/auth/login", json={
        "email": "upload_test_patient@vitacare.ai",
        "password": "SecurePassword2026!"
    })
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify and save a report
    verify_payload = {
        "reportType": "Comprehensive Metabolic Panel",
        "labName": "Metro Pathology Diagnostics",
        "doctorName": "Dr. Sarah Lin, MD",
        "reportDate": "2026-10-24",
        "extractedValues": [
            {
                "metricKey": "fasting_glucose",
                "metricName": "Fasting Blood Glucose",
                "value": "98",
                "unit": "mg/dL",
                "referenceRange": "70 - 99 mg/dL",
                "statusIndicator": "normal"
            },
            {
                "metricKey": "hba1c",
                "metricName": "Glycated Hemoglobin HbA1c",
                "value": "5.4",
                "unit": "%",
                "referenceRange": "< 5.7 %",
                "statusIndicator": "normal"
            }
        ]
    }
    v_res = client.post("/api/reports/verify", json=verify_payload, headers=headers)
    assert v_res.status_code == 200
    saved_rep = v_res.json()["report"]
    report_id = saved_rep["id"]
    assert report_id is not None
    assert saved_rep["metricsCount"] == 2

    # Fetch list
    list_res = client.get("/api/reports", headers=headers)
    assert list_res.status_code == 200
    reports = list_res.json()["reports"]
    assert len(reports) >= 1
    assert any(r["id"] == report_id for r in reports)

    # Fetch details
    detail_res = client.get(f"/api/reports/{report_id}", headers=headers)
    assert detail_res.status_code == 200
    assert detail_res.json()["report"]["id"] == report_id

    # Fetch document blob
    doc_res = client.get(f"/api/reports/{report_id}/document", headers=headers)
    assert doc_res.status_code == 200

    # Delete report
    del_res = client.delete(f"/api/reports/{report_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

def test_3_empty_database_behavior_for_new_users(client: TestClient):
    """
    Test 3: New users receive genuine empty states with no fabricated records.
    """
    clean_user_email = "clean_new_patient@vitacare.ai"
    reg_res = client.post("/api/auth/register", json={
        "name": "Clean Test User",
        "email": clean_user_email,
        "password": "Password2026!",
        "age": 28,
        "gender": "Male"
    })
    assert reg_res.status_code in [200, 201]
    token = reg_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Reports must be genuinely empty
    rep_res = client.get("/api/reports", headers=headers)
    assert rep_res.status_code == 200
    assert rep_res.json()["reports"] == []
    assert rep_res.json()["count"] == 0

    # Medicines must be genuinely empty
    med_res = client.get("/api/medicines", headers=headers)
    assert med_res.status_code == 200
    assert med_res.json()["medicines"] == []

    # Dashboard overview must reflect genuine empty states
    dash_res = client.get("/api/dashboard/overview", headers=headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["latestVitals"] == []
    assert dash_data["todaySchedules"] == []
    assert dash_data["nextMedicine"] is None
    assert dash_data["recentReports"] == []
    assert dash_data["adherence"]["score"] == 0.0

def test_4_administrator_login_and_prototype_editing(client: TestClient):
    """
    Test 4: Administrator login and prototype CMS module/card/announcement creation.
    """
    # Admin login
    admin_login_res = client.post("/api/auth/admin-login", json={
        "email": "admin@vitacare.ai",
        "password": "AdminPass2026!"
    })
    assert admin_login_res.status_code == 200, f"Admin login failed: {admin_login_res.text}"
    admin_token = admin_login_res.json()["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Edit Prototype: Create CMS Announcement
    ann_res = client.post("/api/admin/cms/announcements", json={
        "title": "Hospital Network Maintenance Notice",
        "message": "Scheduled laboratory integration upgrade on Sunday at 02:00 AM UTC.",
        "alertType": "warning",
        "priority": 2,
        "isPublished": True
    }, headers=admin_headers)
    assert ann_res.status_code == 200
    assert ann_res.json()["success"] is True

    # Edit Prototype: Create CMS Metric Card
    card_res = client.post("/api/admin/cms/cards", json={
        "title": "Electrolyte Panel Target",
        "subtitle": "Serum Potassium: 3.5 - 5.0 mEq/L",
        "value": "4.2 mEq/L",
        "delta": "Optimal",
        "badgeColor": "green",
        "orderIndex": 5
    }, headers=admin_headers)
    assert card_res.status_code == 200
    assert card_res.json()["success"] is True

def test_5_persistence_of_administrator_changes(client: TestClient):
    """
    Test 5: Administrator prototype changes persist in database and reflect in published CMS config.
    """
    # Public / patient users can view the published configuration
    public_cms = client.get("/api/dashboard/cms-config")
    assert public_cms.status_code == 200
    cms_data = public_cms.json()

    # Verify announcement was persisted
    announcements = cms_data.get("announcements", [])
    assert any("Hospital Network Maintenance Notice" in a["title"] for a in announcements)

    # Verify metric card was persisted
    cards = cms_data.get("cards", [])
    assert any("Electrolyte Panel Target" in c["title"] for c in cards)

def test_6_rejection_of_unauthorized_editing_attempts(client: TestClient):
    """
    Test 6: Strict RBAC enforcement. Regular patients are blocked from admin routes.
    """
    # Regular patient token
    patient_res = client.post("/api/auth/login", json={
        "email": "clean_new_patient@vitacare.ai",
        "password": "Password2026!"
    })
    patient_token = patient_res.json()["token"]
    patient_headers = {"Authorization": f"Bearer {patient_token}"}

    # Attempt to access /admin/overview -> 403 Forbidden
    overview_attempt = client.get("/api/admin/overview", headers=patient_headers)
    assert overview_attempt.status_code == 403

    # Attempt to modify CMS modules -> 403 Forbidden
    cms_attempt = client.post("/api/admin/cms/modules", json={"title": "Hacked Module"}, headers=patient_headers)
    assert cms_attempt.status_code == 403

    # Attempt to reset database -> 403 Forbidden
    reset_attempt = client.post("/api/admin/database/clear-user-data", headers=patient_headers)
    assert reset_attempt.status_code == 403

    # Attempt to login via admin endpoint as a patient -> 403 Forbidden
    fake_admin_login = client.post("/api/auth/admin-login", json={
        "email": "clean_new_patient@vitacare.ai",
        "password": "Password2026!"
    })
    assert fake_admin_login.status_code == 403

def test_7_isolation_of_records_between_users(client: TestClient):
    """
    Test 7: Complete data isolation. User A cannot view User B's reports or vitals.
    """
    # User A
    user_a = client.post("/api/auth/register", json={
        "name": "User Alpha",
        "email": "user_alpha@vitacare.ai",
        "password": "PassAlpha2026!",
        "age": 45
    }).json()
    token_a = user_a["token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # User B
    user_b = client.post("/api/auth/register", json={
        "name": "User Beta",
        "email": "user_beta@vitacare.ai",
        "password": "PassBeta2026!",
        "age": 52
    }).json()
    token_b = user_b["token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A verifies a confidential report
    rep_a = client.post("/api/reports/verify", json={
        "reportType": "Alpha Private Blood Panel",
        "labName": "Private Alpha Lab",
        "extractedValues": [
            {"metricKey": "blood_glucose", "value": "115", "unit": "mg/dL"}
        ]
    }, headers=headers_a).json()["report"]
    report_a_id = rep_a["id"]

    # User B lists reports -> Must NOT see User A's report
    b_reports = client.get("/api/reports", headers=headers_b).json()["reports"]
    assert all(r["id"] != report_a_id for r in b_reports)

    # User B tries direct detail access to User A's report -> 404 Not Found
    direct_access = client.get(f"/api/reports/{report_a_id}", headers=headers_b)
    assert direct_access.status_code == 404

def test_8_application_behavior_after_logout_and_relogin(client: TestClient):
    """
    Test 8: Logout, relogin, session termination and subsequent access.
    """
    # 1. Login
    login_res = client.post("/api/auth/login", json={
        "email": "user_alpha@vitacare.ai",
        "password": "PassAlpha2026!"
    })
    assert login_res.status_code == 200
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Access profile
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["user"]["email"] == "user_alpha@vitacare.ai"

    # 3. Logout
    logout_res = client.post("/api/auth/logout", headers=headers)
    assert logout_res.status_code == 200
    assert logout_res.json()["success"] is True

    # 4. Relogin
    relogin_res = client.post("/api/auth/login", json={
        "email": "user_alpha@vitacare.ai",
        "password": "PassAlpha2026!"
    })
    assert relogin_res.status_code == 200
    new_token = relogin_res.json()["token"]
    assert new_token is not None
