import React, { useState, useEffect } from 'react';
import { Users, Plus, Phone, Mail, ShieldCheck, Check, X, Shield, Volume2, HeartHandshake } from 'lucide-react';
import { api } from '../api/apiClient';
import { useTranslation } from '../i18n/LanguageContext';
import { useAccessibility } from '../context/AccessibilityContext';

export const GuardianView = () => {
  const { t, language } = useTranslation();
  const { speak } = useAccessibility();
  const [guardians, setGuardians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [newGuardianForm, setNewGuardianForm] = useState({
    name: '',
    relationship: 'Family Member',
    phoneNumber: '',
    email: '',
    allowMedicationEscalation: true,
    allowEmergencyNotification: true,
    allowCareConnectAccess: true,
    allowHealthView: false
  });

  const fetchGuardians = async () => {
    try {
      setLoading(true);
      const res = await api.getGuardians();
      setGuardians(res.guardians || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuardians();
  }, []);

  const handleSpeakGuardian = (g) => {
    const text = `Caregiver: ${g.name}, relationship: ${g.relationship}. Authorized for emergency notifications and medication alerts.`;
    speak(text, language);
  };

  const handleAddGuardian = async (e) => {
    e.preventDefault();
    try {
      await api.addGuardian(newGuardianForm);
      setIsAddModalOpen(false);
      setNewGuardianForm({
        name: '',
        relationship: 'Family Member',
        phoneNumber: '',
        email: '',
        allowMedicationEscalation: true,
        allowEmergencyNotification: true,
        allowCareConnectAccess: true,
        allowHealthView: false
      });
      fetchGuardians();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px' 
      }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--navy)', margin: '0 0 6px 0' }}>
            {t('guardianManagementTitle') || 'Caregivers & Family Support'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', margin: 0 }}>
            {t('guardianManagementSubtitle') || 'Trusted family members or caregivers who receive alerts if you miss a dose or need help.'}
          </p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={() => setIsAddModalOpen(true)}
          style={{ minHeight: '52px', padding: '12px 24px', fontSize: '1.05rem', fontWeight: 700 }}
        >
          <Plus size={20} /> {t('addDesignatedGuardian') || 'Add Family Member or Caregiver'}
        </button>
      </div>

      {/* Elder-Friendly Info Card */}
      <div 
        className="card"
        style={{
          background: '#eff6ff',
          border: '1.5px solid #bfdbfe',
          padding: '18px 22px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px',
          borderRadius: '16px'
        }}
      >
        <HeartHandshake size={28} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '4px' }}>
            {t('howCaregiverProtects') || 'How Caregiver Notifications Keep You Safe'}
          </div>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            {t('howCaregiverProtectsBody') || 'Whenever you miss a scheduled medicine or tap Emergency SOS, an instant text message (SMS) is dispatched to your registered contacts so they can check in on you.'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '1.15rem' }}>{t('loadingGuardians') || 'Loading family contacts...'}</p>
        </div>
      ) : guardians.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '64px 24px', borderRadius: '20px' }}>
          <Users size={64} style={{ margin: '0 auto 16px auto', color: 'var(--primary)', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--navy)', marginBottom: '8px' }}>
            {t('noGuardiansConfigured') || 'No Caregivers Added Yet'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '500px', margin: '0 auto 24px auto', lineHeight: 1.5 }}>
            {t('noGuardiansHelp') || 'Add a son, daughter, spouse, or nurse so VitaCare can send them a polite message if you ever forget to take your medicine.'}
          </p>
          <button 
            className="btn btn-primary btn-lg" 
            onClick={() => setIsAddModalOpen(true)}
            style={{ padding: '14px 28px', fontSize: '1.1rem', fontWeight: 700 }}
          >
            <Plus size={20} /> {t('addDesignatedGuardian') || 'Add Family Member or Caregiver'}
          </button>
        </div>
      ) : (
        <div className="grid-2">
          {guardians.map(g => (
            <div 
              key={g.id} 
              className="card"
              style={{
                padding: '24px',
                borderRadius: '18px',
                border: '1.5px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '50%',
                      background: 'rgba(37, 99, 235, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primary)',
                      fontSize: '1.3rem',
                      fontWeight: 800
                    }}>
                      {g.name.charAt(0)}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--navy)', margin: '0 0 4px 0' }}>{g.name}</h3>
                      <span className="badge badge-blue" style={{ fontSize: '0.85rem', padding: '3px 8px' }}>{g.relationship}</span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleSpeakGuardian(g)}
                      style={{ minHeight: '38px', padding: '6px 12px' }}
                      title="Read contact details aloud"
                      aria-label={`Read details for ${g.name}`}
                    >
                      <Volume2 size={16} color="var(--primary)" />
                    </button>
                    <span className="badge badge-green" style={{ fontSize: '0.85rem', padding: '4px 10px', fontWeight: 700 }}>
                      <Check size={12} style={{ marginRight: '4px' }} />
                      {t('authorizedBadge') || 'Authorized'}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--navy)' }}>
                      <Phone size={18} color="var(--primary)" />
                      <span>🔒 {g.phoneNumber && g.phoneNumber.length > 4 ? g.phoneNumber.slice(0, 3) + '*** ***' + g.phoneNumber.slice(-2) : '***-***-****'}</span>
                    </div>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('maskedForPrivacy') || 'Protected phone'}</span>
                  </div>
                  {g.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                      <Mail size={16} color="var(--primary)" /> {g.email}
                    </div>
                  )}
                </div>

                {/* Granular Permission Checklist */}
                <div style={{
                  background: 'var(--bg-alt)',
                  borderRadius: '12px',
                  padding: '16px',
                  fontSize: '0.95rem'
                }}>
                  <div style={{ fontWeight: 800, color: 'var(--navy)', marginBottom: '10px' }}>
                    {t('grantedPermissions') || 'Active Permissions & Alerts:'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: g.allowMedicationEscalation ? '#166534' : '#94a3b8' }}>
                      <ShieldCheck size={18} color={g.allowMedicationEscalation ? '#16a34a' : '#94a3b8'} />
                      <span style={{ fontWeight: g.allowMedicationEscalation ? 600 : 400 }}>{t('permMedicationEscalation') || 'Missed dose notifications (SMS)'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: g.allowEmergencyNotification ? '#166534' : '#94a3b8' }}>
                      <ShieldCheck size={18} color={g.allowEmergencyNotification ? '#16a34a' : '#94a3b8'} />
                      <span style={{ fontWeight: g.allowEmergencyNotification ? 600 : 400 }}>{t('permEmergencySos') || 'Emergency SOS alerts with GPS'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: g.allowCareConnectAccess ? '#166534' : '#94a3b8' }}>
                      <ShieldCheck size={18} color={g.allowCareConnectAccess ? '#16a34a' : '#94a3b8'} />
                      <span style={{ fontWeight: g.allowCareConnectAccess ? 600 : 400 }}>{t('permCareConnect') || 'Family Video Check-in'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Guardian Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-guardian-title">
          <div className="modal-content" style={{ maxWidth: '560px', borderRadius: '24px', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '20px 24px', background: '#f8fafc', borderBottom: '1.5px solid var(--border)' }}>
              <h2 id="add-guardian-title" className="card-title" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--navy)' }}>
                {t('addDesignatedGuardian') || 'Add Family Member or Caregiver'}
              </h2>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setIsAddModalOpen(false)}
                style={{ minHeight: '40px', minWidth: '40px' }}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddGuardian}>
              <div className="modal-body" style={{ padding: '24px' }}>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '6px' }}>
                    {t('fullName') || 'Full Name'} *
                  </label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    style={{ minHeight: '50px', fontSize: '1.05rem' }}
                    placeholder={t('guardianNamePlaceholder') || 'e.g. Ramesh Kumar'}
                    value={newGuardianForm.name}
                    onChange={(e) => setNewGuardianForm({ ...newGuardianForm, name: e.target.value })}
                  />
                </div>

                <div className="grid-2" style={{ gap: '14px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '6px' }}>
                      {t('relationship') || 'Relationship'} *
                    </label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      style={{ minHeight: '50px', fontSize: '1.05rem' }}
                      placeholder={t('guardianRelPlaceholder') || 'e.g. Son, Daughter, Nurse'}
                      value={newGuardianForm.relationship}
                      onChange={(e) => setNewGuardianForm({ ...newGuardianForm, relationship: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '6px' }}>
                      {t('phoneNumber') || 'Mobile Phone Number'} *
                    </label>
                    <input
                      type="tel"
                      required
                      className="form-input"
                      style={{ minHeight: '50px', fontSize: '1.05rem' }}
                      placeholder="+91 98765 43210"
                      value={newGuardianForm.phoneNumber}
                      onChange={(e) => setNewGuardianForm({ ...newGuardianForm, phoneNumber: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '18px' }}>
                  <label className="form-label" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '6px' }}>
                    {t('emailOptional') || 'Email Address (Optional)'}
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    style={{ minHeight: '50px', fontSize: '1.05rem' }}
                    placeholder="name@example.com"
                    value={newGuardianForm.email}
                    onChange={(e) => setNewGuardianForm({ ...newGuardianForm, email: e.target.value })}
                  />
                </div>

                <div style={{ marginTop: '20px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1.5px solid var(--border)' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--navy)', marginBottom: '10px' }}>
                    {t('permissionsGranted') || 'Alert Permissions:'}
                  </div>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1rem', marginBottom: '10px', cursor: 'pointer', minHeight: '44px' }}>
                    <input
                      type="checkbox"
                      style={{ width: '22px', height: '22px' }}
                      checked={newGuardianForm.allowMedicationEscalation}
                      onChange={(e) => setNewGuardianForm({ ...newGuardianForm, allowMedicationEscalation: e.target.checked })}
                    />
                    <span>{t('permMedicationEscalationAlerts') || 'Send SMS if I miss a scheduled dose'}</span>
                  </label>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1rem', marginBottom: '10px', cursor: 'pointer', minHeight: '44px' }}>
                    <input
                      type="checkbox"
                      style={{ width: '22px', height: '22px' }}
                      checked={newGuardianForm.allowEmergencyNotification}
                      onChange={(e) => setNewGuardianForm({ ...newGuardianForm, allowEmergencyNotification: e.target.checked })}
                    />
                    <span>{t('permEmergencyNotifications') || 'Send SMS if I trigger Emergency SOS'}</span>
                  </label>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1rem', cursor: 'pointer', minHeight: '44px' }}>
                    <input
                      type="checkbox"
                      style={{ width: '22px', height: '22px' }}
                      checked={newGuardianForm.allowCareConnectAccess}
                      onChange={(e) => setNewGuardianForm({ ...newGuardianForm, allowCareConnectAccess: e.target.checked })}
                    />
                    <span>{t('permCareConnectAccess') || 'Allow direct video check-in call'}</span>
                  </label>
                </div>
              </div>
              
              <div className="modal-footer" style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid var(--border)', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsAddModalOpen(false)}
                  style={{ minHeight: '48px', padding: '10px 20px', fontSize: '1rem' }}
                >
                  {t('cancel') || 'Cancel'}
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ minHeight: '48px', padding: '10px 24px', fontSize: '1rem', fontWeight: 700 }}
                >
                  {t('saveGuardianProfile') || 'Save Caregiver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
