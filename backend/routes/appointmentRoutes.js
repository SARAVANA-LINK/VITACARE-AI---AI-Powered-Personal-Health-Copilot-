const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');

// GET /api/appointments
router.get('/', authenticateToken, (req, res) => {
  const appointments = db.find('appointments', a => a.userId === req.user.id);
  appointments.sort((a, b) => new Date(`${a.appointmentDate}T${a.appointmentTime || '00:00'}`) - new Date(`${b.appointmentDate}T${b.appointmentTime || '00:00'}`));
  res.json({ appointments, count: appointments.length });
});

// POST /api/appointments
router.post('/', authenticateToken, (req, res) => {
  try {
    const doctorName = req.body.doctorName;
    const specialty = req.body.specialty || 'General Medicine';
    const clinicName = req.body.clinicName || req.body.facilityName || 'Outpatient Clinic';
    const appointmentDate = req.body.appointmentDate || req.body.date;
    const appointmentTime = req.body.appointmentTime || req.body.time || '10:00 AM';
    const location = req.body.location || '';
    const contactPhone = req.body.contactPhone || '';
    const reminderEnabled = req.body.reminderEnabled !== undefined ? req.body.reminderEnabled : true;
    const notes = req.body.notes || req.body.reason || '';

    if (!doctorName || !appointmentDate) {
      return res.status(400).json({ error: 'Doctor name and appointment date are required.' });
    }

    const newAppointment = db.insert('appointments', {
      userId: req.user.id,
      doctorName: doctorName.trim(),
      specialty: specialty || 'General Medicine',
      clinicName: clinicName || 'Outpatient Clinic',
      appointmentDate: appointmentDate,
      appointmentTime: appointmentTime || '10:00 AM',
      location: location || '',
      contactPhone: contactPhone || '',
      status: 'confirmed', // 'confirmed' | 'completed' | 'cancelled'
      reminderEnabled: !!reminderEnabled,
      notes: notes || '',
      createdAt: new Date().toISOString()
    });

    // Record timeline entry
    db.insert('medical_timeline', {
      userId: req.user.id,
      eventType: 'appointment_scheduled',
      title: `Appointment Booked: ${doctorName}`,
      description: `${specialty || 'Consultation'} with ${doctorName} at ${clinicName || 'Clinic'} on ${appointmentDate} (${appointmentTime || '10:00 AM'}).`,
      metadataJson: { appointmentId: newAppointment.id },
      eventDate: appointmentDate
    });

    // Send in-app notification
    db.insert('notifications', {
      userId: req.user.id,
      title: 'Appointment Confirmed',
      message: `Your visit with ${doctorName} is confirmed for ${appointmentDate} at ${appointmentTime || '10:00 AM'}.`,
      type: 'appointment',
      isRead: false,
      createdAt: new Date().toISOString()
    });

    res.status(201).json({ success: true, appointment: newAppointment });
  } catch (err) {
    console.error('Create appointment error:', err);
    res.status(500).json({ error: 'Failed to create appointment.' });
  }
});

// PUT /api/appointments/:id
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { 
      doctorName, 
      specialty, 
      clinicName, 
      appointmentDate, 
      appointmentTime, 
      location, 
      contactPhone, 
      status, 
      reminderEnabled, 
      notes 
    } = req.body;

    const existing = db.findOne('appointments', a => a.id === id && a.userId === req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    const updated = db.update('appointments', a => a.id === id && a.userId === req.user.id, {
      doctorName: doctorName !== undefined ? doctorName.trim() : undefined,
      specialty: specialty !== undefined ? specialty : undefined,
      clinicName: clinicName !== undefined ? clinicName : undefined,
      appointmentDate: appointmentDate !== undefined ? appointmentDate : undefined,
      appointmentTime: appointmentTime !== undefined ? appointmentTime : undefined,
      location: location !== undefined ? location : undefined,
      contactPhone: contactPhone !== undefined ? contactPhone : undefined,
      status: status !== undefined ? status : undefined,
      reminderEnabled: reminderEnabled !== undefined ? !!reminderEnabled : undefined,
      notes: notes !== undefined ? notes : undefined,
      updatedAt: new Date().toISOString()
    });

    res.json({ success: true, appointment: updated[0] });
  } catch (err) {
    console.error('Update appointment error:', err);
    res.status(500).json({ error: 'Failed to update appointment.' });
  }
});

// DELETE /api/appointments/:id
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const existing = db.findOne('appointments', a => a.id === id && a.userId === req.user.id);
  if (!existing) {
    return res.status(404).json({ error: 'Appointment not found.' });
  }

  db.delete('appointments', a => a.id === id && a.userId === req.user.id);
  res.json({ success: true, message: 'Appointment removed.' });
});

module.exports = router;
