import React from 'react';
import { 
  HeartPulse, 
  LayoutDashboard, 
  FileText, 
  GitCompare, 
  Activity, 
  TrendingUp, 
  Pill, 
  Video, 
  CalendarCheck, 
  Clock, 
  Bot, 
  Users, 
  LogOut, 
  ShieldCheck, 
  X,
  ChevronRight,
  Sliders,
  Stethoscope,
  Calendar,
  Building2,
  Apple,
  BookOpen,
  GraduationCap,
  Lock,
  History,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n/LanguageContext';
import { useBranding } from '../context/BrandingContext';

export const Sidebar = ({ 
  activeView, 
  setActiveView, 
  isOpen, 
  onClose,
  portalMode = 'user',
  onSwitchPortal,
  onOpenAccessibility
}) => {
  const { user, logout, isAdmin } = useAuth();
  const { t } = useTranslation();
  const { websiteName, logoUrl } = useBranding();
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [logoUrl]);

  // Primary core navigation items matching requirements
  const primaryNavItems = [
    { id: 'dashboard', label: t('navOverview') || 'Overview', icon: LayoutDashboard },
    { id: 'reports', label: t('navHealthReports') || 'Health Reports', icon: FileText },
    { id: 'medicines', label: t('navMedicines') || 'Medicines', icon: Pill },
    { id: 'tracker', label: t('navHealthTracker') || 'Health Tracker', icon: Activity },
    { id: 'copilot', label: t('navAiAssistant') || 'AI Assistant', icon: Bot, badge: 'AI' },
    { id: 'guardians', label: t('navFamilyHealth') || 'Family Health', icon: Users },
    { id: 'privacy', label: t('navSettings') || 'Settings', icon: Lock }
  ];

  // Extended clinical care sections (preserving all working features)
  const secondaryNavSections = [
    {
      title: t('clinicalCare') || 'CLINICAL CARE',
      items: [
        { id: 'symptoms', label: t('symptomGuidance') || 'Symptom Guidance', icon: Stethoscope },
        { id: 'appointments', label: t('doctorAppointments') || 'Appointments', icon: Calendar },
        { id: 'careconnect', label: t('careConnect') || 'CareConnect Video', icon: Video, badge: 'Live' }
      ]
    },
    {
      title: t('recordsAndAnalytics') || 'RECORDS & ANALYTICS',
      items: [
        { id: 'compare', label: t('compare') || 'Compare Reports', icon: GitCompare },
        { id: 'trends', label: t('trends') || 'Physiological Trends', icon: TrendingUp },
        { id: 'adherence', label: t('adherence') || 'Adherence Analytics', icon: CalendarCheck },
        { id: 'timeline', label: t('timeline') || 'Medical History', icon: Clock }
      ]
    },
    {
      title: t('wellnessAndFacilities') || 'WELLNESS & FACILITIES',
      items: [
        { id: 'wellness', label: t('wellnessNutrition') || 'Wellness & Nutrition', icon: Apple },
        { id: 'hospitals', label: t('nearbyHospitals') || 'Nearby Hospitals & ER', icon: Building2 },
        { id: 'alerts', label: t('alertHistory') || 'Emergency Alerts', icon: History }
      ]
    },
    {
      title: t('resources') || 'RESOURCES',
      items: [
        { id: 'dictionary', label: t('medicalDictionary') || 'Medical Dictionary', icon: BookOpen },
        { id: 'library', label: t('healthLibrary') || 'Health Library', icon: GraduationCap }
      ]
    }
  ];

  const handleNavClick = (id) => {
    setActiveView(id);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Vertical Sidebar */}
      <aside className={`app-sidebar ${isOpen ? 'open' : ''}`} id="vitacare-sidebar">
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="brand-logo-icon" style={{
            background: 'linear-gradient(135deg, #1597A5 0%, #117C88 100%)',
            boxShadow: '0 4px 12px rgba(21, 151, 165, 0.35)',
            borderRadius: '12px',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            {logoUrl && !imgError ? (
              <img 
                src={logoUrl} 
                alt={websiteName || 'Brand Logo'} 
                onError={() => setImgError(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
            ) : (
              <HeartPulse size={22} color="#ffffff" strokeWidth={2.4} />
            )}
          </div>
          <div className="brand-text">
            <h2 style={{ color: 'var(--navy)', fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
              {websiteName || 'VitaCare AI'}
            </h2>
            <span className="tagline" style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 600 }}>
              {t('sidebarAiTagline') || 'Your Personal Health Copilot'}
            </span>
          </div>
          {/* Close button on mobile */}
          <button 
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Portal Indicator Badge */}
        <div style={{ padding: '0 18px 10px 18px' }}>
          <div style={{
            background: portalMode === 'admin' ? 'rgba(239, 68, 68, 0.08)' : 'var(--primary-subtle)',
            border: `1px solid ${portalMode === 'admin' ? 'rgba(239, 68, 68, 0.2)' : 'var(--border-light)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '7px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.74rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: portalMode === 'admin' ? '#ef4444' : '#10b981'
              }} />
              <strong style={{ color: portalMode === 'admin' ? '#991b1b' : 'var(--navy)' }}>
                {portalMode === 'admin' ? (t('adminPortal') || 'ADMIN PORTAL') : (t('patientPortal') || 'PATIENT COPILOT')}
              </strong>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
              v2.5
            </span>
          </div>
        </div>

        {/* Scrollable Navigation Menu */}
        <div className="sidebar-menu-scroll">
          {/* Primary Navigation Section */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">
              {t('mainNavigation') || 'MAIN MENU'}
            </div>
            <div className="sidebar-nav-list">
              {primaryNavItems.map(item => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleNavClick(item.id)}
                    id={`sidebar-link-${item.id}`}
                    style={isActive ? {
                      background: 'var(--primary)',
                      color: '#ffffff',
                      borderRadius: '12px',
                      fontWeight: 700,
                      boxShadow: '0 4px 12px rgba(21, 151, 165, 0.3)'
                    } : {}}
                  >
                    <Icon size={18} className="sidebar-item-icon" color={isActive ? '#ffffff' : 'var(--primary)'} />
                    <span className="sidebar-item-label">{item.label}</span>
                    {item.badge && (
                      <span className={`sidebar-item-badge ${
                        isActive ? 'badge-verified' : 'badge-verified'
                      }`} style={isActive ? { background: 'rgba(255,255,255,0.25)', color: '#fff' } : {}}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Secondary Clinical & Wellness Sections */}
          {secondaryNavSections.map((sec, idx) => (
            <div key={idx} className="sidebar-section">
              <div className="sidebar-section-title">
                {sec.title}
              </div>
              <div className="sidebar-nav-list">
                {sec.items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                      onClick={() => handleNavClick(item.id)}
                      id={`sidebar-link-${item.id}`}
                      style={isActive ? {
                        background: 'var(--primary)',
                        color: '#ffffff',
                        borderRadius: '12px',
                        fontWeight: 700,
                        boxShadow: '0 4px 12px rgba(21, 151, 165, 0.3)'
                      } : {}}
                    >
                      <Icon size={17} className="sidebar-item-icon" color={isActive ? '#ffffff' : 'var(--text-secondary)'} />
                      <span className="sidebar-item-label">{item.label}</span>
                      {item.badge && (
                        <span className={`sidebar-item-badge ${
                          item.badge === 'Live' ? 'badge-live' : 'badge-verified'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Quick Accessibility Button */}
          <div className="sidebar-section" style={{ marginTop: '6px', paddingTop: '8px', borderTop: '1px solid var(--border-light)' }}>
            <button
              className="sidebar-nav-item"
              onClick={() => {
                if (onOpenAccessibility) onOpenAccessibility();
                if (onClose) onClose();
              }}
              style={{
                background: 'var(--primary-subtle)',
                color: 'var(--primary)',
                border: '1px solid var(--secondary-accent)',
                fontWeight: 700
              }}
              id="sidebar-accessibility-btn"
            >
              <Sliders size={17} color="var(--primary)" />
              <span className="sidebar-item-label">{t('accessibilityAndDisplay') || 'Accessibility & Comfort'}</span>
            </button>
          </div>

          {/* Admin Switch Link (if authorized admin) */}
          {isAdmin && (
            <div className="sidebar-section" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-light)' }}>
              <button
                className="sidebar-nav-item admin-switch-btn"
                onClick={() => {
                  if (onSwitchPortal) onSwitchPortal('admin');
                  if (onClose) onClose();
                }}
                style={{
                  background: 'rgba(239, 68, 68, 0.06)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.2)'
                }}
              >
                <ShieldCheck size={17} color="#ef4444" />
                <span className="sidebar-item-label">{t('adminPortal') || 'Administrator CMS'}</span>
                <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
              </button>
            </div>
          )}
        </div>

        {/* Small Illustrated AI Companion Card (Prompt Requirement 2.A) */}
        <div style={{ padding: '0 12px 10px 12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #F0FBFB 0%, #E6F7F9 100%)',
            border: '1px solid var(--secondary-accent)',
            borderRadius: '14px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 2px 8px rgba(21, 151, 165, 0.08)'
          }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: 'var(--primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Sparkles size={18} />
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--navy)', lineHeight: 1.35, fontWeight: 600 }}>
              {t('aiCompanionCardMsg') || 'Your health matters! Stay informed, stay healthy.'}
            </div>
          </div>
        </div>

        {/* Sidebar Footer: User Card & Logout */}
        <div className="sidebar-footer">
          <div className="sidebar-user-card" style={{
            background: 'var(--bg-alt)',
            border: '1px solid var(--border-light)',
            borderRadius: '12px',
            padding: '8px 12px'
          }}>
            <div className="sidebar-avatar" style={{
              background: 'linear-gradient(135deg, #173B56 0%, #1597A5 100%)',
              color: '#ffffff',
              fontWeight: 700
            }}>
              {user ? user.name.charAt(0).toUpperCase() : 'P'}
            </div>
            <div className="sidebar-user-meta">
              <div className="sidebar-user-name" style={{ color: 'var(--navy)', fontWeight: 700, fontSize: '0.86rem' }}>
                {user ? user.name : 'Patient User'}
              </div>
              <div className="sidebar-user-role" style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                {user?.role === 'admin' ? '🛡️ Administrator' : `Blood: ${user?.bloodGroup || 'O+'}`}
              </div>
            </div>
            <button
              className="sidebar-logout-btn"
              onClick={logout}
              title={t('logout') || 'Log out'}
              id="sidebar-btn-logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
