import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { translations } from './translations';
import { api } from '../api/apiClient';

const LanguageContext = createContext(null);

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', bcp47: 'en-US' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳', bcp47: 'ta-IN' },
  { code: 'tanglish', name: 'Tanglish', nativeName: 'Tanglish (தமிழ்)', flag: '🇮🇳', bcp47: 'ta-IN' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', bcp47: 'hi-IN' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳', bcp47: 'te-IN' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳', bcp47: 'ml-IN' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳', bcp47: 'kn-IN' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇮🇳', bcp47: 'bn-IN' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳', bcp47: 'mr-IN' }
];

// Helper to convert technical snake_case or camelCase keys into clean words if fallback needed
function humanizeKey(key) {
  if (!key || typeof key !== 'string') return '';
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/^\w/, c => c.toUpperCase());
}

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    const saved = localStorage.getItem('vitacare_lang');
    if (saved && SUPPORTED_LANGUAGES.some(l => l.code === saved)) {
      return saved;
    }
    return 'en';
  });

  const [dynamicOverrides, setDynamicOverrides] = useState({});

  const loadCmsTranslations = useCallback(async () => {
    try {
      const res = await api.getCmsConfig();
      if (res && res.translations && Array.isArray(res.translations)) {
        const overrides = {};
        SUPPORTED_LANGUAGES.forEach(l => { overrides[l.code] = {}; });
        for (const item of res.translations) {
          SUPPORTED_LANGUAGES.forEach(l => {
            if (item[l.code]) overrides[l.code][item.key] = item[l.code];
          });
        }
        setDynamicOverrides(overrides);
      }
    } catch (err) {
      console.warn('CMS translations sync warning:', err.message);
    }
  }, []);

  useEffect(() => {
    loadCmsTranslations();

    const handleStorage = (e) => {
      if (e.key === 'vitacare_lang' && e.newValue) {
        if (SUPPORTED_LANGUAGES.some(l => l.code === e.newValue)) {
          setLanguageState(e.newValue);
        }
      }
    };

    const handleCustomChange = (e) => {
      if (e.detail && SUPPORTED_LANGUAGES.some(l => l.code === e.detail)) {
        setLanguageState(e.detail);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('vitacare_lang_changed', handleCustomChange);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('vitacare_lang_changed', handleCustomChange);
    };
  }, [loadCmsTranslations]);

  const setLanguage = useCallback(async (newLang) => {
    if (!SUPPORTED_LANGUAGES.some(l => l.code === newLang)) return;
    setLanguageState(newLang);
    localStorage.setItem('vitacare_lang', newLang);
    window.dispatchEvent(new CustomEvent('vitacare_lang_changed', { detail: newLang }));

    // Save to user account profile on backend
    try {
      const token = api.getToken();
      if (token) {
        await api.updateLanguage(newLang);
      }
    } catch (err) {
      console.warn('Could not persist language to user account:', err.message);
    }
  }, []);

  const t = useCallback((key, paramsOrFallback = '', fallback = '') => {
    if (!key) return '';

    let params = null;
    let customFallback = '';

    if (typeof paramsOrFallback === 'object' && paramsOrFallback !== null) {
      params = paramsOrFallback;
      customFallback = typeof fallback === 'string' ? fallback : '';
    } else if (typeof paramsOrFallback === 'string') {
      customFallback = paramsOrFallback;
    }

    let text = '';

    // 1. Dynamic CMS override for selected language
    if (dynamicOverrides[language] && dynamicOverrides[language][key]) {
      text = dynamicOverrides[language][key];
    }
    // 2. Static bundled translation for selected language
    else if (translations[language] && translations[language][key]) {
      text = translations[language][key];
    }
    // 3. Fallback to CMS English override
    else if (dynamicOverrides['en'] && dynamicOverrides['en'][key]) {
      text = dynamicOverrides['en'][key];
    }
    // 4. Fallback to bundled English
    else if (translations['en'] && translations['en'][key]) {
      text = translations['en'][key];
    }
    // 5. User custom fallback or humanized key (never undefined or raw key)
    else {
      text = customFallback || humanizeKey(key);
    }

    // Dynamic parameter interpolation: {name} or {{name}}
    if (params && typeof text === 'string') {
      Object.keys(params).forEach(p => {
        const val = params[p] !== undefined && params[p] !== null ? params[p] : '';
        text = text.replace(new RegExp(`\\{\\{?\\s*${p}\\s*\\}\\}?`, 'g'), val);
      });
    }

    return text;
  }, [language, dynamicOverrides]);

  const currentLanguageObj = useMemo(() => {
    return SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];
  }, [language]);

  const formatDate = useCallback((date, options = {}) => {
    if (!date) return '';
    try {
      const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
      if (isNaN(d.getTime())) return String(date);
      const locale = currentLanguageObj.bcp47 || 'en-US';
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...options
      }).format(d);
    } catch {
      return String(date);
    }
  }, [currentLanguageObj]);

  const formatTime = useCallback((time, options = {}) => {
    if (!time) return '';
    try {
      if (typeof time === 'string' && time.includes(':')) {
        return time;
      }
      const d = new Date(time);
      if (isNaN(d.getTime())) return String(time);
      const locale = currentLanguageObj.bcp47 || 'en-US';
      return new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        minute: 'numeric',
        ...options
      }).format(d);
    } catch {
      return String(time);
    }
  }, [currentLanguageObj]);

  const formatNumber = useCallback((num, options = {}) => {
    if (num === null || num === undefined || isNaN(Number(num))) return '';
    try {
      const locale = currentLanguageObj.bcp47 || 'en-US';
      return new Intl.NumberFormat(locale, options).format(Number(num));
    } catch {
      return String(num);
    }
  }, [currentLanguageObj]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
    formatDate,
    formatTime,
    formatNumber,
    languages: SUPPORTED_LANGUAGES,
    supportedLanguages: SUPPORTED_LANGUAGES,
    currentLanguageObj,
    bcp47: currentLanguageObj.bcp47,
    refreshTranslations: loadCmsTranslations
  }), [language, setLanguage, t, formatDate, formatTime, formatNumber, currentLanguageObj, loadCmsTranslations]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
