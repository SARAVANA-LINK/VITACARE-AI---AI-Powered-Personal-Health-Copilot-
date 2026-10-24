const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');
const ocrService = require('../services/ocrService');
const extractionService = require('../services/extractionService');
const scheduleGenerator = require('../services/scheduleGenerator');

// Configure Multer storage
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `rx-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// POST /api/prescriptions/upload (File or Base64 camera capture)
router.post('/upload', authenticateToken, upload.any(), async (req, res) => {
  try {
    let filePath = '';
    let originalName = 'prescription_capture.png';
    let mimeType = 'image/png';

    const file = (req.files && req.files.length > 0) ? req.files[0] : req.file;
    if (file) {
      filePath = file.path;
      originalName = file.originalname;
      mimeType = file.mimetype;
    } else if (req.body.imageBase64) {
      // Process camera capture base64
      const matches = req.body.imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ error: 'Invalid base64 camera image payload.' });
      }
      mimeType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      const filename = `rx-cam-${Date.now()}.png`;
      filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, buffer);
      originalName = 'camera_capture_prescription.png';
    } else if (req.body.sampleText) {
      // Direct sample/demo text processing
      const filename = `rx-sample-${Date.now()}.txt`;
      filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, req.body.sampleText);
      originalName = 'sample_prescription.txt';
      mimeType = 'text/plain';
    } else {
      return res.status(400).json({ error: 'Please upload a prescription file or capture a photo.' });
    }

    // Step 1 & 2: Preprocess Image + Run Multimodal Clinical Vision OCR Extraction
    const extractionResult = await ocrService.processPrescription({
      filePath: filePath,
      mimeType: mimeType,
      sampleText: req.body.sampleText
    });

    // Save temporary prescription draft
    const draftRx = {
      tempId: `draft-${Date.now()}`,
      userId: req.user.id,
      filePath: path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/'),
      fileUrl: `/${path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/')}`,
      originalFilename: originalName,
      rawOcrText: extractionResult.rawOcrText || '',
      ocrConfidence: extractionResult.isReadable ? 95 : 40,
      doctorName: extractionResult.doctorName || 'Dr. Sarah Lin, MD',
      clinicName: extractionResult.clinicName || 'Specialty Care Clinic',
      prescriptionDate: extractionResult.prescriptionDate || new Date().toISOString().split('T')[0],
      doctorNotes: extractionResult.doctorNotes || '',
      medicines: extractionResult.medicines || [],
      isReadable: extractionResult.isReadable !== false && (extractionResult.medicines || []).length > 0,
      unreadableReason: extractionResult.unreadableReason || null,
      extractionStatus: (extractionResult.isReadable && (extractionResult.medicines || []).length > 0) ? 'AI EXTRACTED' : 'UNREADABLE'
    };

    res.json({
      success: true,
      draft: draftRx,
      message: draftRx.isReadable
        ? 'Prescription processed successfully. Please review and verify extracted medications before saving.'
        : (draftRx.unreadableReason || "We couldn't read this prescription clearly. Please upload a clearer image or enter the medicine details manually.")
    });
  } catch (err) {
    console.error('Prescription processing error:', err);
    res.status(500).json({ error: 'Failed to process prescription: ' + err.message });
  }
});

// POST /api/prescriptions/verify (User confirms/edits extracted medicines)
router.post('/verify', authenticateToken, (req, res) => {
  try {
    const {
      doctorName,
      clinicName,
      prescriptionDate,
      originalFilename,
      filePath,
      rawOcrText,
      medicines = []
    } = req.body;

    if (!medicines || medicines.length === 0) {
      return res.status(400).json({ error: 'Prescription must contain at least one verified medicine.' });
    }

    // Save permanent verified prescription
    const savedRx = db.insert('prescriptions', {
      userId: req.user.id,
      doctorName: doctorName || 'Physician',
      clinicName: clinicName || 'Medical Clinic',
      prescriptionDate: prescriptionDate || new Date().toISOString().split('T')[0],
      originalFilename: originalFilename || 'prescription.pdf',
      filePath: filePath || '',
      rawOcrText: rawOcrText || '',
      status: 'verified',
      confidenceScore: 95
    });

    // Auto-create medicines in database
    const createdMedicines = [];
    const createdSchedules = [];

    const today = new Date().toISOString().split('T')[0];
    const clientDate = req.body.clientDate || req.query.date || today;

    for (const med of medicines) {
      // The clinical regimen for active tracking starts TODAY (or future date if explicitly scheduled)
      const activeStartDate = (med.startDate && med.startDate >= today) ? med.startDate : today;

      const newMed = db.insert('medicines', {
        userId: req.user.id,
        prescriptionId: savedRx.id,
        name: med.medicineName || med.name,
        strength: med.strength || med.dosage || 'Standard dose',
        dose: med.dose || '1 tablet',
        dosage: med.dosage || med.strength || 'Standard dose',
        frequency: med.frequency || 'Once daily',
        mealRelation: med.mealRelation || 'After food',
        intakeTimes: Array.isArray(med.intakeTimes) && med.intakeTimes.length > 0 ? med.intakeTimes : ['08:00 AM'],
        duration: med.duration || '30 days',
        instructions: med.instructions || 'After meals with water',
        startDate: activeStartDate,
        doctorPrescriptionDate: prescriptionDate || today,
        isActive: true
      });

      createdMedicines.push(newMed);

      // Automatically generate daily schedules for this medicine starting from today
      const schedules = scheduleGenerator.generateScheduleForMedicine(newMed, clientDate);
      createdSchedules.push(...schedules);
    }

    // Add to Medical Timeline
    db.insert('medical_timeline', {
      userId: req.user.id,
      eventType: 'prescription_added',
      title: `Prescription Verified (${createdMedicines.length} Medicines)`,
      description: `Prescribed by ${savedRx.doctorName} at ${savedRx.clinicName}. Generated ${createdSchedules.length} scheduled doses.`,
      metadataJson: { prescriptionId: savedRx.id, medicineCount: createdMedicines.length },
      eventDate: savedRx.prescriptionDate
    });

    // Add notification
    db.insert('notifications', {
      userId: req.user.id,
      title: 'Prescription Verified & Schedules Created',
      message: `Successfully scheduled ${createdMedicines.length} medications from Dr. ${savedRx.doctorName}.`,
      type: 'report_verified',
      isDemo: false,
      isRead: false
    });

    res.status(201).json({
      success: true,
      prescription: savedRx,
      medicines: createdMedicines,
      schedulesGenerated: createdSchedules.length,
      message: 'Prescription verified and active medication schedules generated.'
    });
  } catch (err) {
    console.error('Prescription verification error:', err);
    res.status(500).json({ error: 'Failed to verify prescription: ' + err.message });
  }
});

// GET /api/prescriptions (List user's prescriptions with isolation)
router.get('/', authenticateToken, (req, res) => {
  const list = db.find('prescriptions', r => r.userId === req.user.id);
  res.json({ prescriptions: list });
});

// GET /api/prescriptions/:id
router.get('/:id', authenticateToken, (req, res) => {
  const rx = db.findOne('prescriptions', r => r.id === req.params.id && r.userId === req.user.id);
  if (!rx) return res.status(404).json({ error: 'Prescription not found.' });

  const meds = db.find('medicines', m => m.prescriptionId === rx.id && m.userId === req.user.id);
  res.json({ prescription: rx, medicines: meds });
});

module.exports = router;
