def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "safetyPipeline" in data

def test_demo_login(client):
    response = client.post("/api/v1/auth/demo-login")
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert data["user"]["email"] == "johnathan.doe@vitacare.ai"
    assert data["user"]["role"] == "patient"

def test_user_registration_and_login(client):
    # Register new patient
    reg_payload = {
        "name": "Jane Smith",
        "email": "jane.smith@example.com",
        "password": "SecurePassword123!",
        "phone": "+919876543211",
        "age": 34,
        "gender": "Female",
        "bloodGroup": "O+",
        "emergencyContactName": "Robert Smith",
        "emergencyContactPhone": "+919876543212"
    }
    reg_res = client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert "token" in reg_data
    assert reg_data["user"]["name"] == "Jane Smith"

    # Login with newly created user
    login_res = client.post("/api/v1/auth/login", json={
        "email": "jane.smith@example.com",
        "password": "SecurePassword123!"
    })
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "token" in login_data

def test_invalid_login_rejection(client):
    response = client.post("/api/v1/auth/login", json={
        "email": "nonexistent@example.com",
        "password": "WrongPassword!"
    })
    assert response.status_code == 401

def test_otp_flow(client):
    # Send OTP
    send_res = client.post("/api/v1/auth/otp/send", json={"phoneNumber": "+919123456789"})
    assert send_res.status_code == 200
    assert send_res.json()["success"] is True

    # Verify with correct demo code
    verify_res = client.post("/api/v1/auth/otp/verify", json={
        "phoneNumber": "+919123456789",
        "otp": "123456",
        "name": "OTP Verified Patient"
    })
    assert verify_res.status_code == 200
    assert "token" in verify_res.json()

    # Reject invalid OTP
    bad_verify = client.post("/api/v1/auth/otp/verify", json={
        "phoneNumber": "+919123456789",
        "otp": "000000"
    })
    assert bad_verify.status_code == 401
