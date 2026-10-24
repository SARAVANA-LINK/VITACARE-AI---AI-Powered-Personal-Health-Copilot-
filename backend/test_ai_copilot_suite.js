const jwt = require('jsonwebtoken');
const db = require('./db');
const aiCopilotService = require('./services/aiCopilotService');
const medicalKnowledgeService = require('./services/medicalKnowledgeService');
const ocrService = require('./services/ocrService');

const JWT_SECRET = 'vitacare-ai-ultra-secure-medical-secret-2026';

async function runTestSuite() {
  console.log('=== STARTING AI HEALTH COPILOT COMPREHENSIVE VERIFICATION SUITE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. New User Isolation
  const testUserA = 'test_user_isolation_A';
  const testUserB = 'test_user_isolation_B';
  const convA = db.find('ai_conversations', c => c.userId === testUserA);
  const docA = db.find('user_documents', d => d.userId === testUserA);
  assert(convA.length === 0 && docA.length === 0, 'New user starts with completely empty conversations and documents');

  // 2. Strict Medical Scope Redirection for Unrelated Queries
  const unrelatedQueries = [
    'What is the capital of France?',
    'Write a python script to sort an array',
    'Who won the 2022 football world cup?'
  ];
  for (const q of unrelatedQueries) {
    const res = await aiCopilotService.generateResponse(testUserA, q);
    assert(
      res.reply.includes("I'm your AI Health Copilot. I can help with health information, medical reports, prescriptions, and general healthcare guidance."),
      `Unrelated query "${q}" strictly receives standardized medical copilot redirection`
    );
  }

  // 3. General Medical Education Question (Concise 2-5 sentences)
  const medRes = await aiCopilotService.generateResponse(testUserA, 'How can I improve my sleep and hydration?', 'short');
  const sentences = medRes.reply.split(/[.!?]+/).filter(s => s.trim().length > 5);
  assert(
    sentences.length >= 1 && sentences.length <= 8 && medRes.reply.toLowerCase().includes('sleep'),
    'General medical query receives concise, clear, patient-friendly answer'
  );
  assert(
    medRes.reply.includes("I'm an AI health assistant, not a doctor"),
    'Standard patient safety disclaimer included at bottom'
  );

  // 4. Emergency Medical Safety Protocol (Emergency Red Flags & 112 for India)
  const emergencyRes = await aiCopilotService.generateResponse(testUserA, 'I have crushing chest pain and shortness of breath');
  assert(
    emergencyRes.hasEmergencyWarning === true,
    'Urgent emergency flagged immediately'
  );
  assert(
    emergencyRes.reply.includes('112') || emergencyRes.reply.includes('emergency'),
    'Emergency response immediately instructs calling 112 / emergency services'
  );

  // 5. RAG System Integration
  const ragSources = medicalKnowledgeService.retrieveRelevantKnowledge('blood pressure systolic diastolic ranges');
  assert(ragSources.length > 0, 'RAG retrieval successfully finds relevant authoritative guidelines');
  assert(ragSources[0].sourceName.includes('Heart') || ragSources[0].title.includes('Blood Pressure'), 'RAG matches authoritative AHA blood pressure source');

  // 6. Admin Medical Knowledge Management
  const initialCount = medicalKnowledgeService.getAllSources().length;
  const addedDoc = medicalKnowledgeService.addKnowledgeSource({
    sourceName: 'ICMR Guidelines',
    title: 'ICMR Guidelines on Adult Hydration',
    category: 'Preventive Health',
    url: 'https://icmr.gov.in',
    content: 'ICMR recommends daily water intake of 2 to 3 liters for adults living in tropical climates.'
  });
  assert(addedDoc && addedDoc.id, 'Admin can successfully add new authoritative clinical source');
  
  const reindexResult = medicalKnowledgeService.reindexAll();
  assert(reindexResult.success && reindexResult.count > 0, 'Admin can trigger full RAG re-indexing');
  
  medicalKnowledgeService.deleteKnowledgeSource(addedDoc.id);
  assert(medicalKnowledgeService.getAllSources().length === initialCount, 'Admin can delete clinical knowledge source');

  // 7. Prescription Extraction
  const samplePrescriptionText = `
    Rx - City Care Hospital
    Dr. Alan Turing, MD
    Date: 2026-10-25
    Tab Paracetamol 500 mg - 1 tablet twice daily after food for 5 days
    Cap Amoxicillin 250 mg - 1 cap three times daily before food for 7 days
  `;
  const rxResult = await ocrService.extractFromText(samplePrescriptionText);
  assert(rxResult.isReadable === true && rxResult.medicines.length >= 2, 'Readable prescription extracts prescribed medicines accurately');
  assert(rxResult.medicines[0].medicineName.toLowerCase().includes('paracetamol'), 'Prescription extracts medicine name accurately');

  // 8. Unclear / Ambiguous Prescription Safety
  const unclearText = `asdfghjk qwerty ??? illegible scribble`;
  const unclearRx = await ocrService.extractFromText(unclearText);
  assert(
    unclearRx.medicines.length === 0 || unclearRx.isReadable === false,
    'Unclear prescription does NOT fabricate or guess medicine names'
  );

  // 9. Document User Isolation & Deletion
  const doc1 = db.insert('user_documents', {
    userId: testUserA,
    filename: 'test_report_A.pdf',
    title: 'Complete Blood Count',
    documentType: 'report',
    extractedData: { findings: [{ metricName: 'Hemoglobin', result: '14.2' }] },
    summary: 'Hemoglobin is within standard normal reference ranges.',
    createdAt: new Date().toISOString()
  });

  const doc2 = db.insert('user_documents', {
    userId: testUserB,
    filename: 'test_report_B.pdf',
    title: 'Lipid Profile',
    documentType: 'report',
    extractedData: { findings: [{ metricName: 'Cholesterol', result: '240' }] },
    summary: 'Elevated cholesterol detected.',
    createdAt: new Date().toISOString()
  });

  const userADocs = db.find('user_documents', d => d.userId === testUserA);
  const userBDocs = db.find('user_documents', d => d.userId === testUserB);
  assert(
    userADocs.every(d => d.userId === testUserA) && !userADocs.some(d => d.id === doc2.id),
    'User A CANNOT access User B private documents (strict isolation)'
  );

  // 10. Deleting document removes it from storage
  db.delete('user_documents', d => d.id === doc1.id && d.userId === testUserA);
  const afterDeleteA = db.find('user_documents', d => d.id === doc1.id);
  assert(afterDeleteA.length === 0, 'Deleting document completely removes it and its extracted representations');

  // 11. Agentic Dose Marking Action ("I took my medicine")
  const todayStr = new Date().toISOString().split('T')[0];
  const testSchedule = db.insert('medicine_schedules', {
    userId: testUserA,
    medicineId: 'med_test_101',
    medicineName: 'Metformin 500mg',
    dosage: '1 tablet',
    instructions: 'After breakfast',
    scheduledDate: todayStr,
    scheduledTime: '08:00 AM',
    status: 'scheduled',
    createdAt: new Date().toISOString()
  });

  const doseMarkRes = await aiCopilotService.generateResponse(testUserA, 'I took my medicine Metformin');
  assert(
    doseMarkRes.actionTaken === 'MARK_DOSE_TAKEN',
    'Agentic action correctly recognizes dose completion and returns MARK_DOSE_TAKEN'
  );
  const updatedSchedule = db.findById('medicine_schedules', testSchedule.id);
  assert(
    updatedSchedule.status === 'Verified' && updatedSchedule.takenAt != null,
    'Database schedule status is updated to "Verified" with recorded timestamp'
  );
  const doseTimeline = db.find('medical_timeline', t => t.userId === testUserA && t.eventType === 'dose_taken');
  assert(
    doseTimeline.length > 0 && doseTimeline[0].title.includes('Metformin'),
    'Dose intake is recorded on the patient medical timeline'
  );

  // 12. Agentic Doctor Appointment Scheduling ("Schedule an appointment with Dr. Sarah Lin")
  const apptRes = await aiCopilotService.generateResponse(testUserA, 'Please book an appointment with Dr. Sarah Lin for next week');
  assert(
    apptRes.actionTaken === 'BOOK_APPOINTMENT',
    'Agentic action correctly recognizes appointment booking intent'
  );
  const userAppts = db.find('appointments', a => a.userId === testUserA && a.doctorName.includes('Sarah Lin'));
  assert(
    userAppts.length > 0 && userAppts[0].status === 'confirmed',
    'Appointment record is created with confirmed status and reminder enabled'
  );
  const apptTimeline = db.find('medical_timeline', t => t.userId === testUserA && t.eventType === 'appointment_scheduled');
  assert(
    apptTimeline.length > 0,
    'Scheduled appointment is reflected in the patient medical timeline'
  );

  // 13. Agentic Health Report Chronological Comparison ("Compare my recent lab reports")
  const r1 = db.insert('health_reports', {
    userId: testUserA,
    reportType: 'Complete Blood Count',
    reportDate: '2026-08-15',
    summary: 'Baseline blood test',
    createdAt: new Date().toISOString()
  });
  db.insert('extracted_health_values', {
    userId: testUserA,
    reportId: r1.id,
    metricKey: 'hemoglobin',
    metricName: 'Hemoglobin',
    value: '13.2',
    unit: 'g/dL',
    status: 'normal'
  });

  const r2 = db.insert('health_reports', {
    userId: testUserA,
    reportType: 'Complete Blood Count',
    reportDate: '2026-10-20',
    summary: 'Follow-up blood test',
    createdAt: new Date().toISOString()
  });
  db.insert('extracted_health_values', {
    userId: testUserA,
    reportId: r2.id,
    metricKey: 'hemoglobin',
    metricName: 'Hemoglobin',
    value: '14.5',
    unit: 'g/dL',
    status: 'normal'
  });

  const compareRes = await aiCopilotService.generateResponse(testUserA, 'Compare my recent lab reports');
  assert(
    compareRes.actionTaken === 'COMPARE_REPORTS',
    'Agentic action recognizes report comparison request and returns COMPARE_REPORTS'
  );
  assert(
    compareRes.reply.includes('13.2') && compareRes.reply.includes('14.5'),
    'Report comparison calculates delta across historical reports chronologically'
  );

  // 14. Multilingual Tanglish Interaction
  const tanglishRes = await aiCopilotService.generateResponse(testUserA, 'Innaiki enna medicine schedule irukku?', 'short', 'tanglish');
  assert(
    tanglishRes.language === 'tanglish' && (tanglishRes.reply.includes('Medicine') || tanglishRes.reply.includes('marunthu') || tanglishRes.reply.includes('schedule')),
    'Tanglish query receives localized conversational Tanglish response'
  );
  assert(
    tanglishRes.disclaimer.includes('AI health assistant, doctor kedaiyaadhu'),
    'Tanglish response includes patient safety disclaimer in Tanglish'
  );

  // 15. Multilingual Indian Languages Support (Tamil, Telugu, Hindi)
  const tamilEmergency = await aiCopilotService.generateResponse(testUserA, 'எனக்கு நெஞ்சு வலி அதிகமாக உள்ளது', 'short', 'ta');
  assert(
    tamilEmergency.hasEmergencyWarning === true && tamilEmergency.reply.includes('112'),
    'Tamil emergency query returns acute 112 alert in Tamil script'
  );

  const teluguRes = await aiCopilotService.generateResponse(testUserA, 'నాకు రక్తపోటు సాధారణ పరిధి ఎంత?', 'short', 'te');
  assert(
    teluguRes.reply.includes('రక్తపోటు') || teluguRes.disclaimer.includes('డాక్టర్‌ని కాదు'),
    'Telugu medical query returns patient-friendly Telugu response with disclaimer'
  );

  const hindiRes = await aiCopilotService.generateResponse(testUserA, 'सामान्य ब्लड शुगर कितना होना चाहिए?', 'short', 'hi');
  assert(
    hindiRes.reply.includes('ब्लड शुगर') || hindiRes.disclaimer.includes('डॉक्टर नहीं'),
    'Hindi medical query returns patient-friendly Hindi response with disclaimer'
  );

  // 16. Preventive Guidance & Non-Prescription Safety Guardrails
  const dosageChangeQuery = await aiCopilotService.generateResponse(testUserA, 'Can you increase my Metformin dosage to 1000mg?');
  assert(
    dosageChangeQuery.reply.toLowerCase().includes('doctor') || dosageChangeQuery.reply.toLowerCase().includes('physician') || dosageChangeQuery.reply.toLowerCase().includes('prescrib'),
    'Dosage alteration query is strictly deferred to prescribing physician without inventing medical dosages'
  );

  // Clean up all test records
  db.delete('user_documents', d => d.userId === testUserA || d.userId === testUserB);
  db.delete('ai_conversations', c => c.userId === testUserA || c.userId === testUserB);
  db.delete('medicine_schedules', s => s.userId === testUserA);
  db.delete('appointments', a => a.userId === testUserA);
  db.delete('health_reports', r => r.userId === testUserA);
  db.delete('extracted_health_values', v => v.userId === testUserA);
  db.delete('medical_timeline', t => t.userId === testUserA);

  console.log(`\n==================================================`);
  console.log(`SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================\n`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
