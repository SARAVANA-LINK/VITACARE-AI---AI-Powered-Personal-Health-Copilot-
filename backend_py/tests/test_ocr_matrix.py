import os
import io
import base64
import pytest
import httpx
from PIL import Image, ImageDraw, ImageFilter

BASE_URL = "http://localhost:8000"

@pytest.fixture(scope="module")
def auth_headers():
    client = httpx.Client(base_url=BASE_URL, timeout=30.0)
    login_res = client.post("/api/auth/demo-login")
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["token"]
    return {"Authorization": f"Bearer {token}"}

def test_1_clear_printed_multi_medicine(auth_headers):
    client = httpx.Client(base_url=BASE_URL, timeout=30.0)
    sample_multi = (
        "Dr. Elizabeth Chen, MD - Bellevue Endocrinology Center\n"
        "Date: 2026-10-24\n"
        "Patient: Jane Doe\n\n"
        "Rx:\n"
        "1. Metformin 1000 mg - 1 tab BID with breakfast and dinner for 30 days\n"
        "2. Glipizide 5 mg - 1 tab daily AC breakfast for 30 days\n"
        "3. Atorvastatin 40 mg - 1 tab QHS for 30 days\n"
    )
    r = client.post("/api/prescriptions/upload", json={"sampleText": sample_multi}, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    draft = data["draft"]
    assert draft["isReadable"] is True
    assert len(draft["medicines"]) >= 3
    med_names = [m["medicineName"].lower() for m in draft["medicines"]]
    assert any("metformin" in n for n in med_names)
    assert any("glipizide" in n for n in med_names)
    assert any("atorvastatin" in n for n in med_names)

def test_2_rotated_image_extraction(auth_headers):
    client = httpx.Client(base_url=BASE_URL, timeout=30.0)
    img = Image.new("RGB", (400, 200), color=(250, 250, 250))
    d = ImageDraw.Draw(img)
    d.text((20, 30), "Dr. Lin, MD\nRx: Losartan 50 mg\n1 tab once daily x 30 days", fill=(0, 0, 0))
    img_rot = img.rotate(90, expand=True)
    buf = io.BytesIO()
    img_rot.save(buf, format="JPEG")

    files = {"document": ("rotated_rx.jpg", buf.getvalue(), "image/jpeg")}
    r = client.post("/api/prescriptions/upload", files=files, headers=auth_headers)
    assert r.status_code == 200
    draft = r.json()["draft"]
    assert draft["isReadable"] is True
    assert len(draft["medicines"]) >= 1

def test_3_low_light_blurred_image(auth_headers):
    client = httpx.Client(base_url=BASE_URL, timeout=30.0)
    img = Image.new("RGB", (400, 200), color=(80, 80, 80))
    d = ImageDraw.Draw(img)
    d.text((20, 30), "Dr. Lin, MD\nRx: Pantoprazole 40 mg\n1 tablet daily before food", fill=(230, 230, 230))
    img_blur = img.filter(ImageFilter.GaussianBlur(radius=0.5))
    buf = io.BytesIO()
    img_blur.save(buf, format="JPEG")

    files = {"document": ("lowlight_rx.jpg", buf.getvalue(), "image/jpeg")}
    r = client.post("/api/prescriptions/upload", files=files, headers=auth_headers)
    assert r.status_code == 200
    draft = r.json()["draft"]
    assert draft["isReadable"] is True

def test_4_blank_unreadable_image_flagged(auth_headers):
    client = httpx.Client(base_url=BASE_URL, timeout=30.0)
    img = Image.new("RGB", (150, 150), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")

    files = {"document": ("blank_image.jpg", buf.getvalue(), "image/jpeg")}
    r = client.post("/api/prescriptions/upload", files=files, headers=auth_headers)
    assert r.status_code == 200
    draft = r.json()["draft"]
    assert draft["isReadable"] is False
    assert "We couldn't read this prescription clearly" in draft["unreadableReason"]

def test_5_invalid_mime_type_rejection(auth_headers):
    client = httpx.Client(base_url=BASE_URL, timeout=30.0)
    files = {"document": ("malicious.exe", b"MZexecutabledata", "application/x-msdownload")}
    r = client.post("/api/prescriptions/upload", files=files, headers=auth_headers)
    assert r.status_code == 400
    assert "Unsupported file type" in r.json()["detail"]

def test_6_camera_capture_base64(auth_headers):
    client = httpx.Client(base_url=BASE_URL, timeout=30.0)
    img = Image.new("RGB", (300, 150), color=(255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((10, 10), "Dr. Lin, MD\nRx: Metformin 500 mg\nTwice daily", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    b64_str = f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"

    r = client.post("/api/prescriptions/upload", json={"imageBase64": b64_str}, headers=auth_headers)
    assert r.status_code == 200
    draft = r.json()["draft"]
    assert draft["isReadable"] is True

def test_7_verification_and_schedule_generation(auth_headers):
    client = httpx.Client(base_url=BASE_URL, timeout=30.0)
    # Upload sample
    r = client.post("/api/prescriptions/upload", json={"sampleText": "Dr. Sarah Lin, MD\nRx: Lisinopril 20 mg - 1 tab daily"}, headers=auth_headers)
    assert r.status_code == 200
    draft = r.json()["draft"]

    # Confirm and verify
    verify_payload = {
        "documentId": draft["documentId"],
        "doctorName": draft["doctorName"],
        "clinicName": draft["clinicName"],
        "prescriptionDate": draft["prescriptionDate"],
        "originalFilename": draft["originalFilename"],
        "filePath": draft["filePath"],
        "rawOcrText": draft["rawOcrText"],
        "medicines": draft["medicines"]
    }
    r_ver = client.post("/api/prescriptions/verify", json=verify_payload, headers=auth_headers)
    assert r_ver.status_code == 200
    data_ver = r_ver.json()
    assert data_ver["success"] is True
    assert len(data_ver["medicines"]) >= 1

    # Check persistence in list
    r_list = client.get("/api/prescriptions", headers=auth_headers)
    assert r_list.status_code == 200
    assert len(r_list.json()["prescriptions"]) >= 1

    # Check medicines cabinet
    r_meds = client.get("/api/medicines", headers=auth_headers)
    assert r_meds.status_code == 200
    assert len(r_meds.json()["medicines"]) >= 1
