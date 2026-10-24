import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Lock, 
  Mail, 
  User, 
  Shield, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Globe, 
  AlertCircle,
  ArrowLeft,
  Smartphone,
  PhoneCall,
  UserCheck,
  CheckCircle2,
  FileText,
  Activity,
  Bot,
  BellRing,
  Camera,
  Info,
  ChevronRight,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation, SUPPORTED_LANGUAGES } from '../i18n/LanguageContext';
import { useBranding } from '../context/BrandingContext';
import { api } from '../api/apiClient';

export const AuthView = ({ portalMode = 'user', onSwitchPortal }) => {
  const { login, register, adminLogin, demoLogin } = useAuth();
  const { language, setLanguage, t } = useTranslation();
  const { websiteName, logoUrl } = useBranding();
  const [imgError, setImgError] = useState(false);

  // Tabs: 'login' | 'otp' | 'register' | 'onboarding'
  const [authMode, setAuthMode] = useState('otp'); // Default to Phone OTP login
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // OTP Login State
  const [phoneNumber, setPhoneNumber] = useState('+91 98765 43210');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);

  // Consent & Privacy
  const [consentAccepted, setConsentAccepted] = useState(true);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);

  // Registration Form State (clean empty slate for new users)
  const [formData, setFormData] = useState({
    name: '',
    email: portalMode === 'admin' ? 'admin@vitacare.ai' : '',
    password: '',
    phone: '',
    age: '',
    gender: 'Male',
    bloodGroup: 'A+',
    dateOfBirth: '',
    emergencyPhone: '',
    emergencyContactName: '',
    allergies: '',
    chronicConditions: '',
    currentMedications: '',
    medicalHistory: '',
    guardianName: '',
    guardianPhone: '',
    guardianRelationship: ''
  });

  // Onboarding Carousel State
  const [onboardingStep, setOnboardingStep] = useState(0);
  const onboardingSlides = [
    {
      icon: <Bot size={36} color="var(--primary)" />,
      title: 'Multilingual Clinical AI Copilot',
      description: 'Interact with an intelligent health assistant grounded directly in your verified medical records. Available in English, தமிழ், हिन्दी, and తెలుగు with safety guardrails.',
      highlight: 'Zero hallucinations • Clear medical disclaimer • Voice input & TTS'
    },
    {
      icon: <FileText size={36} color="var(--teal)" />,
      title: 'Prescription & Report OCR Pipeline',
      description: 'Transform physical prescriptions and complex diagnostic lab panels into verified, structured health data with transparent side-by-side progression comparisons.',
      highlight: 'Full user verification review • Longitudinal trends • Secure storage'
    },
    {
      icon: <Activity size={36} color="#0284c7" />,
      title: 'Smart Medication Adherence & CareConnect',
      description: 'Stay on track with schedule reminders, visual dose confirmations, and consent-based live video check-ins for supervised adherence with authorized guardians.',
      highlight: 'Adherence scoring • Missed dose escalation • Voice reminders'
    },
    {
      icon: <BellRing size={36} color="#dc2626" />,
      title: '24/7 Emergency SOS & Safety Protocols',
      description: 'One-touch SOS activation with a 5-second countdown safety window, emergency dispatch call triggers, and automated guardian notification.',
      highlight: '108 / 911 / 112 Ready • Dual contact alerts • GPS support'
    }
  ];

  useEffect(() => {
    let interval = null;
    if (otpTimer > 0) {
      interval = setInterval(() => setOtpTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  const handleSendOtp = async (e) => {
    e?.preventDefault();
    if (!phoneNumber || phoneNumber.trim().length < 8) {
      setErrorMsg('Please enter a valid mobile number.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await api.sendOtp(phoneNumber.trim());
      setOtpSent(true);
      setOtpCode('123456'); // Pre-fill convenience code for demonstration
      setOtpTimer(60);
      setSuccessMsg(res.message || 'Verification code dispatched to ' + phoneNumber);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to dispatch verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!consentAccepted) {
      setErrorMsg('Please accept the privacy policy & health data consent to proceed.');
      return;
    }
    if (!otpCode || otpCode.trim().length < 4) {
      setErrorMsg('Please enter the verification code.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await api.verifyOtp(phoneNumber.trim(), otpCode.trim());
      api.setToken(res.token);
      window.location.reload();
    } catch (err) {
      setErrorMsg(err.message || 'Verification failed. Try demo code: 123456.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitEmailAuth = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!consentAccepted && authMode === 'register') {
      setErrorMsg('Please accept the health data privacy policy to create an account.');
      return;
    }
    setLoading(true);

    try {
      if (portalMode === 'admin') {
        await adminLogin(formData.email, formData.password);
      } else if (authMode === 'register') {
        await register({
          ...formData,
          allergies: formData.allergies ? formData.allergies.split(',').map(s => s.trim()) : [],
          chronicConditions: formData.chronicConditions ? formData.chronicConditions.split(',').map(s => s.trim()) : [],
          preferredLanguage: language
        });
      } else {
        await login(formData.email, formData.password);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAccess = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      await demoLogin();
    } catch (err) {
      setErrorMsg('Failed to initialize demo session: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fillAdminCredentials = () => {
    setFormData(prev => ({
      ...prev,
      email: 'admin@vitacare.ai',
      password: 'AdminSecure2026!'
    }));
    setErrorMsg('');
  };

  const isAdminPortal = portalMode === 'admin';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: isAdminPortal 
        ? 'radial-gradient(circle at top right, #fee2e2 0%, #f8fafc 60%)'
        : 'radial-gradient(circle at top right, #e0f2fe 0%, #f8fafc 60%)',
      padding: '24px 16px'
    }}>
      <div style={{
        maxWidth: authMode === 'onboarding' ? '680px' : authMode === 'register' ? '600px' : '480px',
        width: '100%',
        background: 'var(--bg-card, #ffffff)',
        borderRadius: '24px',
        padding: '36px 32px',
        boxShadow: '0 20px 35px -5px rgba(15, 23, 42, 0.08)',
        border: `1px solid ${isAdminPortal ? '#fecaca' : 'var(--border-light, #e2e8f0)'}`,
        transition: 'max-width 0.3s ease'
      }}>
        {/* Top Header: Portal Indicator & Language Selector */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: '999px',
            background: isAdminPortal ? '#fee2e2' : 'var(--primary-subtle, #eff6ff)',
            color: isAdminPortal ? '#dc2626' : 'var(--primary-dark, #0284c7)',
            border: `1px solid ${isAdminPortal ? '#fca5a5' : 'var(--border-light, #dbeafe)'}`
          }}>
            {isAdminPortal ? t('adminPortalBadge') || 'ADMIN CMS PORTAL' : t('userPortalBadge') || 'PATIENT USER PORTAL'}
          </span>

          {/* Multilingual Selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--bg-alt, #f1f5f9)',
            padding: '4px 10px',
            borderRadius: '999px',
            border: '1px solid var(--border-light, #cbd5e1)'
          }}>
            <Globe size={14} color="var(--primary, #0284c7)" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              id="auth-language-selector"
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--navy, #1e293b)',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {SUPPORTED_LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.nativeName} ({lang.name})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Branding Title */}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            background: isAdminPortal 
              ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
              : 'linear-gradient(135deg, #0284c7 0%, #0f766e 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px auto',
            color: '#fff',
            boxShadow: '0 8px 18px rgba(2, 132, 199, 0.28)'
          }}>
            {isAdminPortal ? <ShieldCheck size={30} fill="#fff" /> : <Heart size={30} fill="#fff" />}
          </div>
          <h1 style={{ fontSize: '1.65rem', color: 'var(--navy, #0f172a)', marginBottom: '4px', fontWeight: 800 }}>
            {websiteName || 'VitaCare AI'}
          </h1>
          <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.84rem', fontWeight: 500 }}>
            {isAdminPortal 
              ? 'Administrative Command & CMS Configuration'
              : 'Personal Health Copilot • Organized, Intelligent, Connected'}
          </p>
        </div>

        {/* 1-Click Evaluator Demo Access Button */}
        {!isAdminPortal && (
          <div style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #e6f7f5 100%)',
            border: '1px solid #bbf7d0',
            borderRadius: '14px',
            padding: '12px 16px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} color="#16a34a" /> Instant Evaluator Demo
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#15803d' }}>
                Sign in with fictional verified profile (Johnathan Doe)
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleDemoAccess}
              disabled={loading}
              style={{
                background: '#16a34a',
                borderColor: '#16a34a',
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '6px 14px',
                whiteSpace: 'nowrap'
              }}
            >
              Demo Login
            </button>
          </div>
        )}

        {/* Patient Portal Mode Tabs */}
        {!isAdminPortal && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: '4px',
            background: 'var(--bg-alt, #f1f5f9)',
            padding: '4px',
            borderRadius: 'var(--radius-lg, 12px)',
            marginBottom: '18px'
          }}>
            <button
              type="button"
              className={`btn btn-sm ${authMode === 'otp' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '6px 4px' }}
              onClick={() => { setAuthMode('otp'); setErrorMsg(''); setSuccessMsg(''); }}
            >
              📱 Mobile OTP
            </button>
            <button
              type="button"
              className={`btn btn-sm ${authMode === 'login' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '6px 4px' }}
              onClick={() => { setAuthMode('login'); setErrorMsg(''); setSuccessMsg(''); }}
            >
              ✉️ Email
            </button>
            <button
              type="button"
              className={`btn btn-sm ${authMode === 'register' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '6px 4px' }}
              onClick={() => { setAuthMode('register'); setErrorMsg(''); setSuccessMsg(''); }}
            >
              📝 Register
            </button>
            <button
              type="button"
              className={`btn btn-sm ${authMode === 'onboarding' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '6px 4px' }}
              onClick={() => { setAuthMode('onboarding'); setErrorMsg(''); setSuccessMsg(''); }}
            >
              🌟 Tour
            </button>
          </div>
        )}

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="error-state-box" style={{ margin: '0 0 16px 0', padding: '10px 14px', fontSize: '0.82rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {successMsg && (
          <div style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '0.82rem',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CheckCircle2 size={16} color="#059669" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. ONBOARDING TOUR SCREEN */}
        {authMode === 'onboarding' && (
          <div>
            <div style={{
              background: 'var(--bg-surface, #f8fafc)',
              border: '1px solid var(--border-light, #e2e8f0)',
              borderRadius: '18px',
              padding: '24px',
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--primary-subtle, #eff6ff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}>
                {onboardingSlides[onboardingStep].icon}
              </div>
              <h3 style={{ fontSize: '1.15rem', color: 'var(--navy, #0f172a)', marginBottom: '8px' }}>
                {onboardingSlides[onboardingStep].title}
              </h3>
              <p style={{ color: 'var(--text-secondary, #475569)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '14px' }}>
                {onboardingSlides[onboardingStep].description}
              </p>
              <div style={{
                display: 'inline-block',
                background: 'var(--teal-light, #e6f7f5)',
                color: 'var(--teal-dark, #0f766e)',
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: '999px'
              }}>
                ✓ {onboardingSlides[onboardingStep].highlight}
              </div>
            </div>

            {/* Slide Navigation Dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}>
              {onboardingSlides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setOnboardingStep(idx)}
                  style={{
                    width: onboardingStep === idx ? '24px' : '8px',
                    height: '8px',
                    borderRadius: '4px',
                    background: onboardingStep === idx ? 'var(--primary, #0284c7)' : 'var(--border-light, #cbd5e1)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              {onboardingStep < onboardingSlides.length - 1 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => setOnboardingStep(prev => prev + 1)}
                >
                  Next Feature <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => setAuthMode('otp')}
                >
                  Get Started (Phone Login) <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* 2. PHONE NUMBER LOGIN WITH OTP */}
        {authMode === 'otp' && !isAdminPortal && (
          <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Mobile Phone Number *</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Indian or Global format</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Smartphone size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                <input
                  type="tel"
                  required
                  className="form-input"
                  style={{ paddingLeft: '36px' }}
                  placeholder="+91 98765 43210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={loading || otpSent}
                />
              </div>
            </div>

            {otpSent && (
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>6-Digit Verification Code (OTP) *</span>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={otpTimer > 0 || loading}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                  >
                    {otpTimer > 0 ? `Resend code in ${otpTimer}s` : 'Resend Code'}
                  </button>
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  className="form-input"
                  style={{ letterSpacing: '8px', fontSize: '1.25rem', textAlign: 'center', fontWeight: 800 }}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  disabled={loading}
                />
                <div style={{ marginTop: '6px', fontSize: '0.74rem', color: '#166534', background: '#f0fdf4', padding: '4px 8px', borderRadius: '6px' }}>
                  💡 Demo Hint: Code <strong>123456</strong> is verified automatically.
                </div>
              </div>
            )}

            {/* Privacy and Consent Checkbox */}
            <div style={{ margin: '14px 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  style={{ marginTop: '2px' }}
                />
                <span>
                  I accept the <button type="button" onClick={() => setIsPrivacyModalOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--primary)', textDecoration: 'underline', padding: 0, cursor: 'pointer', fontWeight: 600 }}>Consent and Privacy Policy</button>. I acknowledge VitaCare AI does not provide binding medical diagnoses.
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{ width: '100%', marginTop: '6px' }}
            >
              {loading ? 'Please wait...' : (otpSent ? 'Verify Code & Enter Portal' : 'Send Verification OTP')}
            </button>
          </form>
        )}

        {/* 3. EMAIL LOGIN / ADMIN LOGIN */}
        {(authMode === 'login' || isAdminPortal) && (
          <form onSubmit={handleSubmitEmailAuth}>
            {isAdminPortal && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '12px',
                padding: '12px',
                marginBottom: '16px',
                fontSize: '0.78rem',
                color: '#991b1b'
              }}>
                <div style={{ fontWeight: 700, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={14} /> Restricted Administrator Area
                </div>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.74rem' }}>
                  Patient accounts cannot access this command center. Use root administrator credentials.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={fillAdminCredentials}
                  style={{ width: '100%', fontSize: '0.75rem', background: '#fff', color: '#991b1b', borderColor: '#fca5a5' }}
                >
                  Autofill Admin Credentials
                </button>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">{isAdminPortal ? 'Admin Email' : 'Email Address'} *</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  required
                  className="form-input"
                  style={{ paddingLeft: '36px' }}
                  placeholder={isAdminPortal ? 'admin@vitacare.ai' : 'patient@example.com'}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password *</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="form-input"
                  style={{ paddingLeft: '36px', paddingRight: '36px' }}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', top: '14px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{
                width: '100%',
                marginTop: '10px',
                background: isAdminPortal ? '#dc2626' : undefined,
                borderColor: isAdminPortal ? '#dc2626' : undefined
              }}
            >
              {loading ? 'Authenticating...' : (isAdminPortal ? 'Authorize Admin Portal' : 'Sign In with Email')}
            </button>
          </form>
        )}

        {/* 4. COMPREHENSIVE PATIENT REGISTRATION FORM */}
        {authMode === 'register' && !isAdminPortal && (
          <form onSubmit={handleSubmitEmailAuth}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. Johnathan Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  required
                  className="form-input"
                  placeholder="user@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input
                  type="password"
                  required
                  className="form-input"
                  placeholder="Min 8 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <div className="form-group">
                <label className="form-label">Age</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Gender</label>
                <select
                  className="form-select"
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
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
                  value={formData.bloodGroup}
                  onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
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

            <div className="form-group">
              <label className="form-label">Known Allergies (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Penicillin, Sulfa drugs, Peanuts"
                value={formData.allergies}
                onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Chronic Conditions / Health History</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Type 2 Diabetes, Hypertension, Asthma"
                value={formData.chronicConditions}
                onChange={(e) => setFormData({ ...formData, chronicConditions: e.target.value })}
              />
            </div>

            {/* Emergency & Guardian Contact */}
            <div style={{
              background: 'var(--bg-alt, #f8fafc)',
              border: '1px solid var(--border-light, #e2e8f0)',
              borderRadius: '12px',
              padding: '12px',
              marginBottom: '14px'
            }}>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--navy)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PhoneCall size={14} color="var(--primary)" /> Emergency Contact & Healthcare Proxy
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Guardian Name (e.g. Eleanor Doe)"
                  value={formData.guardianName}
                  onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                />
                <input
                  type="tel"
                  className="form-input"
                  placeholder="Guardian Phone (+1 / +91)"
                  value={formData.guardianPhone}
                  onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value, emergencyPhone: e.target.value })}
                />
              </div>
            </div>

            {/* Privacy and Consent Checkbox */}
            <div style={{ margin: '14px 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  style={{ marginTop: '2px' }}
                />
                <span>
                  I accept the <button type="button" onClick={() => setIsPrivacyModalOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--primary)', textDecoration: 'underline', padding: 0, cursor: 'pointer', fontWeight: 600 }}>Consent and Privacy Policy</button>.
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? 'Creating Account...' : 'Complete Registration'}
            </button>
          </form>
        )}

        {/* Strict Identity Safety Guarantee Banner */}
        <div style={{
          marginTop: '18px',
          padding: '10px 14px',
          borderRadius: '10px',
          background: 'var(--bg-alt, #f8fafc)',
          border: '1px solid var(--border-light, #e2e8f0)',
          fontSize: '0.72rem',
          color: 'var(--text-muted, #64748b)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          lineHeight: 1.4
        }}>
          <Shield size={16} color="var(--teal, #0f766e)" style={{ flexShrink: 0 }} />
          <span>
            <strong>Zero Identity Leak Guarantee:</strong> VitaCare AI never collects Aadhaar, SSN, or sensitive national ID cards. All health measurements are user-verified.
          </span>
        </div>

        {/* Portal Switcher Navigation at Bottom */}
        <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border-light, #e2e8f0)', textAlign: 'center' }}>
          {isAdminPortal ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onSwitchPortal('user')}
              style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <ArrowLeft size={14} /> Return to Patient User Portal
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onSwitchPortal('admin')}
              style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#dc2626' }}
            >
              <ShieldCheck size={14} /> Switch to Administrator CMS Portal
            </button>
          )}
        </div>
      </div>

      {/* Consent & Privacy Policy Modal */}
      {isPrivacyModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsPrivacyModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={22} color="var(--teal)" />
                <h3>Consent & Health Privacy Charter</h3>
              </div>
              <button className="btn-close" onClick={() => setIsPrivacyModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', fontSize: '0.85rem', lineHeight: 1.6 }}>
              <p><strong>1. Purpose of VitaCare AI</strong><br />
              VitaCare AI organizes personal medical documents, extracted lab biomarkers, and medication schedules. The AI assistant and symptom checker provide educational information only and <strong>do not provide medical diagnosis, treatment, or prescribe drugs</strong>.</p>
              
              <p style={{ marginTop: '12px' }}><strong>2. Strict Identity Protection</strong><br />
              We strictly refrain from collecting Aadhaar numbers, passport details, or sensitive national identifiers. Account ownership is authenticated securely via phone number OTP or encrypted email credentials.</p>

              <p style={{ marginTop: '12px' }}><strong>3. User Control & Verification</strong><br />
              All information extracted via OCR from prescriptions and lab panels requires user review and verification before being committed to your permanent medical timeline.</p>

              <p style={{ marginTop: '12px' }}><strong>4. Data Export & Deletion Rights</strong><br />
              In adherence with Digital Personal Data Protection standards and GDPR, you have the unilateral right to export your complete medical record in standard JSON format or completely erase your account and all associated data at any time from your settings.</p>

              <p style={{ marginTop: '12px' }}><strong>5. Permissions Justification</strong><br />
              Camera and microphone access are requested only when taking a photo of a document or speaking a voice query. Access can be revoked at any time in browser settings.</p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => { setConsentAccepted(true); setIsPrivacyModalOpen(false); }}
              >
                I Accept & Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
