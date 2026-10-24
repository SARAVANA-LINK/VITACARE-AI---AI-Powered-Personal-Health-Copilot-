def test_cross_user_medical_data_isolation(client):
    # 1. Register Patient A
    reg_a = client.post("/api/v1/auth/register", json={
        "name": "Patient Alpha",
        "email": "alpha@example.com",
        "password": "Password123!"
    })
    token_a = reg_a.json()["token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 2. Register Patient B
    reg_b = client.post("/api/v1/auth/register", json={
        "name": "Patient Beta",
        "email": "beta@example.com",
        "password": "Password123!"
    })
    token_b = reg_b.json()["token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 3. Patient A adds a medication schedule
    med_res = client.post("/api/v1/medications/schedules", json={
        "name": "Alpha-Med",
        "dosage": "100 mg",
        "frequency": "Daily"
    }, headers=headers_a)
    assert med_res.status_code == 201
    med_id_a = med_res.json()["schedule"]["id"]

    # 4. Patient B lists medication schedules
    list_b = client.post("/api/v1/medications/schedules", json={
        "name": "Beta-Med",
        "dosage": "50 mg",
        "frequency": "Daily"
    }, headers=headers_b)
    
    get_b = client.get("/api/v1/medications/schedules", headers=headers_b)
    b_schedules = get_b.json()["schedules"]
    
    # Patient B MUST NOT see Alpha-Med
    assert any(s["name"] == "Beta-Med" for s in b_schedules)
    assert not any(s["name"] == "Alpha-Med" for s in b_schedules)

    # 5. Patient B attempts to delete Patient A's medication schedule -> 404 Not Found (Unauthorized isolation)
    del_res = client.delete(f"/api/v1/medications/schedules/{med_id_a}", headers=headers_b)
    assert del_res.status_code == 404

def test_gdpr_data_export_and_erasure(client):
    # Register ephemeral patient
    reg = client.post("/api/v1/auth/register", json={
        "name": "Ephemeral Patient",
        "email": "ephemeral@example.com",
        "password": "DeleteMeSecure123!"
    })
    token = reg.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Export structured records
    export_res = client.get("/api/v1/privacy/export", headers=headers)
    assert export_res.status_code == 200
    export_data = export_res.json()
    assert export_data["patient"]["email"] == "ephemeral@example.com"
    assert "vitals" in export_data

    # Erase account (Right-to-be-Forgotten)
    erase_res = client.delete("/api/v1/privacy/account", headers=headers)
    assert erase_res.status_code == 200
    assert erase_res.json()["success"] is True

    # Confirm user can no longer log in
    login_attempt = client.post("/api/v1/auth/login", json={
        "email": "ephemeral@example.com",
        "password": "DeleteMeSecure123!"
    })
    assert login_attempt.status_code == 401
