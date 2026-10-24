const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');

// Emergency Red Flag keywords and phrases
const EMERGENCY_RED_FLAGS = [
  'chest pain', 'chest pressure', 'radiating pain', 'crushing chest',
  'shortness of breath', 'difficulty breathing', 'gasping', 'cannot breathe',
  'slurred speech', 'facial drooping', 'face droop', 'arm weakness', 'numbness on one side',
  'stroke', 'heart attack', 'unconscious', 'fainted', 'seizure',
  'coughing blood', 'vomiting blood', 'severe bleeding',
  'sudden worst headache', 'thunderclap headache',
  'anaphylaxis', 'swelling of throat', 'throat closing', 'swollen lips and tongue',
  'suicidal', 'severe burns', 'poisoning'
];

function analyzeSymptoms(symptoms, duration, severity, context = '', fever = false) {
  const combinedText = `${symptoms} ${context}`.toLowerCase();
  
  // 1. Check for Emergency Red Flags
  const detectedRedFlags = EMERGENCY_RED_FLAGS.filter(flag => combinedText.includes(flag));
  const isEmergency = detectedRedFlags.length > 0 || (severity >= 9 && (combinedText.includes('pain') || combinedText.includes('breath')));

  let urgencyLevel = 'MONITOR_SELF_CARE';
  let recommendedFacility = 'Self-Care & At-Home Monitoring';
  let emergencyGuidance = null;

  if (isEmergency) {
    urgencyLevel = 'EMERGENCY_IMMEDIATE';
    recommendedFacility = 'Immediate Emergency Medical Services (Call 108 / 911 / 112) or Nearest Emergency Department';
    emergencyGuidance = {
      title: 'CRITICAL MEDICAL WARNING: Urgent Evaluation Required',
      detectedFlags: detectedRedFlags.length > 0 ? detectedRedFlags : ['Severe pain level (9+/10) requiring immediate emergency medical evaluation'],
      action: 'Do not wait or drive yourself. Call emergency medical dispatch (108 / 911 / 112) or have someone take you to the nearest Emergency Room immediately.',
      sosAvailable: true
    };
  } else if (severity >= 7 || combinedText.includes('fever') && duration.includes('week') || combinedText.includes('infection')) {
    urgencyLevel = 'URGENT_EVALUATION';
    recommendedFacility = 'Urgent Care Center or Same-Day Outpatient Clinic (within 6–12 hours)';
  } else if (severity >= 4 || duration.includes('day') || fever) {
    urgencyLevel = 'ROUTINE_CONSULT';
    recommendedFacility = 'Primary Care Physician / Outpatient Consultation (within 24–48 hours)';
  } else {
    urgencyLevel = 'MONITOR_SELF_CARE';
    recommendedFacility = 'Home Observation & Supportive Care (Seek medical advice if symptoms persist beyond 72 hours)';
  }

  // 2. Possible Explanations based on symptom keywords (Educational & non-diagnostic)
  const explanations = [];
  if (combinedText.includes('cough') || combinedText.includes('cold') || combinedText.includes('throat')) {
    explanations.push({
      title: 'Upper Respiratory Tract Irritation / Viral Infection',
      description: 'Common viral pathogens (e.g. rhinovirus, mild flu) or environmental allergens frequently cause mucosal congestion, sore throat, and cough.',
      likelihood: 'Common'
    });
    explanations.push({
      title: 'Allergic Rhinitis or Environmental Hypersensitivity',
      description: 'Seasonal allergens, dust, or air pollutants can trigger airway reactivity and post-nasal drip.',
      likelihood: 'Possible'
    });
  }

  if (combinedText.includes('headache') || combinedText.includes('head pain')) {
    explanations.push({
      title: 'Tension-Type Headache or Eye Strain',
      description: 'Often precipitated by muscular tightness in the neck and scalp, dehydration, prolonged screen use, or emotional stress.',
      likelihood: 'Common'
    });
    explanations.push({
      title: 'Migraine Variant',
      description: 'Unilateral or throbbing discomfort often accompanied by light sensitivity (photophobia), sound sensitivity, or mild nausea.',
      likelihood: 'Possible'
    });
  }

  if (combinedText.includes('stomach') || combinedText.includes('nausea') || combinedText.includes('abdominal') || combinedText.includes('acidity') || combinedText.includes('vomit')) {
    explanations.push({
      title: 'Gastroenteritis or Acute Gastritis',
      description: 'Gastric mucosal irritation or benign viral digestive irritation resulting in cramping, nausea, or altered digestion.',
      likelihood: 'Common'
    });
    explanations.push({
      title: 'Gastroesophageal Reflux (GERD) / Dyspepsia',
      description: 'Stomach acid regurgitation causing epigastric burning, particularly after meals or when lying flat.',
      likelihood: 'Possible'
    });
  }

  if (combinedText.includes('fatigue') || combinedText.includes('tired') || combinedText.includes('weak')) {
    explanations.push({
      title: 'Sleep Deficit / Physical Exhaustion',
      description: 'Insufficient restorative sleep cycles, prolonged physical exertion, or acute emotional stress.',
      likelihood: 'Common'
    });
    explanations.push({
      title: 'Nutritional or Metabolic Imbalance',
      description: 'Fluctuations in blood glucose, iron/hemoglobin insufficiency, or dehydration can diminish cellular energy production.',
      likelihood: 'Possible'
    });
  }

  if (combinedText.includes('joint') || combinedText.includes('knee') || combinedText.includes('back') || combinedText.includes('muscle')) {
    explanations.push({
      title: 'Musculoskeletal Strain or Overuse',
      description: 'Minor ligamentous micro-stretching, postural fatigue, or exertion-related myofascial tightness.',
      likelihood: 'Common'
    });
  }

  // Fallback generic explanation if specific keywords not matched
  if (explanations.length === 0) {
    explanations.push({
      title: 'Nonspecific Symptom Complex',
      description: 'The symptoms described may arise from a variety of functional, environmental, or physiological factors requiring formal examination.',
      likelihood: 'General Assessment'
    });
  }

  // 3. Questions to Discuss with a Healthcare Professional
  const doctorQuestions = [
    'What potential underlying causes best explain the combination of symptoms I am experiencing?',
    'Are there specific diagnostic tests (such as lab work, blood panels, or imaging) recommended to clarify the etiology?',
    'What specific warning signs or changes should prompt me to seek immediate emergency care?',
    'Could any of my current medications, supplements, or dietary habits be contributing to these symptoms?',
    'What safe supportive home therapies or non-pharmacologic interventions do you recommend while monitoring?'
  ];

  // 4. Safe Next Steps
  const safeNextSteps = [
    'Maintain adequate resting hydration with electrolytes, water, or warm broths.',
    'Log symptom fluctuations, times of onset, and any triggers in your VitaCare Timeline.',
    'Do not start new prescription medications without direct clinician consultation.',
    'Rest in a comfortable, quiet, well-ventilated environment.',
    'If symptoms worsen, new warning signs appear, or pain escalates rapidly, proceed to urgent medical evaluation.'
  ];

  return {
    isEmergency,
    urgencyLevel,
    recommendedFacility,
    emergencyGuidance,
    possibleExplanations: explanations,
    doctorQuestions,
    safeNextSteps
  };
}

// POST /api/symptoms/assess
router.post('/assess', authenticateToken, (req, res) => {
  try {
    const { 
      symptoms, 
      duration = '1-2 days', 
      severity = 5, 
      context = '', 
      fever = false,
      age,
      chronicConditions
    } = req.body;

    if (!symptoms || !symptoms.trim()) {
      return res.status(400).json({ error: 'Please describe the symptoms you are experiencing.' });
    }

    const assessmentResult = analyzeSymptoms(symptoms.trim(), duration, parseInt(severity, 10) || 5, context, fever);

    const record = db.insert('symptom_assessments', {
      userId: req.user.id,
      symptoms: symptoms.trim(),
      duration,
      severity: parseInt(severity, 10) || 5,
      context,
      fever: !!fever,
      isEmergency: assessmentResult.isEmergency,
      urgencyLevel: assessmentResult.urgencyLevel,
      recommendedFacility: assessmentResult.recommendedFacility,
      possibleExplanations: assessmentResult.possibleExplanations,
      doctorQuestions: assessmentResult.doctorQuestions,
      safeNextSteps: assessmentResult.safeNextSteps,
      emergencyGuidance: assessmentResult.emergencyGuidance,
      createdAt: new Date().toISOString()
    });

    // Record timeline entry
    db.insert('medical_timeline', {
      userId: req.user.id,
      eventType: 'symptom_assessed',
      title: `Symptom Guidance: ${symptoms.slice(0, 40)}...`,
      description: `Severity: ${severity}/10 (${duration}). Triage Urgency: ${assessmentResult.urgencyLevel.replace(/_/g, ' ')}.`,
      metadataJson: { assessmentId: record.id, isEmergency: assessmentResult.isEmergency },
      eventDate: new Date().toISOString().split('T')[0]
    });

    res.json({
      success: true,
      assessment: record,
      disclaimer: 'VitaCare Symptom Guidance provides informational context and safe triage recommendations. It is NOT a medical diagnosis and does not substitute for a qualified physician.'
    });
  } catch (err) {
    console.error('Symptom assessment error:', err);
    res.status(500).json({ error: 'Failed to process symptom assessment.' });
  }
});

// GET /api/symptoms/history
router.get('/history', authenticateToken, (req, res) => {
  const history = db.find('symptom_assessments', s => s.userId === req.user.id);
  history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ history, count: history.length });
});

module.exports = router;
