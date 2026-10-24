import React, { useState, useEffect } from 'react';
import { 
  Stethoscope, 
  AlertTriangle, 
  ShieldCheck, 
  Clock, 
  Send, 
  HelpCircle, 
  FileText, 
  PhoneCall, 
  CheckCircle2, 
  Info, 
  ChevronRight, 
  Activity, 
  History, 
  Copy, 
  Check, 
  Sparkles 
} from 'lucide-react';
import { api } from '../api/apiClient';
import { useTranslation } from '../i18n/LanguageContext';

export const SymptomGuidanceView = ({ onOpenSos, onScheduleAppointment }) => {
  const { t } = useTranslation();

  const [symptoms, setSymptoms] = useState('');
  const [duration, setDuration] = useState('1-2 days');
  const [severity, setSeverity] = useState(5);
  const [hasFever, setHasFever] = useState(false);
  const [context, setContext] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [assessment, setAssessment] = useState(null);
  
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [copiedQuestions, setCopiedQuestions] = useState(false);

  const quickSymptoms = [
    'Persistent dry cough',
    'Throbbing headache with light sensitivity',
    'Fever and body aches',
    'Chest tightness and shortness of breath',
    'Epigastric stomach burning after meals',
    'Sudden fatigue and dizziness',
    'Lower back pain and stiffness'
  ];

  const fetchHistory = async () => {
    try {
      const res = await api.getSymptomHistory();
      setHistory(res.history || []);
    } catch (err) {
      console.warn('Failed to fetch symptom history:', err.message);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleAssess = async (e) => {
    e?.preventDefault();
    if (!symptoms.trim()) {
      setErrorMsg('Please describe the symptoms you are experiencing.');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    try {
      const res = await api.assessSymptoms({
        symptoms: symptoms.trim(),
        duration,
        severity: parseInt(severity, 10),
        fever: hasFever,
        context: context.trim()
      });
      setAssessment(res.assessment);
      fetchHistory();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to process symptom assessment.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyQuestions = () => {
    if (!assessment?.doctorQuestions) return;
    const text = assessment.doctorQuestions.map((q, idx) => `${idx + 1}. ${q}`).join('\n');
    navigator.clipboard?.writeText(text);
    setCopiedQuestions(true);
    setTimeout(() => setCopiedQuestions(false), 2500);
  };

  // Live Red Flag Check
  const combinedLiveText = `${symptoms} ${context}`.toLowerCase();
  const hasLiveRedFlag = [
    'chest pain', 'crushing chest', 'difficulty breathing', 'shortness of breath',
    'slurred speech', 'facial drooping', 'stroke', 'unconscious', 'coughing blood'
  ].some(flag => combinedLiveText.includes(flag));

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* View Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Stethoscope size={24} color="var(--primary)" />
            Symptom Guidance & Clinical Triage
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Structured medical assessment, safe supportive care, and personalized doctor consultation checklist.
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowHistory(!showHistory)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <History size={15} />
          {showHistory ? 'Hide Assessment Log' : `View Past Assessments (${history.length})`}
        </button>
      </div>

      {/* Live Warning Alarm Banner */}
      {hasLiveRedFlag && (
        <div style={{
          background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
          border: '2px solid #ef4444',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '20px',
          color: '#991b1b',
          animation: 'pulse 2s infinite'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={22} />
              </div>
              <div>
                <strong style={{ fontSize: '1rem', color: '#7f1d1d' }}>URGENT WARNING SIGNS DETECTED</strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#991b1b' }}>
                  Symptoms matching acute cardiac, respiratory, or neurologic emergencies require immediate in-person evaluation.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onOpenSos && onOpenSos()}
                style={{ background: '#dc2626', borderColor: '#dc2626', fontWeight: 700 }}
              >
                Trigger SOS (108 / 911)
              </button>
              <a
                href="tel:108"
                className="btn btn-secondary btn-sm"
                style={{ color: '#dc2626', borderColor: '#fca5a5' }}
              >
                Call 108 / 112
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Past Assessment History Drawer */}
      {showHistory && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <h4 style={{ marginBottom: '14px', color: 'var(--navy)' }}>Past Symptom Guidance History</h4>
          {history.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No past assessments recorded yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {history.map(item => (
                <div
                  key={item.id}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: 'var(--bg-alt)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                  onClick={() => setAssessment(item)}
                >
                  <div>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--navy)' }}>{item.symptoms}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Severity: {item.severity}/10 • Duration: {item.duration} • {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`badge ${item.isEmergency ? 'badge-red' : item.urgencyLevel === 'URGENT_EVALUATION' ? 'badge-orange' : 'badge-green'}`}>
                    {item.urgencyLevel.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Grid: Input Form + Assessment Results */}
      <div style={{ display: 'grid', gridTemplateColumns: assessment ? '1fr 1fr' : '1fr', gap: '24px', alignItems: 'start' }}>
        {/* Symptom Input Form */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', color: 'var(--navy)' }}>
            Describe Your Symptoms
          </h3>

          {errorMsg && (
            <div className="error-state-box" style={{ padding: '8px 12px', fontSize: '0.82rem' }}>
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleAssess}>
            {/* Quick Symptom Chips */}
            <div style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Common Symptoms (Click to insert):
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {quickSymptoms.map((qs, i) => (
                  <button
                    key={i}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSymptoms(prev => prev ? `${prev}, ${qs}` : qs)}
                    style={{ fontSize: '0.74rem', padding: '3px 8px', borderRadius: '999px' }}
                  >
                    + {qs}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">What symptoms are you experiencing? *</label>
              <textarea
                required
                rows={4}
                className="form-input"
                placeholder="e.g., I have had a severe throbbing headache behind my right eye for the last 24 hours with mild nausea and sound sensitivity..."
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">How long has it lasted?</label>
                <select
                  className="form-select"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                >
                  <option value="Less than 24 hours">Less than 24 hours</option>
                  <option value="1-2 days">1–2 days</option>
                  <option value="3-5 days">3–5 days</option>
                  <option value="1-2 weeks">1–2 weeks</option>
                  <option value="More than 2 weeks">More than 2 weeks</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Severity: <strong>{severity}/10</strong> ({severity <= 3 ? 'Mild' : severity <= 6 ? 'Moderate' : 'Severe'})
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  style={{ width: '100%', accentColor: severity >= 8 ? '#dc2626' : severity >= 5 ? '#d97706' : 'var(--primary)' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={hasFever}
                  onChange={(e) => setHasFever(e.target.checked)}
                />
                <span>I have measured a fever (temperature ≥ 100.4°F / 38°C)</span>
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">Additional Context (Medications, triggers, chronic conditions)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Taking Metformin for diabetes, symptoms started after skipped meal..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading || !symptoms.trim()}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {loading ? 'Evaluating Clinical Indicators...' : (
                <>
                  <Sparkles size={18} />
                  Analyze Symptoms & Triage Care
                </>
              )}
            </button>
          </form>
        </div>

        {/* Assessment Results Card */}
        {assessment && (
          <div className="card" style={{ border: assessment.isEmergency ? '2px solid #ef4444' : undefined }}>
            {/* Triage Urgency Header */}
            <div style={{
              padding: '16px',
              borderRadius: '12px',
              background: assessment.isEmergency ? '#fef2f2' : assessment.urgencyLevel === 'URGENT_EVALUATION' ? '#fffbeb' : '#f0fdf4',
              border: `1px solid ${assessment.isEmergency ? '#fecaca' : assessment.urgencyLevel === 'URGENT_EVALUATION' ? '#fde68a' : '#bbf7d0'}`,
              marginBottom: '18px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: assessment.isEmergency ? '#991b1b' : assessment.urgencyLevel === 'URGENT_EVALUATION' ? '#92400e' : '#166534' }}>
                  Recommended Care Level
                </span>
                <span className={`badge ${assessment.isEmergency ? 'badge-red' : assessment.urgencyLevel === 'URGENT_EVALUATION' ? 'badge-orange' : 'badge-green'}`}>
                  {assessment.urgencyLevel.replace(/_/g, ' ')}
                </span>
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy)' }}>
                {assessment.recommendedFacility}
              </div>
            </div>

            {/* Emergency Guidance if flag triggered */}
            {assessment.emergencyGuidance && (
              <div style={{ background: '#fee2e2', padding: '14px', borderRadius: '10px', marginBottom: '16px', color: '#991b1b', fontSize: '0.85rem' }}>
                <div style={{ fontWeight: 800, marginBottom: '4px' }}>🚨 {assessment.emergencyGuidance.title}</div>
                <p style={{ margin: 0, lineHeight: 1.5 }}>{assessment.emergencyGuidance.action}</p>
              </div>
            )}

            {/* Possible Explanations (Non-diagnostic) */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h4 style={{ fontSize: '0.95rem', color: 'var(--navy)', margin: 0 }}>
                  General Possible Explanations
                </h4>
                <span style={{ fontSize: '0.68rem', background: 'var(--bg-alt)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                  Non-Diagnostic Educational Context
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {assessment.possibleExplanations?.map((exp, idx) => (
                  <div key={idx} style={{ padding: '10px 12px', background: 'var(--bg-alt)', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary-dark)' }}>
                      • {exp.title}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>
                      {exp.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Doctor Consultation Checklist */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h4 style={{ fontSize: '0.95rem', color: 'var(--navy)', margin: 0 }}>
                  📋 Questions for Your Doctor
                </h4>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopyQuestions}
                  style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                >
                  {copiedQuestions ? <Check size={12} color="green" /> : <Copy size={12} />}
                  {copiedQuestions ? 'Copied' : 'Copy Checklist'}
                </button>
              </div>
              <ul style={{ paddingLeft: '18px', margin: 0, fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {assessment.doctorQuestions?.map((q, idx) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>{q}</li>
                ))}
              </ul>
            </div>

            {/* Safe Supportive Next Steps */}
            <div style={{ marginBottom: '18px' }}>
              <h4 style={{ fontSize: '0.95rem', color: 'var(--navy)', marginBottom: '8px' }}>
                🛡️ Safe Supportive Next Steps
              </h4>
              <ul style={{ paddingLeft: '18px', margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {assessment.safeNextSteps?.map((step, idx) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>{step}</li>
                ))}
              </ul>
            </div>

            {/* Schedule Visit Button */}
            {onScheduleAppointment && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onScheduleAppointment()}
                style={{ width: '100%', marginBottom: '10px' }}
              >
                Schedule Doctor Appointment
              </button>
            )}

            {/* Medical Disclaimer */}
            <div style={{
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              borderTop: '1px solid var(--border-light)',
              paddingTop: '10px',
              lineHeight: 1.4
            }}>
              ⚖️ <strong>Medical Disclaimer:</strong> This symptom guidance report is generated for educational purposes and safe care triage only. It does not replace clinical consultation, physical examination, or treatment by a licensed physician.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
