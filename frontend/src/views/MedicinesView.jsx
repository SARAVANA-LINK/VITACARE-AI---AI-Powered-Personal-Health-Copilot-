import React, { useState, useEffect } from 'react';
import { 
  Pill, 
  Plus, 
  Clock, 
  CheckCircle, 
  XCircle, 
  PhoneCall, 
  Calendar, 
  AlertCircle, 
  X, 
  Check, 
  Bell, 
  ShieldAlert, 
  History, 
  RefreshCw, 
  ChevronRight,
  UserCheck,
  Camera,
  Volume2
} from 'lucide-react';
import { api } from '../api/apiClient';
import { useTranslation } from '../i18n/LanguageContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { PillConsumptionTrackerModal } from '../components/PillConsumptionTrackerModal';

export const MedicinesView = ({ onAddPrescription, onOpenReminder }) => {
  const { t } = useTranslation();
  const { speak } = useAccessibility();
  const [selectedTab, setSelectedTab] = useState('all');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [todaySchedules, setTodaySchedules] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [callAlertBanner, setCallAlertBanner] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [trackingTargetSchedule, setTrackingTargetSchedule] = useState(null);

  const [newMedForm, setNewMedForm] = useState({
    name: '',
    dosage: '500 mg',
    frequency: 'Twice daily',
    intakeTimes: '08:00 AM, 08:00 PM',
    duration: '30 days',
    instructions: 'Take after food',
    startDate: new Date().toISOString().split('T')[0]
  });

  const fetchData = async () => {
    try {
      const [medsRes, schedRes, historyRes] = await Promise.all([
        api.getMedicines(),
        api.getTodaySchedule(),
        api.getAlertHistory().catch(() => ({ alerts: [] }))
      ]);
      setMedicines(medsRes.medicines || []);
      setTodaySchedules(schedRes.schedules || []);
      setAlertHistory(historyRes.alerts || []);
    } catch (err) {
      console.error('Error fetching medicine data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const handleRecordAdded = () => fetchData();
    window.addEventListener('vitacare_record_added', handleRecordAdded);
    const interval = setInterval(() => {
      fetchData();
    }, 8000);
    return () => {
      window.removeEventListener('vitacare_record_added', handleRecordAdded);
      clearInterval(interval);
    };
  }, []);

  const handleTakeNow = async (id, medName) => {
    try {
      setActionLoadingId(id);
      const res = await api.markMedicineTaken(id);
      setCallAlertBanner({
        type: 'verified',
        title: 'Medication Intake Verified',
        message: `Status updated to "Verified". Guardian alert dispatched: "${res.guardianAlert?.message || `VitaCare Alert: Dose confirmed for ${medName}`}"`
      });
      fetchData();
    } catch (err) {
      console.error(err);
      setCallAlertBanner({
        type: 'error',
        title: 'Verification Failed',
        message: err.message
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleTriggerWarningCall = async (scheduleId, medName) => {
    try {
      setActionLoadingId(scheduleId);
      const res = await api.triggerWarningCall(scheduleId);
      
      if (res.action === 'guardian_escalated') {
        setCallAlertBanner({
          type: 'escalation',
          title: '🚨 Alert Escalated to Guardian!',
          message: `Patient did not respond after 2 warning calls. Urgent notification sent to guardian ${res.guardianName} (${res.guardianPhone}): "${res.message}"`
        });
      } else {
        setCallAlertBanner({
          type: 'warning',
          title: `⚠️ Warning Call Attempt #${res.attemptCount} Dispatched`,
          message: `Automated warning call placed to patient's registered mobile number (${res.phoneNumber}): "${res.message}"`
        });
      }
      fetchData();
    } catch (err) {
      console.error('Warning call error:', err);
      setCallAlertBanner({
        type: 'error',
        title: 'Call Dispatch Failed',
        message: err.message
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSkip = async (id) => {
    try {
      await api.skipMedicine(id, 'Patient skipped dose');
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateMedicine = async (e) => {
    e.preventDefault();
    try {
      const timesArray = newMedForm.intakeTimes.split(',').map(t => t.trim()).filter(Boolean);
      await api.createMedicine({
        ...newMedForm,
        intakeTimes: timesArray
      });
      setIsAddModalOpen(false);
      setNewMedForm({
        name: '',
        dosage: '500 mg',
        frequency: 'Twice daily',
        intakeTimes: '08:00 AM, 08:00 PM',
        duration: '30 days',
        instructions: 'Take after food',
        startDate: new Date().toISOString().split('T')[0]
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      {/* Header and Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>{t('medicationManagement') || 'Medication Management & Escalation'}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {t('medicationManagementSubtitle') || 'Daily scheduled regimen, dynamic dose verification, two-attempt patient warning calls, and guardian escalation.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => setIsHistoryOpen(!isHistoryOpen)}>
            <History size={16} /> {isHistoryOpen ? (t('hideAlertLog') || 'Hide Alert Log') : `${t('showAlertLog') || 'Alert History'} (${alertHistory.length})`}
          </button>
          <button className="btn btn-secondary" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={16} /> {t('addManualMedicine') || 'Add Medicine'}
          </button>
          <button className="btn btn-primary" onClick={onAddPrescription}>
            <Plus size={16} /> + {t('addPrescription') || 'Add Prescription'}
          </button>
        </div>
      </div>

      {/* Alert Call Result Banner */}
      {callAlertBanner && (
        <div style={{
          background: callAlertBanner.type === 'escalation' ? '#fef2f2' :
                      callAlertBanner.type === 'verified' ? '#f0fdf4' : '#fffbeb',
          border: `1px solid ${
            callAlertBanner.type === 'escalation' ? '#f87171' :
            callAlertBanner.type === 'verified' ? '#86efac' : '#fcd34d'
          }`,
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            {callAlertBanner.type === 'escalation' ? (
              <ShieldAlert size={24} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
            ) : callAlertBanner.type === 'verified' ? (
              <CheckCircle size={24} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
            ) : (
              <PhoneCall size={24} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
            )}
            <div>
              <strong style={{
                fontSize: '1rem',
                color: callAlertBanner.type === 'escalation' ? '#991b1b' :
                       callAlertBanner.type === 'verified' ? '#166534' : '#92400e'
              }}>
                {callAlertBanner.title}
              </strong>
              <p style={{
                fontSize: '0.85rem',
                color: callAlertBanner.type === 'escalation' ? '#b91c1c' :
                       callAlertBanner.type === 'verified' ? '#15803d' : '#b45309',
                marginTop: '4px',
                lineHeight: 1.5
              }}>
                {callAlertBanner.message}
              </p>
            </div>
          </div>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => setCallAlertBanner(null)}
            style={{ padding: '4px 8px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ALERT & GUARDIAN ESCALATION HISTORY DRAWER (Requirement 5) */}
      {isHistoryOpen && (
        <div className="card" style={{ marginBottom: '24px', borderLeft: '5px solid #dc2626', background: '#fafafa' }}>
          <div className="card-header" style={{ justifyContent: 'space-between' }}>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991b1b' }}>
              <History size={18} /> {t('alertHistoryTitle') || 'Alert & Escalation Audit History'} ({alertHistory.length})
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={fetchData}>
              <RefreshCw size={14} /> {t('refresh') || 'Refresh'}
            </button>
          </div>

          {alertHistory.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '12px 0' }}>
              {t('noNotifications') || 'No alert notifications recorded yet.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
              {alertHistory.map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    background: '#fff',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.82rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className={`badge ${
                      alert.eventType === 'guardian_escalation' ? 'badge-red' :
                      alert.eventType === 'medicine_verified' ? 'badge-green' : 'badge-orange'
                    }`}>
                      {alert.eventType === 'guardian_escalation' ? (t('guardianEscalatedBadge') || '🚨 GUARDIAN ESCALATED') :
                       alert.eventType === 'medicine_verified' ? (t('verifiedAlertBadge') || '✅ VERIFIED ALERT') :
                       `⚠️ ${t('warningBadge') || 'WARNING'} #${alert.attemptCount || 1}`}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--navy)' }}>
                        {alert.message}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                        To: {alert.recipientName} ({alert.recipientPhone}) • {new Date(alert.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>
                    {alert.deliveryStatus}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4 FILTER TABS & TODAY'S SCHEDULE */}
      {(() => {
        const upcomingDoses = todaySchedules.filter(s => {
          const st = (s.status || '').toLowerCase();
          return st === 'pending' || st === 'scheduled' || st === 'due_now';
        });
        const completedDoses = todaySchedules.filter(s => {
          const st = (s.status || '').toLowerCase();
          return st === 'verified' || st === 'taken';
        });
        const missedDoses = todaySchedules.filter(s => {
          const st = (s.status || '').toLowerCase();
          return st === 'missed' || st === 'skipped' || s.warningCallsSent > 0;
        });
        const unconfirmedDoses = todaySchedules.filter(s => {
          const st = (s.status || '').toLowerCase();
          return st === 'tracking_failed' || st === 'patient_refused' || st === 'unconfirmed';
        });

        let displayedSchedules = todaySchedules;
        if (selectedTab === 'upcoming') displayedSchedules = upcomingDoses;
        else if (selectedTab === 'completed') displayedSchedules = completedDoses;
        else if (selectedTab === 'missed') displayedSchedules = missedDoses;
        else if (selectedTab === 'unconfirmed') displayedSchedules = unconfirmedDoses;

        return (
          <div className="card" style={{ marginBottom: '28px' }}>
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
              <div>
                <h3 className="card-title" style={{ fontSize: '1.35rem' }}>
                  <Clock size={22} color="var(--primary)" />
                  {t('todaysDoses') || "Today's Medicine Schedule"}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                  {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              {/* 4 Accessible Tabs */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${selectedTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedTab('all')}
                  style={{ minHeight: '40px', fontWeight: 700 }}
                >
                  {t('all') || 'All'} ({todaySchedules.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${selectedTab === 'upcoming' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedTab('upcoming')}
                  style={{ minHeight: '40px', fontWeight: 700 }}
                >
                  ⏳ {t('upcoming') || 'Upcoming'} ({upcomingDoses.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${selectedTab === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedTab('completed')}
                  style={{ minHeight: '40px', fontWeight: 700 }}
                >
                  ✅ {t('completed') || 'Completed'} ({completedDoses.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${selectedTab === 'missed' ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={() => setSelectedTab('missed')}
                  style={{ minHeight: '40px', fontWeight: 700 }}
                >
                  ❌ {t('missed') || 'Missed'} ({missedDoses.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${selectedTab === 'unconfirmed' ? 'btn-warning' : 'btn-secondary'}`}
                  onClick={() => setSelectedTab('unconfirmed')}
                  style={{ minHeight: '40px', fontWeight: 700 }}
                >
                  ⚠️ {t('statusUnconfirmed') || 'Unconfirmed'} ({unconfirmedDoses.length})
                </button>
              </div>
            </div>

            {/* Clinical Safety Banner */}
            <div style={{
              margin: '0 20px 16px 20px',
              padding: '10px 16px',
              background: '#eff6ff',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '0.9rem',
              color: '#1e40af'
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>
                <strong>{t('safetyReminder') || 'Safety Reminder'}:</strong> {t('safetyReminderText') || "Follow your doctor's exact instructions. If you miss a dose, take it when remembered unless it is close to your next scheduled time. Never double a dose."}
              </span>
            </div>

            {displayedSchedules.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <CheckCircle size={40} style={{ margin: '0 auto 10px auto', color: 'var(--teal)' }} />
                <h4 style={{ fontSize: '1.2rem', color: 'var(--navy)', marginBottom: '4px' }}>
                  {t('noMedicationsCategory') || 'No medications in this category'}
                </h4>
                <p style={{ fontSize: '0.95rem' }}>
                  {t('selectAnotherTab') || 'Select another tab above or view your active medicines catalog.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '0 20px 20px 20px' }}>
                {displayedSchedules.map(item => {
                  const rawStatus = (item.status || 'Pending').toLowerCase();
                  const isVerified = rawStatus === 'verified' || rawStatus === 'taken';
                  const isMissed = rawStatus === 'missed' || rawStatus === 'skipped';
                  const isUnconfirmed = rawStatus === 'tracking_failed' || rawStatus === 'patient_refused' || rawStatus === 'unconfirmed';
                  const attempts = item.warningCallsSent || 0;

                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: '20px 24px',
                        borderRadius: 'var(--radius-xl)',
                        border: `2px solid ${isVerified ? 'var(--status-green-border)' : isMissed ? 'var(--status-red-border)' : isUnconfirmed ? 'var(--status-orange-border)' : 'var(--border-light)'}`,
                        background: isVerified ? 'var(--status-green-bg)' : isMissed ? 'var(--status-red-bg)' : isUnconfirmed ? 'var(--status-orange-bg)' : '#ffffff',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '16px',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
                      }}
                    >
                      <div style={{ maxWidth: '600px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy)' }}>
                            ⏰ {item.scheduledTime}
                          </span>
                          {isVerified ? (
                            <span className="badge badge-green" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                              ✅ {t('statusVerified') || 'TAKEN - VERIFIED'}
                            </span>
                          ) : isMissed ? (
                            <span className="badge badge-red" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                              ❌ {t('statusMissed') || 'MISSED DOSE'}
                            </span>
                          ) : isUnconfirmed ? (
                            <span className="badge badge-orange" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                              ⚠️ {t('statusUnconfirmed') || 'UNCONFIRMED'}
                            </span>
                          ) : (
                            <span className="badge badge-blue" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                              ⏳ {t('statusPending') || 'PENDING INTAKE'}
                            </span>
                          )}
                          {attempts > 0 && (
                            <span className="badge badge-red" style={{ fontSize: '0.78rem' }}>
                              ⚠️ {t('reminderCalls') || 'Reminder Calls'}: {attempts}/2
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => speak(`${item.medicineName}, ${item.dosage}. Scheduled for ${item.scheduledTime}. Instructions: ${item.instructions || 'Take as prescribed.'}`)}
                            className="btn btn-secondary btn-sm"
                            style={{ minHeight: '34px', padding: '2px 8px', fontSize: '0.8rem', gap: '4px' }}
                            title="Read medicine details aloud"
                          >
                            <Volume2 size={14} color="var(--primary)" /> {t('readAloud') || 'Read Aloud'}
                          </button>
                        </div>

                        <h4 style={{ fontSize: '1.35rem', color: 'var(--navy)', margin: '0 0 6px 0', fontWeight: 800 }}>
                          {item.medicineName}
                        </h4>

                        <div style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                          {t('dosage') || 'Prescribed Dose'}: <strong>{item.dosage}</strong>
                        </div>

                        <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                          {t('instructions') || 'Instructions'}: <strong>{item.instructions || t('asPrescribed') || 'Take with water after food'}</strong>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {isVerified ? (
                          <span className="badge badge-green" style={{ padding: '10px 16px', fontSize: '0.95rem', fontWeight: 700 }}>
                            <CheckCircle size={18} /> {t('verifiedInRecords') || 'Verified in Records'}
                          </span>
                        ) : (
                          <>
                            <button
                              className="btn btn-secondary"
                              onClick={() => {
                                setConfirmDialog({
                                  title: `Skip ${item.medicineName}?`,
                                  message: 'Are you sure you wish to record this dose as skipped? Remember: never take a double dose later to compensate.',
                                  confirmLabel: t('confirmSkip') || 'Confirm Skip',
                                  onConfirm: () => {
                                    handleSkip(item.id);
                                    setConfirmDialog(null);
                                  }
                                });
                              }}
                              style={{ minHeight: '48px', fontWeight: 700 }}
                            >
                              {t('skip') || 'Skip Dose'}
                            </button>

                            {/* Warning Call Button */}
                            <button
                              className={`btn ${attempts >= 2 ? 'btn-danger' : 'btn-secondary'}`}
                              onClick={() => handleTriggerWarningCall(item.id, item.medicineName)}
                              disabled={actionLoadingId === item.id}
                              style={{ minHeight: '48px', fontWeight: 700, gap: '6px' }}
                            >
                              <PhoneCall size={16} />
                              {attempts === 0 ? (t('warningCall1') || 'Warning Call #1') :
                               attempts === 1 ? (t('warningCall2') || 'Warning Call #2') : (t('escalateGuardianBtn') || '🚨 Escalate Guardian')}
                            </button>

                            {/* Camera Verification Button */}
                            <button
                              className="btn btn-success btn-lg"
                              onClick={() => setTrackingTargetSchedule(item)}
                              style={{ fontWeight: 800, gap: '8px' }}
                            >
                              <Camera size={18} /> {t('actionMarkTaken') || 'Mark as Taken'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Confirmation Modal */}
      {confirmDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20, 33, 61, 0.7)',
            backdropFilter: 'blur(3px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          role="dialog"
          aria-modal="true"
        >
          <div style={{
            background: '#ffffff',
            borderRadius: 'var(--radius-xl)',
            padding: '28px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            border: '2px solid var(--border-light)'
          }}>
            <h3 style={{ fontSize: '1.35rem', color: 'var(--navy)', marginBottom: '10px' }}>
              {confirmDialog.title}
            </h3>
            <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '24px' }}>
              {confirmDialog.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmDialog(null)}
                style={{ minHeight: '48px', fontWeight: 700 }}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={confirmDialog.onConfirm}
                style={{ minHeight: '48px', fontWeight: 800 }}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE MEDICATIONS CATALOG */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <Pill size={20} color="var(--primary)" />
            {t('activeMedicinesTitle') || 'Active Prescribed Medications'} ({medicines.length})
          </h3>
        </div>

        {medicines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <p>{t('noActiveMedsMsg') || 'No active medicines in profile. Upload a prescription to automatically generate your regimen.'}</p>
          </div>
        ) : (
          <div className="grid-3">
            {medicines.map(m => (
              <div key={m.id} className="card" style={{ background: '#f8fafc', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '1.1rem', color: 'var(--navy)' }}>{m.name}</h4>
                  <span className="badge badge-green">{t('active') || 'ACTIVE'}</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  {t('dosage') || 'Dosage'}: <strong>{m.dosage}</strong>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  {t('frequency') || 'Frequency'}: {m.frequency}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  {t('intakeTimes') || 'Intake Times'}: {Array.isArray(m.intakeTimes) ? m.intakeTimes.join(', ') : m.intakeTimes}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '8px' }}>
                  {t('instructions') || 'Instructions'}: {m.instructions || (t('asPrescribed') || 'As prescribed')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Manual Medicine Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3 className="card-title">{t('addMedicationModalTitle') || 'Add Medication'}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsAddModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateMedicine}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{t('medicineName') || 'Medicine Name'}</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Paracetamol, Metformin"
                    value={newMedForm.name}
                    onChange={(e) => setNewMedForm({ ...newMedForm, name: e.target.value })}
                  />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">{t('dosage') || 'Dosage'}</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="e.g. 500 mg, 10 mg"
                      value={newMedForm.dosage}
                      onChange={(e) => setNewMedForm({ ...newMedForm, dosage: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('frequency') || 'Frequency'}</label>
                    <select
                      className="form-select"
                      value={newMedForm.frequency}
                      onChange={(e) => setNewMedForm({ ...newMedForm, frequency: e.target.value })}
                    >
                      <option value="Once daily">{t('onceDaily') || 'Once daily'}</option>
                      <option value="Twice daily">{t('twiceDaily') || 'Twice daily'}</option>
                      <option value="Three times daily">{t('threeTimesDaily') || 'Three times daily'}</option>
                      <option value="Every 8 hours">{t('every8Hours') || 'Every 8 hours'}</option>
                      <option value="Once daily at bedtime">{t('bedtime') || 'Once daily at bedtime'}</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('intakeTimes') || 'Intake Times (Comma-separated)'}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="08:00 AM, 08:00 PM"
                    value={newMedForm.intakeTimes}
                    onChange={(e) => setNewMedForm({ ...newMedForm, intakeTimes: e.target.value })}
                  />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">{t('duration') || 'Duration'}</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 30 days"
                      value={newMedForm.duration}
                      onChange={(e) => setNewMedForm({ ...newMedForm, duration: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('startDate') || 'Start Date'}</label>
                    <input
                      type="date"
                      className="form-input"
                      value={newMedForm.startDate}
                      onChange={(e) => setNewMedForm({ ...newMedForm, startDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('instructions') || 'Instructions'}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. After meals with water"
                    value={newMedForm.instructions}
                    onChange={(e) => setNewMedForm({ ...newMedForm, instructions: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  {t('cancel') || 'Cancel'}
                </button>
                <button type="submit" className="btn btn-primary">
                  {t('saveAndGenerateSchedule') || 'Save & Generate Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Real Camera Pill Consumption Tracking HUD Modal */}
      <PillConsumptionTrackerModal
        isOpen={!!trackingTargetSchedule}
        schedule={trackingTargetSchedule}
        onClose={() => setTrackingTargetSchedule(null)}
        onVerified={(res) => {
          if (trackingTargetSchedule) {
            const targetId = trackingTargetSchedule.id;
            setTodaySchedules(prev => prev.map(s => {
              if (s.id === targetId || s.scheduleId === targetId || (s.scheduleId && trackingTargetSchedule.scheduleId && s.scheduleId === trackingTargetSchedule.scheduleId && s.scheduledTime === trackingTargetSchedule.scheduledTime)) {
                return {
                  ...s,
                  status: 'Verified',
                  rawStatus: 'VERIFIED',
                  taken: true,
                  isVerified: true
                };
              }
              return s;
            }));
          }
          fetchData();
          setCallAlertBanner({
            type: 'verified',
            title: 'Medication Intake Verified',
            message: `Status updated to "Verified" via live AI camera tracking. Guardian alert dispatched: "${res.guardianMessage || 'Dose verified'}"`
          });
        }}
        onRefused={(res) => {
          fetchData();
          setCallAlertBanner({
            type: 'warning',
            title: 'Medication Refused by Patient',
            message: `Status updated to PATIENT_REFUSED. Warning call attempt #1 dispatched automatically.`
          });
        }}
      />
    </div>
  );
};
