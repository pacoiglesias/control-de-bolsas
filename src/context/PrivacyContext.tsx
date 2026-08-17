import React, { createContext, useContext, useState, useEffect } from 'react';

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

  const togglePrivacy = () => setIsPrivate(prev => !prev);
  const setPrivate = (val: boolean) => setIsPrivate(val);

  return (
    <PrivacyContext.Provider value={{ isPrivate, togglePrivacy, setPrivate }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}
