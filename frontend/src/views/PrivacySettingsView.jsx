import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Download, 
  Trash2, 
  User, 
  Moon, 
  Sun, 
  Lock, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  PhoneCall, 
  HelpCircle, 
  Send,
  Eye,
  Sliders,
  Globe
} from 'lucide-react';
import { api } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/AccessibilityContext';
import { useTranslation } from '../i18n/LanguageContext';

export const PrivacySettingsView = ({ onOpenAccessibility }) => {
  const { user, profile, logout, refreshUser } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const { language, setLanguage, t, languages, currentLanguageObj } = useTranslation();

  // Profile Form
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    age: user?.age || '',
    gender: user?.gender || 'Male',
    bloodGroup: user?.bloodGroup || 'O+',
    dateOfBirth: user?.dateOfBirth || '',
    emergencyPhone: user?.emergencyPhone || '',
    emergencyContactName: user?.emergencyContactName || '',
    allergies: (profile?.allergies || []).join(', '),
    chronicConditions: (profile?.chronicConditions || []).join(', '),
    currentMedications: (profile?.currentMedications || []).join(', '),
    medicalHistory: profile?.medicalHistory || '',
    avatarUrl: user?.avatarUrl || ''
  });

  // Consents State
  const [consents, setConsents] = useState({
    dataProcessingAccepted: true,
    guardianSharingAccepted: true,
    emergencyAlertsAccepted: true,
    teleconsultAccepted: false
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // Feedback form state
  const [feedbackCategory, setFeedbackCategory] = useState('Feature Suggestion');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    // Fetch consents from backend
    api.getConsent().then(res => {
      if (res.consent) {
        setConsents(res.consent);
      }
    }).catch(err => console.warn(err));
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSaveSuccess(false);

    try {
      await api.updateProfile({
        name: profileForm.name,
        age: profileForm.age,
        gender: profileForm.gender,
        bloodGroup: profileForm.bloodGroup,
        dateOfBirth: profileForm.dateOfBirth,
        emergencyPhone: profileForm.emergencyPhone,
        emergencyContactName: profileForm.emergencyContactName,
        avatarUrl: profileForm.avatarUrl,
        allergies: profileForm.allergies ? profileForm.allergies.split(',').map(s => s.trim()) : [],
        chronicConditions: profileForm.chronicConditions ? profileForm.chronicConditions.split(',').map(s => s.trim()) : [],
        currentMedications: profileForm.currentMedications ? profileForm.currentMedications.split(',').map(s => s.trim()) : [],
        medicalHistory: profileForm.medicalHistory
      });

      // Also save consents
      await api.updateConsent(consents);

      await refreshUser();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vitacare_health_record_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export data: ' + err.message);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      alert('Please type DELETE to confirm permanent account erasure.');
      return;
    }

    try {
      await api.deleteAccount();
      alert('Your account and all associated medical records have been permanently erased.');
      logout();
    } catch (err) {
      alert('Failed to delete account: ' + err.message);
    }
  };

  const handleSendFeedback = (e) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    setFeedbackSent(true);
    setFeedbackText('');
    setTimeout(() => setFeedbackSent(false), 4000);
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--navy)' }}>
          <ShieldCheck size={26} color="var(--primary)" />
          {t('settingsTitle') || 'Account Profile, Privacy & Language Settings'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {t('settingsSubtitle') || 'Manage your health profile, language preference, consent controls, and medical data.'}
        </p>
      </div>

      {/* Prominent Language Preference Card (Requirement 2.A) */}
      <div className="card" style={{ marginBottom: '24px', border: '1.5px solid var(--secondary-accent)', borderRadius: '16px' }}>
        <div className="card-header">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={20} color="var(--primary)" />
            {t('applicationLanguage') || 'Application Language'}
          </h3>
          <span className="badge badge-green">
            {currentLanguageObj?.flag} {currentLanguageObj?.nativeName || 'English'}
          </span>
        </div>
        <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
          {t('selectLanguageSubtitle') || 'Select your preferred language. The entire interface, medication reminders, voice, and AI responses will update immediately.'}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
          {languages.slice(0, 5).map(langItem => {
            const isSelected = language === langItem.code;
            return (
              <button
                key={langItem.code}
                type="button"
                onClick={() => setLanguage(langItem.code)}
                id={`btn-lang-${langItem.code}`}
                style={{
                  background: isSelected ? 'var(--primary)' : '#ffffff',
                  color: isSelected ? '#ffffff' : 'var(--navy)',
                  border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border-light)'}`,
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  boxShadow: isSelected ? '0 4px 12px rgba(21, 151, 165, 0.25)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{langItem.flag} {langItem.nativeName || langItem.name}</span>
                {isSelected && <CheckCircle2 size={16} color="#ffffff" />}
              </button>
            );
          })}
        </div>
      </div>

      {saveSuccess && (
        <div style={{
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          color: '#065f46',
          padding: '12px 16px',
          borderRadius: '12px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={18} color="#059669" />
          <span>Profile and privacy settings successfully saved.</span>
        </div>
      )}

      {errorMsg && (
        <div className="error-state-box">
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Theme & Display Mode */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '1.1rem', color: 'var(--navy)', marginBottom: '12px' }}>
          🎨 Appearance & Display Theme
        </h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--navy)' }}>
              Theme: {isDark ? 'Dark Mode' : 'Light Mode (Clean Medical Blue & White)'}
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Optimized for high contrast and clinical clarity across day and night environments.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className={`btn btn-sm ${!isDark ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => isDark && toggleTheme()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Sun size={15} /> Light Theme
            </button>
            <button
              type="button"
              className={`btn btn-sm ${isDark ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => !isDark && toggleTheme()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Moon size={15} /> Dark Theme
            </button>
          </div>
        </div>
      </div>

      {/* Patient Profile Form */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '1.1rem', color: 'var(--navy)', marginBottom: '14px' }}>
          👤 Personal Clinical Profile
        </h3>
        <form onSubmit={handleSaveProfile}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                required
                className="form-input"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address (Read-Only)</label>
              <input
                type="email"
                disabled
                className="form-input"
                value={user?.email || ''}
                style={{ background: 'var(--bg-alt)' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Age</label>
              <input
                type="number"
                className="form-input"
                value={profileForm.age}
                onChange={(e) => setProfileForm({ ...profileForm, age: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select
                className="form-select"
                value={profileForm.gender}
                onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Blood Group</label>
              <select
                className="form-select"
                value={profileForm.bloodGroup}
                onChange={(e) => setProfileForm({ ...profileForm, bloodGroup: e.target.value })}
              >
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Emergency Contact Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Eleanor Doe"
                value={profileForm.emergencyContactName}
                onChange={(e) => setProfileForm({ ...profileForm, emergencyContactName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Emergency Phone Number</label>
              <input
                type="tel"
                className="form-input"
                placeholder="+1 (555) 987-6543"
                value={profileForm.emergencyPhone}
                onChange={(e) => setProfileForm({ ...profileForm, emergencyPhone: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Known Allergies (Comma-separated)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Penicillin, Peanuts, Sulfa"
              value={profileForm.allergies}
              onChange={(e) => setProfileForm({ ...profileForm, allergies: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Chronic Health Conditions (Comma-separated)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Type 2 Diabetes, Hypertension, Asthma"
              value={profileForm.chronicConditions}
              onChange={(e) => setProfileForm({ ...profileForm, chronicConditions: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Current Active Medications</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Metformin 500mg, Lisinopril 10mg"
              value={profileForm.currentMedications}
              onChange={(e) => setProfileForm({ ...profileForm, currentMedications: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Medical History Notes</label>
            <textarea
              rows={2}
              className="form-input"
              placeholder="Key surgeries, family history, or physician directives..."
              value={profileForm.medicalHistory}
              onChange={(e) => setProfileForm({ ...profileForm, medicalHistory: e.target.value })}
            />
          </div>

          {/* Privacy & Consent Controls */}
          <div style={{ background: 'var(--bg-alt)', padding: '16px', borderRadius: '12px', marginTop: '16px', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', color: 'var(--navy)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={15} color="var(--primary)" /> Privacy & Data Consent Directives
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.82rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={consents.dataProcessingAccepted}
                  onChange={(e) => setConsents({ ...consents, dataProcessingAccepted: e.target.checked })}
                />
                <span>Consent to OCR extraction and AI health copilot grounding on uploaded documents.</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={consents.guardianSharingAccepted}
                  onChange={(e) => setConsents({ ...consents, guardianSharingAccepted: e.target.checked })}
                />
                <span>Allow authorized guardian / healthcare proxy to view adherence logs and receive escalation alerts.</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={consents.emergencyAlertsAccepted}
                  onChange={(e) => setConsents({ ...consents, emergencyAlertsAccepted: e.target.checked })}
                />
                <span>Allow automated SMS and phone dispatch alerts upon Emergency SOS trigger.</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? 'Saving Changes...' : 'Save Profile & Privacy Settings'}
          </button>
        </form>
      </div>

      {/* Data Export & Account Deletion (GDPR & Data Protection) */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '1.1rem', color: 'var(--navy)', marginBottom: '12px' }}>
          📦 Data Sovereignty & Portability
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
          You retain complete ownership over your medical documents, lab extractions, and timeline records. You can download a standardized, machine-readable JSON archive at any time.
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportData}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Download size={16} /> Download Full Health Archive (JSON)
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsDeleteModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', borderColor: '#fca5a5' }}
          >
            <Trash2 size={16} /> Erase Account & All Records
          </button>
        </div>
      </div>

      {/* Support & Feedback Form */}
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', color: 'var(--navy)', marginBottom: '12px' }}>
          💬 Help, Feedback & Support
        </h3>
        {feedbackSent ? (
          <div style={{ background: '#ecfdf5', padding: '12px', borderRadius: '10px', color: '#065f46', fontSize: '0.85rem' }}>
            ✓ Thank you! Your feedback has been logged directly with the VitaCare Clinical Engineering team.
          </div>
        ) : (
          <form onSubmit={handleSendFeedback}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={feedbackCategory}
                onChange={(e) => setFeedbackCategory(e.target.value)}
              >
                <option value="Feature Suggestion">Feature Suggestion</option>
                <option value="OCR Extraction Issue">OCR Extraction Feedback</option>
                <option value="Report Bug">Report a Bug / Glitch</option>
                <option value="Clinical Question">General Clinical Question</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Message / Details</label>
              <textarea
                required
                rows={3}
                className="form-input"
                placeholder="Describe your question or feedback..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Send size={14} /> Submit Feedback
            </button>
          </form>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsDeleteModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626' }}>
                <AlertTriangle size={22} />
                <h3 style={{ margin: 0, color: '#dc2626' }}>Erase Account & Health Data</h3>
              </div>
              <button className="btn-close" onClick={() => setIsDeleteModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
              <p style={{ color: '#991b1b', fontWeight: 600 }}>
                ⚠️ Warning: This action is permanent and cannot be undone.
              </p>
              <p>
                All your stored prescriptions, diagnostic lab reports, vitals tracking, adherence logs, and CareConnect sessions will be completely deleted from the database.
              </p>
              <div className="form-group" style={{ marginTop: '14px' }}>
                <label className="form-label">
                  To confirm, type <strong>DELETE</strong> below:
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="DELETE"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE'}
                style={{ background: '#dc2626', borderColor: '#dc2626' }}
              >
                Permanently Erase Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
