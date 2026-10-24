const express = require('express');
const router = express.Router();

// Curated Medical Dictionary dataset
const MEDICAL_DICTIONARY = [
  {
    id: 'dict-1',
    term: 'HbA1c (Glycated Hemoglobin)',
    category: 'Diagnostic Lab Test',
    definition: 'A standard blood test measuring the average percentage of blood glucose bound to hemoglobin over the preceding 2 to 3 months.',
    referenceRange: 'Normal: < 5.7% | Prediabetes: 5.7% – 6.4% | Diabetes: ≥ 6.5%',
    clinicalNote: 'Provides a long-term glycemic overview independent of daily meal fluctuations.'
  },
  {
    id: 'dict-2',
    term: 'Fasting Blood Glucose (FBS)',
    category: 'Diagnostic Lab Test',
    definition: 'The concentration of glucose in the bloodstream measured after an overnight fast of at least 8 hours.',
    referenceRange: 'Normal: 70 – 99 mg/dL | Impaired: 100 – 125 mg/dL | Elevated: ≥ 126 mg/dL',
    clinicalNote: 'Primary screening test for carbohydrate metabolism disorders.'
  },
  {
    id: 'dict-3',
    term: 'Blood Pressure (Systolic / Diastolic)',
    category: 'Vital Sign',
    definition: 'The force exerted by circulating blood against arterial walls. Systolic represents peak pressure during cardiac contraction; diastolic represents resting pressure between beats.',
    referenceRange: 'Optimal: < 120/80 mmHg | Elevated: 120-129/<80 | Stage 1 HTN: 130-139/80-89 mmHg',
    clinicalNote: 'Chronic elevation strains vascular endothelium and cardiac myocardium.'
  },
  {
    id: 'dict-4',
    term: 'Metformin',
    category: 'Prescription Medication',
    definition: 'A first-line oral biguanide antihyperglycemic medication that reduces hepatic glucose production and enhances peripheral insulin sensitivity.',
    referenceRange: 'Common Dosage: 500 mg – 2000 mg daily',
    clinicalNote: 'Administer with or directly after meals to reduce potential gastrointestinal upset.'
  },
  {
    id: 'dict-5',
    term: 'Lisinopril',
    category: 'Prescription Medication',
    definition: 'An Angiotensin-Converting Enzyme (ACE) inhibitor utilized in hypertension management and renal protection in diabetes.',
    referenceRange: 'Common Dosage: 5 mg – 40 mg daily',
    clinicalNote: 'Monitor serum potassium and renal parameters periodically.'
  },
  {
    id: 'dict-6',
    term: 'Atorvastatin',
    category: 'Prescription Medication',
    definition: 'An HMG-CoA reductase inhibitor (statin) that lowers circulating LDL cholesterol and stabilizes arterial atherosclerotic plaques.',
    referenceRange: 'Common Dosage: 10 mg – 80 mg daily at bedtime',
    clinicalNote: 'Advised once daily, usually at night when hepatic cholesterol synthesis peaks.'
  },
  {
    id: 'dict-7',
    term: 'Complete Blood Count (CBC)',
    category: 'Diagnostic Lab Test',
    definition: 'A comprehensive hematology panel assessing white blood cells, red blood cells, hemoglobin, hematocrit, and platelets.',
    referenceRange: 'Includes WBC, RBC, Hb, Platelets, Hematocrit',
    clinicalNote: 'Crucial for detecting anemia, bacterial/viral infections, and coagulation anomalies.'
  },
  {
    id: 'dict-8',
    term: 'Serum Creatinine & eGFR',
    category: 'Diagnostic Lab Test',
    definition: 'Biomarkers evaluating renal filtration capacity. Creatinine is a metabolic byproduct filtered by the glomeruli; eGFR calculates filtration efficiency.',
    referenceRange: 'Creatinine: 0.7 – 1.3 mg/dL | eGFR: > 90 mL/min/1.73m²',
    clinicalNote: 'Elevated creatinine indicates reduced glomerular clearance.'
  },
  {
    id: 'dict-9',
    term: 'Pulse Oximetry (SpO2)',
    category: 'Vital Sign',
    definition: 'Non-invasive optical estimation of the percentage of hemoglobin binding sites in the bloodstream occupied by oxygen.',
    referenceRange: 'Normal: 95% – 100% | Hypoxia Warning: < 92%',
    clinicalNote: 'Readings below 92% warrant immediate supplemental oxygenation or urgent clinical evaluation.'
  },
  {
    id: 'dict-10',
    term: 'Lipid Profile',
    category: 'Diagnostic Lab Test',
    definition: 'A panel measuring Total Cholesterol, High-Density Lipoprotein (HDL), Low-Density Lipoprotein (LDL), and Triglycerides.',
    referenceRange: 'Total: < 200 mg/dL | LDL: < 100 mg/dL | HDL: > 40-50 mg/dL | Triglycerides: < 150 mg/dL',
    clinicalNote: 'Key biomarker battery for assessing cardiovascular risk and atherosclerotic disease.'
  },
  {
    id: 'dict-11',
    term: 'Anaphylaxis',
    category: 'Clinical Emergency',
    definition: 'A severe, rapid, systemic allergic reaction causing airway constriction, hypotension, and hives.',
    referenceRange: 'Medical Emergency (Immediate 108/911 + Epinephrine)',
    clinicalNote: 'Requires prompt intramuscular injection of epinephrine and immediate emergency transport.'
  },
  {
    id: 'dict-12',
    term: 'Tachycardia & Bradycardia',
    category: 'Vital Sign / Physiology',
    definition: 'Tachycardia denotes a resting heart rate exceeding 100 beats per minute; Bradycardia denotes a resting heart rate below 60 beats per minute.',
    referenceRange: 'Normal Adult Resting Heart Rate: 60 – 100 bpm',
    clinicalNote: 'Athletes frequently present physiologic bradycardia (45-55 bpm) without adverse pathology.'
  }
];

// Curated Health Education Library articles
const HEALTH_ARTICLES = [
  {
    id: 'art-1',
    category: 'Cardiovascular Health',
    title: 'Managing Blood Pressure: The Sodium & Potassium Balance',
    readTime: '4 min read',
    summary: 'Evidence-based strategies to maintain healthy arterial elasticity through dietary sodium reduction and potassium-rich whole foods.',
    keyPoints: [
      'Aim for dietary sodium intake below 2,000 mg daily (approx. 1 teaspoon of table salt).',
      'Incorporate potassium-rich vegetables (spinach, avocados, lentils) to counteract sodium absorption.',
      'Regular aerobic walking 30 minutes daily reduces systolic pressure by an average of 5–8 mmHg.'
    ],
    updatedAt: '2026-10-15'
  },
  {
    id: 'art-2',
    category: 'Diabetes & Metabolism',
    title: 'Understanding HbA1c: Why the 3-Month Average Matters More Than Daily Spikes',
    readTime: '5 min read',
    summary: 'How red blood cell longevity provides clinicians with an uncheatable window into long-term glycemic management.',
    keyPoints: [
      'Red blood cells circulate for approx. 120 days before being recycled by the spleen.',
      'HbA1c reflects glucose exposure across the entire life cycle of the hemoglobin protein.',
      'Keeping HbA1c below 7.0% dramatically lowers risk of diabetic microvascular complications.'
    ],
    updatedAt: '2026-10-12'
  },
  {
    id: 'art-3',
    category: 'Medication Safety',
    title: 'Medication Adherence: Why Skipping Doses Impacts Steady-State Efficacy',
    readTime: '3 min read',
    summary: 'Pharmacokinetics explained: how missed doses lead to therapeutic concentration dips and drug resistance.',
    keyPoints: [
      'Prescriptions are calibrated according to drug elimination half-lives (T1/2).',
      'Skipping a morning dose can cause blood serum levels to drop below therapeutic thresholds.',
      'Always use an adherence organizer and consult your pharmacist before doubling up missed doses.'
    ],
    updatedAt: '2026-10-08'
  },
  {
    id: 'art-4',
    category: 'Nutrition & Wellness',
    title: 'Hydration Science: Fluid Intake Rules for Active Adults & Seniors',
    readTime: '4 min read',
    summary: 'The physiology of fluid balance, electrolyte preservation, and how thirst perception diminishes with age.',
    keyPoints: [
      'Older adults naturally experience diminished thirst sensitivity due to osmoreceptor blunting.',
      'Target approx. 30–35 mL of fluid per kilogram of body weight under moderate climate conditions.',
      'Urine color should ideally resemble pale straw or light lemonade.'
    ],
    updatedAt: '2026-10-01'
  },
  {
    id: 'art-5',
    category: 'First Aid & Emergency',
    title: 'Recognizing Stroke with the F.A.S.T. Protocol',
    readTime: '3 min read',
    summary: 'Immediate identification criteria for acute cerebrovascular events where every minute preserves brain tissue.',
    keyPoints: [
      'F - Face Drooping: Ask the person to smile. Is one side drooping or uneven?',
      'A - Arm Weakness: Ask them to raise both arms. Does one arm drift downward?',
      'S - Speech Difficulty: Is speech slurred or difficult to comprehend?',
      'T - Time to Call Emergency: Immediate dispatch (108/911/112). Note the exact time symptoms started.'
    ],
    updatedAt: '2026-09-28'
  }
];

// Curated Hospital & Clinic Directory
const HOSPITALS_DIRECTORY = [
  {
    id: 'hosp-1',
    name: 'Apollo Speciality Hospital & Trauma Care',
    type: '24/7 Tertiary Emergency Hospital',
    address: '21 Greams Lane, Thousand Lights',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600006',
    emergencyPhone: '+91 (44) 2829-0200',
    hotline: '1066',
    distanceKm: '1.8 km',
    openStatus: 'Open 24 Hours • Trauma Ready',
    specialties: ['Emergency & Trauma', 'Cardiology (Cath Lab)', 'Neurology', 'Critical Care ICU'],
    coordinates: { lat: 13.0604, lng: 80.2496 }
  },
  {
    id: 'hosp-2',
    name: 'Fortis Memorial Health Institute',
    type: 'Multi-Specialty Healthcare Center',
    address: 'Sector 44, Opposite HUDA City Centre',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122002',
    emergencyPhone: '+91 (124) 496-2200',
    hotline: '105010',
    distanceKm: '3.4 km',
    openStatus: 'Open 24 Hours • Emergency Available',
    specialties: ['Cardiothoracic Surgery', 'Pulmonology', 'Orthopedics', 'Dialysis Unit'],
    coordinates: { lat: 28.4595, lng: 77.0725 }
  },
  {
    id: 'hosp-3',
    name: 'Manipal Hospital & Emergency Department',
    type: '24/7 Super Speciality Hospital',
    address: '98 HAL Old Airport Road, Kodihalli',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560017',
    emergencyPhone: '+91 (80) 2502-4444',
    hotline: '080-22221111',
    distanceKm: '2.5 km',
    openStatus: 'Open 24 Hours • Comprehensive ER',
    specialties: ['Comprehensive Stroke Center', 'Trauma Resuscitation', 'Pediatric ICU', 'Oncology'],
    coordinates: { lat: 12.9592, lng: 77.6534 }
  },
  {
    id: 'hosp-4',
    name: 'Care Community Outpatient Clinic & Diagnostics',
    type: 'Outpatient Family Clinic & Lab',
    address: '45 Gandhi Road, West Zone',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    pincode: '641002',
    emergencyPhone: '+91 (422) 254-8899',
    hotline: '+91 (422) 254-8800',
    distanceKm: '0.9 km',
    openStatus: 'Open Mon–Sat: 07:30 AM – 09:30 PM',
    specialties: ['Family Medicine', 'Diabetes Care', 'Pathology Lab', 'Preventative Vitals'],
    coordinates: { lat: 11.0168, lng: 76.9558 }
  },
  {
    id: 'hosp-5',
    name: 'Max Super Speciality Hospital',
    type: '24/7 Multi-Specialty Hospital',
    address: '1, 2 Press Enclave Road, Saket',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110017',
    emergencyPhone: '+91 (11) 2651-5050',
    hotline: '011-40554055',
    distanceKm: '4.1 km',
    openStatus: 'Open 24 Hours • Stroke & Heart Attack Center',
    specialties: ['Interventional Cardiology', 'Organ Transplant', 'Internal Medicine', 'Emergency'],
    coordinates: { lat: 28.5283, lng: 77.2132 }
  }
];

// GET /api/resources/dictionary
router.get('/dictionary', (req, res) => {
  const { q, category } = req.query;
  let results = [...MEDICAL_DICTIONARY];

  if (q && q.trim()) {
    const query = q.trim().toLowerCase();
    results = results.filter(item => 
      item.term.toLowerCase().includes(query) || 
      item.definition.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  }

  if (category && category !== 'All') {
    results = results.filter(item => item.category.toLowerCase() === category.toLowerCase());
  }

  res.json({ terms: results, total: results.length });
});

// GET /api/resources/articles
router.get('/articles', (req, res) => {
  const { q, category } = req.query;
  let results = [...HEALTH_ARTICLES];

  if (q && q.trim()) {
    const query = q.trim().toLowerCase();
    results = results.filter(a => 
      a.title.toLowerCase().includes(query) || 
      a.summary.toLowerCase().includes(query) ||
      a.category.toLowerCase().includes(query)
    );
  }

  if (category && category !== 'All') {
    results = results.filter(a => a.category.toLowerCase() === category.toLowerCase());
  }

  res.json({ articles: results, total: results.length });
});

// GET /api/resources/hospitals
router.get('/hospitals', (req, res) => {
  const { q, city } = req.query;
  let results = [...HOSPITALS_DIRECTORY];

  if (q && q.trim()) {
    const query = q.trim().toLowerCase();
    results = results.filter(h => 
      h.name.toLowerCase().includes(query) ||
      h.city.toLowerCase().includes(query) ||
      h.specialties.some(s => s.toLowerCase().includes(query))
    );
  }

  if (city && city !== 'All') {
    results = results.filter(h => h.city.toLowerCase() === city.toLowerCase());
  }

  res.json({ hospitals: results, total: results.length });
});

module.exports = router;
