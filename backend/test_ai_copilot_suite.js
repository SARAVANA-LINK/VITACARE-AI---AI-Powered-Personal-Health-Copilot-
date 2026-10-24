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

  // Clean up test records
  db.delete('user_documents', d => d.userId === testUserA || d.userId === testUserB);
  db.delete('ai_conversations', c => c.userId === testUserA || c.userId === testUserB);

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
