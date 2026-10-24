from typing import Optional
from fastapi import APIRouter, Query

router = APIRouter(prefix="/resources", tags=["Medical Resources & Facilities"])

DICTIONARY_TERMS = [
    {
        "term": "HbA1c (Glycated Hemoglobin)",
        "category": "Endocrinology / Diagnostics",
        "pronunciation": "H-B-A-1-C",
        "definition": "A primary blood test measuring the average percentage of blood sugar (glucose) bound to hemoglobin over the past 2 to 3 months.",
        "normalRange": "Below 5.7% (Normal), 5.7% - 6.4% (Prediabetes), 6.5% or higher (Diabetes threshold)",
        "clinicalImportance": "Key biomarker for tracking longitudinal glycemic control."
    },
    {
        "term": "Hypertension",
        "category": "Cardiology",
        "pronunciation": "HY-per-TEN-shun",
        "definition": "A chronic medical condition where the arterial blood pressure is persistently elevated above 130/80 mmHg.",
        "normalRange": "Systolic < 120 mmHg and Diastolic < 80 mmHg",
        "clinicalImportance": "Major modifiable risk factor for stroke, myocardial infarction, and renal disease."
    },
    {
        "term": "Metformin",
        "category": "Pharmacology",
        "pronunciation": "met-FOR-min",
        "definition": "A first-line oral biguanide medication that reduces hepatic glucose production and enhances peripheral insulin sensitivity.",
        "normalRange": "Standard dosing 500 mg - 2000 mg daily with meals",
        "clinicalImportance": "Cornerstone treatment for Type 2 Diabetes Mellitus."
    },
    {
        "term": "Lisinopril",
        "category": "Pharmacology",
        "pronunciation": "lye-SIN-oh-pril",
        "definition": "An Angiotensin-Converting Enzyme (ACE) inhibitor used to manage arterial hypertension and post-MI ventricular remodeling.",
        "normalRange": "Standard dosing 5 mg - 40 mg once daily",
        "clinicalImportance": "Provides cardioprotective and renoprotective benefits in hypertensive patients."
    },
    {
        "term": "Lipid Profile",
        "category": "Cardiology / Diagnostics",
        "pronunciation": "LIP-id PRO-fyl",
        "definition": "A panel of blood tests that measures Total Cholesterol, HDL, LDL, and Triglycerides.",
        "normalRange": "Total < 200 mg/dL, LDL < 100 mg/dL, HDL > 40 mg/dL, Triglycerides < 150 mg/dL",
        "clinicalImportance": "Assesses atherosclerotic cardiovascular disease (ASCVD) risk."
    }
]

ARTICLES = [
    {
        "id": "art-1",
        "title": "Managing Blood Pressure: The Sodium & Potassium Balance",
        "category": "Cardiovascular Health",
        "readTime": "4 min read",
        "summary": "Clinical recommendations on dietary sodium reduction and potassium-rich whole foods for optimal vascular elasticity.",
        "content": "Excess dietary sodium draws water into the bloodstream, increasing the pressure against arterial walls. Balancing sodium with adequate dietary potassium helps vascular smooth muscles relax."
    },
    {
        "id": "art-2",
        "title": "Demystifying HbA1c: What Your 3-Month Sugar Score Means",
        "category": "Metabolic Care",
        "readTime": "5 min read",
        "summary": "How glycated hemoglobin reflects long-term metabolic health and practical daily steps to maintain stable glycemic variability.",
        "content": "Red blood cells live for approximately 120 days. As glucose circulates in the blood, a portion binds permanently to hemoglobin molecules inside RBCs."
    },
    {
        "id": "art-3",
        "title": "Medication Timing & Food Interactions",
        "category": "Pharmacology",
        "readTime": "3 min read",
        "summary": "Why specific medications require post-meal ingestion while others necessitate an empty stomach for maximum pharmacokinetic bioavailability.",
        "content": "Taking medications at consistent times each day minimizes therapeutic troughs and reduces unintended adverse effects."
    }
]

HOSPITALS = [
    {
        "id": "hosp-1",
        "name": "Apollo Speciality Hospital & Trauma Care",
        "address": "Greams Road, Thousand Lights, Chennai, Tamil Nadu 600006",
        "city": "Chennai",
        "emergencyPhone": "+91 (44) 2829-0200",
        "ambulanceHotline": "1066",
        "distance": "1.8 km",
        "isEmergency24x7": True,
        "specialties": ["Trauma & Acute Surgery", "Cardiac Emergency (Cath Lab)", "Stroke Center", "ICU / CCU"]
    },
    {
        "id": "hosp-2",
        "name": "St. Jude Specialty Care Hospital & Medical Center",
        "address": "400 Medical Center Blvd, Downtown City",
        "city": "Metro",
        "emergencyPhone": "+1 (555) 019-9911",
        "ambulanceHotline": "911",
        "distance": "2.4 km",
        "isEmergency24x7": True,
        "specialties": ["24/7 Level 1 Trauma", "Stroke Neurology", "Comprehensive Cardiac Care"]
    },
    {
        "id": "hosp-3",
        "name": "Fortis Malar Hospital",
        "address": "First Main Road, Gandhi Nagar, Adyar, Chennai, Tamil Nadu 600020",
        "city": "Chennai",
        "emergencyPhone": "+91 (44) 4289-2222",
        "ambulanceHotline": "105010",
        "distance": "4.2 km",
        "isEmergency24x7": True,
        "specialties": ["Heart Failure Management", "Emergency Medicine", "Nephrology"]
    }
]

@router.get("/dictionary")
def get_dictionary(search: Optional[str] = None):
    results = DICTIONARY_TERMS
    if search:
        s = search.lower().strip()
        results = [t for t in results if s in t["term"].lower() or s in t["definition"].lower()]
    return {"terms": results, "count": len(results)}

@router.get("/articles")
def get_articles(category: Optional[str] = None):
    results = ARTICLES
    if category:
        results = [a for a in results if category.lower() in a["category"].lower()]
    return {"articles": results, "count": len(results)}

@router.get("/hospitals")
def get_hospitals(city: Optional[str] = None):
    results = HOSPITALS
    if city:
        results = [h for h in results if city.lower() in h["city"].lower()]
    return {
        "hospitals": results,
        "count": len(results),
        "emergencyHotlines": [
            {"service": "National Emergency Service (India)", "number": "112"},
            {"service": "Ambulance Dispatch (India)", "number": "108"},
            {"service": "Health Helpline", "number": "104"},
            {"service": "National Emergency (US)", "number": "911"}
        ]
    }
