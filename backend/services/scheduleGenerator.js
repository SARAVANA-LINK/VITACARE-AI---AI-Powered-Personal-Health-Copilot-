const db = require('../db');

class ScheduleGenerator {
  /**
   * Generates daily medication schedule entries for a medicine.
   * For active medications, always anchors to today (or future start date)
   * so upcoming doses populate immediately in today's and future schedules.
   */
  generateScheduleForMedicine(medicine, anchorDate = null) {
    const userId = medicine.userId;
    const medicineId = medicine.id;
    const today = anchorDate || new Date().toISOString().split('T')[0];
    
    // Determine the base date:
    // If medicine.startDate is in the future, start from that future date.
    // If medicine.startDate is in the past (e.g. from an old scanned prescription date),
    // anchor it to TODAY so the patient immediately has active doses to track and take!
    let startDateStr = today;
    if (medicine.startDate && medicine.startDate > today) {
      startDateStr = medicine.startDate;
    }

    // Parse duration (default 30 days of coverage if not parsed, up to 90 days)
    let daysCount = 30;
    if (medicine.duration) {
      const match = medicine.duration.match(/([0-9]+)\s*(?:days?|d)/i);
      if (match) daysCount = Math.min(parseInt(match[1], 10), 90);
      const weekMatch = medicine.duration.match(/([0-9]+)\s*(?:weeks?|w)/i);
      if (weekMatch) daysCount = Math.min(parseInt(weekMatch[1], 10) * 7, 90);
      const monthMatch = medicine.duration.match(/([0-9]+)\s*(?:months?|m)/i);
      if (monthMatch) daysCount = Math.min(parseInt(monthMatch[1], 10) * 30, 90);
    }

    const intakeTimes = Array.isArray(medicine.intakeTimes) && medicine.intakeTimes.length > 0
      ? medicine.intakeTimes
      : ['08:00 AM'];

    const baseDate = new Date(startDateStr);
    const createdEvents = [];

    for (let dayOffset = 0; dayOffset < daysCount; dayOffset++) {
      const currentDate = new Date(baseDate);
      currentDate.setDate(baseDate.getDate() + dayOffset);
      const dateString = currentDate.toISOString().split('T')[0];

      for (const timeStr of intakeTimes) {
        // Check for existing schedule to avoid duplicates
        const existing = db.findOne('medicine_schedules', s => 
          s.userId === userId &&
          s.medicineId === medicineId &&
          s.scheduledDate === dateString &&
          s.scheduledTime === timeStr
        );

        if (!existing) {
          createdEvents.push({
            userId: userId,
            medicineId: medicineId,
            medicineName: medicine.name,
            dosage: medicine.dosage || medicine.strength || 'Standard dose',
            instructions: medicine.instructions || 'Take with water after meals',
            scheduledDate: dateString,
            scheduledTime: timeStr,
            status: 'Pending',
            warningAttemptsCount: 0,
            escalatedToGuardian: false,
            takenAt: null,
            reminderSent: false,
            notes: ''
          });
        }
      }
    }

    if (createdEvents.length > 0) {
      return db.insertMany('medicine_schedules', createdEvents);
    }

    return [];
  }

  /**
   * Calculates real adherence metrics based on stored schedules and logs
   */
  calculateAdherence(userId) {
    const allSchedules = db.find('medicine_schedules', s => s.userId === userId);
    const today = new Date().toISOString().split('T')[0];

    const pastAndTodaySchedules = allSchedules.filter(s => s.scheduledDate <= today);

    let taken = 0;
    let missed = 0;
    let pending = 0;
    let skipped = 0;

    for (const item of pastAndTodaySchedules) {
      const isTaken = item.status === 'Verified' || item.status === 'taken';
      const isMissed = item.status === 'Missed' || item.status === 'missed';
      const isSkipped = item.status === 'Skipped' || item.status === 'skipped';

      if (isTaken) taken++;
      else if (isMissed) missed++;
      else if (isSkipped) skipped++;
      else if (item.scheduledDate === today) pending++;
      else missed++; // past unconfirmed is counted as missed
    }

    const evaluated = taken + missed;
    const adherenceRate = evaluated > 0 ? Math.round((taken / evaluated) * 100) : 100;

    // Build 7-day calendar view for the past week
    const weeklyStatus = [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const dayName = days[d.getDay()];

      const dayItems = allSchedules.filter(s => s.scheduledDate === dStr);
      let dayStatus = 'none';

      if (dayItems.length > 0) {
        const dayTaken = dayItems.filter(s => s.status === 'Verified' || s.status === 'taken').length;
        const dayMissed = dayItems.filter(s => s.status === 'Missed' || s.status === 'missed' || (s.scheduledDate < today && s.status !== 'Verified' && s.status !== 'taken')).length;
        
        if (dayMissed > 0 && dayTaken === 0) dayStatus = 'missed';
        else if (dayMissed > 0) dayStatus = 'warning';
        else dayStatus = 'good';
      }

      weeklyStatus.push({
        date: dStr,
        day: dayName,
        status: dayStatus,
        totalScheduled: dayItems.length
      });
    }

    return {
      takenCount: taken,
      missedCount: missed,
      pendingCount: pending,
      skippedCount: skipped,
      adherencePercentage: adherenceRate,
      weeklyCalendar: weeklyStatus
    };
  }

  /**
   * Retrieves the next upcoming or pending medication dose for the patient.
   * Checks today first (sorted by scheduled time), then looks for the next upcoming dose in future.
   */
  getNextMedicine(userId, anchorDate = null) {
    const today = anchorDate || new Date().toISOString().split('T')[0];
    
    // 1. First look for pending or due doses TODAY (sorted by scheduled time)
    const todayPending = db.find('medicine_schedules', s => 
      s.userId === userId && 
      s.scheduledDate === today && 
      (s.status === 'Pending' || s.status === 'upcoming' || s.status === 'due_now' || s.status === 'TRACKING_FAILED' || s.status === 'Scheduled')
    );

    if (todayPending.length > 0) {
      todayPending.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
      return todayPending[0];
    }

    // 2. If no pending doses today, look for the next upcoming dose in the future
    const futurePending = db.find('medicine_schedules', s => 
      s.userId === userId && 
      s.scheduledDate > today && 
      (s.status === 'Pending' || s.status === 'upcoming' || s.status === 'due_now' || s.status === 'Scheduled')
    );

    if (futurePending.length > 0) {
      futurePending.sort((a, b) => {
        if (a.scheduledDate === b.scheduledDate) {
          return a.scheduledTime.localeCompare(b.scheduledTime);
        }
        return a.scheduledDate.localeCompare(b.scheduledDate);
      });
      return futurePending[0];
    }

    return null;
  }
}

module.exports = new ScheduleGenerator();
