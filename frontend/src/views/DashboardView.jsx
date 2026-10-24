import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Pill, 
  FileText, 
  Activity, 
  CheckCircle, 
  Clock, 
  ArrowUpRight, 
  ShieldCheck, 
  Megaphone, 
  Sparkles, 
  Camera,
  Bot,
  Send,
  Video,
  UserCheck,
  Bell,
  HeartHandshake,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { api } from '../api/apiClient';
import { useTranslation } from '../i18n/LanguageContext';
import { PillConsumptionTrackerModal } from '../components/PillConsumptionTrackerModal';

export const DashboardView = ({ 
  onAddPrescription, 
  onAddReport, 
  onOpenMedicineReminder, 
  onViewReport, 
  setActiveView 
}) => {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [cmsConfig, setCmsConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [trackingTargetSchedule, setTrackingTargetSchedule] = useState(null);

  // Copilot quick question state
  const [copilotQuestion, setCopilotQuestion] = useState('');
  const [copilotAnswer, setCopilotAnswer] = useState(null);
  const [copilotLoading, setCopilotLoading] = useState(false);

  const fetchDashboard = async () => {
    try {
      const [overviewRes, cmsRes] = await Promise.all([
        api.getDashboardOverview(),
        api.getCmsConfig().catch(() => ({ modules: [], cards: [], announcements: [], content: {} }))
      ]);
      setData(overviewRes);
      setCmsConfig(cmsRes);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setErrorMsg('Failed to load dashboard overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(() => {
      fetchDashboard();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAskCopilot = async (qText) => {
    const query = qText || copilotQuestion;
    if (!query.trim()) return;
    try {
      setCopilotLoading(true);
      setCopilotAnswer(null);
      const res = await api.askAi(query, 'simple');
      setCopilotAnswer(res.reply);
    } catch (err) {
      console.error('Copilot query error:', err);
      setCopilotAnswer('Could not reach AI Health Copilot. Please check your network or try again.');
    } finally {
      setCopilotLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-muted)' }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          border: '3px solid var(--border-light)',
          borderTopColor: 'var(--primary)',
          margin: '0 auto 16px auto',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ fontWeight: 600, color: 'var(--navy)' }}>Loading your VitaCare AI Health Dashboard...</p>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const user = data?.user;
  const profile = data?.profile;
  const nextMed = data?.nextMedicine;
  const latestVitals = data?.latestVitals || [];
  const todaySchedules = data?.todaySchedules || [];
  const adherence = data?.adherence;
  const recentReports = data?.recentReports || [];
  const recentPrescriptions = data?.recentPrescriptions || [];
  const guardians = data?.guardians || [];
  const recentAlerts = data?.recentAlerts || [];
  const recentActivity = data?.recentActivity || [];
  const summaryPoints = data?.healthStatusSummary?.points || [];
  const announcements = (cmsConfig?.announcements || []).filter(a => a.isPublished !== false);

  const primaryGuardian = guardians.find(g => g.isPrimary) || guardians[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. DYNAMIC CMS ANNOUNCEMENTS */}
      {announcements.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {announcements.map((ann) => (
            <div
              key={ann.id}
              style={{
                background: ann.alertType === 'warning' ? '#fffbeb' :
                            ann.alertType === 'alert' ? '#fef2f2' :
                            ann.alertType === 'success' ? '#f0fdf4' : '#f0f9ff',
                border: `1px solid ${
                  ann.alertType === 'warning' ? '#fde68a' :
                  ann.alertType === 'alert' ? '#fca5a5' :
                  ann.alertType === 'success' ? '#86efac' : '#bae6fd'
                }`,
                borderRadius: 'var(--radius-lg)',
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
              }}
            >
              <Megaphone size={18} color={ann.alertType === 'alert' ? '#dc2626' : 'var(--primary)'} />
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '0.9rem', color: ann.alertType === 'alert' ? '#991b1b' : 'var(--navy)' }}>
                  {ann.title}
                </strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  {ann.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. PERSONALIZED WELCOME & QUICK ACTIONS BANNER */}
      <div className="action-banner" style={{
        background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 50%, #0ea5e9 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: '28px 32px',
        color: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px',
        boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.3)'
      }}>
        <div style={{ maxWidth: '650px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.04em'
            }}>
              PATIENT HEALTH PORTAL
            </span>
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 6px 0', color: '#fff' }}>
            {t('welcomeUser', { name: user?.name || 'Patient' })}
          </h2>
          <p style={{ margin: 0, fontSize: '0.92rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.5 }}>
            {t('tagline') || 'VitaCare AI • Clinical Adherence Supervision & Multilingual Personal Health Copilot'}
          </p>
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.85)', flexWrap: 'wrap' }}>
            <span>{t('bloodGroup')}: <strong>{user?.bloodGroup || 'Not specified'}</strong></span>
            <span>{t('age')}: <strong>{user?.age ? `${user.age} yrs` : 'Not recorded'}</strong></span>
            <span>Allergies: <strong>{profile?.allergies?.length || 'None'}</strong></span>
            <span>Language: <strong>{(user?.preferredLanguage || 'en').toUpperCase()}</strong></span>
          </div>
        </div>

        {/* Action Buttons for Elderly Users */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={onAddPrescription}
            id="btn-add-prescription-top"
            style={{
              background: '#ffffff',
              color: 'var(--primary-dark)',
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Plus size={18} /> {t('addPrescription')}
          </button>
          <button
            className="btn btn-secondary btn-lg"
            onClick={onAddReport}
            id="btn-add-health-report-top"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.4)',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Plus size={18} /> {t('addHealthReport')}
          </button>
        </div>
      </div>

      {/* 3. PROMINENT FEATURE: AI HEALTH COPILOT CARD */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
        border: '1.5px solid #bae6fd',
        padding: '24px 28px',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 4px 20px rgba(2, 132, 199, 0.08)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
            }}>
              <Bot size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--navy)', fontWeight: 800 }}>
                VitaCare AI Health Copilot
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Clinically grounded in your verified records & prescriptions
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-green" style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} /> GEMINI 3.5 ACTIVE
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setActiveView('copilot')}
              style={{ fontSize: '0.8rem' }}
            >
              Open Full Chat <ArrowUpRight size={14} />
            </button>
          </div>
        </div>

        {/* Input Bar */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
          <input
            type="text"
            className="input-field"
            value={copilotQuestion}
            onChange={(e) => setCopilotQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAskCopilot(); }}
            placeholder="Ask about medications, test reference ranges, or health trends..."
            style={{ flex: 1, padding: '12px 16px', fontSize: '0.92rem', borderRadius: 'var(--radius-lg)' }}
          />
          <button
            className="btn btn-primary"
            onClick={() => handleAskCopilot()}
            disabled={copilotLoading || !copilotQuestion.trim()}
            style={{ padding: '0 24px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Send size={16} /> {copilotLoading ? 'Thinking...' : 'Ask'}
          </button>
        </div>

        {/* Quick Consultation Prompt Chips */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => { setCopilotQuestion('What medicines are scheduled for today?'); handleAskCopilot('What medicines are scheduled for today?'); }}
            style={{ background: '#fff', border: '1px solid #bae6fd', color: '#0369a1', fontSize: '0.78rem', borderRadius: '999px', padding: '6px 14px' }}
          >
            💊 Today's Medicines
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => { setCopilotQuestion('Explain my latest blood glucose and BP readings'); handleAskCopilot('Explain my latest blood glucose and BP readings'); }}
            style={{ background: '#fff', border: '1px solid #bae6fd', color: '#0369a1', fontSize: '0.78rem', borderRadius: '999px', padding: '6px 14px' }}
          >
            🩸 Latest Glucose & BP
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => { setCopilotQuestion('Summarize my uploaded lab reports'); handleAskCopilot('Summarize my uploaded lab reports'); }}
            style={{ background: '#fff', border: '1px solid #bae6fd', color: '#0369a1', fontSize: '0.78rem', borderRadius: '999px', padding: '6px 14px' }}
          >
            🔬 Lab Report Summary
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => { setCopilotQuestion('What questions should I prepare for my next doctor visit?'); handleAskCopilot('What questions should I prepare for my next doctor visit?'); }}
            style={{ background: '#fff', border: '1px solid #bae6fd', color: '#0369a1', fontSize: '0.78rem', borderRadius: '999px', padding: '6px 14px' }}
          >
            🩺 Doctor Questions Prep
          </button>
        </div>

        {/* Inline Answer Display */}
        {copilotAnswer && (
          <div style={{
            marginTop: '16px',
            background: '#ffffff',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid #bae6fd',
            padding: '16px 20px',
            fontSize: '0.9rem',
            color: 'var(--navy)',
            lineHeight: 1.6,
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--primary)', fontWeight: 700, fontSize: '0.82rem' }}>
              <Bot size={16} /> COPILOT DIRECT ANSWER:
            </div>
            <div style={{ whiteSpace: 'pre-line' }}>{copilotAnswer}</div>
          </div>
        )}
      </div>

      {/* 4. NEXT SCHEDULED DOSE / REAL-TIME TRACKING HUD TRIGGER */}
      {nextMed ? (
        <div className="next-med-card" style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
          border: '1.5px solid #86efac',
          borderRadius: 'var(--radius-xl)',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 4px 16px rgba(22, 163, 74, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              background: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)'
            }}>
              <Pill size={28} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                UPCOMING SCHEDULED DOSE
              </span>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--navy)', margin: '2px 0 4px 0', fontWeight: 800 }}>
                {nextMed.medicineName}
              </h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                <span>Dose: <strong>{nextMed.dosage}</strong></span>
                <span>Time: <strong>{nextMed.scheduledTime}</strong></span>
                <span>Status: <strong style={{ color: '#d97706' }}>PENDING INTAKE</strong></span>
              </div>
            </div>
          </div>
          <div>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => setTrackingTargetSchedule(nextMed)}
              id="btn-track-pill-next"
              style={{
                background: '#16a34a',
                borderColor: '#16a34a',
                padding: '12px 24px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)'
              }}
            >
              <Camera size={18} /> {t('trackPillIntake') || 'Track Pill Intake'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          background: '#ffffff',
          border: '1px dashed var(--border-light)',
          borderRadius: 'var(--radius-xl)',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: 'var(--text-muted)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle size={22} color="var(--status-green)" />
            <span style={{ fontWeight: 600, color: 'var(--navy)' }}>All scheduled doses for today are completed and verified!</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setActiveView('medicines')}>
            {t('viewAllMedicines') || 'Manage Medicines'}
          </button>
        </div>
      )}

      {/* 5. MAIN 2-COLUMN GRID */}
      <div className="grid-main-side">
        {/* LEFT COLUMN: Vitals, Schedules, Health Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Latest Health Measurements */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Activity size={20} color="var(--primary)" />
                {t('biomarkers') || 'Health Measurements & Trends'}
              </h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setActiveView('tracker')}
              >
                Health Tracker <ArrowUpRight size={14} />
              </button>
            </div>

            {latestVitals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                <Activity size={36} style={{ margin: '0 auto 10px auto', opacity: 0.35 }} />
                <p style={{ fontWeight: 600, color: 'var(--navy)' }}>No health measurements recorded yet.</p>
                <p style={{ fontSize: '0.82rem', marginBottom: '14px' }}>Upload a lab report or log vitals to see trends and physiological ranges.</p>
                <button className="btn btn-primary btn-sm" onClick={onAddReport}>
                  + Add Health Report
                </button>
              </div>
            ) : (
              <div className="grid-3">
                {latestVitals.slice(0, 6).map((vital, idx) => (
                  <div key={idx} className="vital-stat-card">
                    <div className="vital-stat-top">
                      <span className="vital-name">{vital.metricName}</span>
                      <span className={`badge ${
                        vital.statusIndicator === 'normal' ? 'badge-green' :
                        vital.statusIndicator === 'elevated' ? 'badge-orange' : 'badge-blue'
                      }`}>
                        {vital.statusIndicator}
                      </span>
                    </div>
                    <div className="vital-value-display">
                      <span className="vital-value">{vital.value}</span>
                      <span className="vital-unit">{vital.unit}</span>
                    </div>
                    <div className="vital-meta">
                      <span>Ref: {vital.referenceRange || 'Standard'}</span>
                      <span>{vital.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Today's Medicine Schedule */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Pill size={20} color="var(--primary)" />
                {t('todaysDoses') || "Today's Medicine Schedule"}
              </h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setActiveView('medicines')}
              >
                Manage Schedule <ArrowUpRight size={14} />
              </button>
            </div>

            {todaySchedules.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                <Pill size={36} style={{ margin: '0 auto 10px auto', opacity: 0.35 }} />
                <p style={{ fontWeight: 600, color: 'var(--navy)' }}>No medicines scheduled for today.</p>
                <p style={{ fontSize: '0.82rem', marginBottom: '14px' }}>Add a prescription or medication regimen to activate adherence tracking.</p>
                <button className="btn btn-primary btn-sm" onClick={onAddPrescription}>
                  + Add Prescription
                </button>
              </div>
            ) : (
              <div>
                {todaySchedules.map((med) => (
                  <div key={med.id} className={`med-schedule-item ${med.status}`}>
                    <div className="med-schedule-time">
                      <Clock size={14} style={{ display: 'inline', marginRight: '4px' }} />
                      {med.scheduledTime}
                    </div>
                    <div className="med-schedule-info">
                      <div className="med-schedule-name">{med.medicineName}</div>
                      <div className="med-schedule-dose">
                        {med.dosage} • {med.instructions || 'After food'}
                      </div>
                    </div>
                    <div>
                      {med.status === 'taken' || med.status === 'Verified' ? (
                        <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={12} /> VERIFIED
                        </span>
                      ) : (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => setTrackingTargetSchedule(med)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                        >
                          <Camera size={13} /> {t('trackPillIntake') || 'Track Intake'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Medical Timeline Feed */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Calendar size={18} color="var(--primary)" />
                Medical Timeline
              </h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setActiveView('timeline')}
              >
                Full History <ArrowUpRight size={14} />
              </button>
            </div>

            {recentActivity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No clinical events recorded yet. Upload reports or confirm medication to build your history.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recentActivity.slice(0, 4).map((item, idx) => (
                  <div
                    key={item.id || idx}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-alt)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.85rem'
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--navy)' }}>{item.title}</strong>
                      <p style={{ margin: '2px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                        {item.description}
                      </p>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '12px' }}>
                      {item.eventDate || (item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Adherence, Care Connect, Guardian Alerts, Recent Reports */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Adherence Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <CheckCircle size={18} color="var(--primary)" />
                Medication Adherence
              </h3>
              <span className="badge badge-green">WEEKLY</span>
            </div>

            <div className="adherence-gauge" style={{ textAlign: 'center', padding: '16px 0' }}>
              <div className="adherence-score" style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--navy)' }}>
                {adherence?.adherencePercentage ?? 100}%
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Taken: <strong style={{ color: '#16a34a' }}>{adherence?.takenCount ?? 0}</strong> • Missed: <strong style={{ color: '#dc2626' }}>{adherence?.missedCount ?? 0}</strong>
              </p>

              {/* 7-Day Calendar Dots */}
              <div className="weekly-dots" style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '16px' }}>
                {(adherence?.weeklyCalendar || []).map((day, i) => (
                  <div key={i} className="day-dot-item" style={{ textAlign: 'center' }}>
                    <span className="day-label" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{day.day}</span>
                    <span className={`dot-indicator dot-${day.status}`} style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      display: 'inline-block',
                      background: day.status === 'taken' ? '#16a34a' : day.status === 'missed' ? '#dc2626' : '#cbd5e1'
                    }} title={`${day.date}: ${day.status}`} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Care Connect Quick Access Card */}
          <div className="card" style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
            border: '1px solid #bbf7d0'
          }}>
            <div className="card-header">
              <h3 className="card-title">
                <HeartHandshake size={18} color="#16a34a" />
                Care Connect
              </h3>
              <span className="badge badge-green">WEBRTC</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
              Live two-way encrypted video consultation with your primary registered guardian or healthcare proxy.
            </p>
            <div style={{
              background: '#fff',
              border: '1px solid #dcfce7',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              fontSize: '0.8rem',
              marginBottom: '14px'
            }}>
              <span style={{ color: 'var(--text-muted)' }}>Assigned Participant: </span>
              <strong style={{ color: '#166534' }}>{primaryGuardian ? `${primaryGuardian.name} (${primaryGuardian.relationship})` : 'Clinic Healthcare Proxy'}</strong>
            </div>
            <button
              className="btn btn-success btn-sm"
              onClick={() => setActiveView('careconnect')}
              style={{ width: '100%', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Video size={16} /> Start Video Consultation
            </button>
          </div>

          {/* Guardian & Alerts Status Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Bell size={18} color="var(--primary)" />
                Guardian Alerts
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setActiveView('guardian')}>
                Manage <ArrowUpRight size={14} />
              </button>
            </div>

            {guardians.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                <p>No guardian registered yet.</p>
                <button className="btn btn-secondary btn-sm" onClick={() => setActiveView('guardian')} style={{ marginTop: '8px' }}>
                  + Register Guardian
                </button>
              </div>
            ) : (
              <div>
                <div style={{
                  background: 'var(--bg-alt)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  marginBottom: '12px',
                  fontSize: '0.82rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Primary Contact:</span>
                    <strong style={{ color: 'var(--navy)' }}>{primaryGuardian.name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>SMS Dispatch:</span>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>Active (Verified Doses)</span>
                  </div>
                </div>

                {recentAlerts.length > 0 && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: '6px' }}>
                      Recent SMS Dispatches:
                    </span>
                    {recentAlerts.slice(0, 2).map((alt, i) => (
                      <div key={i} style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '4px', marginBottom: '4px' }}>
                        • {alt.messageContent}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recent Reports & Prescriptions */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <FileText size={18} color="var(--primary)" />
                {t('healthReports') || 'Reports & Prescriptions'}
              </h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setActiveView('reports')}
              >
                All Documents
              </button>
            </div>

            {recentReports.length === 0 && recentPrescriptions.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
                No medical reports or prescriptions uploaded yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recentReports.map(rep => (
                  <div
                    key={rep.id}
                    onClick={() => onViewReport ? onViewReport(rep) : setActiveView('reports')}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      cursor: 'pointer',
                      background: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--navy)' }}>{rep.reportType}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {rep.labName} • {rep.reportDate}
                      </div>
                    </div>
                    <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>
                      REPORT
                    </span>
                  </div>
                ))}

                {recentPrescriptions.map(rx => (
                  <div
                    key={rx.id}
                    onClick={() => setActiveView('medicines')}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      cursor: 'pointer',
                      background: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--navy)' }}>{rx.doctorName ? `Rx by Dr. ${rx.doctorName}` : 'Prescription Order'}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {rx.createdAt ? new Date(rx.createdAt).toLocaleDateString() : 'Active'}
                      </div>
                    </div>
                    <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>
                      PRESCRIPTION
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Real Camera Pill Consumption Tracking HUD Modal */}
      <PillConsumptionTrackerModal
        isOpen={!!trackingTargetSchedule}
        schedule={trackingTargetSchedule}
        onClose={() => setTrackingTargetSchedule(null)}
        onVerified={() => {
          fetchDashboard();
        }}
        onRefused={() => {
          fetchDashboard();
        }}
      />
    </div>
  );
};
