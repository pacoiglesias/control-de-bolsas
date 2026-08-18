import React, { createContext, useContext, useState, useEffect } from 'react';
import { triggerHaptic, playSoftClick } from '../lib/hapticEngine';

interface PrivacyContextType {
  isPrivate: boolean;
  togglePrivacy: () => void;
  setPrivate: (val: boolean) => void;
}

const PrivacyContext = createContext<PrivacyContextType>({
  isPrivate: false,
  togglePrivacy: () => {},
  setPrivate: () => {},
});

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [isPrivate, setIsPrivate] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('cb-privacy-mode');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('cb-privacy-mode', JSON.stringify(isPrivate));
    } catch (e) {
      console.error(e);
    }
  }, [isPrivate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + H / Cmd + H para alternar Modo Privacidad en 1 toque
      if ((e.ctrlKey || e.metaKey) && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        togglePrivacy();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const togglePrivacy = () => {
    setIsPrivate(prev => {
      const next = !prev;
      triggerHaptic(next ? 'medium' : 'light');
      playSoftClick();
      return next;
    });
  };

  const setPrivate = (val: boolean) => {
    setIsPrivate(val);
    triggerHaptic('light');
  };

  return (
    <PrivacyContext.Provider value={{ isPrivate, togglePrivacy, setPrivate }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}
