from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field, ConfigDict
import datetime

# --- AUTH SCHEMAS ---
class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    phone: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = "Unspecified"
    bloodGroup: Optional[str] = "A+"
    preferredLanguage: Optional[str] = "en"
    emergencyContactName: Optional[str] = None
    emergencyContactPhone: Optional[str] = None

class SendOtpRequest(BaseModel):
    phoneNumber: Optional[str] = None
    phone: Optional[str] = None

class VerifyOtpRequest(BaseModel):
    phoneNumber: Optional[str] = None
    phone: Optional[str] = None
    otp: str
    name: Optional[str] = None

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    name: str
    email: str
    role: str
    age: Optional[int] = None
    gender: Optional[str] = None
    bloodGroup: Optional[str] = Field(default=None, validation_alias="blood_group")
    preferredLanguage: Optional[str] = Field(default="en", validation_alias="preferred_language")
    preferred_language: Optional[str] = Field(default="en", validation_alias="preferred_language")
    emergencyPhone: Optional[str] = Field(default=None, validation_alias="emergency_phone")

class TokenResponse(BaseModel):
    token: str
    refreshToken: Optional[str] = None
    user: UserOut
    guardian: Optional[Dict[str, Any]] = None

# --- PROFILE & CONSENTS ---
class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    bloodGroup: Optional[str] = None
    emergencyPhone: Optional[str] = None
    preferredLanguage: Optional[str] = None
    allergies: Optional[List[str]] = None
    chronicConditions: Optional[List[str]] = None
    currentMedications: Optional[List[str]] = None
    heightCm: Optional[float] = None
    weightKg: Optional[float] = None
    primaryPhysician: Optional[str] = None

class ConsentUpdateRequest(BaseModel):
    dataProcessingAccepted: Optional[bool] = None
    guardianSharingAccepted: Optional[bool] = None
    emergencyAlertsAccepted: Optional[bool] = None
    teleconsultAccepted: Optional[bool] = None

class GuardianCreate(BaseModel):
    name: str
    relationship: str
    phoneNumber: str
    email: Optional[str] = None
    allowMedicationEscalation: Optional[bool] = True
    allowEmergencyNotification: Optional[bool] = True
    allowCareConnectAccess: Optional[bool] = True
    allowHealthView: Optional[bool] = True

# --- CHAT & AI COPILOT ---
class ChatMessageCreate(BaseModel):
    message: str
    threadId: Optional[str] = None
    mode: Optional[str] = "simple" # "simple", "standard", "detailed"
    language: Optional[str] = "en"
    preferred_language: Optional[str] = None
    attachmentUrl: Optional[str] = None

class ChatThreadCreate(BaseModel):
    title: Optional[str] = "New Health Consultation"

class ChatThreadUpdate(BaseModel):
    title: str

# --- MEDICATIONS & REMINDERS ---
class MedicationScheduleCreate(BaseModel):
    name: str
    dosage: str
    instructions: Optional[str] = "Take with water"
    frequency: Optional[str] = "Once daily"
    timesOfDay: Optional[List[str]] = ["08:00 AM"]
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    refillReminder: Optional[bool] = True
    remainingDoses: Optional[int] = 30

class AdherenceActionRequest(BaseModel):
    action: str # "taken", "skipped", "missed"
    reason: Optional[str] = None

# --- HEALTH RECORDS & VITALS ---
class MeasurementCreate(BaseModel):
    type: str # "bp_systolic", "bp_diastolic", "heart_rate", "blood_glucose", "spo2", "temperature", "weight"
    value: float
    unit: str
    source: Optional[str] = "manual"

# --- APPOINTMENTS ---
class AppointmentCreate(BaseModel):
    doctorName: str
    specialty: Optional[str] = "General Medicine"
    clinicName: Optional[str] = None
    facilityName: Optional[str] = None
    appointmentDate: Optional[str] = None
    date: Optional[str] = None
    appointmentTime: Optional[str] = "10:00 AM"
    time: Optional[str] = None
    location: Optional[str] = None
    contactPhone: Optional[str] = None
    reminderEnabled: Optional[bool] = True
    notes: Optional[str] = None
    reason: Optional[str] = None

class AppointmentUpdate(BaseModel):
    status: Optional[str] = None # "confirmed", "completed", "cancelled"
    appointmentDate: Optional[str] = None
    appointmentTime: Optional[str] = None
    notes: Optional[str] = None

# --- SYMPTOM GUIDANCE ---
class SymptomAssessRequest(BaseModel):
    symptoms: str
    duration: Optional[str] = "1-2 days"
    severity: Optional[int] = 5
    context: Optional[str] = ""
    fever: Optional[bool] = False

# --- WELLNESS ---
class WaterLogRequest(BaseModel):
    deltaGlasses: Optional[int] = 1
    deltaMl: Optional[int] = 250
    reset: Optional[bool] = False

class ActivityLogRequest(BaseModel):
    steps: Optional[int] = None
    activeMinutes: Optional[int] = None
    sleepHours: Optional[float] = None
