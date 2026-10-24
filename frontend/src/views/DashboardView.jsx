import React, { useState, useEffect, useRef } from 'react';
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
  Mic,
  StopCircle,
  X,
  Video,
  UserCheck,
  Bell,
  HeartHandshake,
  Calendar,
  AlertCircle,
  Volume2,
  Sun,
  Moon,
  Clock3,
  Stethoscope,
  Apple,
  Building2,
  BookOpen,
  Lock,
  Globe,
  Users
} from 'lucide-react';
import { api } from '../api/apiClient';
import { useTranslation } from '../i18n/LanguageContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { PillConsumptionTrackerModal } from '../components/PillConsumptionTrackerModal';

export const DashboardView = ({ 
  onAddPrescription, 
  onAddReport, 
  onOpenMedicineReminder, 
  onViewReport, 
  setActiveView 
}) => {
  const { t, language, setLanguage, formatDate, formatNumber, bcp47 } = useTranslation();
  const { speak } = useAccessibility();
  const [data, setData] = useState(null);
  const [cmsConfig, setCmsConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [trackingTargetSchedule, setTrackingTargetSchedule] = useState(null);

  // Copilot quick question state
  const [copilotQuestion, setCopilotQuestion] = useState('');
  const [copilotAnswer, setCopilotAnswer] = useState(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [voiceQueryPreview, setVoiceQueryPreview] = useState('');
  const dashRecRef = useRef(null);

  const toggleVoiceRecording = () => {
    if (isListeningVoice) {
      if (dashRecRef.current) dashRecRef.current.stop();
      setIsListeningVoice(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = bcp47 || 'en-US';
      recognition.interimResults = true;
      recognition.onstart = () => setIsListeningVoice(true);
      recognition.onresult = (event) => {
        let text = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          text += event.results[i][0].transcript;
        }
        setVoiceQueryPreview(text);
        setCopilotQuestion(text);
      };
      recognition.onerror = () => setIsListeningVoice(false);
      recognition.onend = () => setIsListeningVoice(false);
      dashRecRef.current = recognition;
      recognition.start();
    } catch (e) {
      setIsListeningVoice(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('goodMorning') || 'Good morning';
    if (hour < 17) return t('goodAfternoon') || 'Good afternoon';
    return t('goodEvening') || 'Good evening';
  };

  const formattedDate = formatDate(new Date(), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const handleReadDoseAloud = (med) => {
    if (!med) return;
    const text = `Your next scheduled medicine is ${med.medicineName}, ${med.dosage}, scheduled for ${med.scheduledTime}. Instructions: ${med.instructions || 'Take as prescribed with water.'}`;
    speak(text, language);
  };

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
      const res = await api.askAi(query, 'simple', language);
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

      {/* 2. SCENIC SUNRISE / SOFT BLUE WELCOME BANNER (Requirement 2.C) */}
      <div className="action-banner" style={{
        background: 'linear-gradient(135deg, #173B56 0%, #1597A5 65%, #38BDF8 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: '30px 34px',
        color: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px',
        boxShadow: '0 10px 25px -5px rgba(23, 59, 86, 0.25)',
        border: '1.5px solid rgba(255, 255, 255, 0.2)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle decorative medical graphic backdrop */}
        <div style={{
          position: 'absolute',
          right: '-20px',
          top: '-20px',
          width: '260px',
          height: '260px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(189, 237, 232, 0.22) 0%, rgba(21, 151, 165, 0) 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ maxWidth: '650px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '4px 12px',
              borderRadius: '999px',
              fontSize: '0.88rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Calendar size={14} /> {formattedDate}
            </span>
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 8px 0', color: '#fff', lineHeight: 1.2 }}>
            {getGreeting()}, {user?.name || 'Patient'}!
          </h2>
          <p style={{ margin: 0, fontSize: '1.05rem', color: 'rgba(255,255,255,0.92)', lineHeight: 1.5 }}>
            {t('welcomeBannerSubtitle') || "Your health journey matters. Here's what's happening today."}
          </p>
          <div style={{ display: 'flex', gap: '16px', marginTop: '14px', fontSize: '0.92rem', color: 'rgba(255,255,255,0.9)', flexWrap: 'wrap' }}>
            <span>{t('bloodGroup') || 'Blood Group'}: <strong>{user?.bloodGroup || 'Not specified'}</strong></span>
            <span>{t('age') || 'Age'}: <strong>{user?.age ? `${user.age} yrs` : 'Not recorded'}</strong></span>
            <span>{t('language') || 'Language'}: <strong>{(user?.preferredLanguage || language || 'en').toUpperCase()}</strong></span>
          </div>
        </div>

        {/* Large Action Buttons */}
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={onAddPrescription}
            id="btn-add-prescription-top"
            style={{
              background: '#ffffff',
              color: 'var(--navy)',
              fontWeight: 800,
              boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
              gap: '8px',
              borderRadius: '12px'
            }}
          >
            <Plus size={20} color="var(--primary)" /> {t('addPrescription') || 'Add Prescription'}
          </button>
          <button
            className="btn btn-secondary btn-lg"
            onClick={onAddReport}
            id="btn-add-health-report-top"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: '#ffffff',
              border: '2px solid rgba(255,255,255,0.4)',
              fontWeight: 800,
              gap: '8px',
              borderRadius: '12px'
            }}
          >
            <Plus size={20} /> {t('addHealthReport') || 'Add Report'}
          </button>
        </div>
      </div>

      {/* 2B. 4 HEALTH OVERVIEW CARDS (Requirement 2.D) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px'
      }}>
        {/* Card 1: Total Health Reports (Turquoise Accent) */}
        <div 
          className="card"
          onClick={() => setActiveView && setActiveView('reports')}
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1.5px solid #cffafe',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 10px rgba(6, 182, 212, 0.06)'
          }}
          id="overview-card-reports"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#ecfeff',
              color: '#0891b2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FileText size={22} />
            </div>
            <ArrowUpRight size={18} color="#0891b2" />
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--navy)', lineHeight: 1.1 }}>
              {recentReports.length + recentPrescriptions.length}
            </div>
            <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '4px' }}>
              {t('cardTotalReports') || 'Total Health Reports'}
            </div>
          </div>
        </div>

        {/* Card 2: Today's Medicines (Violet Accent) */}
        <div 
          className="card"
          onClick={() => setActiveView && setActiveView('medicines')}
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1.5px solid #ede9fe',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 10px rgba(139, 92, 246, 0.06)'
          }}
          id="overview-card-medicines"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#f5f3ff',
              color: '#7c3aed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Pill size={22} />
            </div>
            <ArrowUpRight size={18} color="#7c3aed" />
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--navy)', lineHeight: 1.1 }}>
              {todaySchedules.length}
            </div>
            <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '4px' }}>
              {t('cardTodayMedicines') || "Today's Medicines"}
            </div>
          </div>
        </div>

        {/* Card 3: Family Members (Blue Accent) */}
        <div 
          className="card"
          onClick={() => setActiveView && setActiveView('guardians')}
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1.5px solid #dbeafe',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 10px rgba(59, 130, 246, 0.06)'
          }}
          id="overview-card-family"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Users size={22} />
            </div>
            <ArrowUpRight size={18} color="#2563eb" />
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--navy)', lineHeight: 1.1 }}>
              {guardians.length}
            </div>
            <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '4px' }}>
              {t('cardFamilyMembers') || 'Family Members'}
            </div>
          </div>
        </div>

        {/* Card 4: Overall Health Overview (Green Accent) */}
        <div 
          className="card"
          onClick={() => setActiveView && setActiveView('tracker')}
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1.5px solid #d1fae5',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 10px rgba(16, 185, 129, 0.06)'
          }}
          id="overview-card-health"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#ecfdf5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Activity size={22} />
            </div>
            <ArrowUpRight size={18} color="#059669" />
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--navy)', lineHeight: 1.1 }}>
              {adherence?.adherencePercentage !== undefined ? `${adherence.adherencePercentage}%` : '100%'}
            </div>
            <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '4px' }}>
              {t('cardOverallHealth') || 'Overall Health Overview'}
            </div>
          </div>
        </div>
      </div>

      {/* 2B. CLEAN SLATE ONBOARDING BANNER FOR NEWLY REGISTERED PATIENT */}
      {(todaySchedules.length === 0 && recentReports.length === 0 && recentPrescriptions.length === 0 && latestVitals.length === 0) && (
        <div className="card" style={{
          background: '#ffffff',
          border: '1.5px solid var(--border-light)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px 28px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#ecfdf5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Sparkles size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--navy)', fontWeight: 800 }}>
                {t('welcomeToVitacare') || 'Welcome to VitaCare AI'}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {t('completeProfilePrompt') || 'Complete your profile when you are ready.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '18px' }}>
            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>📋 Medical Records</div>
              <strong style={{ fontSize: '0.85rem', color: 'var(--navy)' }}>{t('noRecordsYet') || 'No medical records added yet.'}</strong>
            </div>
            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>💊 Medications</div>
              <strong style={{ fontSize: '0.85rem', color: 'var(--navy)' }}>{t('noMedicationsYet') || 'No medications added yet.'}</strong>
            </div>
            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>🗓️ Appointments</div>
              <strong style={{ fontSize: '0.85rem', color: 'var(--navy)' }}>{t('noAppointmentsYet') || 'No appointments scheduled yet.'}</strong>
            </div>
            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>💬 Conversations</div>
              <strong style={{ fontSize: '0.85rem', color: 'var(--navy)' }}>{t('noConversationsYet') || 'No conversations yet.'}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid var(--border-light)', paddingTop: '14px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {t('addFirstRecord') || 'Add your first record when needed.'}
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary btn-sm" onClick={onAddPrescription}>
                <Plus size={14} /> {t('addPrescription') || 'Add Prescription'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={onAddReport}>
                <Plus size={14} /> {t('addHealthReport') || 'Add Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. AI HEALTH ASSISTANT CARD (Requirement 2.G) */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #F0FBFB 100%)',
        border: '1.5px solid var(--secondary-accent)',
        padding: '24px 28px',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 4px 20px rgba(21, 151, 165, 0.08)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #1597A5 0%, #117C88 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(21, 151, 165, 0.3)'
            }}>
              <Bot size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--navy)', fontWeight: 800 }}>
                {t('aiHealthAssistantHeading') || 'AI Health Assistant'}
              </h3>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {t('aiHealthAssistantWelcome') || 'Hello! How can I assist with your health records and medication today?'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Language Selector for English, Tamil, Tanglish, Hindi, Telugu (Requirement 2.G) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '999px', padding: '4px 12px' }}>
              <Globe size={14} color="var(--primary)" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{ border: 'none', background: 'transparent', fontSize: '0.78rem', fontWeight: 700, color: 'var(--navy)', cursor: 'pointer', outline: 'none' }}
                title="Select Language"
              >
                <option value="en">🇬🇧 English</option>
                <option value="ta">🇮🇳 தமிழ்</option>
                <option value="tanglish">🇮🇳 Tanglish (தமிழ்)</option>
                <option value="hi">🇮🇳 हिन्दी</option>
                <option value="te">🇮🇳 తెలుగు</option>
              </select>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setActiveView && setActiveView('copilot')}
              style={{ fontSize: '0.8rem', borderRadius: '999px' }}
            >
              {t('openFullChat') || 'Open Full Chat'} <ArrowUpRight size={14} />
            </button>
          </div>
        </div>

        {/* Input Bar */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
          <input
            type="text"
            className="input-field"
            value={copilotQuestion}
            onChange={(e) => setCopilotQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAskCopilot(); }}
            placeholder={isListeningVoice ? "Listening to your voice... Speak now" : (t('askCopilotPlaceholder') || "Ask about medications, test reference ranges, or health trends...")}
            style={{ flex: 1, padding: '12px 18px', fontSize: '0.92rem', borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--border-light)', background: '#fff' }}
          />
          <button
            type="button"
            className={`btn btn-secondary ${isListeningVoice ? 'active' : ''}`}
            onClick={toggleVoiceRecording}
            style={{
              padding: '0 16px',
              borderRadius: 'var(--radius-lg)',
              background: isListeningVoice ? '#fee2e2' : undefined,
              borderColor: isListeningVoice ? '#fca5a5' : undefined,
              color: isListeningVoice ? '#dc2626' : undefined
            }}
            title={isListeningVoice ? "Stop speaking" : "Speak voice question"}
          >
            <Mic size={18} />
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleAskCopilot()}
            disabled={copilotLoading || !copilotQuestion.trim()}
            style={{ padding: '0 24px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: 'var(--radius-lg)' }}
          >
            <Send size={16} /> {copilotLoading ? (t('thinking') || 'Thinking...') : (t('ask') || 'Ask')}
          </button>
        </div>

        {/* Voice Question Display Box - Directly BELOW the Text Bar */}
        {(isListeningVoice || (voiceQueryPreview && voiceQueryPreview.trim().length > 0)) && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: isListeningVoice ? '#fef2f2' : 'var(--primary-subtle)',
              border: `1.5px solid ${isListeningVoice ? '#fca5a5' : 'var(--secondary-accent)'}`,
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
              <div style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background: isListeningVoice ? '#dc2626' : 'var(--primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Mic size={15} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: isListeningVoice ? '#dc2626' : 'var(--primary-dark)' }}>
                  {isListeningVoice ? '🔴 LISTENING (Speak now)...' : '🎙️ VOICE QUESTION'}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--navy)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  "{voiceQueryPreview || copilotQuestion}"
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              {isListeningVoice ? (
                <button
                  type="button"
                  onClick={toggleVoiceRecording}
                  className="btn btn-secondary btn-sm"
                  style={{ minHeight: '30px', padding: '2px 8px', fontSize: '0.78rem', color: '#dc2626' }}
                >
                  <StopCircle size={14} /> Stop
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (copilotQuestion.trim()) {
                        handleAskCopilot(copilotQuestion.trim());
                        setVoiceQueryPreview('');
                      }
                    }}
                    className="btn btn-primary btn-sm"
                    style={{ minHeight: '30px', padding: '2px 10px', fontSize: '0.78rem' }}
                  >
                    <Send size={13} /> Ask
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVoiceQueryPreview('');
                      setCopilotQuestion('');
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ minHeight: '30px', padding: '2px 8px' }}
                    title="Clear"
                  >
                    <X size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Suggested Question Chips (Requirement 2.G) */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              const q = t('promptChipExplainReport') || 'Explain my latest blood report';
              setCopilotQuestion(q);
              handleAskCopilot(q);
            }}
            style={{ background: '#fff', border: '1px solid var(--secondary-accent)', color: 'var(--navy)', fontSize: '0.8rem', borderRadius: '999px', padding: '6px 14px', fontWeight: 600 }}
          >
            🔬 {t('promptChipExplainReport') || 'Explain my latest blood report'}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              const q = t('promptChipFollowSchedule') || 'How should I follow my prescribed medicine schedule?';
              setCopilotQuestion(q);
              handleAskCopilot(q);
            }}
            style={{ background: '#fff', border: '1px solid var(--secondary-accent)', color: 'var(--navy)', fontSize: '0.8rem', borderRadius: '999px', padding: '6px 14px', fontWeight: 600 }}
          >
            💊 {t('promptChipFollowSchedule') || 'How should I follow my prescribed medicine schedule?'}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              const q = t('promptChipCompareReports') || 'Compare my recent and previous reports';
              setCopilotQuestion(q);
              handleAskCopilot(q);
            }}
            style={{ background: '#fff', border: '1px solid var(--secondary-accent)', color: 'var(--navy)', fontSize: '0.8rem', borderRadius: '999px', padding: '6px 14px', fontWeight: 600 }}
          >
            📊 {t('promptChipCompareReports') || 'Compare my recent and previous reports'}
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

      {/* 4. COMPREHENSIVE CARE ECOSYSTEM SERVICES */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px'
      }}>
        {/* Symptom Guidance */}
        <div
          className="card"
          onClick={() => setActiveView('symptoms')}
          style={{
            cursor: 'pointer',
            padding: '16px',
            borderRadius: '16px',
            border: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Stethoscope size={22} />
          </div>
          <div>
            <strong style={{ fontSize: '0.92rem', color: 'var(--navy)', display: 'block' }}>Symptom Guidance</strong>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Triage & Doctor Checklist</span>
          </div>
        </div>

        {/* Doctor Appointments */}
        <div
          className="card"
          onClick={() => setActiveView('appointments')}
          style={{
            cursor: 'pointer',
            padding: '16px',
            borderRadius: '16px',
            border: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Calendar size={22} />
          </div>
          <div>
            <strong style={{ fontSize: '0.92rem', color: 'var(--navy)', display: 'block' }}>Appointments</strong>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Clinic Visits & Reminders</span>
          </div>
        </div>

        {/* Wellness & Nutrition */}
        <div
          className="card"
          onClick={() => setActiveView('wellness')}
          style={{
            cursor: 'pointer',
            padding: '16px',
            borderRadius: '16px',
            border: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Apple size={22} />
          </div>
          <div>
            <strong style={{ fontSize: '0.92rem', color: 'var(--navy)', display: 'block' }}>Wellness & Nutrition</strong>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Hydration & BMI Calculator</span>
          </div>
        </div>

        {/* Nearby Hospitals */}
        <div
          className="card"
          onClick={() => setActiveView('hospitals')}
          style={{
            cursor: 'pointer',
            padding: '16px',
            borderRadius: '16px',
            border: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Building2 size={22} />
          </div>
          <div>
            <strong style={{ fontSize: '0.92rem', color: 'var(--navy)', display: 'block' }}>Nearby Hospitals</strong>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>24/7 ER & Trauma Centers</span>
          </div>
        </div>

        {/* Medical Dictionary */}
        <div
          className="card"
          onClick={() => setActiveView('dictionary')}
          style={{
            cursor: 'pointer',
            padding: '16px',
            borderRadius: '16px',
            border: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BookOpen size={22} />
          </div>
          <div>
            <strong style={{ fontSize: '0.92rem', color: 'var(--navy)', display: 'block' }}>Medical Dictionary</strong>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Search Tests & Drugs</span>
          </div>
        </div>

        {/* Profile & Privacy */}
        <div
          className="card"
          onClick={() => setActiveView('privacy')}
          style={{
            cursor: 'pointer',
            padding: '16px',
            borderRadius: '16px',
            border: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--bg-alt)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Lock size={22} />
          </div>
          <div>
            <strong style={{ fontSize: '0.92rem', color: 'var(--navy)', display: 'block' }}>Profile & Privacy</strong>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Export Data & Consents</span>
          </div>
        </div>
      </div>

      {/* 5. LARGE HERO NEXT MEDICINE CARD — ELDER ACCESSIBLE */}
      {nextMed ? (
        <div
          className="next-med-card"
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%)',
            border: '2px solid var(--teal)',
            borderRadius: 'var(--radius-xl)',
            padding: '28px 32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '24px',
            boxShadow: '0 8px 24px rgba(15, 157, 138, 0.12)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', maxWidth: '680px' }}>
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '20px',
              background: 'var(--teal)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 6px 16px rgba(15, 157, 138, 0.3)',
              flexShrink: 0
            }}>
              <Pill size={36} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--teal-dark)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  YOUR NEXT MEDICINE
                </span>
                <span className="badge badge-orange" style={{ fontSize: '0.8rem', padding: '3px 8px' }}>
                  ⏳ PENDING INTAKE
                </span>
                <button
                  type="button"
                  onClick={() => handleReadDoseAloud(nextMed)}
                  className="btn btn-secondary btn-sm"
                  style={{ minHeight: '36px', padding: '4px 10px', fontSize: '0.85rem', gap: '4px' }}
                  title="Read medicine details aloud"
                  aria-label="Read medicine details aloud"
                >
                  <Volume2 size={16} color="var(--primary)" /> Read Aloud
                </button>
              </div>

              <h3 style={{ fontSize: '1.6rem', color: 'var(--navy)', margin: '2px 0 6px 0', fontWeight: 800 }}>
                {nextMed.medicineName}
              </h3>

              <p style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: '0 0 10px 0', fontWeight: 600 }}>
                Instructions: {nextMed.instructions || 'Take 1 dose with a full glass of water after meals.'}
              </p>

              <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <span>Prescribed Dose: <strong style={{ color: 'var(--navy)' }}>{nextMed.dosage}</strong></span>
                <span>Scheduled For: <strong style={{ color: 'var(--primary)', fontSize: '1.15rem' }}>⏰ {nextMed.scheduledTime}</strong></span>
              </div>
            </div>
          </div>

          {/* Action Buttons for Dose */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '220px' }}>
            <button
              className="btn btn-success btn-lg"
              onClick={() => setTrackingTargetSchedule(nextMed)}
              id="btn-track-pill-next"
              style={{
                padding: '16px 28px',
                fontWeight: 800,
                fontSize: '1.15rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 4px 16px rgba(15, 157, 138, 0.35)'
              }}
            >
              <Camera size={22} /> Mark as Taken
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => onOpenMedicineReminder(nextMed)}
              style={{ minHeight: '46px', fontWeight: 700, gap: '6px' }}
            >
              <Clock3 size={18} /> Remind Me Later
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          background: '#ffffff',
          border: '2px dashed var(--border-light)',
          borderRadius: 'var(--radius-xl)',
          padding: '32px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--teal-light)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={28} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--navy)', margin: '0 0 4px 0', fontWeight: 800 }}>
                All Doses Completed for Now!
              </h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1rem' }}>
                You have no pending medications right now. Rest well or add a new prescription if prescribed.
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-lg" onClick={() => setActiveView('medicines')}>
            {t('viewAllMedicines') || 'View Medicines'}
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
            <div className="card-header" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3 className="card-title" style={{ fontSize: '1.35rem' }}>
                  <Pill size={22} color="var(--primary)" />
                  {t('todaysDoses') || "Today's Medicine Schedule"}
                </h3>
                {todaySchedules.length > 0 && (
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                    Completed: <strong>{todaySchedules.filter(s => s.status === 'taken' || s.status === 'Verified').length} of {todaySchedules.length} doses taken</strong> ({Math.round((todaySchedules.filter(s => s.status === 'taken' || s.status === 'Verified').length / todaySchedules.length) * 100)}%)
                  </p>
                )}
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setActiveView('medicines')}
                style={{ fontWeight: 700 }}
              >
                Manage Schedule <ArrowUpRight size={16} />
              </button>
            </div>

            {/* Dose Progress Bar */}
            {todaySchedules.length > 0 && (
              <div style={{ padding: '0 20px 16px 20px' }}>
                <div style={{ width: '100%', height: '10px', background: 'var(--bg-alt)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${(todaySchedules.filter(s => s.status === 'taken' || s.status === 'Verified').length / todaySchedules.length) * 100}%`,
                      background: 'var(--teal)',
                      borderRadius: '999px',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
              </div>
            )}

            {todaySchedules.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-muted)' }}>
                <Pill size={44} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
                <h4 style={{ fontSize: '1.2rem', color: 'var(--navy)', marginBottom: '6px' }}>No medicines scheduled for today</h4>
                <p style={{ fontSize: '0.95rem', marginBottom: '18px', maxWidth: '420px', margin: '0 auto 18px auto' }}>
                  When your doctor prescribes a new medication, add it here to receive timely reminders and tracking.
                </p>
                <button className="btn btn-primary" onClick={onAddPrescription}>
                  <Plus size={18} /> Add New Prescription
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {todaySchedules.map((med) => {
                  const isVerified = med.status === 'taken' || med.status === 'Verified';
                  return (
                    <div
                      key={med.id}
                      className={`med-schedule-item ${med.status}`}
                      style={{
                        padding: '16px 20px',
                        border: `2px solid ${isVerified ? 'var(--status-green-border)' : 'var(--border-light)'}`,
                        borderRadius: 'var(--radius-lg)',
                        background: isVerified ? 'var(--status-green-bg)' : '#ffffff'
                      }}
                    >
                      <div className="med-schedule-time" style={{ fontSize: '1.1rem', fontWeight: 800, color: isVerified ? 'var(--teal-dark)' : 'var(--navy)' }}>
                        <Clock size={18} style={{ display: 'inline', marginRight: '6px' }} />
                        {med.scheduledTime}
                      </div>
                      <div className="med-schedule-info">
                        <div className="med-schedule-name" style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                          {med.medicineName}
                        </div>
                        <div className="med-schedule-dose" style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                          {med.dosage} • {med.instructions || 'After food'}
                        </div>
                      </div>
                      <div>
                        {isVerified ? (
                          <span className="badge badge-green" style={{ fontSize: '0.85rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <CheckCircle size={16} /> TAKEN - VERIFIED
                          </span>
                        ) : (
                          <button
                            className="btn btn-success"
                            onClick={() => setTrackingTargetSchedule(med)}
                            style={{ minHeight: '44px', padding: '8px 18px', fontWeight: 700, gap: '6px', fontSize: '0.95rem' }}
                          >
                            <Camera size={16} /> Mark as Taken
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
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

        {/* RIGHT COLUMN: Health Insights, Adherence, Care Connect, Guardian Alerts, Recent Reports */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Health Insights Card (Requirement 2.I) */}
          <div className="card" style={{ border: '1.5px solid var(--secondary-accent)', borderRadius: '16px' }}>
            <div className="card-header">
              <h3 className="card-title" style={{ fontSize: '1.15rem' }}>
                <Sparkles size={19} color="var(--primary)" />
                {t('healthInsightsTitle') || 'Health Insights'}
              </h3>
              <span className="badge badge-green" style={{ fontSize: '0.72rem' }}>
                {t('verified') || 'VERIFIED'}
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 14px 0' }}>
              {t('healthInsightsSubtitle') || 'Comparable measurements, historical trends, and upcoming care tasks'}
            </p>

            {summaryPoints.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {summaryPoints.map((pt, idx) => (
                  <div key={idx} style={{
                    padding: '10px 14px',
                    borderRadius: '12px',
                    background: 'var(--bg-alt)',
                    fontSize: '0.86rem',
                    color: 'var(--navy)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }} />
                    <span>{pt}</span>
                  </div>
                ))}
              </div>
            ) : latestVitals.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ padding: '10px 14px', borderRadius: '12px', background: 'var(--primary-subtle)', fontSize: '0.86rem', color: 'var(--navy)' }}>
                  <strong>{latestVitals[0].metricName}:</strong> {latestVitals[0].value} {latestVitals[0].unit} ({latestVitals[0].statusIndicator})
                </div>
                {todaySchedules.length > 0 && (
                  <div style={{ padding: '10px 14px', borderRadius: '12px', background: 'var(--bg-alt)', fontSize: '0.86rem', color: 'var(--navy)' }}>
                    <strong>Upcoming:</strong> {todaySchedules.filter(s => s.status !== 'taken' && s.status !== 'Verified').length} pending medication doses today.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                {t('noInsightsYet') || 'Upload lab reports or track vitals to generate automated health comparisons.'}
              </div>
            )}
          </div>

          {/* Adherence Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <CheckCircle size={18} color="var(--primary)" />
                {t('medicationAdherence') || 'Medication Adherence'}
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

          {/* Recent Health Reports (Requirement 2.F) */}
          <div className="card" style={{ borderRadius: '16px', border: '1.5px solid var(--border-light)' }}>
            <div className="card-header">
              <h3 className="card-title" style={{ fontSize: '1.15rem' }}>
                <FileText size={18} color="var(--primary)" />
                {t('recentHealthReports') || 'Recent Health Reports'}
              </h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setActiveView('reports')}
                style={{ borderRadius: '999px', fontSize: '0.8rem', gap: '4px' }}
              >
                {t('actionViewAll') || 'View All'} <ArrowUpRight size={14} />
              </button>
            </div>

            {recentReports.length === 0 && recentPrescriptions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)' }}>
                <FileText size={36} style={{ margin: '0 auto 8px auto', opacity: 0.35 }} />
                <p style={{ margin: 0, fontSize: '0.86rem' }}>
                  {t('noReportsUploaded') || 'No medical reports uploaded yet.'}
                </p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={onAddReport}
                  style={{ marginTop: '10px', borderRadius: '8px' }}
                >
                  <Plus size={14} /> {t('addHealthReport') || 'Add Report'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recentReports.map(rep => (
                  <div
                    key={rep.id}
                    onClick={() => onViewReport ? onViewReport(rep) : setActiveView('reports')}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid var(--border-light)',
                      cursor: 'pointer',
                      background: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      transition: 'all 0.18s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'var(--primary-subtle)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <FileText size={18} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: '0.88rem', color: 'var(--navy)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {rep.reportType || rep.title || 'Laboratory Diagnostic Report'}
                        </strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {rep.labName ? `${rep.labName} • ` : ''}{rep.reportDate || 'Recent'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span className="badge badge-green" style={{ fontSize: '0.68rem', padding: '3px 8px' }}>
                        {t('verified') || 'VERIFIED'}
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onViewReport) onViewReport(rep);
                          else setActiveView('reports');
                        }}
                      >
                        {t('actionViewDetails') || 'View Details'}
                      </button>
                    </div>
                  </div>
                ))}

                {recentPrescriptions.map(rx => (
                  <div
                    key={rx.id}
                    onClick={() => setActiveView('medicines')}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid var(--border-light)',
                      cursor: 'pointer',
                      background: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: '#ecfdf5',
                        color: '#059669',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Pill size={18} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: '0.88rem', color: 'var(--navy)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {rx.doctorName ? `Rx by Dr. ${rx.doctorName}` : 'Prescription Order'}
                        </strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {rx.createdAt ? new Date(rx.createdAt).toLocaleDateString() : 'Active'}
                        </div>
                      </div>
                    </div>
                    <span className="badge badge-green" style={{ fontSize: '0.68rem', padding: '3px 8px' }}>
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
          if (trackingTargetSchedule) {
            const targetId = trackingTargetSchedule.id;
            setData(prev => {
              if (!prev || !prev.todaySchedules) return prev;
              const updatedSchedules = prev.todaySchedules.map(s => {
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
              });
              const nextPending = updatedSchedules.find(s => s.status !== 'Verified' && s.status !== 'taken');
              return {
                ...prev,
                todaySchedules: updatedSchedules,
                nextMedicine: nextPending || updatedSchedules[0]
              };
            });
          }
          fetchDashboard();
        }}
        onRefused={() => {
          fetchDashboard();
        }}
      />
    </div>
  );
};
