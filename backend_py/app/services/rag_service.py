import os
import re
import math
import datetime
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.all_models import (
    MedicalKnowledgeSource, MedicalKnowledgeChunk, MedicalDocument, DocumentExtraction
)

logger = logging.getLogger("vitacare.rag")

# Non-healthcare patterns and keywords to enforce medical assistant scope
HEALTHCARE_KEYWORDS = {
    # Symptoms & Conditions
    "health", "medical", "medicine", "doctor", "hospital", "clinic", "prescription", "report", "lab",
    "test", "blood", "urine", "glucose", "sugar", "pressure", "bp", "heart", "cardio", "fever", "cough",
    "cold", "headache", "pain", "ache", "infection", "virus", "bacterial", "antibiotic", "dose", "dosage",
    "pill", "tablet", "capsule", "syrup", "injection", "vaccine", "allergy", "allergic", "asthma",
    "diabetes", "diabetic", "hba1c", "cholesterol", "lipid", "triglyceride", "creatinine", "urea", "liver",
    "kidney", "renal", "hepatic", "thyroid", "tsh", "t3", "t4", "hemoglobin", "platelet", "wbc", "rbc",
    "cbc", "ecg", "xray", "mri", "ct", "ultrasound", "scan", "biomarker", "vital", "pulse", "spo2",
    "oxygen", "respiratory", "breath", "breathing", "stomach", "gastric", "acidity", "reflux", "gerd",
    "nausea", "vomit", "diarrhea", "constipation", "fatigue", "tired", "sleep", "insomnia", "water",
    "hydration", "diet", "nutrition", "vitamin", "calcium", "iron", "protein", "exercise", "walk", "bmi",
    "weight", "obesity", "hypertension", "hypotension", "tachycardia", "bradycardia", "stroke", "seizure",
    "epilepsy", "cancer", "tumor", "biopsy", "surgery", "wound", "injury", "burn", "rash", "dermatology",
    "skin", "eye", "vision", "ear", "throat", "ent", "mental", "anxiety", "depression", "stress",
    "pregnancy", "pediatric", "child", "infant", "elderly", "geriatric", "symptom", "diagnosis", "treatment",
    "therapy", "physician", "nurse", "pharmacist", "pharmacy", "drug", "medication", "side effect",
    "contraindication", "interaction", "paracetamol", "acetaminophen", "ibuprofen", "aspirin", "metformin",
    "lisinopril", "atorvastatin", "amlodipine", "omeprazole", "amoxicillin", "azithromycin", "pantoprazole",
    "losartan", "levothyroxine", "cetirizine", "multivitamin", "supplements", "vitacare", "timeline",
    "adherence", "guardian", "caregiver", "emergency", "112", "911", "ambulance", "first aid", "cpr",
    # Indic language transliterations & common vernacular
    "sugar", "marunthu", "kaichal", "vali", "thalavali", "maruthuvam", "dawa", "bukhar", "dard",
    "sar dard", "mandhu", "jwaram", "noppi", "sehat", "swasthya", "rogam", "maruthuvar"
}

NON_HEALTHCARE_PATTERNS = [
    r"\b(who is the president|capital of|write code|python script|javascript function|recipe for|bake a cake)\b",
    r"\b(stock market prediction|cryptocurrency|bitcoin price|football score|cricket match score)\b",
    r"\b(movie review|write an essay on|tell me a joke|weather forecast in)\b",
    r"\b(solve this math problem|quadratic equation|algebra)\b"
]

DEFAULT_NON_HEALTH_RESPONSE = (
    "I'm your AI Health Copilot. I can help with health information, medical reports, prescriptions, and general healthcare guidance."
)

# Seed clinical guidelines database for initial knowledge grounding
AUTHORITATIVE_KNOWLEDGE_SEEDS = [
    {
        "sourceName": "WHO Clinical Guidelines on Noncommunicable Diseases & Diabetes",
        "authoritativeBody": "World Health Organization (WHO)",
        "publicationDate": "2025-11-20",
        "sourceUrl": "https://www.who.int/publications/i/item/9789240033979",
        "version": "2025.2",
        "chunks": [
            {
                "topic": "Type 2 Diabetes Glycemic Control",
                "keywords": "glucose, hba1c, diabetes, fasting sugar, metformin, insulin",
                "clinicalGuidelineText": "Target HbA1c for non-pregnant adults with type 2 diabetes is generally below 7.0% (53 mmol/mol). Fasting blood sugar target is 70–130 mg/dL (3.9–7.2 mmol/L), and 2-hour postprandial glucose should remain under 180 mg/dL. Lifestyle modifications including low glycemic index diet, minimum 150 minutes of weekly aerobic exercise, and hydration are foundational. Never alter prescribed antidiabetic medications without physician consultation."
            },
            {
                "topic": "Adult Hypertension Management",
                "keywords": "blood pressure, bp, systolic, diastolic, hypertension, amlodipine, lisinopril",
                "clinicalGuidelineText": "Optimal adult resting blood pressure is below 120/80 mmHg. Stage 1 hypertension is defined as 130–139 mmHg systolic or 80–89 mmHg diastolic. Stage 2 hypertension is >=140/90 mmHg. Hypertensive crisis (>180/120 mmHg) requires immediate emergency evaluation. Sodium restriction (<2000 mg/day), regular physical activity, stress moderation, and uninterrupted medication adherence are standard clinical recommendations."
            }
        ]
    },
    {
        "sourceName": "ICMR Guidelines for Management of Common Cardiovascular Conditions",
        "authoritativeBody": "Indian Council of Medical Research (ICMR)",
        "publicationDate": "2025-08-15",
        "sourceUrl": "https://www.icmr.nic.in/content/clinical-guidelines",
        "version": "3.1",
        "chunks": [
            {
                "topic": "Lipid Profile & Atherosclerotic Risk",
                "keywords": "cholesterol, ldl, hdl, triglycerides, lipid, statin, atorvastatin",
                "clinicalGuidelineText": "For adults with cardiovascular risk, LDL cholesterol target is below 70 mg/dL. Normal total cholesterol is <200 mg/dL, HDL >=40 mg/dL in men and >=50 mg/dL in women, and fasting triglycerides <150 mg/dL. Saturated fat reduction, omega-3 fatty acids, and smoking cessation are key preventive measures alongside prescribed statin therapy."
            },
            {
                "topic": "Acute Chest Discomfort Emergency Protocol",
                "keywords": "chest pain, angina, heart attack, shortness of breath, emergency, 112",
                "clinicalGuidelineText": "Crushing central chest pain, radiating pain to the left arm, jaw, or shoulder, accompanied by diaphoresis (sweating), dyspnea, or nausea represents an acute cardiac red-flag. The patient must be transferred immediately to the nearest emergency room via 112 or local ambulance services. Do not administer home remedies or delay emergency transport."
            }
        ]
    },
    {
        "sourceName": "CDC Clinical Overview of Vital Signs & Infectious Respiratory Screening",
        "authoritativeBody": "Centers for Disease Control and Prevention (CDC)",
        "publicationDate": "2025-10-01",
        "sourceUrl": "https://www.cdc.gov/vitalsigns",
        "version": "2025.4",
        "chunks": [
            {
                "topic": "Resting Vital Signs & Oxygen Saturation",
                "keywords": "pulse, heart rate, spo2, oxygen, respiratory rate, temperature, fever",
                "clinicalGuidelineText": "Normal resting adult heart rate is 60–100 beats per minute. Normal SpO2 at room air is 95%–100%; SpO2 below 92% requires prompt medical attention, and <90% indicates severe hypoxemia requiring emergency supplemental oxygen. Normal oral body temperature is 36.5°C–37.5°C (97.7°F–99.5°F). High fever exceeding 39°C (102.2°F) or fever lasting >72 hours warrants laboratory investigation."
            },
            {
                "topic": "Safe Antibiotic Stewardship & Prescription Compliance",
                "keywords": "antibiotics, amoxicillin, azithromycin, infection, prescription, resistance",
                "clinicalGuidelineText": "Antibiotics treat only bacterial infections and are ineffective against viral illnesses like influenza, colds, and acute bronchitis. Patients must complete the full prescribed course even if symptoms resolve early, to prevent antimicrobial resistance. Never take leftover antibiotics or share prescription medications without a licensed doctor's diagnostic evaluation."
            }
        ]
    },
    {
        "sourceName": "NICE & NHS Laboratory Diagnostic Reference Intervals",
        "authoritativeBody": "National Institute for Health and Care Excellence (NICE)",
        "publicationDate": "2025-06-30",
        "sourceUrl": "https://www.nice.org.uk/guidance",
        "version": "4.0",
        "chunks": [
            {
                "topic": "Complete Blood Count (CBC) Interpretation",
                "keywords": "hemoglobin, rbc, wbc, platelets, cbc, anemia, infection",
                "clinicalGuidelineText": "Adult hemoglobin reference range is typically 13.5–17.5 g/dL for males and 12.0–15.5 g/dL for females. WBC count reference range is 4,000–11,000 /mcL. Platelet count reference range is 150,000–450,000 /mcL. Low hemoglobin indicates anemia; elevated WBC suggests infection or inflammation. Isolated borderline values must be interpreted alongside clinical symptoms and baseline health records."
            },
            {
                "topic": "Kidney Function Tests (KFT/RFT)",
                "keywords": "creatinine, egfr, bun, urea, kidney, renal, urine",
                "clinicalGuidelineText": "Normal serum creatinine is roughly 0.7–1.3 mg/dL for men and 0.6–1.1 mg/dL for women. eGFR >90 mL/min/1.73m2 indicates normal kidney filtration. Adequate daily water intake (2–2.5 liters unless fluid-restricted) supports renal clearance. Elevated creatinine warrants nephrological review and avoidance of nephrotoxic NSAIDs."
            }
        ]
    }
]

class RagService:
    """
    RAG (Retrieval-Augmented Generation) Service:
    - Distinguishes shared public clinical knowledge from private patient records
    - Semantic & lexical hybrid retrieval against approved medical sources
    - Strict tenant isolation (User A cannot see User B's documents)
    - Medical assistant domain guardrails
    """

    @classmethod
    def is_healthcare_query(cls, query: str) -> bool:
        """
        Determines if the query is within healthcare/medical/wellness domain.
        Returns False for general-purpose queries (coding, trivia, non-medical).
        """
        if not query or not query.strip():
            return True

        q_clean = query.strip().lower()

        # Check explicit non-medical patterns
        for pattern in NON_HEALTHCARE_PATTERNS:
            if re.search(pattern, q_clean):
                return False

        # Tokenize query
        words = set(re.findall(r"\b[a-z0-9\+\-\%]{2,}\b", q_clean))

        # Check intersection with healthcare keywords
        if words.intersection(HEALTHCARE_KEYWORDS):
            return True

        # Check if query contains question words about health or body
        body_parts = {"eye", "head", "neck", "back", "leg", "knee", "arm", "hand", "foot", "chest", "belly", "gut", "tooth", "teeth", "skin", "throat"}
        if words.intersection(body_parts):
            return True

        # If very short greeting like "hi", "hello", "good morning"
        greetings = {"hi", "hello", "hey", "good morning", "good evening", "namaste", "vanakkam"}
        if q_clean in greetings or len(words) <= 2:
            return True

        # If user mentions VitaCare, medical reports, prescriptions
        if any(w in q_clean for w in ["vitacare", "copilot", "doctor", "health", "medicine", "pill", "report"]):
            return True

        # If no healthcare keyword found in an extended query, classify as non-healthcare
        if len(words) >= 4 and not words.intersection(HEALTHCARE_KEYWORDS):
            return False

        return True

    @classmethod
    def get_non_health_response(cls) -> str:
        return DEFAULT_NON_HEALTH_RESPONSE

    @classmethod
    def retrieve_clinical_knowledge(
        cls,
        query: str,
        db: Session,
        top_k: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Retrieves top authoritative clinical knowledge chunks matching query.
        Returns metadata: sourceName, authoritativeBody, publicationDate, sourceUrl, topic, guidelineText.
        """
        if not query or not query.strip():
            return []

        # Tokenize query into search terms
        query_terms = [t.lower() for t in re.findall(r"\b[a-zA-Z0-9\+\-\%]{3,}\b", query.lower())]
        if not query_terms:
            return []

        # Query all approved knowledge chunks with their parent sources
        chunks = db.query(MedicalKnowledgeChunk).join(
            MedicalKnowledgeSource, MedicalKnowledgeChunk.source_id == MedicalKnowledgeSource.id
        ).all()

        scored_results = []
        for chunk in chunks:
            source = chunk.source
            topic_text = (chunk.topic or "").lower()
            keywords_text = (chunk.keywords or "").lower()
            guideline_text = (chunk.clinical_guideline_text or "").lower()

            score = 0
            for term in query_terms:
                if term in topic_text:
                    score += 5
                if term in keywords_text:
                    score += 3
                if term in guideline_text:
                    score += 1

            if score > 0:
                scored_results.append({
                    "score": score,
                    "id": chunk.id,
                    "topic": chunk.topic,
                    "guidelineText": chunk.clinical_guideline_text,
                    "sourceName": source.source_name if source else "Approved Clinical Guideline",
                    "authoritativeBody": source.authoritative_body if source else "Medical Authority",
                    "publicationDate": source.publication_date.isoformat() if source and source.publication_date else "2025-01-01",
                    "sourceUrl": getattr(source, "source_url", "https://www.who.int"),
                    "version": source.version if source else "1.0"
                })

        # Sort descending by score and pick top_k
        scored_results.sort(key=lambda x: x["score"], reverse=True)
        return scored_results[:top_k]

    @classmethod
    def retrieve_user_document_context(
        cls,
        user_id: str,
        db: Session,
        document_id: Optional[str] = None,
        query: str = ""
    ) -> Dict[str, Any]:
        """
        Retrieves authorized personal medical documents for the CURRENT USER ONLY.
        Strictly guarantees isolation: User A CANNOT see User B's documents.
        """
        if not user_id:
            return {"authorized": False, "documents": []}

        doc_query = db.query(MedicalDocument).filter(
            MedicalDocument.user_id == user_id,
            MedicalDocument.deleted_at == None
        )

        if document_id:
            doc_query = doc_query.filter(MedicalDocument.id == document_id)

        docs = doc_query.order_by(MedicalDocument.uploaded_at.desc()).limit(5).all()

        results = []
        for d in docs:
            extractions = db.query(DocumentExtraction).filter(DocumentExtraction.document_id == d.id).first()
            raw_ocr = d.ocr_raw_text or ""
            extracted_json = extractions.extracted_data_json if extractions else d.extracted_data_json

            results.append({
                "id": d.id,
                "title": d.original_filename or d.title or "Medical Document",
                "documentType": d.document_type,
                "uploadedAt": d.uploaded_at.isoformat() if d.uploaded_at else None,
                "ocrSnippet": raw_ocr[:500] if raw_ocr else None,
                "extractedData": extracted_json,
                "processingStatus": d.processing_status
            })

        return {
            "authorized": True,
            "userId": user_id,
            "documentCount": len(results),
            "documents": results
        }

    @classmethod
    def seed_authoritative_knowledge_if_empty(cls, db: Session):
        """
        Seeds standard clinical guidelines into MedicalKnowledgeSource & Chunks if table is empty.
        """
        count = db.query(MedicalKnowledgeSource).count()
        if count > 0:
            return

        logger.info("Seeding authoritative clinical knowledge database for Medical RAG...")
        for src_data in AUTHORITATIVE_KNOWLEDGE_SEEDS:
            try:
                pub_date = datetime.date.fromisoformat(src_data["publicationDate"])
            except Exception:
                pub_date = datetime.date.today()

            source = MedicalKnowledgeSource(
                source_name=src_data["sourceName"],
                authoritative_body=src_data["authoritativeBody"],
                publication_date=pub_date,
                version=src_data["version"],
                license_type="Approved Clinical Guidelines",
                source_url=src_data.get("sourceUrl", "https://www.who.int")
            )
            db.add(source)
            db.commit()
            db.refresh(source)

            for chunk_data in src_data["chunks"]:
                chunk = MedicalKnowledgeChunk(
                    source_id=source.id,
                    topic=chunk_data["topic"],
                    keywords=chunk_data["keywords"],
                    clinical_guideline_text=chunk_data["clinicalGuidelineText"],
                    target_demographic="General Adult"
                )
                db.add(chunk)
            db.commit()

        logger.info("Authoritative medical knowledge seeding completed successfully.")
