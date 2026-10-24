const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');
const aiCopilotService = require('../services/aiCopilotService');

// GET /api/ai/threads (List all conversation threads)
router.get('/threads', authenticateToken, (req, res) => {
  let threads = db.find('ai_threads', t => t.userId === req.user.id);
  if (threads.length === 0) {
    // Initialize default thread
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

// POST /api/ai/chat
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { 
      message, 
      threadId, 
      mode = 'simple', 
      preferred_language, 
      language, 
      history, 
      attachment 
    } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const targetThreadId = threadId || 'default';
    const requestedLang = preferred_language || language || req.user.preferredLanguage || 'en';

    // Build context if attachment provided
    let queryWithAttachment = message.trim();
    if (attachment && attachment.name) {
      queryWithAttachment += ` [Attached Document Context: ${attachment.name} (${attachment.type || 'file'})]`;
    }

    const response = await aiCopilotService.generateResponse(req.user.id, queryWithAttachment, mode, requestedLang, history);

    // Persist user message
    db.insert('ai_conversations', {
      userId: req.user.id,
      threadId: targetThreadId,
      role: 'user',
      content: message.trim(),
      attachment: attachment || null,
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
      hasEmergencyWarning: response.hasEmergencyWarning || false,
      disclaimer: response.disclaimer,
      createdAt: new Date().toISOString()
    });

    // Update thread timestamp & count if specific thread
    if (threadId && threadId !== 'default') {
      const thread = db.findOne('ai_threads', t => t.id === threadId);
      if (thread) {
        db.update('ai_threads', t => t.id === threadId, {
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
      contextUsed: response.contextUsed || {},
      hasEmergencyWarning: response.hasEmergencyWarning || false,
      disclaimer: response.disclaimer
    });
  } catch (err) {
    console.error('AI Copilot error:', err);
    res.status(500).json({ error: 'Failed to generate copilot response: ' + err.message });
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
