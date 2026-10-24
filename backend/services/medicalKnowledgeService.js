const db = require('../db');

/**
 * Medical Knowledge & RAG (Retrieval-Augmented Generation) System
 * Provides trusted, authoritative clinical reference material (WHO, CDC, MedlinePlus, FDA, ADA, AHA).
 * Strictly segregated from patient private medical records.
 */

const SEED_KNOWLEDGE = [
  {
    id: 'kb_bp_aha',
    sourceName: 'American Heart Association (AHA) / ACC',
    title: 'Adult Blood Pressure Clinical Guidelines & Categories',
    category: 'Vitals & Cardiovascular',
    url: 'https://www.heart.org/en/health-topics/high-blood-pressure',
    publishedDate: '2023-11-01',
    version: '2023.2',
    keywords: ['blood pressure', 'bp', 'systolic', 'diastolic', 'hypertension', 'hypotension', 'ranges', 'high blood pressure'],
    content: 'Normal blood pressure for adults is defined as systolic less than 120 mmHg and diastolic less than 80 mmHg (<120/80 mmHg). Elevated blood pressure is systolic 120-129 and diastolic <80. Stage 1 Hypertension is systolic 130-139 or diastolic 80-89. Stage 2 Hypertension is systolic 140 or higher, or diastolic 90 or higher. Hypertensive crisis requiring immediate emergency care is systolic >180 and/or diastolic >120 with symptoms like chest pain, shortness of breath, or numbness.'
  },
  {
    id: 'kb_glucose_ada',
    sourceName: 'American Diabetes Association (ADA)',
    title: 'Standard Blood Glucose and HbA1c Reference Standards',
    category: 'Metabolic & Endocrinology',
    url: 'https://diabetes.org/clinical-care',
    publishedDate: '2024-01-15',
    version: '2024.1',
    keywords: ['glucose', 'sugar', 'blood sugar', 'fasting', 'ppbs', 'postprandial', 'hba1c', 'diabetes', 'prediabetes'],
    content: 'Fasting Plasma Glucose (FPG): Normal is 70 to 99 mg/dL. Pre-diabetes (impaired fasting glucose) is 100 to 125 mg/dL. Diabetes diagnosis threshold is 126 mg/dL or higher on more than one testing occasion. Post-prandial (2 hours post-meal) blood sugar: Normal is less than 140 mg/dL, pre-diabetes is 140 to 199 mg/dL, and diabetes is 200 mg/dL or higher. HbA1c: Normal is below 5.7%, pre-diabetes is 5.7% to 6.4%, and diabetes is 6.5% or higher.'
  },
  {
    id: 'kb_cbc_medline',
    sourceName: 'NIH MedlinePlus',
    title: 'Complete Blood Count (CBC) and Hemoglobin Guidelines',
    category: 'Hematology & Lab Reports',
    url: 'https://medlineplus.gov/lab-tests/complete-blood-count/',
    publishedDate: '2023-08-20',
    version: '2023.1',
    keywords: ['hemoglobin', 'hb', 'cbc', 'red blood cells', 'rbc', 'wbc', 'platelets', 'anemia', 'hematocrit'],
    content: 'Hemoglobin (Hb) reference ranges: Normal adult males typically range 13.5 to 17.5 g/dL; adult non-pregnant females typically range 12.0 to 15.5 g/dL. Low hemoglobin suggests anemia, blood loss, or nutritional deficiencies (iron, B12, folate). High hemoglobin can stem from dehydration, smoking, high altitude, or lung conditions. White Blood Cells (WBC): 4,500 to 11,000 cells/mcL. Platelets: 150,000 to 450,000/mcL.'
  },
  {
    id: 'kb_lipid_cdc',
    sourceName: 'CDC / NCEP ATP III',
    title: 'Lipid Profile and Cholesterol Management',
    category: 'Cardiovascular & Lab Reports',
    url: 'https://www.cdc.gov/cholesterol/index.htm',
    publishedDate: '2023-05-10',
    version: '2023.1',
    keywords: ['cholesterol', 'lipid', 'ldl', 'hdl', 'triglycerides', 'vldl', 'heart health'],
    content: 'Total Cholesterol: Desirable is under 200 mg/dL; 200-239 is borderline high; 240+ is high. LDL (bad) cholesterol: Optimal is under 100 mg/dL; 100-129 is near optimal; 130-159 is borderline high; 160-189 is high. HDL (protective) cholesterol: 40 mg/dL or higher for men, 50 mg/dL or higher for women (higher is better). Triglycerides: Normal is under 150 mg/dL; 150-199 is borderline high; 200-499 is high.'
  },
  {
    id: 'kb_kidney_nkf',
    sourceName: 'National Kidney Foundation (NKF)',
    title: 'Renal Function Panel and Biomarker Interpretation',
    category: 'Nephrology & Lab Reports',
    url: 'https://www.kidney.org/atoz/content/kidneytests',
    publishedDate: '2023-09-12',
    version: '2023.1',
    keywords: ['creatinine', 'kidney', 'renal', 'egfr', 'bun', 'urea', 'urine', 'proteinuria'],
    content: 'Serum Creatinine: Normal for adult men is 0.7 to 1.3 mg/dL; for adult women is 0.6 to 1.1 mg/dL. Elevated creatinine can signify reduced kidney filtration, dehydration, or heavy muscle breakdown. eGFR (Estimated Glomerular Filtration Rate): Normal is 90 mL/min/1.73m² or higher. eGFR between 60-89 may indicate early stage kidney damage if other markers present; below 60 suggests chronic kidney disease. Blood Urea Nitrogen (BUN): Normal range is 7 to 20 mg/dL.'
  },
  {
    id: 'kb_liver_mayo',
    sourceName: 'Mayo Clinic / AASLD',
    title: 'Liver Function Tests (LFT) Reference Ranges',
    category: 'Gastroenterology & Lab Reports',
    url: 'https://www.mayoclinic.org/tests-procedures/liver-function-tests/about/pac-20394595',
    publishedDate: '2023-07-15',
    version: '2023.1',
    keywords: ['alt', 'ast', 'bilirubin', 'liver', 'lft', 'alkaline phosphatase', 'sgot', 'sgpt', 'albumin'],
    content: 'Alanine Transaminase (ALT/SGPT): Standard range is 7 to 56 U/L. Aspartate Transaminase (AST/SGOT): Standard range is 10 to 40 U/L. Elevated ALT/AST indicates hepatocellular inflammation or injury (viral hepatitis, fatty liver, medication reaction, alcohol). Total Bilirubin: 0.2 to 1.2 mg/dL. Serum Albumin: 3.5 to 5.0 g/dL. Minor enzyme elevations must always be evaluated in clinical context and do not automatically mean irreversible liver disease.'
  },
  {
    id: 'kb_thyroid_ata',
    sourceName: 'American Thyroid Association (ATA)',
    title: 'Thyroid Function Evaluation (TSH and Free T4)',
    category: 'Endocrinology & Lab Reports',
    url: 'https://www.thyroid.org/thyroid-function-tests/',
    publishedDate: '2023-10-05',
    version: '2023.1',
    keywords: ['tsh', 'thyroid', 't3', 't4', 'free t4', 'hypothyroidism', 'hyperthyroidism'],
    content: 'Thyroid-Stimulating Hormone (TSH): Standard normal reference range is typically 0.4 to 4.0 mIU/L (may vary slightly by laboratory). Elevated TSH indicates an underactive thyroid (hypothyroidism). Suppressed or low TSH indicates an overactive thyroid (hyperthyroidism). Free T4 (Thyroxine): Normal range is typically 0.8 to 1.8 ng/dL.'
  },
  {
    id: 'kb_rx_safety_fda',
    sourceName: 'FDA / WHO Essential Medicines',
    title: 'Prescription Information, Dosage Safety & Pharmacovigilance',
    category: 'Pharmacology & Safety',
    url: 'https://www.fda.gov/drugs/information-consumers-and-patients-drugs',
    publishedDate: '2024-02-01',
    version: '2024.1',
    keywords: ['prescription', 'medicine', 'dosage', 'frequency', 'pharmacist', 'safety', 'side effects', 'missed dose', 'interaction'],
    content: 'Medication administration guidelines: Always take medications exactly as prescribed by your licensed physician or healthcare provider. Never alter doses or stop antibiotic courses early unless instructed by your clinician. If a medicine label, handwritten dosage, or tablet strength is blurred or ambiguous, never guess — verify directly with a licensed pharmacist or prescribing physician before taking. Report any unexpected rash, facial swelling, or breathing difficulty immediately.'
  },
  {
    id: 'kb_wellness_who',
    sourceName: 'World Health Organization (WHO)',
    title: 'Preventive Health: Sleep, Hydration, Nutrition & Exercise',
    category: 'Preventive Healthcare & Wellness',
    url: 'https://www.who.int/health-topics/physical-activity',
    publishedDate: '2023-04-18',
    version: '2023.1',
    keywords: ['sleep', 'hydration', 'water', 'exercise', 'nutrition', 'diet', 'wellness', 'lifestyle', 'preventive'],
    content: 'Adult wellness foundations: Adults require 7 to 9 hours of quality, uninterrupted sleep per night for metabolic and cognitive repair. Daily water intake of 2.0 to 3.0 liters is recommended for healthy adults under normal conditions. Maintain at least 150-300 minutes of moderate-intensity aerobic exercise or 75-150 minutes of vigorous aerobic activity weekly. Emphasize a plant-rich, whole-food diet with balanced protein and limited sodium (<2g/day) to support long-term cardiovascular health.'
  },
  {
    id: 'kb_emergency_mohfw',
    sourceName: 'Ministry of Health & Family Welfare (MoHFW) / WHO Emergency Triage',
    title: 'Emergency Medical Triage & Acute Care Red Flags',
    category: 'Emergency Triage',
    url: 'https://www.mohfw.gov.in',
    publishedDate: '2024-01-01',
    version: '2024.1',
    keywords: ['emergency', 'chest pain', 'stroke', 'shortness of breath', '112', '108', 'ambulance', 'urgent', 'anaphylaxis'],
    content: 'Acute medical red flags require immediate emergency intervention: 1) Crushing chest pressure or tightness radiating to jaw, left arm, or back; 2) FAST stroke signs: Facial drooping, Arm weakness, Slurred speech, Time to call emergency; 3) Severe difficulty breathing or gasping; 4) Sudden loss of consciousness or severe head trauma; 5) Severe anaphylaxis with throat swelling or hives. In India, call 112 (National Emergency) or 108 (Ambulance). Do not delay emergency transport for an online consultation.'
  }
];

class MedicalKnowledgeService {
  constructor() {
    this.ensureInitialized();
  }

  ensureInitialized() {
    const existing = db.find('medical_knowledge');
    if (existing.length === 0) {
      console.log('Initializing curated medical knowledge base with trusted authoritative references...');
      for (const item of SEED_KNOWLEDGE) {
        db.insert('medical_knowledge', {
          ...item,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Retrieves all knowledge sources for admin inspection
   */
  getAllSources() {
    const list = db.find('medical_knowledge');
    return list.map(item => ({
      ...item,
      authoritativeBody: item.authoritativeBody || item.sourceName,
      publicationDate: item.publicationDate || item.publishedDate,
      sourceUrl: item.sourceUrl || item.url,
      chunkCount: item.chunkCount || 1
    }));
  }

  /**
   * Adds a new authoritative medical document to the knowledge base (Admin only)
   */
  addKnowledgeSource(data) {
    const title = data.title || data.topic || data.sourceName || 'Clinical Reference Guideline';
    const content = data.content || data.guidelineText;
    if (!title || !content) {
      throw new Error('Title and content are required for medical knowledge.');
    }
    const keywords = Array.isArray(data.keywords) 
      ? data.keywords 
      : (data.keywords || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean);

    const doc = {
      sourceName: (data.sourceName || data.authoritativeBody || 'Clinical Reference').trim(),
      authoritativeBody: (data.authoritativeBody || data.sourceName || 'WHO').trim(),
      title: title.trim(),
      category: data.category || data.topic || 'Clinical Reference',
      url: data.url || data.sourceUrl || 'https://www.who.int',
      sourceUrl: data.url || data.sourceUrl || 'https://www.who.int',
      publishedDate: data.publishedDate || data.publicationDate || new Date().toISOString().split('T')[0],
      publicationDate: data.publishedDate || data.publicationDate || new Date().toISOString().split('T')[0],
      version: data.version || '1.0',
      keywords,
      content: content.trim(),
      chunkCount: Math.max(1, Math.ceil(content.length / 400)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return db.insert('medical_knowledge', doc);
  }

  /**
   * Deletes a knowledge source
   */
  deleteKnowledgeSource(id) {
    return db.delete('medical_knowledge', k => k.id === id);
  }

  /**
   * Re-indexes all knowledge entries
   */
  reindexAll() {
    const all = db.find('medical_knowledge');
    const count = all.length;
    // Normalize keywords and ensure freshness timestamp
    db.update('medical_knowledge', () => true, {
      lastIndexedAt: new Date().toISOString()
    });
    return { success: true, count, timestamp: new Date().toISOString() };
  }

  /**
   * RAG Query: Semantic & Keyword similarity matching to retrieve authoritative clinical reference material.
   * Excludes any patient data — retrieves strictly from shared medical reference knowledge.
   * @param {string} query Natural language medical query
   * @param {number} limit Max references to retrieve
   */
  retrieveRelevantKnowledge(query, limit = 2) {
    if (!query || typeof query !== 'string') return [];
    const normalized = query.toLowerCase();
    const queryTokens = normalized.split(/\W+/).filter(t => t.length > 2);

    const allKnowledge = db.find('medical_knowledge');
    const scored = [];

    for (const item of allKnowledge) {
      let score = 0;
      const contentLower = item.content.toLowerCase();
      const titleLower = item.title.toLowerCase();
      const keywords = item.keywords || [];

      // Keyword match (highest weight)
      for (const kw of keywords) {
        if (normalized.includes(kw.toLowerCase())) {
          score += 5;
        }
      }

      // Title match
      for (const token of queryTokens) {
        if (titleLower.includes(token)) {
          score += 3;
        }
        if (contentLower.includes(token)) {
          score += 1;
        }
      }

      if (score > 0) {
        scored.push({ item, score });
      }
    }

    // Sort by descending relevance score
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(s => ({
      id: s.item.id,
      sourceName: s.item.sourceName,
      title: s.item.title,
      category: s.item.category,
      url: s.item.url,
      publishedDate: s.item.publishedDate,
      snippet: s.item.content,
      relevanceScore: s.score
    }));
  }
}

module.exports = new MedicalKnowledgeService();
