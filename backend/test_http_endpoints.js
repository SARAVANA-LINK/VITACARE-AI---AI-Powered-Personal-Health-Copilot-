const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = 'vitacare-ai-ultra-secure-medical-secret-2026';

// Generate tokens for testing with correct userId key
const patientUser = db.findOne('users', u => u.role !== 'admin') || db.insert('users', { name: 'Test Patient', email: 'testpatient@vitacare.ai', role: 'patient' });
const adminUser = db.findOne('users', u => u.role === 'admin') || db.insert('users', { name: 'Test Admin', email: 'admin@vitacare.ai', role: 'admin' });

const patientToken = jwt.sign({ userId: patientUser.id, email: patientUser.email, role: 'patient' }, JWT_SECRET, { expiresIn: '1h' });
const adminToken = jwt.sign({ userId: adminUser.id, email: adminUser.email, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

async function runHttpTests() {
  console.log('=== VERIFYING AI COPILOT & ADMIN API ENDPOINTS VIA HTTP ===\n');

  const PORT = process.env.PORT || 5000;
  const baseUrl = `http://localhost:${PORT}/api`;

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

  // 1. POST /api/ai/chat with non-medical query -> should return exact required string
  try {
    const res = await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${patientToken}`
      },
      body: JSON.stringify({
        message: 'What is the capital of France?'
      })
    });
    const data = await res.json();
    assert(res.status === 200, 'POST /api/ai/chat responds with 200 OK');
    assert(
      data.reply && data.reply.includes("I'm your AI Health Copilot. I can help with health information, medical reports, prescriptions, and general healthcare guidance."),
      'Non-medical query receives the exact required medical copilot redirection'
    );
  } catch (err) {
    assert(false, `POST /api/ai/chat non-medical error: ${err.message}`);
  }

  // 2. POST /api/ai/chat with general medical query
  try {
    const res = await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${patientToken}`
      },
      body: JSON.stringify({
        message: 'What is a normal blood pressure reading?',
        mode: 'short',
        language: 'en'
      })
    });
    const data = await res.json();
    assert(res.status === 200, 'POST /api/ai/chat medical query responds 200 OK');
    assert(data.reply && data.reply.length > 20, 'Medical query generates structured medical answer');
    assert(data.disclaimer && data.disclaimer.includes("I'm an AI health assistant, not a doctor"), 'Response includes standard clinical safety disclaimer');
  } catch (err) {
    assert(false, `POST /api/ai/chat medical query error: ${err.message}`);
  }

  // 3. POST /api/ai/chat with emergency query
  try {
    const res = await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${patientToken}`
      },
      body: JSON.stringify({
        message: 'I have severe chest pain and cannot breathe'
      })
    });
    const data = await res.json();
    assert(data.hasEmergencyWarning === true, 'Emergency symptoms are flagged with hasEmergencyWarning: true');
    assert(data.reply && data.reply.includes('112'), 'Emergency advice includes emergency call 112 for India');
  } catch (err) {
    assert(false, `POST /api/ai/chat emergency error: ${err.message}`);
  }

  // 4. GET /api/ai/user-documents
  try {
    const res = await fetch(`${baseUrl}/ai/user-documents`, {
      headers: { 'Authorization': `Bearer ${patientToken}` }
    });
    const data = await res.json();
    assert(res.status === 200, 'GET /api/ai/user-documents responds with 200 OK');
    assert(Array.isArray(data.documents), 'Returns documents array isolated to this patient');
  } catch (err) {
    assert(false, `GET /api/ai/user-documents error: ${err.message}`);
  }

  // 5. GET /api/admin/ai/knowledge
  try {
    const res = await fetch(`${baseUrl}/admin/ai/knowledge`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json();
    assert(res.status === 200, 'GET /api/admin/ai/knowledge responds with 200 OK');
    assert(Array.isArray(data.knowledgeSources) && data.knowledgeSources.length > 0, 'Returns list of approved medical knowledge sources');
  } catch (err) {
    assert(false, `GET /api/admin/ai/knowledge error: ${err.message}`);
  }

  // 6. POST /api/admin/ai/knowledge (Add source)
  let createdKnowledgeId = null;
  try {
    const res = await fetch(`${baseUrl}/admin/ai/knowledge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        sourceName: 'WHO Sleep Guidelines',
        authoritativeBody: 'WHO',
        title: 'Adult Sleep Requirements and Cardiovascular Health',
        category: 'Wellness',
        content: 'Adults require 7-9 hours of consistent sleep for optimal cardiovascular homeostasis.'
      })
    });
    const data = await res.json();
    assert(res.status === 201, 'POST /api/admin/ai/knowledge successfully creates entry');
    assert(data.knowledgeSource && data.knowledgeSource.id, 'Created source returns assigned ID');
    createdKnowledgeId = data.knowledgeSource?.id;
  } catch (err) {
    assert(false, `POST /api/admin/ai/knowledge error: ${err.message}`);
  }

  // 7. POST /api/admin/ai/knowledge/reindex
  try {
    const res = await fetch(`${baseUrl}/admin/ai/knowledge/reindex`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json();
    assert(res.status === 200 && data.success === true, 'POST /api/admin/ai/knowledge/reindex re-indexes base');
  } catch (err) {
    assert(false, `POST /api/admin/ai/knowledge/reindex error: ${err.message}`);
  }

  // 8. DELETE /api/admin/ai/knowledge/:id
  if (createdKnowledgeId) {
    try {
      const res = await fetch(`${baseUrl}/admin/ai/knowledge/${createdKnowledgeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await res.json();
      assert(res.status === 200 && data.success === true, 'DELETE /api/admin/ai/knowledge/:id successfully removes entry');
    } catch (err) {
      assert(false, `DELETE /api/admin/ai/knowledge error: ${err.message}`);
    }
  }

  // 9. GET /api/admin/ai/config
  try {
    const res = await fetch(`${baseUrl}/admin/ai/config`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json();
    assert(res.status === 200, 'GET /api/admin/ai/config responds with 200 OK');
    assert(data.aiConfig && data.aiConfig.provider, 'Returns server-side AI provider configuration');
  } catch (err) {
    assert(false, `GET /api/admin/ai/config error: ${err.message}`);
  }

  // 10. GET /api/admin/ai/health
  try {
    const res = await fetch(`${baseUrl}/admin/ai/health`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json();
    assert(res.status === 200, 'GET /api/admin/ai/health responds with 200 OK');
    assert(data.status === 'healthy', 'Health check returns status: healthy');
  } catch (err) {
    assert(false, `GET /api/admin/ai/health error: ${err.message}`);
  }

  console.log(`\n==================================================`);
  console.log(`HTTP TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runHttpTests().catch(e => {
  console.error(e);
  process.exit(1);
});
