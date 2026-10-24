const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');
const scheduleGenerator = require('../services/scheduleGenerator');

// WebRTC Active Signal Store for peer negotiation
const activeSignals = new Map(); // sessionId -> { offer, answer, candidates: [] }

// POST /api/careconnect/start (Initialize a real video check-in session)
router.post('/start', authenticateToken, (req, res) => {
  const { caregiverId, medicineId, scheduleId, recipientName } = req.body;

  let assignedCaregiver = recipientName || null;
  let guardianId = caregiverId || null;

  if (guardianId) {
    const g = db.findOne('guardians', item => item.id === guardianId && item.userId === req.user.id);
    if (g) assignedCaregiver = `${g.name} (${g.relationship || 'Guardian'})`;
  }

  if (!assignedCaregiver) {
    const primaryG = db.findOne('guardians', item => item.userId === req.user.id && item.isPrimary);
    const anyG = primaryG || db.findOne('guardians', item => item.userId === req.user.id);
    if (anyG) {
      assignedCaregiver = `${anyG.name} (${anyG.relationship || 'Guardian'})`;
      guardianId = anyG.id;
    } else {
      const profile = db.findOne('user_profiles', p => p.userId === req.user.id);
      if (profile && profile.doctorName) {
        assignedCaregiver = `Dr. ${profile.doctorName} (Assigned Physician)`;
      } else {
        assignedCaregiver = 'Registered Caregiver / Family Contact';
      }
    }
  }

  const session = db.insert('careconnect_sessions', {
    userId: req.user.id,
    caregiverName: assignedCaregiver,
    guardianId: guardianId,
    medicineId: medicineId || null,
    scheduleId: scheduleId || null,
    scheduledTime: new Date().toISOString(),
    status: 'in_progress',
    adherenceConfirmed: false,
    notes: 'Real CareConnect video session initiated.',
    startedAt: new Date().toISOString(),
    completedAt: null,
    connectionQuality: 'Good',
    callDurationSeconds: 0
  });

  // Record call attempt in call_logs
  db.insert('call_logs', {
    userId: req.user.id,
    recipient: assignedCaregiver,
    recipientType: guardianId ? 'guardian' : 'caregiver',
    callType: 'careconnect_video',
    status: 'initiated',
    sessionId: session.id,
    createdAt: new Date().toISOString()
  });

  res.json({
    success: true,
    session,
    sessionMode: 'LIVE WEBRTC VIDEO SESSION',
    message: 'CareConnect video session initiated. Waiting for participant connection.'
  });
});

// POST /api/careconnect/signal (WebRTC SDP offer/answer/ICE exchange)
router.post('/signal', authenticateToken, (req, res) => {
  const { sessionId, type, payload } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required.' });
  }

  const session = db.findOne('careconnect_sessions', s => s.id === sessionId && s.userId === req.user.id);
  if (!session) {
    return res.status(404).json({ error: 'CareConnect session not found.' });
  }

  if (!activeSignals.has(sessionId)) {
    activeSignals.set(sessionId, { offer: null, answer: null, candidates: [] });
  }

  const signalData = activeSignals.get(sessionId);

  if (type === 'offer') {
    signalData.offer = payload;
  } else if (type === 'answer') {
    signalData.answer = payload;
  } else if (type === 'candidate') {
    signalData.candidates.push(payload);
  }

  res.json({ success: true, message: 'Signal registered successfully.' });
});

// GET /api/careconnect/signal/:sessionId (Retrieve peer signals)
router.get('/signal/:sessionId', authenticateToken, (req, res) => {
  const { sessionId } = req.params;
  const session = db.findOne('careconnect_sessions', s => s.id === sessionId && s.userId === req.user.id);
  if (!session) {
    return res.status(404).json({ error: 'CareConnect session not found.' });
  }

  const signalData = activeSignals.get(sessionId) || { offer: null, answer: null, candidates: [] };
  res.json(signalData);
});

// POST /api/careconnect/confirm-medication (Caregiver/Patient confirms medication intake during session)
router.post('/confirm-medication', authenticateToken, (req, res) => {
  const { sessionId, medicineId, scheduleId, notes } = req.body;
  const now = new Date().toISOString();

  const session = db.findOne('careconnect_sessions', s => s.id === sessionId && s.userId === req.user.id);

  if (session) {
    db.update('careconnect_sessions', s => s.id === session.id, {
      status: 'completed',
      adherenceConfirmed: true,
      notes: notes || 'Medication witnessed and confirmed during CareConnect video check-in.',
      completedAt: now
    });
  }

  // If a scheduleId was linked, mark the schedule as taken with careconnect verification
  if (scheduleId) {
    db.update('medicine_schedules', s => s.id === scheduleId && s.userId === req.user.id, {
      status: 'taken',
      takenAt: now,
      verificationSource: 'careconnect_video'
    });
  }

  // Record adherence log
  db.insert('medicine_adherence_logs', {
    userId: req.user.id,
    scheduleId: scheduleId || null,
    medicineId: medicineId || (session ? session.medicineId : null),
    eventType: 'taken',
    confirmedAt: now,
    confirmationSource: 'careconnect'
  });

  // Log to timeline
  db.insert('medical_timeline', {
    userId: req.user.id,
    eventType: 'careconnect_session',
    title: 'CareConnect Session Completed',
    description: `Medication witnessed by ${session ? session.caregiverName : 'Caregiver'}. User confirmation recorded.`,
    metadataJson: {
      sessionId: session ? session.id : null,
      verificationRule: 'User Confirmation Recorded'
    },
    eventDate: now.split('T')[0]
  });

  // Calculate new adherence score
  const adherence = scheduleGenerator.calculateAdherence(req.user.id);

  res.json({
    success: true,
    adherenceRecorded: true,
    adherence,
    safetyReport: {
      title: 'CareConnect Session Completed',
      userConfirmation: 'Confirmed by User & Caregiver',
      medicationAdherence: 'Recorded in Health Database',
      safetyPolicy: 'Consent-based session records mutual participation and confirmation.'
    }
  });
});

// POST /api/careconnect/end (End video session and save audit metadata)
router.post('/end', authenticateToken, (req, res) => {
  const { sessionId, durationSeconds = 0, notes } = req.body;
  const now = new Date().toISOString();

  if (sessionId) {
    const session = db.findOne('careconnect_sessions', s => s.id === sessionId && s.userId === req.user.id);
    if (session) {
      db.update('careconnect_sessions', s => s.id === sessionId, {
        status: 'completed',
        completedAt: now,
        callDurationSeconds: parseInt(durationSeconds, 10) || 0,
        notes: notes || session.notes || 'CareConnect video session ended safely.'
      });

      // Update call log
      const log = db.findOne('call_logs', l => l.sessionId === sessionId);
      if (log) {
        db.update('call_logs', l => l.id === log.id, {
          status: 'completed',
          duration: parseInt(durationSeconds, 10) || 0,
          endedAt: now
        });
      }
    }
    activeSignals.delete(sessionId);
  }

  res.json({ success: true, message: 'CareConnect session ended and metadata recorded.' });
});

// GET /api/careconnect/sessions (List past sessions)
router.get('/sessions', authenticateToken, (req, res) => {
  const list = db.find('careconnect_sessions', s => s.userId === req.user.id);
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ sessions: list });
});

module.exports = router;
