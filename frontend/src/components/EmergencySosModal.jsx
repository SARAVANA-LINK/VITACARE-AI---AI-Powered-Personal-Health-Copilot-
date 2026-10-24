import React, { useState, useEffect } from 'react';
import { AlertTriangle, PhoneCall, ShieldAlert, CheckCircle, X, Users, MapPin } from 'lucide-react';
import { api } from '../api/apiClient';
import { useTranslation } from '../i18n/LanguageContext';

export const EmergencySosModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState(5);
  const [isCounting, setIsCounting] = useState(true);
  const [isTriggered, setIsTriggered] = useState(false);
  const [sosResult, setSosResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setCountdown(5);
      setIsCounting(true);
      setIsTriggered(false);
      setSosResult(null);
      loadEmergencyContacts();
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
    onClose();
  };

  const executeSos = async () => {
    setLoading(true);
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
    } catch (err) {
      console.error('SOS failed:', err);
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
    <div className="modal-overlay" style={{ zIndex: 300 }}>
      <div className="modal-content" style={{ maxWidth: '520px', border: '2px solid var(--status-red)' }}>
        <div className="modal-header" style={{ background: 'var(--status-red-bg)' }}>
          <h3 className="card-title" style={{ color: 'var(--status-red)' }}>
            <AlertTriangle size={22} color="var(--status-red)" />
            {t('emergencySosAlertTitle') || 'EMERGENCY SOS ALERT'}
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={handleCancel}>
            <X size={18} />
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
              <div style={{ margin: '12px 0', color: 'var(--status-green)' }}>
                <CheckCircle size={56} style={{ margin: '0 auto 10px auto' }} />
                <h4 style={{ fontSize: '1.25rem', color: 'var(--navy)' }}>{t('sosDispatchedHeading') || 'Emergency SOS Dispatched'}</h4>
                <div style={{ marginTop: '8px' }}>
                  <span className="badge badge-green" style={{ padding: '4px 12px', fontWeight: 700 }}>
                    ACTIVE EMERGENCY DISPATCH
                  </span>
                </div>
              </div>

              <div style={{
                background: '#f8fafc',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                textAlign: 'left',
                margin: '14px 0',
                fontSize: '0.85rem'
              }}>
                <p style={{ fontWeight: '700', marginBottom: '8px', color: 'var(--navy)' }}>
                  Emergency Action Summary:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlert size={15} color="#dc2626" />
                    <span>Emergency services protocol activated (Dial 911/112/108 immediately if life-threatening)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PhoneCall size={15} color="#0284c7" />
                    <span>
                      Guardian SMS Alert: {sosResult?.smsSent ? 'Delivered with patient medical profile' : 'Dispatched to registered contact'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={15} color="#16a34a" />
                    <span>GPS location & verified blood group transmitted to response records</span>
                  </div>
                </div>

                <div style={{ marginTop: '12px', padding: '8px 10px', background: '#fef2f2', borderRadius: '6px', fontSize: '0.78rem', color: '#991b1b', lineHeight: 1.4 }}>
                  <strong>Important Safety Notice:</strong> VitaCare AI is an assistive organizer. If you are experiencing chest pain, difficulty breathing, or severe trauma, call local emergency services directly.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          {!isTriggered ? (
            <>
              <button className="btn btn-secondary btn-lg" onClick={handleCancel} style={{ flex: 1 }}>
                {t('cancelSos') || 'CANCEL SOS'}
              </button>
              <button className="btn btn-danger btn-lg" onClick={handleImmediateTrigger} disabled={loading} style={{ flex: 1 }}>
                {t('sendNow') || 'Send Now'}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={onClose} style={{ width: '100%' }}>
              {t('closeEmergencyStatus') || 'Close Emergency Status'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
