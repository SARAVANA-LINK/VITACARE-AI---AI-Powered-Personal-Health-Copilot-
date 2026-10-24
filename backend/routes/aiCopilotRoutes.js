const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');
const aiCopilotService = require('../services/aiCopilotService');
const ocrService = require('../services/ocrService');
const extractionService = require('../services/extractionService');
const medicalKnowledgeService = require('../services/medicalKnowledgeService');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `copilot-doc-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext) || file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file format. Please upload a PDF, JPG, JPEG, or PNG document.'));
    }
  }
});

// GET /api/ai/threads (List all conversation threads)
router.get('/threads', authenticateToken, (req, res) => {
  let threads = db.find('ai_threads', t => t.userId === req.user.id);
  if (threads.length === 0) {
    const initialThread = db.insert('ai_threads', {
      userId: req.user.id,
      title: 'General Health Conversation',
      isArchived: false,
      messageCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    threads = [initialThread];
  }
  threads.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json({ threads });
});

// POST /api/ai/threads (Create new conversation thread)
router.post('/threads', authenticateToken, (req, res) => {
  try {
    const { title = 'New Health Conversation' } = req.body;
    const newThread = db.insert('ai_threads', {
      userId: req.user.id,
      title: title.trim() || 'New Health Conversation',
      isArchived: false,
      messageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    res.status(201).json({ success: true, thread: newThread });
  } catch (err) {
    console.error('Create thread error:', err);
    res.status(500).json({ error: 'Failed to create conversation thread.' });
  }
});

// PUT /api/ai/threads/:id (Rename or archive thread)
router.put('/threads/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { title, isArchived } = req.body;
    const existing = db.findOne('ai_threads', t => t.id === id && t.userId === req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Thread not found.' });
    }

    const updated = db.update('ai_threads', t => t.id === id && t.userId === req.user.id, {
      title: title !== undefined ? title.trim() : undefined,
      isArchived: isArchived !== undefined ? !!isArchived : undefined,
      updatedAt: new Date().toISOString()
    });

    res.json({ success: true, thread: updated[0] });
  } catch (err) {
    console.error('Update thread error:', err);
    res.status(500).json({ error: 'Failed to update thread.' });
  }
});

// DELETE /api/ai/threads/:id (Delete thread and associated messages)
router.delete('/threads/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  db.delete('ai_threads', t => t.id === id && t.userId === req.user.id);
  db.delete('ai_conversations', c => c.threadId === id && c.userId === req.user.id);
  res.json({ success: true, message: 'Thread and conversation history deleted.' });
});

// GET /api/ai/threads/:id/messages
router.get('/threads/:id/messages', authenticateToken, (req, res) => {
  const { id } = req.params;
  const messages = db.find('ai_conversations', c => c.userId === req.user.id && (c.threadId === id || (!c.threadId && id === 'default')));
  messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  res.json({ messages });
});

// POST /api/ai/chat (Send query to AI Health Copilot)
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { 
      message, 
      threadId, 
      mode = 'short', 
      preferred_language, 
      language, 
      history, 
      attachment,
      documentId
    } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const targetThreadId = threadId || 'default';
    const requestedLang = preferred_language || language || req.user.preferredLanguage || 'en';

    // Retrieve authorized personal document context if referenced
    let documentContext = null;
    if (documentId) {
      const doc = db.findOne('user_documents', d => d.id === documentId && d.userId === req.user.id);
      if (doc) {
        documentContext = {
          title: doc.title,
          documentType: doc.documentType,
          extractedData: doc.extractedData,
          summary: doc.summary
        };
      }
    }

    // Build context if attachment metadata provided in body
    let queryWithAttachment = message.trim();
    if (attachment && attachment.name) {
      queryWithAttachment += ` [Attached: ${attachment.name}]`;
    }

    const response = await aiCopilotService.generateResponse(
      req.user.id, 
      queryWithAttachment, 
      mode, 
      requestedLang, 
      history, 
      documentContext
    );

    // Persist user message
    db.insert('ai_conversations', {
      userId: req.user.id,
      threadId: targetThreadId,
      role: 'user',
      content: message.trim(),
      attachment: attachment || null,
      documentId: documentId || null,
      mode: mode,
      createdAt: new Date().toISOString()
    });

    // Persist assistant response
    const assistantMsg = db.insert('ai_conversations', {
      userId: req.user.id,
      threadId: targetThreadId,
      role: 'assistant',
      content: response.reply,
      mode: response.mode,
      language: requestedLang,
      userDataCitations: response.userDataCitations || [],
      ragSources: response.ragSources || [],
      hasEmergencyWarning: response.hasEmergencyWarning || false,
      disclaimer: response.disclaimer,
      createdAt: new Date().toISOString()
    });

    // Update thread timestamp & count
    if (targetThreadId !== 'default') {
      const thread = db.findOne('ai_threads', t => t.id === targetThreadId);
      if (thread) {
        db.update('ai_threads', t => t.id === targetThreadId, {
          messageCount: (thread.messageCount || 0) + 2,
          updatedAt: new Date().toISOString()
        });
      }
    }

    res.json({
      success: true,
      messageId: assistantMsg.id,
      reply: response.reply,
      mode: response.mode,
      language: requestedLang,
      userDataCitations: response.userDataCitations || [],
      ragSources: response.ragSources || [],
      contextUsed: response.contextUsed || {},
      hasEmergencyWarning: response.hasEmergencyWarning || false,
      disclaimer: response.disclaimer
    });
  } catch (err) {
    console.error('AI Copilot error:', err);
    res.status(500).json({ error: 'Failed to generate copilot response: ' + err.message });
  }
});

// POST /api/ai/analyze-document (Medical Report & Prescription OCR Analysis)
router.post('/analyze-document', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No document file was uploaded. Please upload a PDF, JPG, or PNG file.' });
    }

    const { mode = 'short', language = 'en', thread_id = 'default', document_type } = req.body;
    const filePath = file.path;
    const originalName = file.originalname || 'document.png';
    const mimeType = file.mimetype || 'image/png';
    const ext = path.extname(originalName).toLowerCase();

    // 1. Determine Document Type (Prescription vs Lab Report)
    const isPrescriptionHint = document_type === 'prescription' || 
      /rx|prescription|medicine|tablet|capsule|marunthu/i.test(originalName);

    let extractedData = null;
    let reply = '';
    let clinicalBreakdown = '';
    let docType = isPrescriptionHint ? 'prescription' : 'report';

    if (isPrescriptionHint) {
      // Process Doctor Prescription
      const rxResult = await ocrService.processPrescription({ filePath, mimeType });
      
      if (!rxResult.isReadable || rxResult.medicines.length === 0) {
        reply = "We couldn't read this prescription clearly. Please upload a clearer image or confirm the medicine details with your pharmacist or prescriber.";
        clinicalBreakdown = "Document readability was insufficient for high-confidence pharmacological extraction.";
        extractedData = {
          isReadable: false,
          medicines: [],
          doctorName: rxResult.doctorName || 'Prescriber',
          prescriptionDate: rxResult.prescriptionDate || new Date().toISOString().split('T')[0]
        };
      } else {
        const medSummary = rxResult.medicines.map(m => {
          const doseStr = m.dose ? `${m.dose}` : `${m.strength}`;
          return `${m.medicineName} (${doseStr}, ${m.frequency})`;
        }).join(', ');

        reply = `I found the following medicine information in your prescription: ${medSummary}. Please follow your prescriber's instructions. If any name or dosage is unclear, confirm it with your pharmacist before taking the medicine.`;
        
        clinicalBreakdown = `Extracted ${rxResult.medicines.length} prescribed medication(s) by ${rxResult.doctorName || 'licensed prescriber'}.`;
        extractedData = {
          isReadable: true,
          medicines: rxResult.medicines,
          doctorName: rxResult.doctorName,
          clinicName: rxResult.clinicName,
          prescriptionDate: rxResult.prescriptionDate,
          doctorNotes: rxResult.doctorNotes
        };
      }
    } else {
      // Process Diagnostic / Lab Report
      let rawText = '';
      if (ext === '.pdf' || mimeType.includes('pdf')) {
        const pdfData = await ocrService.extractFromPdf(filePath);
        rawText = pdfData.text || '';
      } else {
        const ocrData = await ocrService.extractText(filePath, mimeType);
        rawText = ocrData.text || '';
      }

      if (!rawText || rawText.length < 15) {
        reply = "The uploaded file could not be read clearly. Please ensure the document is clear, well-lit, and not encrypted or empty, then retry.";
        clinicalBreakdown = "Insufficient optical character resolution in the uploaded document.";
        extractedData = { isReadable: false, findings: [] };
      } else {
        const labExtraction = extractionService.extractLabValues(rawText);
        const reportType = extractionService.detectReportType(rawText);
        const labName = extractionService.extractLabName(rawText);
        const reportDate = extractionService.extractReportDate(rawText);

        const findings = (labExtraction.values || []).map(v => ({
          metricName: v.metricName,
          result: v.value,
          unit: v.unit,
          referenceRange: v.referenceRange || 'Standard reference',
          status: v.status || 'NORMAL',
          isAbnormal: v.status === 'ELEVATED' || v.status === 'LOW'
        }));

        extractedData = {
          isReadable: true,
          reportType: reportType.name,
          labName: labName || 'Diagnostic Laboratory',
          reportDate: reportDate || new Date().toISOString().split('T')[0],
          findings: findings,
          totalFindings: findings.length
        };

        const abnormalItems = findings.filter(f => f.isAbnormal);
        if (abnormalItems.length > 0) {
          const itemNames = abnormalItems.map(i => `${i.metricName} (${i.result} ${i.unit})`).join(', ');
          reply = `Your ${reportType.name} shows that ${itemNames} is outside the standard reference range. This can happen for several reasons and does not confirm a disease by itself. Please discuss it with your doctor, who can interpret it alongside your symptoms and medical history.`;
        } else if (findings.length > 0) {
          reply = `I have analyzed your ${reportType.name}. I identified ${findings.length} biomarker(s) within the reported ranges. Please review the details below and share them with your clinician.`;
        } else {
          reply = `Your report has been processed. We extracted clinical text from ${originalName}. If you have questions about specific results, feel free to ask me.`;
        }

        clinicalBreakdown = `Identified ${findings.length} clinical metric(s) from ${reportType.name}.`;
      }
    }

    // 2. Persist to User's Private Document Collection (User Isolation)
    const newDoc = db.insert('user_documents', {
      userId: req.user.id,
      filename: originalName,
      filePath: filePath,
      fileSize: file.size,
      mimeType: mimeType,
      documentType: docType,
      title: originalName.replace(/\.[^/.]+$/, ''),
      extractedData: extractedData,
      summary: reply,
      createdAt: new Date().toISOString()
    });

    const disclaimer = "I'm an AI health assistant, not a doctor. I can help explain health information, but a qualified healthcare professional should make medical decisions.";
    const fullAssistantContent = `${reply}\n\n---\n*${disclaimer}*`;

    // 3. Persist Messages into Active Conversation Thread
    db.insert('ai_conversations', {
      userId: req.user.id,
      threadId: thread_id,
      role: 'user',
      content: `Analyze uploaded ${docType}: ${originalName}`,
      attachment: { name: originalName, type: docType, size: (file.size / 1024).toFixed(1) + ' KB' },
      documentId: newDoc.id,
      mode: mode,
      createdAt: new Date().toISOString()
    });

    db.insert('ai_conversations', {
      userId: req.user.id,
      threadId: thread_id,
      role: 'assistant',
      content: fullAssistantContent,
      mode: mode,
      language: language,
      documentId: newDoc.id,
      documentAnalysis: {
        documentType: docType,
        filename: originalName,
        ...extractedData
      },
      disclaimer: disclaimer,
      createdAt: new Date().toISOString()
    });

    res.json({
      success: true,
      documentId: newDoc.id,
      filename: originalName,
      documentType: docType,
      reply: fullAssistantContent,
      clinicalBreakdown: clinicalBreakdown,
      extractedData: extractedData,
      citations: [`Document: ${originalName}`],
      disclaimer: disclaimer
    });
  } catch (err) {
    console.error('Analyze document error:', err);
    res.status(500).json({ error: 'Failed to process medical document: ' + err.message });
  }
});

// GET /api/ai/user-documents (List user's private documents with strict isolation)
router.get('/user-documents', authenticateToken, (req, res) => {
  try {
    const docs = db.find('user_documents', d => d.userId === req.user.id);
    const sanitized = docs.map(d => ({
      id: d.id,
      filename: d.filename,
      title: d.title || d.filename,
      documentType: d.documentType,
      fileSize: d.fileSize,
      summary: d.summary,
      itemCount: d.extractedData?.medicines?.length || d.extractedData?.findings?.length || 0,
      createdAt: d.createdAt
    }));
    sanitized.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ documents: sanitized });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user documents.' });
  }
});

// DELETE /api/ai/user-documents/:id (Delete user document and remove extracted text/embeddings)
router.delete('/user-documents/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.findOne('user_documents', d => d.id === id && d.userId === req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Document not found or unauthorized.' });
    }

    // Safely remove file on disk if exists
    if (existing.filePath && fs.existsSync(existing.filePath)) {
      try {
        fs.unlinkSync(existing.filePath);
      } catch (e) {
        console.warn('Could not delete file from disk:', e.message);
      }
    }

    db.delete('user_documents', d => d.id === id && d.userId === req.user.id);
    res.json({ success: true, message: 'Document and extracted representations deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete document: ' + err.message });
  }
});

// GET /api/ai/history (Legacy flat history support)
router.get('/history', authenticateToken, (req, res) => {
  const history = db.find('ai_conversations', c => c.userId === req.user.id);
  history.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  res.json({ history: history.slice(-50) });
});

// DELETE /api/ai/history (Clear all)
router.delete('/history', authenticateToken, (req, res) => {
  db.delete('ai_conversations', c => c.userId === req.user.id);
  db.delete('ai_threads', t => t.userId === req.user.id);
  res.json({ success: true, message: 'All AI conversation history cleared.' });
});

module.exports = router;
