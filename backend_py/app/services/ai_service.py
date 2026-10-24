import json
import logging
from typing import Dict, Any, List, Optional
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.safety import ClinicalSafetyPipeline
from app.services.rag_service import RagService
from app.services.agent_tools_service import AgentToolsService, AGENT_TOOL_DEFINITIONS
from app.models.all_models import MedicalDocument, DocumentExtraction

logger = logging.getLogger("vitacare.ai")

class AiService:
    """
    Dedicated AI Health Copilot service layer with:
    - Authoritative Medical Knowledge RAG Retrieval
    - Isolated Personal Document Context (Patient Privacy)
    - Medical Assistant Domain Guardrail (Non-health filter)
    - Short & Sweet (2–5 sentences) default response length
    - Medical Report & Prescription Analysis with OCR Grounding
    - Multilingual Support (English, Tamil, Hindi, Telugu)
    - 7-Step Clinical Safety Pipeline & Emergency Screening
    """

    @classmethod
    async def process_chat(
        cls,
        user_id: str,
        message: str,
        language: str = "en",
        mode: str = "simple",
        user_context: Optional[Dict[str, Any]] = None,
        db: Optional[Session] = None,
        document_id: Optional[str] = None,
        document_analysis: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        target_lang = language or "en"
        query_text = (message or "").strip()

        # Step 1: Medical Assistant Domain Guardrail
        # Must answer healthcare-related questions only.
        if not RagService.is_healthcare_query(query_text) and not document_analysis:
            return {
                "reply": RagService.get_non_health_response(),
                "isHealthQuery": False,
                "is_health_query": False,
                "isEmergency": False,
                "is_emergency": False,
                "mode": mode,
                "language": target_lang,
                "clinicalBreakdown": None,
                "citations": [],
                "disclaimer": "I'm an AI health assistant, not a doctor. I can help explain health information, but a qualified healthcare professional should make medical decisions."
            }

        # Step 2: Acute Red-Flag Emergency Screening
        is_emergency, detected_flags = ClinicalSafetyPipeline.detect_emergency(query_text)
        if is_emergency:
            emergency_resp = ClinicalSafetyPipeline.get_emergency_response(detected_flags, target_lang)
            emergency_resp["hasEmergencyWarning"] = True
            emergency_resp["isEmergency"] = True
            emergency_resp["is_emergency"] = True
            emergency_resp["isHealthQuery"] = True
            emergency_resp["is_health_query"] = True
            emergency_resp["emergencyNumber"] = "112"
            return emergency_resp

        # Step 3: Authoritative Clinical Knowledge Retrieval (RAG)
        rag_sources = []
        if db:
            rag_sources = RagService.retrieve_clinical_knowledge(query_text, db=db, top_k=2)

        rag_context_text = ""
        citations = []
        for src in rag_sources:
            citations.append({
                "sourceName": src["sourceName"],
                "authoritativeBody": src["authoritativeBody"],
                "publicationDate": src["publicationDate"],
                "sourceUrl": src.get("sourceUrl", "https://www.who.int"),
                "topic": src["topic"]
            })
            rag_context_text += f"\n[Clinical Reference: {src['sourceName']} ({src['authoritativeBody']})]: {src['guidelineText']}"

        # Step 4: Patient-Specific Context (Isolated to this user)
        patient_context = ""
        if user_context:
            allergies = user_context.get("allergies", [])
            conditions = user_context.get("conditions", [])
            meds = user_context.get("medications", [])
            patient_context = f"[Patient Context: Conditions: {', '.join(conditions) or 'None'}; Allergies: {', '.join(allergies) or 'None'}; Active Meds: {', '.join(meds) or 'None'}]"

        # Step 5: Document Context (If user attached or referenced a personal document)
        doc_context_text = ""
        if document_analysis:
            doc_context_text = f"\n[Attached Document Analysis]: {json.dumps(document_analysis)}"
        elif document_id and db:
            user_doc_info = RagService.retrieve_user_document_context(user_id=user_id, db=db, document_id=document_id)
            if user_doc_info.get("documents"):
                doc = user_doc_info["documents"][0]
                doc_context_text = f"\n[Referenced User Document: {doc['title']}]: {doc.get('ocrSnippet') or doc.get('extractedData') or ''}"

        # Step 5.5: Agentic Real Tool Execution (Requirement 7)
        executed_tool_name = None
        tool_action_result = None
        if db and user_id:
            executed_tool_name, tool_action_result = cls._match_and_execute_agent_tool(query_text, user_id, db)

        # Step 6: Generate Clinical Response (Gemini API or Local Medical RAG Engine)
        reply, breakdown = await cls._generate_clinical_response(
            query=query_text,
            lang=target_lang,
            mode=mode,
            patient_context=patient_context,
            rag_context=rag_context_text,
            doc_context=doc_context_text,
            document_analysis=document_analysis,
            tool_name=executed_tool_name,
            tool_result=tool_action_result
        )

        # Step 7: Post-Inference Safety Sanitation
        sanitized_reply = ClinicalSafetyPipeline.sanitize_ai_output(reply)

        return {
            "reply": sanitized_reply,
            "mode": mode,
            "language": target_lang,
            "clinicalBreakdown": breakdown,
            "citations": citations,
            "documentAnalysis": document_analysis,
            "toolExecuted": executed_tool_name,
            "toolResult": tool_action_result,
            "disclaimer": "I'm an AI health assistant, not a doctor. I can help explain health information, but a qualified healthcare professional should make medical decisions."
        }

    @classmethod
    def _match_and_execute_agent_tool(cls, query: str, user_id: str, db: Session) -> (Optional[str], Optional[Dict[str, Any]]):
        """
        Matches user query to controlled application tools and executes with strict tenant boundaries.
        """
        q = query.lower()

        # 1. Medication Schedules
        if any(w in q for w in ["what medicines", "my medicines", "today's medicine", "scheduled medicine", "my medications", "pills to take", "what pills", "enna marundhu"]):
            res = AgentToolsService.execute_tool("get_medication_schedules", {}, user_id, db)
            return "get_medication_schedules", res

        # 2. Vitals / Biomarkers
        elif any(w in q for w in ["my blood pressure", "my bp", "my sugar", "my glucose", "my vitals", "my heart rate", "spo2", "hba1c reading"]):
            res = AgentToolsService.execute_tool("list_authorized_health_records", {}, user_id, db)
            return "list_authorized_health_records", res

        # 3. Appointments
        elif any(w in q for w in ["my appointments", "when is my appointment", "doctor visit", "upcoming appointment", "scheduled appointment"]):
            res = AgentToolsService.execute_tool("get_appointments", {}, user_id, db)
            return "get_appointments", res

        # 4. User Profile / Allergies
        elif any(w in q for w in ["my profile", "my allergies", "my conditions", "my blood group", "my details"]):
            res = AgentToolsService.execute_tool("get_user_profile", {}, user_id, db)
            return "get_user_profile", res

        # 5. Family / Guardians
        elif any(w in q for w in ["my guardian", "family profile", "emergency contact info", "who is my guardian"]):
            res = AgentToolsService.execute_tool("get_selected_family_profile", {}, user_id, db)
            return "get_selected_family_profile", res

        # 6. Adherence / Verified Intake History
        elif any(w in q for w in ["did i take", "have i taken", "intake history", "adherence score", "adherence status"]):
            res = AgentToolsService.execute_tool("get_verified_medication_intake_history", {}, user_id, db)
            return "get_verified_medication_intake_history", res

        # 7. Language Switch
        elif "change language to" in q or "switch to" in q or "switch language" in q:
            target = "en"
            if "tamil" in q: target = "ta"
            elif "tanglish" in q: target = "tanglish"
            elif "hindi" in q: target = "hi"
            elif "telugu" in q: target = "te"
            res = AgentToolsService.execute_tool("change_user_language_preference", {"language_code": target}, user_id, db)
            return "change_user_language_preference", res

        # 8. Search reports
        elif "search my reports" in q or "search document" in q:
            kw = q.replace("search my reports for", "").replace("search document for", "").strip()
            res = AgentToolsService.execute_tool("search_user_health_documents", {"query": kw or "glucose"}, user_id, db)
            return "search_user_health_documents", res

        return None, None

    @classmethod
    async def _generate_clinical_response(
        cls,
        query: str,
        lang: str,
        mode: str,
        patient_context: str,
        rag_context: str,
        doc_context: str,
        document_analysis: Optional[Dict[str, Any]] = None,
        tool_name: Optional[str] = None,
        tool_result: Optional[Dict[str, Any]] = None
    ) -> (str, Dict[str, Any]):
        """
        Generates grounded, concise clinical response with structured educational breakdown.
        Enforces 2–5 sentences for 'simple' (Short Answer) mode.
        """
        q_lower = query.lower()

        # If document analysis is provided, format concise document explanation
        if document_analysis:
            doc_reply, doc_breakdown = cls._format_document_response(document_analysis, lang, mode)
            return doc_reply, doc_breakdown

        # If an agent tool executed, format actual verified tool findings
        if tool_name and tool_result and tool_result.get("success"):
            data = tool_result.get("data")

            if tool_name == "get_medication_schedules":
                if data and len(data) > 0:
                    med_summary = ", ".join([f"{m['medicineName']} ({m['dosage']} at {', '.join(m.get('timesOfDay', []))})" for m in data[:3]])
                    if lang == "ta":
                        reply = f"இன்று உங்களுக்கு {len(data)} மருந்து(கள்) அட்டவணைப்படுத்தப்பட்டுள்ளது: {med_summary}. தண்ணீருடன் உட்கொண்டு கேமரா மூலம் உட்கொள்ளலை உறுதிப்படுத்தவும்."
                    elif lang in ["tanglish", "ta-en"]:
                        reply = f"Innaikku ungalukku {len(data)} marundhu(gal) schedule aagi irukku: {med_summary}. Thanniyudan saappittu camera tracker moolam verify pannikollungal."
                    elif lang == "hi":
                        reply = f"आज आपकी {len(data)} दवाइयां निर्धारित हैं: {med_summary}। कृपया पानी के साथ लें और कैमरा ट्रैकर द्वारा सत्यापन करें।"
                    elif lang == "te":
                        reply = f"ఈరోజు మీకు {len(data)} మందులు షెడ్యూల్ చేయబడ్డాయి: {med_summary}. దయచేసి నీటితో తీసుకోండి."
                    else:
                        reply = f"You have {len(data)} active medication schedule(s) for today: {med_summary}. Please take them with a full glass of water and complete camera intake verification."
                else:
                    if lang in ["tanglish", "ta-en"]:
                        reply = "Innaikku ungalukku pending doses edhuvum illai. Pudhiya prescription upload seiyyalaam alladhu Add Medication tap seiyyalaam."
                    elif lang == "ta":
                        reply = "இன்று உங்களுக்கு நிலுவையில் உள்ள மருந்துகள் ஏதுமில்லை. புதிய மருந்துச் சீட்டைப் பதிவேற்றலாம்."
                    else:
                        reply = "You currently have no scheduled medication doses logged for today. You can upload a new doctor prescription or tap Add Medication to set up a reminder."
                return reply, cls._build_breakdown(query, lang, mode)

            elif tool_name == "list_authorized_health_records":
                if data and len(data) > 0:
                    v_summary = ", ".join([f"{v['type'].replace('_', ' ').title()}: {v['value']} {v['unit']} ({v['status']})" for v in data[:3]])
                    if lang in ["tanglish", "ta-en"]:
                        reply = f"Unga latest health vitals: {v_summary}. Regular-aaga vitals record panradhu unga doctor-kku nalladhu."
                    elif lang == "ta":
                        reply = f"உங்கள் சமீபத்திய உடல்நல அளவீடுகள்: {v_summary}. வழக்கமான அளவீடுகள் உங்கள் மருத்துவருக்கு உதவும்."
                    else:
                        reply = f"Here are your latest verified vital measurements: {v_summary}. Regular monitoring helps track long-term clinical trends."
                else:
                    if lang in ["tanglish", "ta-en"]:
                        reply = "Innum vitals edhuvum record seiyyavillai. Health Tracker-il unga blood pressure alladhu glucose log pannalaam."
                    else:
                        reply = "No physiological vitals have been recorded yet. You can log your blood pressure or blood glucose using the Health Tracker."
                return reply, cls._build_breakdown(query, lang, mode)

            elif tool_name == "get_appointments":
                if data and len(data) > 0:
                    a_summary = ", ".join([f"{a['doctorName']} on {a['date']} at {a['time']}" for a in data[:2]])
                    if lang in ["tanglish", "ta-en"]:
                        reply = f"Ungalukku {len(data)} appointment(s) irukku: {a_summary}. Consult-kku 10 minutes munnadiye chellavum."
                    else:
                        reply = f"You have {len(data)} scheduled doctor appointment(s): {a_summary}. Please arrive 10 minutes prior to your consultation."
                else:
                    if lang in ["tanglish", "ta-en"]:
                        reply = "Ungalukku aduthu appointments edhuvum illai. Appointments tab-il pudhidhaaga book seiyyalaam."
                    else:
                        reply = "You have no upcoming doctor appointments scheduled. You can book an appointment anytime in the Appointments tab."
                return reply, cls._build_breakdown(query, lang, mode)

            elif tool_name == "change_user_language_preference":
                l_code = tool_result.get("language", "en")
                if lang in ["tanglish", "ta-en"]:
                    reply = f"Unga language preference {l_code}-kku maatrathukku vetrikaramaaga save aayiduchu."
                else:
                    reply = f"Your language preference has been updated to {l_code}. All interface labels and Copilot answers will now use this language."
                return reply, cls._build_breakdown(query, lang, mode)

        # Check if external AI provider is configured (e.g. GEMINI_API_KEY)
        if settings.GEMINI_API_KEY and settings.AI_PROVIDER == "gemini":
            try:
                length_instruction = (
                    "Provide a SHORT AND SWEET response of 2 to 5 short, friendly sentences using simple everyday English. "
                    "Do NOT use long paragraphs. Do NOT repeat the user's question. "
                    if mode in ["simple", "short"] else
                    "Provide a helpful explanation with clear sections and safe next steps. Keep language patient-friendly."
                )

                system_prompt = (
                    "You are AI Health Copilot, a professional and compassionate healthcare educational assistant. "
                    "You answer healthcare-related queries only. "
                    "Follow strict clinical boundaries: NEVER diagnose, NEVER change prescription doses, "
                    "NEVER guess unclear drug names or dosages (say 'Unable to read clearly — please confirm with your pharmacist or prescriber'), "
                    "and communicate uncertainty appropriately. "
                    f"{length_instruction} "
                    f"Reply in language: {lang}. "
                    f"{patient_context} {rag_context} {doc_context}"
                )

                async with httpx.AsyncClient(timeout=15.0) as client:
                    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
                    payload = {
                        "contents": [{"parts": [{"text": f"{system_prompt}\n\nPatient Query: {query}"}]}]
                    }
                    resp = await client.post(gemini_url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                        return text, cls._build_breakdown(query, lang, mode)
            except Exception as e:
                logger.warning(f"External AI provider call failed, falling back to local RAG knowledge engine: {e}")

        # Local Multilingual Medical RAG Knowledge Engine (Concise 2–5 sentences by default)
        if "hba1c" in q_lower or "blood sugar" in q_lower or "glucose" in q_lower or "diabetes" in q_lower:
            if lang == "ta":
                reply = "HbA1c சோதனை என்பது கடந்த 2 முதல் 3 மாதங்களில் உங்கள் சராசரி இரத்த சர்க்கரை அளவை அளவிடும் ஒரு முக்கியமான பரிசோதனை ஆகும். நீரிழிவு நோயாளிகளுக்கு இது 7.0% க்கும் குறைவாக இருப்பது பொதுவான இலக்காகும். உங்கள் மருத்துவர் உங்கள் அறிக்கையை ஆய்வு செய்து தகுந்த உணவு மற்றும் மருந்து ஆலோசனைகளை வழங்குவார்."
            elif lang in ["tanglish", "ta-en"]:
                reply = "HbA1c test unga kadaisi 2-3 months-oda average blood sugar level-ai kaattugiradhu. Diabetes control-kku idhu 7.0%-kku kuraivaaga iruppadhu nalladhu. Unga doctor-idam indha report-ai kaatti diet matrum marundhu aalosanai perungal."
            elif lang == "hi":
                reply = "HbA1c परीक्षण पिछले 2 से 3 महीनों में आपके औसत रक्त शर्करा (ब्लड शुगर) स्तर को दर्शाता है। सामान्यतः मधुमेह प्रबंधन के लिए 7.0% से कम का लक्ष्य सुरक्षित माना जाता है। कृपया अपने चिकित्सक से परामर्श करें जो आपकी जांच रिपोर्ट के आधार पर उचित मार्गदर्शन करेंगे।"
            elif lang == "te":
                reply = "HbA1c పరీక్ష గత 2 నుండి 3 నెలల్లో మీ సగటు రక్తంలో చక్కెర స్థాయిని కొలుస్తుంది. సాధారణంగా మధుమేహం ఉన్నవారికి ఇది 7.0% కంటే తక్కువగా ఉండటం మంచిది. సరైన ఆహారం మరియు మందుల సలహా కోసం మీ వైద్యుడిని సంప్రదించండి."
            else:
                reply = "HbA1c measures your average blood glucose levels over the past 2 to 3 months. For most adults managing diabetes, a target below 7.0% is commonly recommended by WHO and ICMR guidelines. Please review this result with your doctor, who can interpret it alongside your daily routine and medications."

        elif "pressure" in q_lower or "bp" in q_lower or "hypertension" in q_lower:
            if lang == "ta":
                reply = "ஆரோக்கியமான இரத்த அழுத்தம் பொதுவாக 120/80 mmHg க்கும் குறைவாக இருக்கும். குறைந்த உப்பு உணவு மற்றும் வழக்கமான உடற்பயிற்சி இரத்த அழுத்தத்தை சீராக வைக்க உதவுகிறது. உங்கள் இரத்த அழுத்த அளவுகளைத் தொடர்ந்து பதிவு செய்து மருத்துவரிடம் காண்பிக்கவும்."
            elif lang in ["tanglish", "ta-en"]:
                reply = "Normal resting blood pressure 120/80 mmHg-kku kuraivaaga iruppadhu nalladhu. Uppu kuraippadhum, daily walking povadhum BP-yai control-la vaikka udhavum. Unga BP readings-ai continue-aaga track seidhu doctor-kitta kaattunga."
            elif lang == "hi":
                reply = "एक स्वस्थ वयस्क का सामान्य रक्तचाप 120/80 mmHg के आसपास होता है। नमक का कम सेवन और नियमित सैर इसे नियंत्रित रखने में सहायक होती है। यदि आपका रक्तचाप बढ़ा हुआ है, तो अपने डॉक्टर से जांच अवश्य कराएं।"
            elif lang == "te":
                reply = "ఆరోగ్యకరమైన రక్తపోటు సాధారణంగా 120/80 mmHg కింద ఉంటుంది. ఉప్పును తగ్గించడం మరియు రోజువారీ వ్యాయామం దీనిని అదుపులో ఉంచుతాయి. మీ రీడింగులను ట్రాక్ చేసి మీ వైద్యుడికి చూపించండి."
            else:
                reply = "A standard healthy resting blood pressure is generally below 120/80 mmHg according to clinical guidelines. Managing dietary sodium, staying well-hydrated, and taking prescribed medications on time are key habits. If your reading stays high, please discuss it with your healthcare provider."

        elif "fever" in q_lower or "headache" in q_lower:
            if lang == "ta":
                reply = "காய்ச்சல் மற்றும் தலைவலி பொதுவாக வைரஸ் தொற்று அல்லது நீர்ச்சத்து குறைவினால் ஏற்படலாம். போதுமான ஓய்வு எடுத்து அதிக திரவங்களை அருந்தவும். காய்ச்சல் 3 நாட்களுக்கு மேல் நீடித்தால் அல்லது தீவிரமடைந்தால் மருத்துவரை அணுகவும்."
            elif lang in ["tanglish", "ta-en"]:
                reply = "Lessaana fever matrum thalaivali viral infection alladhu dehydration-naala varalaam. Nalla rest eduthu, niraiya thanni kudinga. Fever 3 naatkalukku mela irundhaa doctor-ai consult pannunga."
            elif lang == "hi":
                reply = "बुखार और सिरदर्द अक्सर वायरल संक्रमण या पानी की कमी से होते हैं। भरपूर आराम करें और पर्याप्त पानी पिएं। यदि बुखार 3 दिनों से अधिक रहे या तेज हो, तो तुरंत डॉक्टर से परामर्श लें।"
            elif lang == "te":
                reply = "జ్వరం మరియు తలనొప్పి సాధారణంగా వైరల్ ఇన్ఫెక్షన్ లేదా నిర్జలీకరణం వల్ల రావచ్చు. తగినంత విశ్రాంతి తీసుకోండి మరియు ద్రవపదార్థాలు తాగండి. జ్వరం 3 రోజుల కంటే ఎక్కువ ఉంటే వైద్యుడిని సంప్రదించండి."
            else:
                reply = "Mild fever and headache are frequently caused by common viral infections or dehydration. Rest, staying hydrated with water or fluids, and resting in a cool environment are safe first steps. If the fever exceeds 102°F (39°C) or lasts more than 3 days, please see a doctor."

        elif "sleep" in q_lower or "insomnia" in q_lower:
            if lang in ["tanglish", "ta-en"]:
                reply = "Regular-aana sleep time maintain pannunga, thoonguradhukku 1 hour munnadi mobile use panradhai thavirunga. Kaappi/tea maalai nerathil thavirkkavum. Problem continue aanaal doctor-idam aalosanai peravum."
            else:
                reply = "Keep a consistent sleep schedule, reduce caffeine later in the day, and create a relaxing bedtime routine. Limit screen time for at least an hour before bed. If sleep problems continue or affect daily life, speak with a healthcare professional."

        elif "water" in q_lower or "hydration" in q_lower:
            if lang in ["tanglish", "ta-en"]:
                reply = "Daily 2 mudhal 2.5 liters thanni kudipudhu unga kidney matrum BP regulation-kku romba nalladhu. Neenga active-aaga irundhaal innum konjam adhigamaaga kudikkavum."
            else:
                reply = "Most healthy adults benefit from drinking about 2 to 2.5 liters of water daily. Staying hydrated supports kidney health, blood pressure regulation, and energy levels. Adjust your intake if you are active or if your doctor has given you specific fluid guidelines."

        elif "prescription" in q_lower or "medication" in q_lower or "dose" in q_lower:
            reply = "Always take your medicines exactly as prescribed by your doctor and pharmacist. Never stop, start, or change a medication dosage without consulting your clinician first. If any label or instruction is unclear, confirm it directly with your pharmacist before taking it."

        elif "report" in q_lower or "blood test" in q_lower or "lab" in q_lower:
            reply = "Your report shows laboratory values that reflect your physiological baseline. An out-of-range value does not confirm a disease on its own, as test results vary based on hydration, fasting, and laboratory reference standards. Please discuss the findings with your doctor for complete interpretation."

        else:
            if lang == "ta":
                reply = "உங்கள் நலவாழ்வு கேள்விக்கு நன்றி. மருத்துவக் கண்ணோட்டத்தில் உங்கள் அறிகுறிகளைக் கண்காணித்து, தேவைப்படும்போது உங்கள் குடும்ப மருத்துவரை அணுகுவது பாதுகாப்பான வழியாகும்."
            elif lang in ["tanglish", "ta-en"]:
                reply = "Unga health kelvikku nandri. Unga arikurigalai kavanithu, thevaipadum pothu unga doctor-ai consult panradhu thaan safe-aana vazhi."
            elif lang == "hi":
                reply = "आपके स्वास्थ्य प्रश्न के लिए धन्यवाद। अपने लक्षणों पर ध्यान दें और किसी भी निरंतर समस्या के लिए अपने चिकित्सक से परामर्श लें।"
            elif lang == "te":
                reply = "మీ ఆరోగ్య ప్రశ్నకు ధన్యవాదాలు. మీ ఆరోగ్య సంరక్షణ కోసం మీ వైద్యుడిని సంప్రదించి అవసరమైన పరీక్షలు చేయించుకోవడం సురక్షితమైన మార్గం."
            else:
                reply = "Thank you for reaching out with your health question. Maintaining healthy daily habits, resting, staying hydrated, and discussing persistent questions with your doctor are the best steps. Feel free to upload a report or prescription for a personalized summary."

        breakdown = cls._build_breakdown(query, lang, mode)
        return reply, breakdown

        breakdown = cls._build_breakdown(query, lang, mode)
        return reply, breakdown

    @classmethod
    def _format_document_response(
        cls,
        doc_analysis: Dict[str, Any],
        lang: str,
        mode: str
    ) -> (str, Dict[str, Any]):
        """
        Formats medical report or prescription extraction into a concise, safe response.
        Enforces prescription uncertainty rule:
        'Unable to read clearly — please confirm with your pharmacist or prescriber'
        """
        doc_type = doc_analysis.get("documentType", "report")

        if doc_type == "prescription":
            medicines = doc_analysis.get("medicines", [])
            has_uncertain = doc_analysis.get("hasUncertainText", False)

            if not medicines:
                reply = "Unable to read clearly — please confirm with your pharmacist or prescriber. I could not reliably extract medicine names or dosage instructions from this prescription."
            else:
                med_lines = []
                for m in medicines[:4]:
                    name = m.get("name") or "Unable to read clearly — please confirm with your pharmacist or prescriber"
                    dosage = m.get("dosage") or m.get("strength") or "Unable to read clearly — please confirm with your pharmacist or prescriber"
                    instructions = m.get("instructions") or "Follow prescriber's directions"
                    med_lines.append(f"• {name} ({dosage}): {instructions}")

                uncertain_warning = (
                    "\n\n*Note*: If any medicine name or strength is unclear, please confirm with your pharmacist or prescriber before taking it."
                    if has_uncertain else ""
                )

                reply = (
                    f"I found the following medication information in your prescription:\n\n"
                    f"{chr(10).join(med_lines)}\n\n"
                    f"Please follow your prescriber's exact instructions.{uncertain_warning}"
                )

            breakdown = {
                "documentType": "Prescription",
                "extractedMedicines": medicines,
                "safetyRule": "Never guess uncertain drug names or dosages. Pharmacist verification mandatory."
            }
            return reply, breakdown

        else:
            # Lab Report Analysis
            lab_results = doc_analysis.get("labResults", [])
            abnormal_count = doc_analysis.get("abnormalCount", 0)

            if lab_results:
                result_lines = []
                for r in lab_results[:4]:
                    test = r.get("testName") or r.get("name") or "Lab Test"
                    val = r.get("result") or r.get("value") or "—"
                    unit = r.get("unit") or ""
                    ref = r.get("referenceRange") or r.get("reference") or "Standard Range"
                    flag = f" [{r.get('flag')}]" if r.get('flag') and r.get('flag') != "normal" else ""
                    result_lines.append(f"• {test}: {val} {unit} (Ref: {ref}){flag}")

                reply = (
                    f"Your medical report has been processed. Here are the key findings:\n\n"
                    f"{chr(10).join(result_lines)}\n\n"
                    f"This report shows values based on the laboratory's printed reference ranges. "
                    f"Values slightly outside standard ranges can happen for several reasons and do not confirm a condition on their own. "
                    f"Please discuss these results with your doctor alongside your symptoms."
                )
            else:
                reply = (
                    "Your report text has been extracted and reviewed. "
                    "The findings reflect your current laboratory readings. "
                    "Please discuss the report with your doctor, who can interpret each parameter in the context of your complete health history."
                )

            breakdown = {
                "documentType": "Medical Report",
                "extractedResults": lab_results,
                "abnormalFindings": abnormal_count
            }
            return reply, breakdown

    @classmethod
    def _build_breakdown(cls, query: str, lang: str, mode: str) -> Dict[str, Any]:
        return {
            "possibleEtiologies": [
                "Physiological lifestyle adaptations or metabolic baseline fluctuations",
                "Self-limiting viral or environmental mucosal reactions"
            ],
            "questionsForDoctor": [
                "What target biomarker intervals are recommended specifically for my medical profile?",
                "Are follow-up blood panels indicated within the next 4–8 weeks?",
                "Could any of my current daily medications or supplements interact with these symptoms?"
            ],
            "safeNextSteps": [
                "Maintain consistent resting hydration and track symptom patterns in your VitaCare Timeline.",
                "Do not start, stop, or modify prescription medications without your clinician's direct guidance.",
                "Seek emergency care (Call 112) if you experience severe chest pain, shortness of breath, or sudden weakness."
            ]
        }
