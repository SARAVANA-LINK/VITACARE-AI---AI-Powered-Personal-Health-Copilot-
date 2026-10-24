import React, { createContext, useContext, useState, useEffect } from 'react';

const AccessibilityContext = createContext();

export const AccessibilityProvider = ({ children }) => {
  const [textSize, setTextSize] = useState(() => {
    return localStorage.getItem('vitacare_text_size') || 'default';
  });

  const [highContrast, setHighContrast] = useState(() => {
    return localStorage.getItem('vitacare_high_contrast') === 'true';
  });

  const [reducedMotion, setReducedMotion] = useState(() => {
    return localStorage.getItem('vitacare_reduced_motion') === 'true';
  });

  const [voiceGuidance, setVoiceGuidance] = useState(() => {
    return localStorage.getItem('vitacare_voice_guidance') !== 'false'; // default enabled
  });

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('vitacare_theme') || 'light';
  });

  // Apply attributes to <html> element
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    localStorage.setItem('vitacare_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-text-size', textSize);
    localStorage.setItem('vitacare_text_size', textSize);
  }, [textSize]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-contrast', highContrast ? 'high' : 'normal');
    localStorage.setItem('vitacare_high_contrast', String(highContrast));
  }, [highContrast]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-reduced-motion', reducedMotion ? 'true' : 'false');
    localStorage.setItem('vitacare_reduced_motion', String(reducedMotion));
  }, [reducedMotion]);

  useEffect(() => {
    localStorage.setItem('vitacare_voice_guidance', String(voiceGuidance));
  }, [voiceGuidance]);

  // Text to Speech Functionality for Elder Guidance
  const speak = (text, lang = 'en') => {
    if (!voiceGuidance || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel(); // Stop any pending speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9; // Slightly slower, calm cadence for elderly clarity
      utterance.pitch = 1.0;
      
      const voices = window.speechSynthesis.getVoices();
      if (lang === 'ta') {
        utterance.lang = 'ta-IN';
        const taVoice = voices.find(v => v.lang.startsWith('ta'));
        if (taVoice) utterance.voice = taVoice;
      } else if (lang === 'tanglish') {
        utterance.lang = 'en-IN';
        const inVoice = voices.find(v => v.lang.startsWith('en-IN') || v.lang.startsWith('ta'));
        if (inVoice) utterance.voice = inVoice;
      } else if (lang === 'hi') {
        utterance.lang = 'hi-IN';
        const hiVoice = voices.find(v => v.lang.startsWith('hi'));
        if (hiVoice) utterance.voice = hiVoice;
      } else if (lang === 'te') {
        utterance.lang = 'te-IN';
        const teVoice = voices.find(v => v.lang.startsWith('te'));
        if (teVoice) utterance.voice = teVoice;
      } else {
        utterance.lang = 'en-US';
      }
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
    }
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const increaseTextSize = () => {
    if (textSize === 'default') setTextSize('large');
    else if (textSize === 'large') setTextSize('xlarge');
    else if (textSize === 'xlarge') setTextSize('huge');
  };

  const decreaseTextSize = () => {
    if (textSize === 'huge') setTextSize('xlarge');
    else if (textSize === 'xlarge') setTextSize('large');
    else if (textSize === 'large') setTextSize('default');
  };

  return (
    <AccessibilityContext.Provider
      value={{
        textSize,
        setTextSize,
        increaseTextSize,
        decreaseTextSize,
        highContrast,
        setHighContrast,
        reducedMotion,
        setReducedMotion,
        voiceGuidance,
        setVoiceGuidance,
        theme,
        setTheme,
        toggleTheme,
        speak,
        stopSpeaking
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

export const useTheme = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useTheme must be used within an AccessibilityProvider');
  }
  return {
    theme: context.theme,
    setTheme: context.setTheme,
    toggleTheme: context.toggleTheme,
    isDark: context.theme === 'dark'
  };
};
