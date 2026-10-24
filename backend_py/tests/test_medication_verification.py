import pytest
import json
import datetime
from app.models.all_models import User, MedicationSchedule, AdherenceLog

def test_medication_verification_counts_and_persistence(client, db_session):
    """
    Test exact requirement:
    - User with 12 scheduled doses starts with Verified = 0, Pending = 12, Total = 12.
    - After 1 successful pill intake verification:
      - Verified changes from 0 to 1
      - Pending changes from 12 to 11
      - Total Scheduled remains 12
    - Persists on subsequent calls (simulating page refresh / re-login)
    - Duplicate submission does NOT increment count again
    """
    # 1. Register test patient
    reg = client.post("/api/v1/auth/register", json={
        "name": "Medication Test Patient",
        "email": "med.verify.test@vitacare.ai",
        "password": "Password123!",
        "phone": "+919876543219"
    })
    assert reg.status_code == 201
    user_id = reg.json()["user"]["id"]
    token = reg.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Seed exactly 12 scheduled doses for today across 4 medications (3 doses each)
    meds_config = [
        ("Metformin", "500 mg", ["08:00 AM", "01:00 PM", "08:00 PM"]),
        ("Lisinopril", "10 mg", ["09:00 AM", "02:00 PM", "09:00 PM"]),
        ("Atorvastatin", "20 mg", ["07:30 AM", "12:30 PM", "07:30 PM"]),
        ("Amlodipine", "5 mg", ["10:00 AM", "03:00 PM", "10:00 PM"])
    ]
    created_schedules = []
    for name, dose, times in meds_config:
        sched = MedicationSchedule(
            user_id=user_id,
            name=name,
            dosage=dose,
            frequency="Three times daily",
            times_of_day=json.dumps(times),
            instructions="Take with water",
            start_date="2026-10-01",
            remaining_doses=30,
            is_active=True
        )
        db_session.add(sched)
        created_schedules.append(sched)
    db_session.commit()

    # 3. Verify initial state before any intake
    # Fetch /api/medicines/today
    res_today = client.get("/api/medicines/today", headers=headers)
    assert res_today.status_code == 200
    today_data = res_today.json()
    schedules = today_data["schedules"]
    assert len(schedules) == 12, f"Expected exactly 12 doses, got {len(schedules)}"

    verified_initial = sum(1 for s in schedules if s.get("status") == "Verified")
    pending_initial = sum(1 for s in schedules if s.get("status") == "Pending")
    assert verified_initial == 0, f"Expected Verified=0, got {verified_initial}"
    assert pending_initial == 12, f"Expected Pending=12, got {pending_initial}"
    assert today_data["adherence"]["verified"] == 0
    assert today_data["adherence"]["pending"] == 12
    assert today_data["adherence"]["total"] == 12

    # Fetch /api/dashboard/overview
    res_dash = client.get("/api/dashboard/overview", headers=headers)
    assert res_dash.status_code == 200
    dash_data = res_dash.json()
    dash_schedules = dash_data["todaySchedules"]
    assert len(dash_schedules) == 12
    assert sum(1 for s in dash_schedules if s.get("status") == "Verified") == 0
    assert sum(1 for s in dash_schedules if s.get("status") == "Pending") == 12

    # 4. Perform 1 verified pill intake
    first_dose = schedules[0]
    target_id = first_dose["id"]
    dose_time = first_dose["scheduledTime"]

    verify_res = client.post(
        f"/api/medicines/schedules/{target_id}/consumption-event",
        json={
            "confidenceScore": 0.96,
            "verificationSource": "camera_vision_pipeline",
            "handUsed": "right",
            "scheduledTime": dose_time,
            "status": "CONSUMPTION_DETECTED"
        },
        headers=headers
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["verified"] is True

    # 5. Verify that Verified changed from 0 to 1, Pending from 12 to 11, Total remains 12
    # In /api/medicines/today
    res_after = client.get("/api/medicines/today", headers=headers)
    assert res_after.status_code == 200
    after_data = res_after.json()
    after_schedules = after_data["schedules"]
    assert len(after_schedules) == 12, "Total Scheduled must remain unchanged at 12"

    verified_after = sum(1 for s in after_schedules if s.get("status") == "Verified")
    pending_after = sum(1 for s in after_schedules if s.get("status") == "Pending")
    assert verified_after == 1, f"Expected Verified=1, got {verified_after}"
    assert pending_after == 11, f"Expected Pending=11, got {pending_after}"
    assert after_data["adherence"]["verified"] == 1
    assert after_data["adherence"]["pending"] == 11
    assert after_data["adherence"]["total"] == 12

    # Check status badge of verified dose
    verified_item = next(s for s in after_schedules if s["id"] == target_id)
    assert verified_item["status"] == "Verified"
    assert verified_item["rawStatus"] == "VERIFIED"
    assert verified_item["isVerified"] is True
    assert verified_item["taken"] is True

    # Check that Next Medicine advanced to the first pending dose
    assert after_data["nextMedicine"]["id"] != target_id
    assert after_data["nextMedicine"]["status"] == "Pending"

    # In /api/dashboard/overview (Simulating page refresh)
    dash_after = client.get("/api/dashboard/overview", headers=headers).json()
    assert len(dash_after["todaySchedules"]) == 12
    dash_verified = sum(1 for s in dash_after["todaySchedules"] if s.get("status") == "Verified")
    dash_pending = sum(1 for s in dash_after["todaySchedules"] if s.get("status") == "Pending")
    assert dash_verified == 1, f"Expected Dashboard Verified=1, got {dash_verified}"
    assert dash_pending == 11, f"Expected Dashboard Pending=11, got {dash_pending}"
    assert dash_after["nextMedicine"]["status"] == "Pending"

    # 6. Test duplicate submission prevention
    # Submitting the same dose verification again must NOT increment count
    dup_res = client.post(
        f"/api/medicines/schedules/{target_id}/consumption-event",
        json={
            "confidenceScore": 0.98,
            "verificationSource": "camera_vision_pipeline",
            "handUsed": "right",
            "scheduledTime": dose_time
        },
        headers=headers
    )
    assert dup_res.status_code == 200
    assert dup_res.json().get("alreadyVerified") is True

    # Re-verify counts did NOT increase again
    res_dup_check = client.get("/api/medicines/today", headers=headers).json()
    dup_verified = sum(1 for s in res_dup_check["schedules"] if s.get("status") == "Verified")
    dup_pending = sum(1 for s in res_dup_check["schedules"] if s.get("status") == "Pending")
    assert dup_verified == 1, f"Expected Verified to remain 1 after duplicate, got {dup_verified}"
    assert dup_pending == 11, f"Expected Pending to remain 11 after duplicate, got {dup_pending}"
    assert len(res_dup_check["schedules"]) == 12

    # 7. Verify a second different dose
    second_dose = after_schedules[1]
    second_id = second_dose["id"]
    second_time = second_dose["scheduledTime"]
    client.post(
        f"/api/medicines/schedules/{second_id}/consumption-event",
        json={
            "confidenceScore": 0.95,
            "verificationSource": "camera_vision_pipeline",
            "scheduledTime": second_time
        },
        headers=headers
    )

    res_second = client.get("/api/medicines/today", headers=headers).json()
    verified_second = sum(1 for s in res_second["schedules"] if s.get("status") == "Verified")
    pending_second = sum(1 for s in res_second["schedules"] if s.get("status") == "Pending")
    assert verified_second == 2, f"Expected Verified=2, got {verified_second}"
    assert pending_second == 10, f"Expected Pending=10, got {pending_second}"
    assert len(res_second["schedules"]) == 12
