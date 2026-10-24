import React from 'react';
import { X, Volume2, Type, Contrast, Eye, Sparkles, Check, Globe } from 'lucide-react';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTranslation } from '../i18n/LanguageContext';

export const AccessibilitySettingsModal = ({ isOpen, onClose }) => {
  const {
    textSize,
    setTextSize,
    highContrast,
    setHighContrast,
    reducedMotion,
    setReducedMotion,
    voiceGuidance,
    setVoiceGuidance,
    speak
  } = useAccessibility();

  const { language, setLanguage, t } = useTranslation();

  if (!isOpen) return null;

  const handleTestVoice = () => {
    const text = language === 'ta'
      ? 'வணக்கம். வைட்டாகேர் ஒலி வழிகாட்டி இயங்குகிறது. உங்கள் மருந்துகளை சரியான நேரத்தில் உட்கொள்ளவும்.'
      : 'Hello. VitaCare audio guidance is active. Please take your prescribed medicines on time.';
    speak(text, language);
  };

  const textSizes = [
    { id: 'default', label: 'Standard (100%)', sample: 'Aa', desc: 'Default 18px text' },
    { id: 'large', label: 'Large (125%)', sample: 'Aa+', desc: 'Comfortable reading' },
    { id: 'xlarge', label: 'Extra Large (150%)', sample: 'Aa++', desc: 'High visibility' },
    { id: 'huge', label: 'Maximum (200%)', sample: 'Aa+++', desc: 'Maximum size' }
  ];

  const languages = [
    { code: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
    { code: 'ta', label: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
    { code: 'tanglish', label: 'Tanglish', native: 'Tanglish (தமிழ்)', flag: '🇮🇳' },
    { code: 'hi', label: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
    { code: 'te', label: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' }
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(20, 33, 61, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="accessibility-settings-title"
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 40px rgba(20, 33, 61, 0.25)',
          border: '2px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '2px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-alt)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'var(--primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Eye size={24} />
            </div>
            <div>
              <h2 id="accessibility-settings-title" style={{ fontSize: '1.4rem', color: 'var(--navy)', margin: 0 }}>
                {t('accessibilitySettings') || 'Accessibility & Comfort'}
              </h2>
              <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                Customize text size, contrast, and voice assistance
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ width: '44px', height: '44px', padding: 0, borderRadius: '50%' }}
            aria-label="Close accessibility settings"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Section 1: Text Size */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '1.15rem', color: 'var(--navy)', marginBottom: '12px' }}>
              <Type size={20} color="var(--primary)" />
              Text & Display Size
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
              {textSizes.map((s) => {
                const isSelected = textSize === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setTextSize(s.id)}
                    style={{
                      background: isSelected ? 'var(--primary-subtle)' : '#ffffff',
                      border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border-light)'}`,
                      borderRadius: 'var(--radius-lg)',
                      padding: '14px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.15)' : 'none'
                    }}
                  >
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: isSelected ? 'var(--primary)' : 'var(--navy)' }}>
                      {s.sample}
                    </span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy)' }}>
                      {s.label}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {s.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: High Contrast & Reduced Motion */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--navy)' }}>
              Vision & Motion Preferences
            </label>

            {/* High Contrast Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                borderRadius: 'var(--radius-lg)',
                border: '2px solid var(--border-light)',
                background: highContrast ? 'var(--bg-alt)' : '#ffffff'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Contrast size={22} color="var(--primary)" />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '1.05rem' }}>
                    High-Contrast Mode
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Deep solid black text, pure white surface, and strong borders
                  </div>
                </div>
              </div>
              <button
                onClick={() => setHighContrast(!highContrast)}
                className={`btn ${highContrast ? 'btn-primary' : 'btn-secondary'}`}
                style={{ minHeight: '44px', minWidth: '90px' }}
              >
                {highContrast ? 'Active ✓' : 'Turn On'}
              </button>
            </div>

            {/* Reduced Motion Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                borderRadius: 'var(--radius-lg)',
                border: '2px solid var(--border-light)',
                background: reducedMotion ? 'var(--bg-alt)' : '#ffffff'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Sparkles size={22} color="var(--teal)" />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '1.05rem' }}>
                    Reduced Motion
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Disables sliding and floating animations for vestibular comfort
                  </div>
                </div>
              </div>
              <button
                onClick={() => setReducedMotion(!reducedMotion)}
                className={`btn ${reducedMotion ? 'btn-primary' : 'btn-secondary'}`}
                style={{ minHeight: '44px', minWidth: '90px' }}
              >
                {reducedMotion ? 'Active ✓' : 'Turn On'}
              </button>
            </div>
          </div>

          {/* Section 3: Voice Guidance */}
          <div
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--border-light)',
              background: 'var(--primary-subtle)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Volume2 size={24} color="var(--primary)" />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '1.05rem' }}>
                    Voice Assistance & Read Aloud
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Reads medicine schedules and instructions aloud in a calm cadence
                  </div>
                </div>
              </div>
              <button
                onClick={() => setVoiceGuidance(!voiceGuidance)}
                className={`btn ${voiceGuidance ? 'btn-primary' : 'btn-secondary'}`}
                style={{ minHeight: '44px', minWidth: '90px' }}
              >
                {voiceGuidance ? 'Enabled ✓' : 'Disabled'}
              </button>
            </div>
            {voiceGuidance && (
              <button
                onClick={handleTestVoice}
                className="btn btn-secondary"
                style={{ width: '100%', minHeight: '44px', marginTop: '6px' }}
              >
                <Volume2 size={18} />
                Test Voice Speaker Now
              </button>
            )}
          </div>

          {/* Section 4: Language Selection */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '1.15rem', color: 'var(--navy)', marginBottom: '12px' }}>
              <Globe size={20} color="var(--primary)" />
              Application Language
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
              {languages.map((l) => {
                const isSelected = language === l.code;
                return (
                  <button
                    key={l.code}
                    onClick={() => setLanguage(l.code)}
                    style={{
                      background: isSelected ? 'var(--primary)' : '#ffffff',
                      color: isSelected ? '#ffffff' : 'var(--navy)',
                      border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border-light)'}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '1rem',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{l.native}</span>
                    {isSelected && <Check size={18} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '2px solid var(--border-light)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'var(--bg-alt)'
          }}
        >
          <button
            onClick={onClose}
            className="btn btn-primary btn-lg"
            style={{ minWidth: '160px' }}
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
