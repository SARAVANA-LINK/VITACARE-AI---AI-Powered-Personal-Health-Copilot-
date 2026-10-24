const db = require('../db');
const medicalKnowledgeService = require('./medicalKnowledgeService');

// Multi-language Clinical AI Response Templates & Translators
const AI_LOCALES = {
  en: {
    emergencyTitle: "⚠️ **URGENT MEDICAL SAFETY ALERT**",
    emergencyBody: "The symptoms you mentioned may indicate an acute medical emergency.\n\n• **Immediate Action**: Please stop using this chat and call emergency services immediately (112 in India, 911, or your local emergency number).\n• **Emergency SOS**: You can trigger the Emergency SOS button on your dashboard to instantly alert your configured emergency contacts and guardian.\n• AI Health Copilot is an educational health assistant, **NOT an emergency response system or a physician**.\n\nPlease seek professional emergency medical evaluation immediately.",
    emergencyDisclaimer: "AI Health Copilot is not a doctor and does not provide emergency medical diagnosis or treatment.",
    medScheduleHeader: "### 💊 Today's Medication Schedule\n\n",
    medScheduledFor: "scheduled for",
    instructions: "Instructions",
    statusLabel: "Status",
    statusTaken: "✅ Taken & Verified",
    statusMissed: "❌ Missed",
    statusUpcoming: "⏳ Upcoming",
    nextDose: "Next dose",
    activeMedsCount: "You have **{{count}}** active medicines in your profile:\n",
    noMedsToday: "You currently have **no medicines scheduled** for today. You can upload a new prescription or add a medicine from the Medicine Management tab.",
    medKnowledge: "Always take medications at the prescribed intervals with appropriate meals as directed by your prescribing physician.",
    glucoseHeader: "### 🩸 Your Blood Glucose Records\n\n",
    recordedOn: "Recorded on",
    statusIndicator: "Status",
    elevatedNote: "\n*Note*: Some glucose readings were slightly elevated compared to standard fasting reference ranges.",
    noGlucoseFound: "No blood glucose measurements found in your uploaded health reports yet.",
    glucoseKnowledge: "Standard fasting blood glucose ranges for non-diabetic adults are typically between 70 and 99 mg/dL. Values between 100–125 mg/dL indicate impaired fasting glucose, while 126 mg/dL or higher indicates diabetes.",
    hbHeader: "### 🔬 Your Hemoglobin Level (Hb)\n\n",
    stdRefRange: "Standard Reference Range",
    recordedDate: "Recorded Date",
    verifiedByPatient: "Verified by Patient",
    trendDiff: "Trend: Previous measurement was **{{prev}}** on {{date}} (Change: {{diff}}).",
    noHbFound: "No hemoglobin measurement has been recorded yet. Please upload a Complete Blood Count (CBC) report.",
    hbKnowledge: "Hemoglobin is the iron-rich protein in red blood cells that transports oxygen throughout the human body. Normal adult male ranges are generally 13.5–17.5 g/dL, and female ranges are 12.0–15.5 g/dL.",
    bpHeader: "### 💓 Your Blood Pressure Record (BP)\n\n",
    currentReading: "Current Reading",
    stdTarget: "Standard Target: < 120/80 mmHg",
    noBpFound: "No blood pressure readings are recorded in your account yet.",
    bpKnowledge: "Blood pressure consists of Systolic (pressure when heart beats) over Diastolic (pressure when heart rests between beats). Optimal resting blood pressure is under 120/80 mmHg.",
    compareHeader: "### 📊 Report Comparison Overview\n\nComparing your two most recent health records:\n",
    noOverlap: "Both reports represent different clinical panels. You can view full granular details in the **Compare Reports** view.\n",
    singleReport: "You currently have **1 uploaded report** ({{type}} from {{date}}).\nUpload a second report to perform an automatic side-by-side metric comparison!",
    noReports: "You have not uploaded any health reports yet. Click **+ ADD HEALTH REPORT** on your dashboard to begin.",
    summaryHeader: "### 🩺 Health Summary for {{name}}\n\nHere is your current health profile at a glance:\n",
    activeMedsSummary: "• **Active Medications**: {{count}} registered\n",
    todayDosesSummary: "• **Today's Scheduled Doses**: {{count}} events\n",
    reportsSummary: "• **Verified Health Reports**: {{count}} document(s)\n",
    vitalsSummary: "• **Tracked Vitals**: {{count}} measurement(s)\n",
    allergiesSummary: "• **Known Allergies**: {{allergies}}\n",
    disclaimer: "I'm an AI health assistant, not a doctor. I can help explain health information, but a qualified healthcare professional should make medical decisions."
  },

  ta: {
    emergencyTitle: "⚠️ **அவசர மருத்துவ பாதுகாப்பு எச்சரிக்கை**",
    emergencyBody: "நீங்கள் குறிப்பிட்ட அறிகுறிகள் தீவிர மருத்துவ அவசரநிலையைக் குறிக்கலாம்.\n\n• **உடனடி நடவடிக்கை**: தயவுசெய்து அவசர மருத்துவ சேவைகளை (112 / 108) உடனே அழைக்கவும்.\n• **அவசர SOS**: உங்கள் டாஷ்போர்டில் உள்ள அவசர SOS பொத்தானை அழுத்தி பாதுகாவலர் மற்றும் குடும்பத்தினருக்கு உடனடியாக எச்சரிக்கை அனுப்பலாம்.\n• AI Health Copilot என்பது ஒரு சுகாதார வழிகாட்டி மட்டுமே, **மருத்துவர் அல்ல**.\n\nஉடனடியாக மருத்துவ நிபுணரின் உதவியை நாடுங்கள்.",
    emergencyDisclaimer: "AI Health Copilot மருத்துவர் அல்ல, அவசர மருத்துவ சிகிச்சை அளிக்காது.",
    medScheduleHeader: "### 💊 இன்றைய மருந்து அட்டவணை\n\n",
    medScheduledFor: "திட்டமிடப்பட்ட நேரம்",
    instructions: "வழிமுறைகள்",
    statusLabel: "நிலை",
    statusTaken: "✅ உட்கொள்ளப்பட்டது (சரிபார்க்கப்பட்டது)",
    statusMissed: "❌ தவறவிடப்பட்டது",
    statusUpcoming: "⏳ வரவிருப்பது",
    nextDose: "அடுத்த மருந்து",
    activeMedsCount: "உங்கள் கணக்கில் **{{count}}** செயலில் உள்ள மருந்துகள் உள்ளன:\n",
    noMedsToday: "இன்று உட்கொள்ள வேண்டிய மருந்துகள் எதுவும் இல்லை. புதிய மருந்துச்சீட்டைப் பதிவேற்றலாம்.",
    medKnowledge: "மருத்துவர் பரிந்துரைத்தபடி குறிப்பிட்ட நேரத்தில் உணவோடு அல்லது உணவுக்குப் பின் தவறாமல் மருந்துகளை உட்கொள்ளவும்.",
    glucoseHeader: "### 🩸 உங்கள் இரத்த சர்க்கரை அளவீடுகள் (Blood Glucose)\n\n",
    recordedOn: "பதிவு செய்த தேதி",
    statusIndicator: "நிலை",
    elevatedNote: "\n*குறிப்பு*: சில சர்க்கரை அளவீடுகள் இயல்பான வரம்பை விட சற்று அதிகமாக உள்ளன.",
    noGlucoseFound: "உங்கள் மருத்துவ அறிக்கைகளில் இரத்த சர்க்கரை அளவீடுகள் இன்னும் இல்லை.",
    glucoseKnowledge: "வெறும் வயிற்றில் இரத்த சர்க்கரை அளவு 70-99 mg/dL இருப்பது இயல்பானது. 100-125 mg/dL என்பது முன்-நீரிழிவு நிலையையும், 126 mg/dL அல்லது அதற்கு மேல் இருப்பது நீரிழிவையும் குறிக்கும்.",
    hbHeader: "### 🔬 உங்கள் ஹீமோகுளோபின் அளவு (Hemoglobin - Hb)\n\n",
    stdRefRange: "நிலையான குறிப்பு வரம்பு",
    recordedDate: "பதிவு செய்த தேதி",
    verifiedByPatient: "நோயாளியால் சரிபார்க்கப்பட்டது",
    trendDiff: "போக்கு: முந்தைய அளவீடு {{date}} அன்று **{{prev}}** ஆக இருந்தது (மாற்றம்: {{diff}}).",
    noHbFound: "ஹீமோகுளோபின் அளவீடு இன்னும் பதிவு செய்யப்படவில்லை. முழு இரத்த பரிசோதனை (CBC) அறிக்கையைப் பதிவேற்றவும்.",
    hbKnowledge: "ஹீமோகுளோபின் என்பது இரத்த சிவப்பணுக்களில் உள்ள இரும்புச்சத்து நிறைந்த புரதமாகும், இது உடலெங்கும் ஆக்ஸிஜனைக் கொண்டு செல்கிறது. ஆண்களுக்கு 13.5–17.5 g/dL, பெண்களுக்கு 12.0–15.5 g/dL இயல்பான அளவாகும்.",
    bpHeader: "### 💓 உங்கள் இரத்த அழுத்த அளவீடு (Blood Pressure - BP)\n\n",
    currentReading: "தற்போதைய அளவீடு",
    stdTarget: "நிலையான இலக்கு: < 120/80 mmHg",
    noBpFound: "உங்கள் கணக்கில் இரத்த அழுத்த அளவீடுகள் எதுவும் இல்லை.",
    bpKnowledge: "இரத்த அழுத்தம் என்பது சிஸ்டாலிக் மற்றும் டயஸ்டாலிக் ஆகியவற்றைக் குறிக்கும். சிறந்த ஓய்வு இரத்த அழுத்தம் 120/80 mmHg-க்கு கீழ் இருக்க வேண்டும்.",
    compareHeader: "### 📊 மருத்துவ ஆய்வக அறிக்கைகள் ஒப்பீடு\n\nஉங்கள் சமீபத்திய இரண்டு அறிக்கைகளின் ஒப்பீடு:\n",
    noOverlap: "இரண்டு அறிக்கைகளும் வெவ்வேறு சோதனைகளைக் குறிக்கின்றன. முழு விவரங்களை **அறிக்கைகள் ஒப்பீடு** பிரிவில் காணலாம்.\n",
    singleReport: "தற்போது **1 அறிக்கை** மட்டுமே உள்ளது ({{type}} - {{date}}).\nஇரண்டாவது அறிக்கையைப் பதிவேற்றினால் தானாக ஒப்பிட்டுப் பார்க்கலாம்!",
    noReports: "மருத்துவ அறிக்கைகள் எதுவும் பதிவேற்றப்படவில்லை. டாஷ்போர்டில் **+ மருத்துவ அறிக்கை சேர்** பொத்தானை அழுத்தவும்.",
    summaryHeader: "### 🩺 {{name}} அவர்களின் சுகாதார சுருக்கம்\n\nஉங்கள் தற்போதைய ஆரோக்கிய சுயவிவரம்:\n",
    activeMedsSummary: "• **செயலில் உள்ள மருந்துகள்**: {{count}} பதிவு செய்யப்பட்டுள்ளன\n",
    todayDosesSummary: "• **இன்றைய திட்டமிடப்பட்ட மருந்துகள்**: {{count}} நிகழ்வுகள்\n",
    reportsSummary: "• **சரிபார்க்கப்பட்ட அறிக்கைகள்**: {{count}} ஆவணங்கள்\n",
    vitalsSummary: "• **கண்காணிக்கப்படும் அளவீடுகள்**: {{count}} அளவீடுகள்\n",
    allergiesSummary: "• **தெரிந்த ஒவ்வாமைகள்**: {{allergies}}\n",
    disclaimer: "நான் ஒரு AI சுகாதார உதவியாளர், மருத்துவர் அல்ல. மருத்துவ முடிவுகளை உங்கள் மருத்துவரிடம் ஆலோசிக்கவும்."
  },

  te: {
    emergencyTitle: "⚠️ **అత్యవసర వైద్య భద్రతా హెచ్చరిక**",
    emergencyBody: "మీరు పేర్కొన్న లక్షణాలు తీవ్రమైన వైద్య అత్యవసర పరిస్థితిని సూచించవచ్చు.\n\n• **తక్షణ చర్య**: దయచేసి వెంటనే అత్యవసర సేవలకు (112 / 108) కాల్ చేయండి.\n• **ఎమర్జెన్సీ SOS**: మీ డ్యాష్‌బోర్డ్‌లోని ఎమర్జెన్సీ SOS బటన్‌ను నొక్కి సంరక్షకులకు తక్షణమే హెచ్చరిక పంపవచ్చు.\n• AI Health Copilot కేవలం ఆరోగ్య సహాయకుడు మాత్రమే, **వైద్యుడు కాదు**.\n\nవెంటనే వైద్యుడిని సంప్రదించండి.",
    emergencyDisclaimer: "AI Health Copilot వైద్యుడు కాదు, అత్యవసర చికిత్స అందించదు.",
    medScheduleHeader: "### 💊 నేటి మందుల షెడ్యూల్\n\n",
    medScheduledFor: "షెడ్యూల్ సమయం",
    instructions: "సూచనలు",
    statusLabel: "స్థితి",
    statusTaken: "✅ తీసుకున్నారు (ధృవీకరించబడింది)",
    statusMissed: "❌ మిస్ అయింది",
    statusUpcoming: "⏳ రాబోయేది",
    nextDose: "తదుపరి మందు",
    activeMedsCount: "మీ ఖాతాలో **{{count}}** యాక్టివ్ మందులు ఉన్నాయి:\n",
    noMedsToday: "ఈ రోజుకు మందులు ఏవీ షెడ్యూల్ చేయబడలేదు. కొత్త ప్రిస్క్రిప్షన్‌ను అప్‌లోడ్ చేయవచ్చు.",
    medKnowledge: "వైద్యుడు సూచించిన విధంగా సమయానికి భోజనంతో పాటు మందులను క్రమం తప్పకుండా తీసుకోండి.",
    glucoseHeader: "### 🩸 మీ బ్లడ్ గ్లూకోజ్ రికార్డులు (Blood Glucose)\n\n",
    recordedOn: "నమోదైన తేదీ",
    statusIndicator: "స్థితి",
    elevatedNote: "\n*గమనిక*: కొన్ని చక్కెర కొలతలు సాధారణ పరిధి కంటే కొద్దిగా ఎక్కువగా ఉన్నాయి.",
    noGlucoseFound: "మీ వైద్య నివేదికలలో బ్లడ్ షుగర్ కొలతలు ఇంకా నమోదు కాలేదు.",
    glucoseKnowledge: "ఖాళీ కడుపుతో రక్తంలో చక్కెర సాధారణంగా 70-99 mg/dL ఉండాలి. 100-125 mg/dL ఉంటే ప్రీ-డయాబెటిస్ మరియు 126 mg/dL లేదా అంతకంటే ఎక్కువ ఉంటే డయాబెటిస్ అని సూచిస్తుంది.",
    hbHeader: "### 🔬 మీ హిమోగ్లోబిన్ స్థాయి (Hemoglobin - Hb)\n\n",
    stdRefRange: "ప్రామాణిక సూచన పరిధి",
    recordedDate: "నమోదైన తేదీ",
    verifiedByPatient: "రోగి ద్వారా ధృవీకరించబడింది",
    trendDiff: "మార్పు: మునుపటి కొలత {{date}} నాడు **{{prev}}** గా ఉంది (తేడా: {{diff}}).",
    noHbFound: "హిమోగ్లోబిన్ కొలత ఇంకా నమోదు కాలేదు. పూర్తి రక్త పరీక్ష (CBC) నివేదికను అప్‌లోడ్ చేయండి.",
    hbKnowledge: "హిమోగ్లోబిన్ అనేది ఎర్ర రక్త కణాలలో ఉండే ప్రోటీన్, ఇది శరీరమంతటా ఆక్సిజన్‌ను మోసుకెళుతుంది. పురుషులకు 13.5–17.5 g/dL మరియు మహిళలకు 12.0–15.5 g/dL సాధారణ పరిధి.",
    bpHeader: "### 💓 మీ రక్తపోటు రికార్డు (Blood Pressure - BP)\n\n",
    currentReading: "ప్రస్తుత కొలత",
    stdTarget: "ప్రామాణిక లక్ష్యం: < 120/80 mmHg",
    noBpFound: "మీ ఖాతాలో రక్తపోటు కొలతలు ఏవీ నమోదు కాలేదు.",
    bpKnowledge: "రక్తపోటులో సిస్టోలిక్ మరియు డయాస్టోలిక్ ఉంటాయి. సాధారణ రక్తపోటు 120/80 mmHg కంటే తక్కువగా ఉండాలి.",
    compareHeader: "### 📊 ల్యాబ్ నివేదికల పోలిక\n\nమీ ఇటీవలి రెండు నివేదికల పోలిక:\n",
    noOverlap: "రెండు నివేదికలలో వేర్వేరు పరీక్షలు ఉన్నాయి. పూర్తి వివరాలను **నివేదికల పోలిక** వీక్షణలో చూడవచ్చు.\n",
    singleReport: "ప్రస్తుతం **1 నివేదిక** మాత్రమే ఉంది ({{type}} - {{date}}).\nరెండవ నివేదికను అప్‌లోడ్ చేసి ఆటోమేటిక్‌గా పోల్చండి!",
    noReports: "ఆరోగ్య నివేదికలు ఏవీ అప్‌లోడ్ చేయలేదు.",
    summaryHeader: "### 🩺 {{name}} గారి ఆరోగ్య సారాంశం\n\nమీ ప్రస్తుత ఆరోగ్య ప్రొఫైల్:\n",
    activeMedsSummary: "• **యాక్టివ్ మందులు**: {{count}} నమోదయ్యాయి\n",
    todayDosesSummary: "• **నేటి మందుల మోతాదులు**: {{count}} ఈవెంట్‌లు\n",
    reportsSummary: "• **ధృవీకరించిన నివేదికలు**: {{count}} పత్రాలు\n",
    vitalsSummary: "• **ట్రాక్ చేసిన కొలతలు**: {{count}} కొలతలు\n",
    allergiesSummary: "• **అలెర్జీలు**: {{allergies}}\n",
    disclaimer: "నేను AI ఆరోగ్య సహాయకుడిని, డాక్టర్‌ని కాదు. వైద్య నిర్ణయాలకు మీ వైద్యుడిని సంప్రదించండి."
  },

  hi: {
    emergencyTitle: "⚠️ **तत्काल चिकित्सा सुरक्षा चेतावनी**",
    emergencyBody: "आपके द्वारा बताए गए लक्षण गंभीर आपातकालीन स्थिति का संकेत हो सकते हैं।\n\n• **तत्काल कार्रवाई**: कृपया तुरंत आपातकालीन सेवाओं (112 / 108) को कॉल करें।\n• **आपातकालीन SOS**: अभिभावक को तुरंत सतर्क करने के लिए डैशबोर्ड पर SOS बटन दबाएं।\n• AI Health Copilot केवल एक स्वास्थ्य सहायक है, **डॉक्टर नहीं**।\n\nकृपया तुरंत डॉक्टर से संपर्क करें।",
    emergencyDisclaimer: "AI Health Copilot डॉक्टर नहीं है और आपातकालीन उपचार प्रदान नहीं करता है।",
    medScheduleHeader: "### 💊 आज का दवा शेड्यूल\n\n",
    medScheduledFor: "निर्धारित समय",
    instructions: "निर्देश",
    statusLabel: "स्थिति",
    statusTaken: "✅ ले ली गई (सत्यापित)",
    statusMissed: "❌ छूट गई",
    statusUpcoming: "⏳ आगामी",
    nextDose: "अगली दवा",
    activeMedsCount: "आपकी प्रोफ़ाइल में **{{count}}** सक्रिय दवाइयां हैं:\n",
    noMedsToday: "आज के लिए कोई दवा निर्धारित नहीं है। आप नया पर्चा अपलोड कर सकते हैं।",
    medKnowledge: "चिकित्सक के निर्देशानुसार भोजन के साथ या बाद में नियमित रूप से दवाएं लें।",
    glucoseHeader: "### 🩸 आपके ब्लड ग्लूकोज रिकॉर्ड (Blood Glucose)\n\n",
    recordedOn: "दर्ज की गई तारीख",
    statusIndicator: "स्थिति",
    elevatedNote: "\n*नोट*: कुछ ग्लूकोज रीडिंग सामान्य सीमा से थोड़ी अधिक हैं।",
    noGlucoseFound: "आपकी रिपोर्ट में ब्लड शुगर का कोई माप अभी नहीं मिला है।",
    glucoseKnowledge: "खाली पेट ब्लड शुगर 70-99 mg/dL सामान्य है। 100-125 mg/dL प्री-डायबिटीज और 126 mg/dL या अधिक डायबिटीज का संकेत है।",
    hbHeader: "### 🔬 आपका हीमोग्लोबिन स्तर (Hemoglobin - Hb)\n\n",
    stdRefRange: "मानक संदर्भ सीमा",
    recordedDate: "दर्ज तारीख",
    verifiedByPatient: "रोगी द्वारा सत्यापित",
    trendDiff: "बदलाव: पिछला माप {{date}} को **{{prev}}** था (अंतर: {{diff}})।",
    noHbFound: "हीमोग्लोबिन माप दर्ज नहीं है। कृपया सीबीसी (CBC) रिपोर्ट अपलोड करें।",
    hbKnowledge: "हीमोग्लोबिन लाल रक्त कोशिकाओं में ऑक्सीजन ले जाने वाला प्रोटीन है। पुरुषों के लिए 13.5–17.5 g/dL और महिलाओं के लिए 12.0–15.5 g/dL सामान्य सीमा है।",
    bpHeader: "### 💓 आपका रक्तचाप रिकॉर्ड (Blood Pressure - BP)\n\n",
    currentReading: "वर्तमान माप",
    stdTarget: "मानक लक्ष्य: < 120/80 mmHg",
    noBpFound: "रक्तचाप का कोई माप दर्ज नहीं है।",
    bpKnowledge: "रक्तचाप सिस्टोलिक और डायस्टोलिक से बना होता है। सामान्य रक्तचाप 120/80 mmHg से कम होना चाहिए।",
    compareHeader: "### 📊 लैब रिपोर्ट तुलना अवलोकन\n\nआपकी पिछली दो रिपोर्टों की तुलना:\n",
    noOverlap: "दोनों रिपोर्टों में अलग-अलग परीक्षण हैं। पूरी जानकारी **रिपोर्ट तुलना** में देखें।\n",
    singleReport: "वर्तमान में केवल **1 रिपोर्ट** उपलब्ध है ({{type}} - {{date}})।\nदूसरी रिपोर्ट अपलोड करके तुलना करें!",
    noReports: "कोई स्वास्थ्य रिपोर्ट अपलोड नहीं की गई है।",
    summaryHeader: "### 🩺 {{name}} का स्वास्थ्य सारांश\n\nआपकी वर्तमान स्वास्थ्य प्रोफ़ाइल:\n",
    activeMedsSummary: "• **सक्रिय दवाइयां**: {{count}} पंजीकृत\n",
    todayDosesSummary: "• **आज की निर्धारित खुराक**: {{count}} घटनाएं\n",
    reportsSummary: "• **सत्यापित रिपोर्टें**: {{count}} दस्तावेज़\n",
    vitalsSummary: "• **ट्रैक किए गए बायोमार्कर**: {{count}} माप\n",
    allergiesSummary: "• **एलर्जी**: {{allergies}}\n",
    disclaimer: "मैं एक AI स्वास्थ्य सहायक हूं, डॉक्टर नहीं। चिकित्सा निर्णयों के लिए कृपया अपने डॉक्टर से परामर्श लें।"
  }
};

class AiCopilotService {
  /**
   * Invokes Google Gemini Generative AI API with clinical grounding, RAG context, and safety rules
   */
  async callGemini(systemPrompt, conversationHistory = [], userMessage = '', maxTokens = 450) {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    if (!apiKey) {
      console.warn('GEMINI_API_KEY not configured in environment.');
      return null;
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Format multi-turn conversation history into alternating user/model contents sequence
    const contents = [];
    if (Array.isArray(conversationHistory)) {
      for (const item of conversationHistory) {
        if (!item || !item.content || !item.content.trim()) continue;
        const role = (item.role === 'assistant' || item.role === 'model') ? 'model' : 'user';
        const text = item.content.split('\n\n---\n*')[0].trim();
        if (!text) continue;

        if (contents.length > 0 && contents[contents.length - 1].role === role) {
          contents[contents.length - 1].parts[0].text += '\n' + text;
        } else {
          contents.push({ role, parts: [{ text }] });
        }
      }
    }

    // Ensure conversation begins with a user turn
    while (contents.length > 0 && contents[0].role !== 'user') {
      contents.shift();
    }

    // Append the current user message
    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      contents[contents.length - 1].parts[0].text += '\n' + userMessage;
    } else {
      contents.push({ role: 'user', parts: [{ text: userMessage }] });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents,
          generationConfig: {
            temperature: 0.15,
            maxOutputTokens: maxTokens
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`Gemini API returned status ${response.status}:`, errText);
        return null;
      }

      const data = await response.json();
      const generated = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return generated ? generated.trim() : null;
    } catch (err) {
      clearTimeout(timeout);
      console.warn('Gemini API call failed, falling back to local clinical engine:', err.message);
      return null;
    }
  }

  /**
   * Deterministic check for whether a query is healthcare-related.
   */
  isMedicalQuery(query, documentContext = null) {
    if (documentContext) return true;
    if (!query || typeof query !== 'string') return false;
    const q = query.toLowerCase().trim();

    // Check greeting / intro
    if (/^(hi|hello|hey|namaste|vanakkam|good\s*(morning|afternoon|evening)|who\s+are\s+you|what\s+can\s+you\s+do|help\s*me)/i.test(q)) {
      return true;
    }

    const medicalKeywords = [
      'health', 'medical', 'medicine', 'medicines', 'medication', 'dose', 'dosage', 'prescription', 'pills', 'tablets', 'capsule',
      'schedule', 'intake', 'patient', 'doctor', 'hospital', 'clinic', 'nurse', 'pharmacist', 'pharmacy',
      'report', 'lab', 'test', 'blood', 'urine', 'cbc', 'hemoglobin', 'hb', 'hba1c', 'glucose', 'sugar', 'fbs', 'ppbs',
      'pressure', 'bp', 'systolic', 'diastolic', 'heart', 'pulse', 'spo2', 'oxygen', 'temperature', 'fever', 'chills',
      'cough', 'cold', 'flu', 'covid', 'infection', 'virus', 'bacteria', 'bacterium', 'antibiotic', 'pain', 'ache', 'headache',
      'stomach', 'nausea', 'vomit', 'diarrhea', 'constipation', 'dizzy', 'fatigue', 'tired', 'sleep', 'insomnia', 'water',
      'hydration', 'nutrition', 'diet', 'food', 'exercise', 'weight', 'bmi', 'cholesterol', 'lipid', 'ldl', 'hdl', 'triglyceride',
      'creatinine', 'kidney', 'liver', 'lft', 'alt', 'ast', 'bilirubin', 'thyroid', 'tsh', 't3', 't4', 'allergy', 'allergies',
      'asthma', 'breathing', 'breath', 'chest', 'stroke', 'emergency', 'sos', '112', '108', '911', 'wound', 'bleeding', 'rash',
      'tanglish', 'marunthu', 'maathirai', 'udambu', 'raththam', 'vali', 'maruthuvar',
      'document', 'upload', 'uploaded', 'attachment', 'scan', 'findings', 'biomarker', 'reading', 'vitals', 'summary', 'explain this', 'clarify'
    ];

    return medicalKeywords.some(kw => q.includes(kw));
  }

  /**
   * Main entrypoint to generate localized AI Health Copilot response.
   * @param {string} userId - Authenticated user ID
   * @param {string} userMessage - Natural language patient query
   * @param {string} mode - 'short' (default, 2-5 sentences) | 'explain' (1-2 paragraphs) | 'detailed' (deep clinical context)
   * @param {string} requestedLang - 'en' | 'ta' | 'te' | 'hi' | 'ml' | 'kn' | 'bn' | 'mr'
   * @param {Array} history - Optional recent conversation history
   * @param {Object} documentContext - Optional attached document extraction
   */
  async generateResponse(userId, userMessage, mode = 'short', requestedLang = null, history = null, documentContext = null) {
    const user = db.findById('users', userId);
    const lang = requestedLang || user?.preferredLanguage || 'en';
    const loc = AI_LOCALES[lang] || AI_LOCALES['en'];

    const normalizedMode = (mode === 'simple' || mode === 'short') ? 'short' 
      : (mode === 'standard' || mode === 'explain') ? 'explain' 
      : 'detailed';

    const query = (userMessage || '').toLowerCase();

    // 1. Strict Healthcare Scope Verification
    const isMedical = this.isMedicalQuery(userMessage, documentContext);
    if (!isMedical) {
      const redirectReply = "I'm your AI Health Copilot. I can help with health information, medical reports, prescriptions, and general healthcare guidance.";
      return {
        reply: redirectReply,
        mode: normalizedMode,
        language: lang,
        isOutOfScope: true,
        disclaimer: loc.disclaimer
      };
    }

    // 2. Critical Emergency Symptom Triage Check
    const emergencyKeywords = [
      'chest pain', 'heart attack', 'cannot breathe', 'severe shortness of breath',
      'stroke', 'sudden weakness', 'face drooping', 'slurred speech',
      'severe bleeding', 'unconscious', 'overdose', 'anaphylaxis', 'choking',
      'நெஞ்சு வலி', 'மூச்சுத் திணறல்', 'గుండె నొప్పి', 'శ్వాస ఆడకపోవడం',
      'നെഞ്ചുവേദന', 'ശ്വാസതടസ്സം', 'ಎದೆ ನೋವು', 'ಉಸಿರಾಟದ ತೊಂದರೆ',
      'सीने में दर्द', 'सांस लेने में तकलीफ', 'बुके ব্যথা', 'শ্বাসকষ্ট', 'छातीत दुखणे'
    ];
    const hasEmergencyKeywords = emergencyKeywords.some(kw => query.includes(kw));

    if (hasEmergencyKeywords) {
      return {
        reply: `${loc.emergencyTitle}\n\n${loc.emergencyBody}`,
        mode: normalizedMode,
        language: lang,
        contextUsed: { emergencyTriggered: true },
        hasEmergencyWarning: true,
        disclaimer: loc.emergencyDisclaimer
      };
    }

    // 3. RAG: Retrieve Relevant Authoritative Medical Knowledge
    const ragSources = medicalKnowledgeService.retrieveRelevantKnowledge(userMessage, 2);
    const ragContextStr = ragSources.length > 0 
      ? ragSources.map(s => `[SOURCE: ${s.sourceName} - ${s.title}]\n${s.snippet}`).join('\n\n')
      : 'Standard clinical reference guidelines.';

    // 4. Resolve Patient's Private Records (Strictly User Isolated)
    const profile = db.findOne('user_profiles', p => p.userId === userId);
    const reports = db.find('health_reports', r => r.userId === userId);
    const extractedValues = db.find('extracted_health_values', v => v.userId === userId);
    const vitals = db.find('vitals', v => v.userId === userId);
    const medicines = db.find('medicines', m => m.userId === userId && m.isActive);
    const today = new Date().toISOString().split('T')[0];
    const todaySchedules = db.find('medicine_schedules', s => s.userId === userId && s.scheduledDate === today);

    // 5. Multi-Turn Conversation History (isolated per user)
    let conversationHistory = [];
    if (Array.isArray(history) && history.length > 0) {
      conversationHistory = history.slice(-6);
    } else {
      const storedConvs = db.find('ai_conversations', c => c.userId === userId) || [];
      storedConvs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      conversationHistory = storedConvs.slice(-6).map(c => ({ role: c.role, content: c.content }));
    }

    // 6. Build Gemini Multimodal & Clinical System Prompt
    const languageNames = {
      en: 'English',
      ta: 'Tamil (தமிழ்)',
      te: 'Telugu (తెలుగు)',
      ml: 'Malayalam (മലയാളം)',
      kn: 'Kannada (ಕನ್ನಡ)',
      hi: 'Hindi (हिन्दी)',
      bn: 'Bengali (বাংলা)',
      mr: 'Marathi (मराठी)'
    };
    const targetLanguage = languageNames[lang] || 'English';

    const systemPrompt = `You are AI Health Copilot – an intelligent, empathetic, and clinically grounded medical AI assistant.

CRITICAL SCOPE DIRECTIVE:
You answer ONLY health, medical, prescription, laboratory report, and wellness questions.
If the user asks an unrelated question (e.g. sports, coding, capital of France, geography, finance, entertainment):
Reply PRECISELY with:
"I'm your AI Health Copilot. I can help with health information, medical reports, prescriptions, and general healthcare guidance."

RESPONSE LENGTH REQUIREMENTS:
- Mode "SHORT" (Default):
  * Keep your response usually between 2 to 5 short, friendly sentences.
  * Use simple everyday English (or the selected language).
  * Avoid unnecessary technical jargon.
  * Do not repeat the user's question.
  * Do not output long multi-paragraph essays.
- Mode "EXPLAIN" ("Explain More"):
  * Provide 1 to 2 focused paragraphs with bullet points for clarity.
- Mode "DETAILED" ("Detailed Explanation"):
  * Provide an in-depth clinical explanation with physiological context, reference ranges, and precautions.

PATIENT-FRIENDLY CLINICAL SAFETY GUIDELINES:
1. Educational Support Only: Explain health terms, test results, and prescriptions clearly. Do not provide a definitive diagnosis from a single result.
2. Uncertain Text Rule: Never guess an unclear medicine name, dose, or strength. If text is ambiguous or unreadable, advise: "Unable to read clearly — please confirm with your pharmacist or prescriber."
3. Medication Guidance: Never independently create, change, or recommend altering a prescription. Emphasize taking medicines as directed.
4. Emergency Guidance: If life-threatening symptoms appear, advise contacting emergency services immediately (112 in India, 911, or local emergency services).
5. Grounding: Ground all personal health answers strictly in the Patient Verified Health Records and RAG references below. Never hallucinate reports or records that do not exist.

AUTHORITATIVE MEDICAL KNOWLEDGE (RAG):
${ragContextStr}

PATIENT'S VERIFIED HEALTH CONTEXT (PRIVATE TO THIS PATIENT):
- Patient Name: ${user?.name || 'Patient'}
- Blood Group: ${user?.bloodGroup || 'Not specified'}
- Allergies: ${(profile?.allergies && profile.allergies.length > 0) ? (Array.isArray(profile.allergies) ? profile.allergies.join(', ') : profile.allergies) : 'None recorded'}
- Active Medications (${medicines.length}): ${medicines.map(m => `${m.name} (${m.dosage}, ${m.frequency})`).join('; ') || 'No active medications recorded'}
- Today's Dose Schedule (${todaySchedules.length}): ${todaySchedules.map(s => `${s.scheduledTime} - ${s.medicineName} (${s.dosage}) [Status: ${s.status}]`).join('; ') || 'No doses scheduled for today'}
- Recent Tracked Vitals (${vitals.length}): ${vitals.slice(-4).map(v => `${v.metricName}: ${v.value} ${v.unit} (Ref: ${v.referenceRange || 'Standard'})`).join('; ') || 'No vitals recorded'}
- Verified Diagnostic Reports (${reports.length}): ${reports.slice(-3).map(r => `${r.reportType} from ${r.labName} (${r.reportDate})`).join('; ') || 'No reports uploaded'}
- Extracted Lab Values (${extractedValues.length}): ${extractedValues.slice(-6).map(v => `${v.metricName}: ${v.value} ${v.unit || ''} (Ref: ${v.referenceRange || 'Standard'})`).join('; ') || 'None recorded'}
${documentContext ? `- Attached Document Findings: ${JSON.stringify(documentContext)}` : ''}

TARGET LANGUAGE: ${targetLanguage}.
RESPONSE MODE: ${normalizedMode.toUpperCase()}.
`;

    const maxTokens = normalizedMode === 'detailed' ? 650 : normalizedMode === 'explain' ? 400 : 250;
    const geminiReply = await this.callGemini(systemPrompt, conversationHistory, userMessage, maxTokens);

    if (geminiReply) {
      // Check if Gemini detected out-of-scope and returned redirect
      if (geminiReply.includes("I'm your AI Health Copilot. I can help with health information")) {
        return {
          reply: "I'm your AI Health Copilot. I can help with health information, medical reports, prescriptions, and general healthcare guidance.",
          mode: normalizedMode,
          language: lang,
          isOutOfScope: true,
          disclaimer: loc.disclaimer
        };
      }

      const finalReply = `${geminiReply}\n\n---\n*${loc.disclaimer}*`;
      const ragCitations = ragSources.map(s => `${s.sourceName}: ${s.title}`);

      return {
        reply: finalReply,
        mode: normalizedMode,
        language: lang,
        userDataCitations: ragCitations,
        ragSources: ragSources.map(s => ({ title: s.title, sourceName: s.sourceName, url: s.url })),
        contextUsed: {
          vitalsCount: vitals.length,
          reportsCount: reports.length,
          medicinesCount: medicines.length,
          ragCount: ragSources.length,
          aiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
        },
        disclaimer: loc.disclaimer
      };
    }

    // 7. Deterministic Clinical Fallback Engine
    return this.generateLocalFallback(userId, userMessage, lang, normalizedMode, ragSources, documentContext);
  }

  /**
   * Deterministic local clinical fallback engine when AI provider is offline or unreachable
   */
  generateLocalFallback(userId, userMessage, lang = 'en', mode = 'short', ragSources = [], documentContext = null) {
    const loc = AI_LOCALES[lang] || AI_LOCALES['en'];
    const query = (userMessage || '').toLowerCase();
    const user = db.findById('users', userId);
    const vitals = db.find('vitals', v => v.userId === userId);
    const medicines = db.find('medicines', m => m.userId === userId && m.isActive);
    const reports = db.find('health_reports', r => r.userId === userId);
    const extractedValues = db.find('extracted_health_values', v => v.userId === userId);
    const today = new Date().toISOString().split('T')[0];
    const todaySchedules = db.find('medicine_schedules', s => s.userId === userId && s.scheduledDate === today);

    // Non-healthcare query check
    if (!this.isMedicalQuery(userMessage, documentContext)) {
      return {
        reply: "I'm your AI Health Copilot. I can help with health information, medical reports, prescriptions, and general healthcare guidance.",
        mode,
        language: lang,
        isOutOfScope: true,
        disclaimer: loc.disclaimer
      };
    }

    let reply = '';
    const userDataCitations = [];

    // Document Context Query
    if (documentContext) {
      if (documentContext.documentType === 'prescription') {
        const rxMeds = documentContext.extractedData?.medicines || [];
        if (rxMeds.length > 0) {
          const names = rxMeds.map(m => `${m.medicineName} (${m.dosage || m.strength})`).join(', ');
          reply = `In your uploaded prescription, I found: ${names}. Please take them strictly according to your prescriber's directions. If any dose is unclear, verify with your pharmacist.`;
        } else {
          reply = "The uploaded prescription text was not clearly readable. Please verify your medication details directly with your pharmacist or doctor.";
        }
      } else {
        const findings = documentContext.extractedData?.findings || [];
        if (findings.length > 0) {
          reply = `In your uploaded ${documentContext.title || 'report'}, we extracted ${findings.length} biomarker(s). Please review the findings with your doctor for clinical interpretation.`;
        } else {
          reply = `Your uploaded document ${documentContext.title || ''} is saved in your private records. Please discuss any unusual results with your physician.`;
        }
      }
    }

    // Medicine Query
    if (query.includes('medicine') || query.includes('schedule') || query.includes('prescription') || query.includes('pill') || query.includes('tablet')) {
      if (todaySchedules.length > 0) {
        reply = `You have ${todaySchedules.length} dose(s) scheduled for today. For example, ${todaySchedules[0].medicineName} (${todaySchedules[0].dosage}) at ${todaySchedules[0].scheduledTime}. Please take medications as prescribed with meals.`;
      } else if (medicines.length > 0) {
        reply = `You have ${medicines.length} registered active medication(s) in your profile, including ${medicines[0].name} (${medicines[0].dosage}). None are specifically pending for today.`;
      } else {
        reply = "You do not have any active medicines or scheduled doses in your profile today. You can upload a new prescription anytime.";
      }
    }
    // Blood Test / Report Query
    else if (query.includes('report') || query.includes('blood test') || query.includes('lab') || query.includes('result') || query.includes('glucose') || query.includes('sugar')) {
      if (reports.length > 0) {
        const latest = reports[reports.length - 1];
        reply = `Your latest uploaded report is ${latest.reportType} from ${latest.labName} dated ${latest.reportDate}. Your documented values have been recorded in your profile. Please discuss any out-of-range findings with your doctor.`;
      } else {
        reply = "No health reports have been uploaded to your profile yet. You can attach a laboratory PDF or image using the attachment button to analyze your test results.";
      }
    }
    // Blood Pressure Query
    else if (query.includes('blood pressure') || query.includes('bp') || query.includes('hypertension')) {
      const bp = vitals.find(v => v.metricKey === 'blood_pressure');
      if (bp) {
        reply = `Your recorded blood pressure is ${bp.value} ${bp.unit} on ${bp.date}. A standard target resting blood pressure is below 120/80 mmHg. Maintain healthy hydration and consult your doctor for medical advice.`;
      } else {
        reply = "Normal resting blood pressure is typically below 120/80 mmHg. Blood pressure can vary with physical activity, stress, and hydration. If you experience dizziness or headaches, consult a healthcare provider.";
      }
    }
    // Sleep & Wellness
    else if (query.includes('sleep') || query.includes('hydration') || query.includes('water') || query.includes('diet') || query.includes('exercise')) {
      reply = "Keep a consistent sleep schedule of 7 to 9 hours nightly, drink 2 to 3 liters of water daily, and engage in regular physical activity. If sleep disturbances or fatigue persist, consult a healthcare professional.";
    }
    // General Medical Introduction / Question
    else {
      reply = `Hello! I am your AI Health Copilot. I can help explain medical terms, summarize your lab reports, review prescription instructions, and provide preventive health guidance. How may I assist your health today?`;
    }

    // Adapt for mode if user asks to explain more or detailed
    if (mode === 'explain') {
      reply += "\n\n• Always take medications with adequate water as directed.\n• Keep laboratory reference ranges in mind when reviewing test results.\n• Routine check-ups help detect subtle health changes early.";
    } else if (mode === 'detailed') {
      reply += "\n\nClinical Background:\nReference ranges reflect healthy population distributions and can vary across testing instruments. Biological factors such as age, fasting status, and hydration significantly impact metabolic measurements. Never alter medication regimens without explicit clinician consultation.";
    }

    return {
      reply: `${reply}\n\n---\n*${loc.disclaimer}*`,
      mode,
      language: lang,
      userDataCitations,
      ragSources: ragSources.map(s => ({ title: s.title, sourceName: s.sourceName, url: s.url })),
      disclaimer: loc.disclaimer
    };
  }
}

module.exports = new AiCopilotService();
