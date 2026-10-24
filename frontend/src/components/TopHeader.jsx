import React, { useState, useRef, useEffect } from 'react';
import { 
  Menu, 
  Globe, 
  Bell, 
  AlertTriangle, 
  Sparkles, 
  ShieldCheck, 
  User, 
  ChevronRight, 
  ChevronDown,
  Sliders, 
  Sun, 
  Moon,
  Search,
  LogOut,
  Pill,
  FileText,
  Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n/LanguageContext';
import { useBranding } from '../context/BrandingContext';
import { useAccessibility, useTheme } from '../context/AccessibilityContext';

export const TopHeader = ({
  onToggleSidebar,
  activeViewTitle,
  unreadCount = 0,
  onOpenNotifications,
  onOpenSos,
  onLoadDemoData,
  demoLoading = false,
  portalMode = 'user',
  onSwitchPortal,
  onOpenAccessibility,
  setActiveView
}) => {
  const { user, logout, isAdmin } = useAuth();
  const { language, setLanguage, t, languages } = useTranslation();
  const { websiteName, logoUrl } = useBranding();
  const { increaseTextSize, decreaseTextSize } = useAccessibility();
  const { isDark, toggleTheme } = useTheme();
  const [imgError, setImgError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setImgError(false);
  }, [logoUrl]);

  // Click outside listener for profile dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const q = searchQuery.trim().toLowerCase();
    
    if (setActiveView) {
      if (q.includes('medicine') || q.includes('pill') || q.includes('dose') || q.includes('marundhu')) {
        setActiveView('medicines');
      } else if (q.includes('report') || q.includes('blood') || q.includes('lab') || q.includes('scan')) {
        setActiveView('reports');
      } else if (q.includes('track') || q.includes('vital') || q.includes('sugar') || q.includes('bp')) {
        setActiveView('tracker');
      } else {
        // Default to AI health assistant for general health questions
        setActiveView('copilot');
      }
    }
  };

  return (
    <header className="top-header" id="vitacare-top-header" style={{
      background: 'rgba(255, 255, 255, 0.94)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-light)',
      boxShadow: '0 1px 6px rgba(23, 59, 86, 0.04)',
      height: '72px',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px'
    }}>
      {/* Left: Mobile Menu Toggle & Title */}
      <div className="top-header-left" style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
        <button
          className="top-header-menu-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation sidebar"
          id="btn-sidebar-toggle"
        >
          <Menu size={22} />
        </button>

        <div className="top-header-title-wrapper">
          <div className="top-header-breadcrumb" style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {logoUrl && !imgError && (
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  onError={() => setImgError(true)}
                  style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'cover' }} 
                />
              )}
              {websiteName || t('appTitle') || 'VitaCare AI'}
            </span>
            <ChevronRight size={12} color="var(--text-secondary)" />
            <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
              {portalMode === 'admin' ? (t('adminPortal') || 'Admin CMS') : (t('patientPortal') || 'Patient Copilot')}
            </span>
          </div>
          <h1 className="top-header-title" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
            {activeViewTitle}
          </h1>
        </div>
      </div>

      {/* Middle: Global Search Field (Requirement 2.B) */}
      <form 
        onSubmit={handleSearchSubmit} 
        style={{ 
          flex: 1, 
          maxWidth: '440px', 
          margin: '0 12px',
          display: 'flex',
          alignItems: 'center',
          position: 'relative'
        }}
        className="top-header-search-form"
      >
        <Search 
          size={16} 
          color="var(--text-secondary)" 
          style={{ position: 'absolute', left: '14px', pointerEvents: 'none' }} 
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('globalSearchPlaceholder') || 'Search reports, medicines, lab tests, or health questions...'}
          className="input-field"
          style={{
            width: '100%',
            padding: '9px 14px 9px 38px',
            fontSize: '0.86rem',
            borderRadius: '999px',
            border: '1.5px solid var(--border-light)',
            background: 'var(--bg-page)',
            color: 'var(--navy)',
            transition: 'all 0.2s ease',
            outline: 'none'
          }}
          id="global-search-input"
        />
      </form>

      {/* Right: Actions & User Avatar */}
      <div className="top-header-right" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {/* Quick Text Zoom Shortcuts (A- / A+) for Accessible Comfort */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-alt)', borderRadius: 'var(--radius-md)', padding: '2px', border: '1px solid var(--border-light)' }}>
          <button
            onClick={decreaseTextSize}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '5px 8px',
              fontSize: '0.85rem',
              fontWeight: 800,
              color: 'var(--navy)',
              cursor: 'pointer',
              borderRadius: 'var(--radius-sm)'
            }}
            title="Make text smaller (A-)"
            aria-label="Decrease text size"
          >
            A-
          </button>
          <div style={{ width: '1px', height: '14px', background: 'var(--border-light)' }} />
          <button
            onClick={increaseTextSize}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '5px 8px',
              fontSize: '0.98rem',
              fontWeight: 800,
              color: 'var(--primary)',
              cursor: 'pointer',
              borderRadius: 'var(--radius-sm)'
            }}
            title="Make text larger (A+)"
            aria-label="Increase text size"
          >
            A+
          </button>
        </div>

        {/* Multi-Language Selector Dropdown (Prominent in main nav) */}
        <div className="header-lang-selector" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'var(--primary-subtle)',
          padding: '6px 12px',
          borderRadius: '999px',
          border: '1.5px solid var(--secondary-accent)'
        }}>
          <Globe size={16} color="var(--primary)" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            id="global-language-selector"
            className="lang-select"
            title={t('selectLanguagePrompt') || 'Select Language'}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '0.84rem',
              fontWeight: 700,
              color: 'var(--navy)',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {languages.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {lang.nativeName || lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* 1-Click Sample Records (Patient mode) */}
        {portalMode === 'user' && (
          <button
            className="btn btn-secondary btn-sm header-sample-btn"
            onClick={onLoadDemoData}
            disabled={demoLoading}
            title={t('populateSampleRecords') || 'Populate complete verified patient clinical records'}
            style={{ borderRadius: '999px', border: '1px solid var(--border-light)' }}
          >
            <Sparkles size={14} color="var(--primary)" />
            <span className="btn-label-desktop">{demoLoading ? (t('loading') || 'Loading...') : (t('sampleRecords') || 'Sample Data')}</span>
          </button>
        )}

        {/* Notification Bell with unread indicator */}
        <button
          className="header-icon-btn"
          onClick={onOpenNotifications}
          id="btn-notifications-trigger"
          title={t('notifications') || 'Notification Center'}
          style={{ width: '40px', height: '40px', borderRadius: '10px' }}
        >
          <Bell size={19} color="var(--navy)" />
          {unreadCount > 0 && (
            <span className="header-notification-badge" style={{ background: 'var(--status-red)' }}>
              {unreadCount}
            </span>
          )}
        </button>

        {/* Theme Mode Toggle Button */}
        <button
          className="header-icon-btn"
          onClick={toggleTheme}
          id="btn-theme-toggle"
          title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          style={{ width: '40px', height: '40px', borderRadius: '10px', color: isDark ? '#fbbf24' : 'var(--navy)' }}
        >
          {isDark ? <Sun size={19} /> : <Moon size={19} />}
        </button>

        {/* Emergency SOS Button */}
        {portalMode === 'user' && (
          <button
            className="btn btn-danger header-sos-btn"
            onClick={onOpenSos}
            id="btn-emergency-sos"
            title={t('triggerEmergencySos') || 'Trigger Emergency SOS'}
            style={{
              minHeight: '40px',
              fontWeight: 800,
              padding: '6px 14px',
              gap: '6px',
              borderRadius: '999px',
              fontSize: '0.82rem'
            }}
          >
            <AlertTriangle size={16} />
            <span>{t('sos') || 'SOS'}</span>
          </button>
        )}

        {/* User Avatar & Profile Dropdown (Requirement 2.B) */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
            id="btn-user-profile-menu"
            style={{
              background: 'transparent',
              border: '1px solid var(--border-light)',
              borderRadius: '999px',
              padding: '3px 8px 3px 3px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            title="Profile Menu"
          >
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #173B56 0%, #1597A5 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.85rem'
            }}>
              {user ? user.name.charAt(0).toUpperCase() : 'P'}
            </div>
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--navy)', maxWidth: '100px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name?.split(' ')[0] || 'User'}
            </span>
            <ChevronDown size={14} color="var(--text-secondary)" />
          </button>

          {/* Profile Dropdown Menu */}
          {isProfileDropdownOpen && (
            <div style={{
              position: 'absolute',
              top: '46px',
              right: 0,
              width: '230px',
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid var(--border-light)',
              boxShadow: '0 12px 30px rgba(23, 59, 86, 0.12)',
              padding: '8px',
              zIndex: 1000,
              animation: 'fadeIn 0.15s ease'
            }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light)' }}>
                <strong style={{ display: 'block', fontSize: '0.88rem', color: 'var(--navy)' }}>
                  {user?.name || 'Patient'}
                </strong>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  {user?.email || 'patient@vitacare.ai'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '6px 0' }}>
                <button
                  onClick={() => {
                    if (setActiveView) setActiveView('privacy');
                    setIsProfileDropdownOpen(false);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.84rem',
                    color: 'var(--navy)',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left'
                  }}
                >
                  <Lock size={15} color="var(--primary)" /> {t('navSettings') || 'Settings & Profile'}
                </button>

                <button
                  onClick={() => {
                    if (onOpenAccessibility) onOpenAccessibility();
                    setIsProfileDropdownOpen(false);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.84rem',
                    color: 'var(--navy)',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left'
                  }}
                >
                  <Sliders size={15} color="var(--primary)" /> {t('accessibilityAndDisplay') || 'Accessibility & Display'}
                </button>

                {isAdmin && (
                  <button
                    onClick={() => {
                      if (onSwitchPortal) onSwitchPortal(portalMode === 'admin' ? 'user' : 'admin');
                      setIsProfileDropdownOpen(false);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '0.84rem',
                      color: '#ef4444',
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'left'
                    }}
                  >
                    <ShieldCheck size={15} color="#ef4444" /> {portalMode === 'admin' ? 'Return to Patient Portal' : 'Administrator CMS'}
                  </button>
                )}

                <div style={{ height: '1px', background: 'var(--border-light)', margin: '4px 0' }} />

                <button
                  onClick={() => {
                    setIsProfileDropdownOpen(false);
                    logout();
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.84rem',
                    color: '#ef4444',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left'
                  }}
                >
                  <LogOut size={15} color="#ef4444" /> {t('logout') || 'Log out'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
