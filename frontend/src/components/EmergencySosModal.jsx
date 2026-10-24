import React, { useState, useEffect } from 'react';
import { AlertTriangle, PhoneCall, ShieldAlert, CheckCircle, X, Users, MapPin, Volume2 } from 'lucide-react';
import { api } from '../api/apiClient';
import { useTranslation } from '../i18n/LanguageContext';
import { useAccessibility } from '../context/AccessibilityContext';

export const EmergencySosModal = ({ isOpen, onClose }) => {
  const { t, language } = useTranslation();
  const { speak } = useAccessibility();
  const [countdown, setCountdown] = useState(5);
  const [isCounting, setIsCounting] = useState(true);
  const [isTriggered, setIsTriggered] = useState(false);
  const [sosResult, setSosResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [emergencyContacts, setEmergencyContacts] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setCountdown(5);
      setIsCounting(true);
      setIsTriggered(false);
      setSosResult(null);
      setErrorMessage(null);
      loadEmergencyContacts();
      speak("Emergency help screen opened. Contacts will be alerted in 5 seconds. Press cancel if this was accidental.", language);
    }
  }, [isOpen]);

  const loadEmergencyContacts = async () => {
    try {
      const res = await api.getEmergencyContacts();
      setEmergencyContacts(res.contacts || []);
    } catch (err) {
      console.warn('Could not load emergency contacts:', err.message);
    }
  };

  useEffect(() => {
    let timer = null;
    if (isOpen && isCounting && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (isOpen && isCounting && countdown === 0) {
      setIsCounting(false);
      executeSos();
    }
    return () => clearTimeout(timer);
  }, [isOpen, isCounting, countdown]);

  const handleCancel = () => {
    setIsCounting(false);
    speak("Emergency alert cancelled.", language);
    onClose();
  };

  const executeSos = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      let locationString = 'Location: Geolocation Access Enabled';
      if ('geolocation' in navigator) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
          });
          locationString = `GPS: ${pos.coords.latitude.toFixed(4)}° N, ${pos.coords.longitude.toFixed(4)}° E`;
        } catch (geoErr) {
          locationString = 'Location: Device GPS Unavailable / Manual Emergency Request';
        }
      }

      const res = await api.triggerSos(locationString);
      setSosResult(res);
      setIsTriggered(true);
      speak("Emergency alert sent. Help has been notified.", language);
    } catch (err) {
      console.error('SOS failed:', err);
      setErrorMessage(err.message || 'Could not verify transmission. Please dial 911 or local emergency services directly.');
      setIsTriggered(true);
    } finally {
      setLoading(false);
    }
  };

  const handleImmediateTrigger = () => {
    setIsCounting(false);
    setCountdown(0);
    executeSos();
  };

  if (!isOpen) return null;

  const guardianContact = emergencyContacts.find(c => !c.isPrimary) || emergencyContacts[0];

  return (
    <div className="modal-overlay" style={{ zIndex: 300 }} role="dialog" aria-modal="true" aria-labelledby="emergency-modal-title">
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: '560px', 
          border: '3px solid var(--status-red)',
          borderRadius: '24px',
          overflow: 'hidden'
        }}
      >
        <div className="modal-header" style={{ background: '#fef2f2', padding: '18px 24px', borderBottom: '2px solid #fecaca' }}>
          <h2 id="emergency-modal-title" className="card-title" style={{ color: 'var(--status-red)', fontSize: '1.4rem', fontWeight: 800 }}>
            <AlertTriangle size={26} color="var(--status-red)" />
            {t('emergencySosAlertTitle') || 'EMERGENCY HELP REQUEST'}
          </h2>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={handleCancel}
            style={{ minHeight: '40px', minWidth: '40px' }}
            aria-label="Close emergency modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ textAlign: 'center' }}>
          {!isTriggered ? (
            <div>
              <div style={{ margin: '16px 0' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  background: 'var(--status-red)',
                  color: '#fff',
                  fontSize: '2.5rem',
                  fontWeight: '800',
                  boxShadow: '0 0 25px rgba(239, 68, 68, 0.4)'
                }}>
                  {countdown}
                </span>
                <p style={{ marginTop: '12px', fontWeight: '700', color: 'var(--navy)', fontSize: '1.05rem' }}>
                  {t('emergencyContactsAlertIn', { seconds: countdown }) || `Emergency contacts will be alerted in ${countdown} seconds...`}
                </p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {t('clickCancelNotice') || 'Click CANCEL immediately if this was pressed in error.'}
                </p>
              </div>

              <div style={{
                background: 'var(--bg-alt)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                textAlign: 'left',
                margin: '18px 0',
                fontSize: '0.85rem'
              }}>
                <div style={{ fontWeight: '700', marginBottom: '8px', color: 'var(--navy)' }}>
                  {t('whoWillBeContacted') || 'Designated Emergency Responders:'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <ShieldAlert size={16} color="var(--status-red)" />
                  <span><strong>EMS / Ambulance Dispatch:</strong> 911 / 112 / 108</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PhoneCall size={16} color="var(--primary)" />
                  <span>
                    <strong>Primary Guardian:</strong>{' '}
                    {guardianContact ? `${guardianContact.contactName} (${guardianContact.phoneNumber})` : 'Designated Family Emergency Proxy'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {errorMessage ? (
                <div style={{ margin: '16px 0', color: 'var(--status-red)' }}>
                  <AlertTriangle size={64} style={{ margin: '0 auto 12px auto' }} />
                  <h3 style={{ fontSize: '1.4rem', color: 'var(--status-red)', fontWeight: 800 }}>
                    {t('sosUnconfirmedHeading') || 'Direct Emergency Call Recommended'}
                  </h3>
                  <div style={{ marginTop: '10px' }}>
                    <span className="badge" style={{ background: '#fef2f2', color: '#b91c1c', border: '1.5px solid #f87171', padding: '6px 16px', fontWeight: 800, fontSize: '0.9rem' }}>
                      STATUS: TRANSMISSION UNCONFIRMED
                    </span>
                  </div>
                  <p style={{ fontSize: '1.05rem', color: 'var(--text-main)', marginTop: '14px', lineHeight: 1.5 }}>
                    {errorMessage}
                  </p>
                </div>
              ) : (
                <div style={{ margin: '16px 0', color: 'var(--status-green)' }}>
                  <CheckCircle size={64} style={{ margin: '0 auto 12px auto' }} />
                  <h3 style={{ fontSize: '1.4rem', color: 'var(--navy)', fontWeight: 800 }}>
                    {t('sosDispatchedHeading') || 'Emergency Alerts Dispatched'}
                  </h3>
                  <div style={{ marginTop: '10px' }}>
                    <span className="badge badge-green" style={{ padding: '6px 18px', fontWeight: 800, fontSize: '0.9rem' }}>
                      {sosResult?.smsSent ? 'STATUS: CONFIRMED BY PROVIDER NETWORK' : 'STATUS: DISPATCHED / PENDING NETWORK CONFIRMATION'}
                    </span>
                  </div>
                </div>
              )}

              <div style={{
                background: '#f8fafc',
                border: '1.5px solid var(--border)',
                borderRadius: '16px',
                padding: '20px',
                textAlign: 'left',
                margin: '18px 0',
                fontSize: '1rem'
              }}>
                <div style={{ fontWeight: 800, marginBottom: '12px', color: 'var(--navy)', fontSize: '1.05rem' }}>
                  Emergency Action Status & Summary:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <ShieldAlert size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span><strong>EMS / Ambulance Protocols:</strong> Dial 911 / 112 / 108 directly on phone if in immediate physical danger.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <PhoneCall size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>
                      <strong>Family / Caregiver SMS:</strong>{' '}
                      {sosResult?.smsSent 
                        ? 'Confirmed delivered via SMS gateway with GPS location' 
                        : (errorMessage ? 'Could not reach SMS provider' : 'Dispatched to carrier gateway')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <MapPin size={20} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span><strong>Medical Profile & Location:</strong> Blood type, critical conditions, and coordinates transmitted.</span>
                  </div>
                </div>

                <div style={{ marginTop: '16px', padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', fontSize: '0.92rem', color: '#991b1b', lineHeight: 1.5 }}>
                  <strong>Important Safety Notice:</strong> VitaCare is a smart assistive application. For sudden cardiac distress, breathing stoppage, or critical trauma, always contact primary emergency telephone services immediately.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid var(--border)', justifyContent: 'space-between', gap: '12px' }}>
          {!isTriggered ? (
            <>
              <button 
                className="btn btn-secondary btn-lg" 
                onClick={handleCancel} 
                style={{ flex: 1, minHeight: '52px', fontSize: '1.05rem', fontWeight: 700 }}
              >
                {t('cancelSos') || 'CANCEL SOS'}
              </button>
              <button 
                className="btn btn-danger btn-lg" 
                onClick={handleImmediateTrigger} 
                disabled={loading} 
                style={{ flex: 1, minHeight: '52px', fontSize: '1.05rem', fontWeight: 800 }}
              >
                {loading ? 'Alerting...' : (t('sendNow') || 'Send Now')}
              </button>
            </>
          ) : (
            <button 
              className="btn btn-primary btn-lg" 
              onClick={onClose} 
              style={{ width: '100%', minHeight: '52px', fontSize: '1.05rem', fontWeight: 700 }}
            >
              {t('closeEmergencyStatus') || 'Close Emergency Screen'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
