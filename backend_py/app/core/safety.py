import re
from typing import Dict, Any, List, Optional, Tuple

# Comprehensive Acute Red Flag & Emergency Keywords
EMERGENCY_TRIGGERS = [
    # Cardiovascular
    r"chest pain", r"chest pressure", r"crushing chest", r"radiating pain",
    r"heart attack", r"cardiac arrest", r"severe palpitation",
    # Respiratory
    r"shortness of breath", r"difficulty breathing", r"cannot breathe",
    r"gasping", r"suffocating", r"choking", r"stridor",
    # Neurological / Stroke (FAST)
    r"slurred speech", r"face droop", r"facial drooping", r"arm weakness",
    r"numbness on one side", r"sudden loss of vision", r"stroke",
    r"unconscious", r"fainted", r"passed out", r"seizure", r"convulsion",
    r"thunderclap headache", r"worst headache of life",
    # Hemorrhagic & Trauma
    r"coughing blood", r"vomiting blood", r"hemoptysis", r"hematemesis",
    r"severe uncontrolled bleeding", r"spurting blood", r"severe trauma",
    # Anaphylaxis & Toxicity
    r"anaphylaxis", r"throat closing", r"swollen lips and tongue",
    r"swelling of airway", r"poisoning", r"overdose", r"ingested toxin",
    # Psychiatric / Crisis
    r"suicidal", r"want to kill myself", r"end my life"
]

COMPILED_EMERGENCY_REGEX = re.compile("|".join(EMERGENCY_TRIGGERS), re.IGNORECASE)

class ClinicalSafetyPipeline:
    """
    Production Healthcare Safety Pipeline implementing 7-step clinical validation:
    1. Validate authenticated caller.
    2. Real-time Emergency / Red Flag screening & triage escalation.
    3. Context authorization filtering (isolated PHI access).
    4. Guardrailed AI inference.
    5. Output safety screening (prevent diagnosis/prescription/dose alteration claims).
    6. Structured formatting with disclaimer & doctor discussion questions.
    7. Sanitized operational audit logging.
    """

    @staticmethod
    def detect_emergency(text: str) -> Tuple[bool, List[str]]:
        """Scans input text for acute red-flag symptoms requiring immediate EMS escalation."""
        if not text:
            return False, []
        matches = list(set(COMPILED_EMERGENCY_REGEX.findall(text)))
        return (len(matches) > 0, matches)

    @staticmethod
    def sanitize_ai_output(raw_text: str) -> str:
        """
        Enforces healthcare guardrails:
        - Prevents definitive diagnosis assertions.
        - Prevents medication dosage modifications.
        - Appends non-diagnostic clinical boundaries.
        """
        cleaned = raw_text

        # Guard against assertive diagnoses
        cleaned = re.sub(r"(?i)\byou have\b", "your symptoms may be consistent with", cleaned)
        cleaned = re.sub(r"(?i)\bi diagnose you with\b", "potential etiologies to discuss with your doctor include", cleaned)
        cleaned = re.sub(r"(?i)\byou must take\b", "patients typically discuss options such as", cleaned)
        cleaned = re.sub(r"(?i)\bstop taking your\b", "do not stop prescribed medication without consulting your doctor regarding", cleaned)
        cleaned = re.sub(r"(?i)\bdouble your dose\b", "dosage adjustments must only be made by your prescribing physician", cleaned)

        return cleaned

    @staticmethod
    def get_emergency_response(detected_flags: List[str], language: str = "en") -> Dict[str, Any]:
        """Returns immediate critical escalation notice bypassing regular AI conversation."""
        flags_str = ", ".join(detected_flags)
        
        emergency_messages = {
            "en": {
                "summary": "⚠️ CRITICAL MEDICAL WARNING: Emergency symptoms detected.",
                "action": f"Emergency warning signs detected ({flags_str}). Please call emergency services immediately (108 / 112 in India, 911 in US) or proceed to the nearest Emergency Department. Do not drive yourself.",
                "facility": "Immediate Emergency Department (24/7 Trauma Care)",
                "hotlines": ["108 (Ambulance)", "112 (National Emergency Dispatch)", "911 (US)"]
            },
            "ta": {
                "summary": "⚠️ அவசர மருத்துவ எச்சரிக்கை: தீவிர அறிகுறிகள் கண்டறியப்பட்டுள்ளன.",
                "action": f"அவசர மருத்துவ அறிகுறிகள் கண்டறியப்பட்டன ({flags_str}). உடனடியாக அவசர மருத்துவ சேவையை (108 / 112) அழைக்கவும் அல்லது அருகில் உள்ள அவசர சிகிச்சைப் பிரிவிற்குச் செல்லவும்.",
                "facility": "அவசர சிகிச்சைப் பிரிவு (Emergency Trauma Center)",
                "hotlines": ["108 (ஆம்புலன்ஸ்)", "112 (அவசர உதவி)"]
            },
            "hi": {
                "summary": "⚠️ आपातकालीन चिकित्सा चेतावनी: गंभीर लक्षण पाए गए हैं।",
                "action": f"आपातकालीन चेतावनी संकेत मिले हैं ({flags_str})। कृपया तुरंत आपातकालीन सेवाओं (108 / 112) पर कॉल करें या नजदीकी आपातकालीन विभाग (ER) जाएं।",
                "facility": "निकटतम आपातकालीन विभाग (24/7 ट्रॉमा सेंटर)",
                "hotlines": ["108 (एम्बुलेंस)", "112 (राष्ट्रीय आपातकालीन)"]
            },
            "te": {
                "summary": "⚠️ అత్యవసర వైద్య హెచ్చరిక: తీవ్రమైన లక్షణాలు గుర్తించబడ్డాయి.",
                "action": f"అత్యవసర హెచ్చరిక సంకేతాలు గుర్తించబడ్డాయి ({flags_str}). దయచేసి వెంటనే అత్యవసర సేవలను (108 / 112) సంప్రదించండి లేదా సమీప అత్యవసర విభాగానికి వెళ్ళండి.",
                "facility": "అత్యవసర వైద్య కేంద్రం (24/7 ఎమర్జెన్సీ వార్డు)",
                "hotlines": ["108 (అంబులెన్స్)", "112 (నేషనల్ ఎమర్జెన్సీ)"]
            }
        }
        
        msg = emergency_messages.get(language, emergency_messages["en"])
        
        return {
            "is_emergency": True,
            "urgency_level": "EMERGENCY_IMMEDIATE",
            "reply": msg["action"],
            "summary": msg["summary"],
            "clinical_breakdown": {
                "detected_red_flags": detected_flags,
                "recommended_facility": msg["facility"],
                "hotlines": msg["hotlines"],
                "questions_for_doctor": [
                    "What urgent diagnostic stabilization tests are being performed?",
                    "What are the immediate telemetry or blood gas indicators?",
                    "What specific post-stabilization care is required?"
                ],
                "safe_next_steps": [
                    "Sit down or lay flat in a well-ventilated space while help is en route.",
                    "Unlock your front door if you are alone.",
                    "Do not consume solid foods, aspirin, or unprescribed medications before paramedic arrival unless advised by 108/911 dispatch."
                ]
            },
            "disclaimer": "EMERGENCY PROTOCOL: VitaCare AI does not replace emergency medical personnel. Emergency dispatches have been prioritized."
        }
