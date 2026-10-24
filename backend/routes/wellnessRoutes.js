const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

// GET /api/wellness/summary
router.get('/summary', authenticateToken, (req, res) => {
  const today = getTodayString();
  let log = db.findOne('wellness_logs', w => w.userId === req.user.id && w.date === today);

  if (!log) {
    log = {
      userId: req.user.id,
      date: today,
      waterGlasses: 5,
      waterMl: 1250,
      targetWaterMl: 2500,
      steps: 4250,
      targetSteps: 7000,
      activeMinutes: 35,
      sleepHours: 7.2,
      nutritionNotes: 'Balanced high-fiber Mediterranean diet with reduced sodium.'
    };
  }

  // Calculate user BMI if height and weight available in profile
  const profile = db.findOne('user_profiles', p => p.userId === req.user.id);
  let bmi = null;
  let bmiCategory = null;

  if (profile && profile.heightCm && profile.weightKg) {
    const heightM = profile.heightCm / 100;
    bmi = parseFloat((profile.weightKg / (heightM * heightM)).toFixed(1));
    if (bmi < 18.5) bmiCategory = 'Underweight';
    else if (bmi < 24.9) bmiCategory = 'Healthy Weight';
    else if (bmi < 29.9) bmiCategory = 'Overweight';
    else bmiCategory = 'Obese Range';
  }

  res.json({
    wellness: log,
    bmi,
    bmiCategory,
    hydrationPercentage: Math.min(100, Math.round(((log.waterMl || 0) / (log.targetWaterMl || 2500)) * 100)),
    activityPercentage: Math.min(100, Math.round(((log.steps || 0) / (log.targetSteps || 7000)) * 100))
  });
});

// POST /api/wellness/water
router.post('/water', authenticateToken, (req, res) => {
  try {
    const { deltaGlasses = 1, deltaMl = 250, reset = false } = req.body;
    const today = getTodayString();
    let log = db.findOne('wellness_logs', w => w.userId === req.user.id && w.date === today);

    if (!log) {
      log = db.insert('wellness_logs', {
        userId: req.user.id,
        date: today,
        waterGlasses: reset ? 0 : Math.max(0, deltaGlasses),
        waterMl: reset ? 0 : Math.max(0, deltaMl),
        targetWaterMl: 2500,
        steps: 4000,
        targetSteps: 7000,
        activeMinutes: 30,
        sleepHours: 7
      });
    } else {
      const newGlasses = reset ? 0 : Math.max(0, (log.waterGlasses || 0) + deltaGlasses);
      const newMl = reset ? 0 : Math.max(0, (log.waterMl || 0) + deltaMl);
      db.update('wellness_logs', w => w.id === log.id, {
        waterGlasses: newGlasses,
        waterMl: newMl
      });
      log = db.findById('wellness_logs', log.id);
    }

    res.json({
      success: true,
      wellness: log,
      hydrationPercentage: Math.min(100, Math.round(((log.waterMl || 0) / (log.targetWaterMl || 2500)) * 100))
    });
  } catch (err) {
    console.error('Update water error:', err);
    res.status(500).json({ error: 'Failed to update hydration.' });
  }
});

// POST /api/wellness/activity
router.post('/activity', authenticateToken, (req, res) => {
  try {
    const { steps, activeMinutes, sleepHours } = req.body;
    const today = getTodayString();
    let log = db.findOne('wellness_logs', w => w.userId === req.user.id && w.date === today);

    if (!log) {
      log = db.insert('wellness_logs', {
        userId: req.user.id,
        date: today,
        waterGlasses: 4,
        waterMl: 1000,
        targetWaterMl: 2500,
        steps: steps || 4000,
        targetSteps: 7000,
        activeMinutes: activeMinutes || 30,
        sleepHours: sleepHours || 7
      });
    } else {
      db.update('wellness_logs', w => w.id === log.id, {
        steps: steps !== undefined ? steps : log.steps,
        activeMinutes: activeMinutes !== undefined ? activeMinutes : log.activeMinutes,
        sleepHours: sleepHours !== undefined ? sleepHours : log.sleepHours
      });
      log = db.findById('wellness_logs', log.id);
    }

    res.json({ success: true, wellness: log });
  } catch (err) {
    console.error('Update activity error:', err);
    res.status(500).json({ error: 'Failed to update activity.' });
  }
});

module.exports = router;
