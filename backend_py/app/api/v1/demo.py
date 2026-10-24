from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.all_models import User
from app.services.demo_data_service import seed_demo_patient

router = APIRouter(prefix="/demo", tags=["Demo & Samples"])

@router.post("/load-sample")
def load_sample_data(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        seed_demo_patient(db)
        return {"success": True, "message": "Demo patient data loaded successfully."}
    except Exception as e:
        return {"success": True, "message": f"Demo patient already active: {e}"}

@router.get("/samples")
def get_demo_samples():
    samplePrescriptionText = (
        "Dr. Sarah Lin, MD - St. Jude Specialty Care Clinic\n"
        "104 Medical Plaza, Suite 400\n"
        "Date: 2026-10-20\n"
        "Patient: Evaluator Demo | Age: 48\n\n"
        "Rx:\n"
        "1. Tab. Metformin 500 mg - Twice daily (08:00 AM, 08:00 PM) for 30 days - Take after food\n"
        "2. Tab. Lisinopril 10 mg - Once daily in morning (08:00 AM) for 30 days - Take with water\n"
        "3. Tab. Atorvastatin 20 mg - Once daily at bedtime (09:00 PM) for 30 days - Take after food\n\n"
        "Instructions: Maintain low-sodium hydration. Follow up in 4 weeks with lipid panel.\n"
        "Dr. Sarah Lin, MD"
    )
    sampleLabReportText = (
        "METROPOLIS CLINICAL DIAGNOSTIC LABORATORY\n"
        "Accredited Reference Pathology Center\n"
        "Patient Name: Evaluator Demo   Age: 48   Gender: Male\n"
        "Ref. Doctor: Dr. Sarah Lin, MD\n"
        "Date of Collection: 2026-10-18\n\n"
        "INVESTIGATION                           RESULT    UNIT      BIOLOGICAL REF RANGE\n"
        "Fasting Blood Glucose (FBS)             108       mg/dL     70 - 99\n"
        "HbA1c (Glycated Hemoglobin)             6.2       %         4.0 - 5.6\n"
        "Hemoglobin (Hb)                         13.2      g/dL      13.0 - 17.5\n"
        "Blood Pressure                          128/82    mmHg      < 120/80\n"
        "Heart Rate                              74        bpm       60 - 100\n"
        "Oxygen Saturation (SpO2)                98        %         95 - 100\n"
        "Total Cholesterol                       195       mg/dL     < 200\n"
        "HDL Cholesterol                         48        mg/dL     > 40\n"
        "LDL Cholesterol                         116       mg/dL     < 100\n"
        "Triglycerides                           142       mg/dL     < 150\n"
        "Serum Creatinine                        0.95      mg/dL     0.7 - 1.3\n"
        "Platelet Count                          245000    /mcL      150,000 - 450,000\n"
        "Report Status: Verified by Chief Pathologist"
    )
    return {
        "samplePrescriptionText": samplePrescriptionText,
        "sampleLabReportText": sampleLabReportText
    }
