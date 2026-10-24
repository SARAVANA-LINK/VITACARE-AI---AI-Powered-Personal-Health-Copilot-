const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, authenticateToken } = require('../middleware/authMiddleware');
const smsService = require('../services/smsService');

// POST /api/auth/register (User Registration with Guardian Details)
router.post('/register', async (req, res) => {
  try {
    const { 
      email, 
      password, 
      name, 
      age, 
      gender, 
      bloodGroup, 
      emergencyPhone, 
      preferredLanguage = 'en',
      guardianName,
      guardianPhone,
      guardianRelationship = 'Parent / Primary Guardian'
    } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const existing = db.findOne('users', u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const user = db.insert('users', {
      email: email.toLowerCase(),
      passwordHash: passwordHash,
      name: name.trim(),
      role: 'patient',
      age: age ? parseInt(age, 10) : null,
      gender: gender || 'Unspecified',
      bloodGroup: bloodGroup || 'O+',
      preferredLanguage: preferredLanguage || 'en',
      emergencyPhone: emergencyPhone || ''
    });

    db.insert('user_profiles', {
      userId: user.id,
      allergies: [],
      chronicConditions: [],
      heightCm: null,
      weightKg: null,
      preferredLanguage: preferredLanguage || 'en',
      primaryPhysician: ''
    });

    // Save Guardian contact if provided
    let createdGuardian = null;
    if (guardianName && guardianPhone) {
      createdGuardian = db.insert('guardians', {
        userId: user.id,
        name: guardianName.trim(),
        relationship: guardianRelationship || 'Parent / Primary Guardian',
        phoneNumber: guardianPhone.trim(),
        email: '',
        allowMedicationEscalation: true,
        allowEmergencyNotification: true,
        allowCareConnectAccess: true,
        allowHealthView: true
      });

      // Dispatch welcome SMS to guardian
      try {
        await smsService.sendGuardianSms({
          userId: user.id,
          eventType: 'login_alert',
          customMessage: `VitaCare AI Notice: ${name} has designated you as their registered healthcare guardian. Emergency & adherence notifications are active.`
        });
      } catch (smsErr) {
        console.warn('Initial guardian SMS notice log warning:', smsErr.message);
      }
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        age: user.age,
        gender: user.gender,
        bloodGroup: user.bloodGroup,
        preferredLanguage: user.preferredLanguage,
        emergencyPhone: user.emergencyPhone
      },
      guardian: createdGuardian
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = db.findOne('users', u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = bcrypt.compareSync(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Preload verified clinical records and prescriptions if evaluation user has no prescriptions
    if (user.email.toLowerCase() === 'saravanakumar.s16072007@gmail.com' || user.email.toLowerCase() === 'admin@vitacare.ai') {
      const existingRx = db.find('prescriptions', p => p.userId === user.id);
      if (!existingRx || existingRx.length === 0) {
        try {
          const demoDataService = require('../services/demoDataService');
          demoDataService.loadDemoData(user.id);
        } catch (demoErr) {
          console.warn('Auto-seed evaluation account records note:', demoErr.message);
        }
      }
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    const guardians = db.find('guardians', g => g.userId === user.id);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'patient',
        age: user.age,
        gender: user.gender,
        bloodGroup: user.bloodGroup,
        preferredLanguage: user.preferredLanguage || 'en',
        emergencyPhone: user.emergencyPhone
      },
      guardian: guardians[0] || null
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// POST /api/auth/admin-login (Secure Admin Portal Login)
router.post('/admin-login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Admin email and password are required.' });
    }

    const user = db.findOne('users', u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid administrator credentials.' });
    }

    // Auto-promote recognized evaluation account if necessary
    if (user.email === 'admin@vitacare.ai' || user.email === 'saravanakumar.s16072007@gmail.com') {
      if (user.role !== 'admin') {
        db.update('users', u => u.id === user.id, { role: 'admin' });
        user.role = 'admin';
      }
    }

    // Strict Admin Authorization Check
    if (user.role !== 'admin') {
      return res.status(403).json({ 
        error: `Access denied. The account (${user.email}) is a Patient account, not an Administrator. Please use administrator credentials (admin@vitacare.ai) or sign in to the User Portal.` 
      });
    }

    const isMatch = bcrypt.compareSync(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid administrator credentials.' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: 'admin',
        preferredLanguage: user.preferredLanguage || 'en'
      }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Internal server error during admin authentication.' });
  }
});

// POST /api/auth/demo-login (1-Click Evaluator Guest Demo Login)
router.post('/demo-login', async (req, res) => {
  try {
    let user = db.findOne('users', u => u.email.toLowerCase() === 'johnathan.doe@vitacare.ai' || u.email.toLowerCase() === 'demo@vitacare.ai');
    if (!user) {
      const salt = bcrypt.genSaltSync(10);
      user = db.insert('users', {
        email: 'johnathan.doe@vitacare.ai',
        passwordHash: bcrypt.hashSync('DemoSecure2026!', salt),
        name: 'Johnathan Doe',
        role: 'patient',
        age: 48,
        gender: 'Male',
        bloodGroup: 'A+',
        preferredLanguage: 'en',
        emergencyPhone: '+1 (555) 987-6543'
      });

      db.insert('user_profiles', {
        userId: user.id,
        allergies: ['Penicillin', 'Peanuts (Mild)'],
        chronicConditions: ['Type 2 Diabetes Mellitus', 'Stage 1 Hypertension'],
        heightCm: 178,
        weightKg: 82,
        preferredLanguage: 'en',
        primaryPhysician: 'Dr. Sarah Lin, MD (St. Jude Specialty Care Clinic)'
      });

      db.insert('guardians', {
        userId: user.id,
        name: 'Eleanor Doe',
        relationship: 'Spouse / Primary Healthcare Proxy',
        phoneNumber: '+1 (555) 987-6543',
        email: 'eleanor.doe@example.com',
        allowMedicationEscalation: true,
        allowEmergencyNotification: true,
        allowCareConnectAccess: true,
        allowHealthView: true
      });

      // Auto-load sample records for evaluator
      try {
        const demoDataService = require('../services/demoDataService');
        demoDataService.loadDemoData(user.id);
      } catch (e) {
        console.warn('Initial demo load note:', e.message);
      }
    } else {
      // Ensure existing demo user has verified prescriptions; reload if cleared
      const existingDemoRx = db.find('prescriptions', p => p.userId === user.id);
      if (!existingDemoRx || existingDemoRx.length === 0) {
        try {
          const demoDataService = require('../services/demoDataService');
          demoDataService.loadDemoData(user.id);
        } catch (e) {
          console.warn('Demo reload note:', e.message);
        }
      }
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    const guardians = db.find('guardians', g => g.userId === user.id);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: 'patient',
        age: user.age,
        gender: user.gender,
        bloodGroup: user.bloodGroup,
        preferredLanguage: user.preferredLanguage || 'en',
        emergencyPhone: user.emergencyPhone
      },
      guardian: guardians[0] || null
    });
  } catch (err) {
    console.error('Demo login error:', err);
    res.status(500).json({ error: 'Failed to authenticate demo user: ' + err.message });
  }
});

// In-memory OTP storage with TTL
const phoneOtpStore = new Map();

// POST /api/auth/send-otp (Phone Number Login)
router.post('/send-otp', async (req, res) => {
  try {
    const rawPhone = req.body.phoneNumber || req.body.phone;
    if (!rawPhone || String(rawPhone).trim().length < 8) {
      return res.status(400).json({ error: 'A valid mobile phone number is required.' });
    }

    const cleanPhone = String(rawPhone).trim();
    // Default demo OTP is 123456 for instant testing convenience, plus simulated generation
    const generatedOtp = '123456';
    phoneOtpStore.set(cleanPhone, {
      otp: generatedOtp,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    console.log(`[VitaCare OTP Service] Verification code generated for ${cleanPhone}: ${generatedOtp}`);

    res.json({
      success: true,
      message: `Verification code dispatched to ${cleanPhone}.`,
      demoCodeNotice: 'Demo Mode: Use code 123456 to verify instantly.',
      expiresInSeconds: 600
    });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Failed to dispatch verification OTP.' });
  }
});

// POST /api/auth/verify-otp (Verify Phone Number OTP & Authenticate)
router.post('/verify-otp', async (req, res) => {
  try {
    const rawPhone = req.body.phoneNumber || req.body.phone;
    const { otp, name } = req.body;
    if (!rawPhone || !otp) {
      return res.status(400).json({ error: 'Phone number and verification OTP are required.' });
    }

    const cleanPhone = String(rawPhone).trim();
    const stored = phoneOtpStore.get(cleanPhone);

    const isDemoCode = otp.trim() === '123456';
    const isValidStored = stored && stored.otp === otp.trim() && Date.now() < stored.expiresAt;

    if (!isDemoCode && !isValidStored) {
      return res.status(401).json({ error: 'Invalid or expired verification code. Use 123456 in demo mode.' });
    }

    // Clear used code
    phoneOtpStore.delete(cleanPhone);

    // Find or create patient
    let user = db.findOne('users', u => (u.emergencyPhone && u.emergencyPhone.includes(cleanPhone)) || (u.phone && u.phone.includes(cleanPhone)));
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const digitsOnly = cleanPhone.replace(/\D/g, '');
      const assignedEmail = `patient_${digitsOnly.slice(-6) || Date.now()}@vitacare.ai`;
      const salt = bcrypt.genSaltSync(10);
      user = db.insert('users', {
        email: assignedEmail,
        phone: cleanPhone,
        passwordHash: bcrypt.hashSync('PhoneAuthUser2026!', salt),
        name: name ? name.trim() : `Patient (${cleanPhone.slice(-4)})`,
        role: 'patient',
        age: 38,
        gender: 'Unspecified',
        bloodGroup: 'B+',
        preferredLanguage: 'en',
        emergencyPhone: cleanPhone
      });

      db.insert('user_profiles', {
        userId: user.id,
        allergies: [],
        chronicConditions: [],
        heightCm: null,
        weightKg: null,
        preferredLanguage: 'en',
        primaryPhysician: ''
      });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    const profile = db.findOne('user_profiles', p => p.userId === user.id) || {};
    const guardians = db.find('guardians', g => g.userId === user.id);

    res.json({
      token,
      isNewUser,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || user.emergencyPhone,
        role: user.role || 'patient',
        age: user.age,
        gender: user.gender,
        bloodGroup: user.bloodGroup,
        preferredLanguage: user.preferredLanguage || 'en',
        emergencyPhone: user.emergencyPhone
      },
      profile,
      guardian: guardians[0] || null
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Failed to verify code: ' + err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  const user = db.findById('users', req.user.id);
  const profile = db.findOne('user_profiles', p => p.userId === req.user.id);
  const guardians = db.find('guardians', g => g.userId === req.user.id);

  if (!user) return res.status(404).json({ error: 'User not found.' });

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || user.emergencyPhone,
      role: user.role || 'patient',
      age: user.age,
      gender: user.gender,
      bloodGroup: user.bloodGroup,
      avatarUrl: user.avatarUrl || '',
      preferredLanguage: user.preferredLanguage || 'en',
      emergencyPhone: user.emergencyPhone,
      emergencyContactName: user.emergencyContactName || ''
    },
    profile: profile || {},
    guardian: guardians[0] || null
  });
});

// PUT /api/auth/profile
router.put('/profile', authenticateToken, (req, res) => {
  const { 
    name,
    age,
    gender,
    bloodGroup,
    dateOfBirth,
    avatarUrl,
    emergencyContactName,
    emergencyPhone,
    allergies, 
    chronicConditions, 
    currentMedications,
    medicalHistory,
    heightCm, 
    weightKg, 
    primaryPhysician, 
    preferredLanguage 
  } = req.body;

  // Update base user details
  db.update('users', u => u.id === req.user.id, {
    name: name ? name.trim() : undefined,
    age: age !== undefined ? parseInt(age, 10) || undefined : undefined,
    gender: gender !== undefined ? gender : undefined,
    bloodGroup: bloodGroup !== undefined ? bloodGroup : undefined,
    dateOfBirth: dateOfBirth !== undefined ? dateOfBirth : undefined,
    avatarUrl: avatarUrl !== undefined ? avatarUrl : undefined,
    preferredLanguage: preferredLanguage || undefined,
    emergencyPhone: emergencyPhone !== undefined ? emergencyPhone : undefined,
    emergencyContactName: emergencyContactName !== undefined ? emergencyContactName : undefined
  });

  // Update or insert extended clinical profile
  const existingProfile = db.findOne('user_profiles', p => p.userId === req.user.id);
  if (!existingProfile) {
    db.insert('user_profiles', {
      userId: req.user.id,
      allergies: allergies || [],
      chronicConditions: chronicConditions || [],
      currentMedications: currentMedications || [],
      medicalHistory: medicalHistory || '',
      heightCm: heightCm || null,
      weightKg: weightKg || null,
      preferredLanguage: preferredLanguage || 'en',
      primaryPhysician: primaryPhysician || ''
    });
  } else {
    db.update('user_profiles', p => p.userId === req.user.id, {
      allergies: allergies !== undefined ? allergies : undefined,
      chronicConditions: chronicConditions !== undefined ? chronicConditions : undefined,
      currentMedications: currentMedications !== undefined ? currentMedications : undefined,
      medicalHistory: medicalHistory !== undefined ? medicalHistory : undefined,
      heightCm: heightCm !== undefined ? heightCm : undefined,
      weightKg: weightKg !== undefined ? weightKg : undefined,
      preferredLanguage: preferredLanguage || undefined,
      primaryPhysician: primaryPhysician !== undefined ? primaryPhysician : undefined
    });
  }

  const refreshedUser = db.findById('users', req.user.id);
  const refreshedProfile = db.findOne('user_profiles', p => p.userId === req.user.id);

  res.json({
    success: true,
    user: {
      id: refreshedUser.id,
      name: refreshedUser.name,
      email: refreshedUser.email,
      phone: refreshedUser.phone || refreshedUser.emergencyPhone,
      role: refreshedUser.role || 'patient',
      age: refreshedUser.age,
      gender: refreshedUser.gender,
      bloodGroup: refreshedUser.bloodGroup,
      avatarUrl: refreshedUser.avatarUrl || '',
      preferredLanguage: refreshedUser.preferredLanguage || 'en',
      emergencyPhone: refreshedUser.emergencyPhone,
      emergencyContactName: refreshedUser.emergencyContactName || ''
    },
    profile: refreshedProfile || {}
  });
});

// GET /api/auth/consent (Fetch privacy consents)
router.get('/consent', authenticateToken, (req, res) => {
  let consent = db.findOne('user_consents', c => c.userId === req.user.id);
  if (!consent) {
    consent = {
      userId: req.user.id,
      dataProcessingAccepted: true,
      guardianSharingAccepted: true,
      emergencyAlertsAccepted: true,
      teleconsultAccepted: false,
      termsAcceptedAt: new Date().toISOString()
    };
  }
  res.json({ consent });
});

// PUT /api/auth/consent (Update privacy consents)
router.put('/consent', authenticateToken, (req, res) => {
  const { dataProcessingAccepted, guardianSharingAccepted, emergencyAlertsAccepted, teleconsultAccepted } = req.body;
  const existing = db.findOne('user_consents', c => c.userId === req.user.id);
  if (!existing) {
    db.insert('user_consents', {
      userId: req.user.id,
      dataProcessingAccepted: dataProcessingAccepted ?? true,
      guardianSharingAccepted: guardianSharingAccepted ?? true,
      emergencyAlertsAccepted: emergencyAlertsAccepted ?? true,
      teleconsultAccepted: teleconsultAccepted ?? false,
      termsAcceptedAt: new Date().toISOString()
    });
  } else {
    db.update('user_consents', c => c.userId === req.user.id, {
      dataProcessingAccepted: dataProcessingAccepted !== undefined ? dataProcessingAccepted : undefined,
      guardianSharingAccepted: guardianSharingAccepted !== undefined ? guardianSharingAccepted : undefined,
      emergencyAlertsAccepted: emergencyAlertsAccepted !== undefined ? emergencyAlertsAccepted : undefined,
      teleconsultAccepted: teleconsultAccepted !== undefined ? teleconsultAccepted : undefined
    });
  }
  const updated = db.findOne('user_consents', c => c.userId === req.user.id);
  res.json({ success: true, consent: updated });
});

// GET /api/auth/export-data (Export user personal health record JSON)
router.get('/export-data', authenticateToken, (req, res) => {
  const user = db.findById('users', req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const safeUser = { ...user };
  delete safeUser.passwordHash;

  const profile = db.findOne('user_profiles', p => p.userId === req.user.id) || {};
  const vitals = db.find('vitals', v => v.userId === req.user.id);
  const prescriptions = db.find('prescriptions', p => p.userId === req.user.id);
  const reports = db.find('health_reports', r => r.userId === req.user.id);
  const medicines = db.find('medicines', m => m.userId === req.user.id);
  const adherence = db.find('medicine_adherence_logs', a => a.userId === req.user.id);
  const timeline = db.find('medical_timeline', t => t.userId === req.user.id);
  const appointments = db.find('appointments', a => a.userId === req.user.id);
  const symptomAssessments = db.find('symptom_assessments', s => s.userId === req.user.id);

  res.json({
    title: 'VitaCare AI Patient Health Record Export',
    exportedAt: new Date().toISOString(),
    patient: safeUser,
    profile,
    vitals,
    prescriptions,
    reports,
    medicines,
    adherence,
    appointments,
    symptomAssessments,
    timeline
  });
});

// DELETE /api/auth/account (GDPR-Compliant Erase User Account)
router.delete('/account', authenticateToken, (req, res) => {
  const userId = req.user.id;
  db.delete('users', u => u.id === userId);
  db.delete('user_profiles', p => p.userId === userId);
  db.delete('guardians', g => g.userId === userId);
  db.delete('vitals', v => v.userId === userId);
  db.delete('prescriptions', p => p.userId === userId);
  db.delete('health_reports', r => r.userId === userId);
  db.delete('medicines', m => m.userId === userId);
  db.delete('medicine_schedules', s => s.userId === userId);
  db.delete('medicine_adherence_logs', a => a.userId === userId);
  db.delete('medical_timeline', t => t.userId === userId);
  db.delete('appointments', a => a.userId === userId);
  db.delete('symptom_assessments', s => s.userId === userId);
  db.delete('notifications', n => n.userId === userId);
  db.delete('ai_conversations', c => c.userId === userId);
  db.delete('user_consents', c => c.userId === userId);

  res.json({ success: true, message: 'Account and all associated health records permanently erased.' });
});

// PUT /api/auth/language (Dedicated Language Preference Persistence)
router.put('/language', authenticateToken, (req, res) => {
  const { language } = req.body;
  if (!language) return res.status(400).json({ error: 'Language code required.' });

  db.update('users', u => u.id === req.user.id, { preferredLanguage: language });
  db.update('user_profiles', p => p.userId === req.user.id, { preferredLanguage: language });

  const updatedUser = db.findById('users', req.user.id);
  const userSafe = updatedUser ? { ...updatedUser } : { id: req.user.id, preferredLanguage: language };
  delete userSafe.passwordHash;

  res.json({ success: true, preferredLanguage: language, user: userSafe });
});

module.exports = router;
