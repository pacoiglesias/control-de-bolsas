import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  loadPreferences,
  savePreferences,
  getLocalUserPreferences,
  type UserPreferences,
  type VisibleColumnsConfig,
  DEFAULT_USER_PREFERENCES,
} from '../services/userPreferencesService';

export interface ThemeContextValue {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  preferences: UserPreferences;
  updatePreferences: (newPrefs: Partial<UserPreferences>) => Promise<void>;
  toggleColumn: (colKey: keyof VisibleColumnsConfig) => Promise<void>;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(() => getLocalUserPreferences());
  const [loading, setLoading] = useState(true);

  // Sincronizar preferencias desde Firestore cuando hay sesión
  useEffect(() => {
    let mounted = true;
    const fetchPrefs = async () => {
      setLoading(true);
      const loaded = await loadPreferences(user?.uid || '');
      if (mounted) {
        setPreferences(loaded);
        setLoading(false);
      }
    };
    fetchPrefs();
    return () => {
      mounted = false;
    };
  }, [user?.uid]);

  // Aplicar tema en el DOM de forma inmediata
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    localStorage.setItem('cb-theme', preferences.theme);
  }, [preferences.theme]);

  const setTheme = useCallback(
    (newTheme: 'light' | 'dark') => {
      setPreferences((prev) => {
        const next = { ...prev, theme: newTheme };
        savePreferences(user?.uid || '', { theme: newTheme });
        return next;
      });
    },
    [user?.uid]
  );

  const toggleTheme = useCallback(() => {
    setTheme(preferences.theme === 'dark' ? 'light' : 'dark');
  }, [preferences.theme, setTheme]);

  const updatePreferences = useCallback(
    async (newPrefs: Partial<UserPreferences>) => {
      setPreferences((prev) => {
        const next: UserPreferences = {
          ...prev,
          ...newPrefs,
          visibleColumns: {
            ...prev.visibleColumns,
            ...(newPrefs.visibleColumns || {}),
          },
        };
        savePreferences(user?.uid || '', next);
        return next;
      });
    },
    [user?.uid]
  );

  const toggleColumn = useCallback(
    async (colKey: keyof VisibleColumnsConfig) => {
      setPreferences((prev) => {
        const next: UserPreferences = {
          ...prev,
          visibleColumns: {
            ...prev.visibleColumns,
            [colKey]: !prev.visibleColumns[colKey],
          },
        };
        savePreferences(user?.uid || '', { visibleColumns: next.visibleColumns });
        return next;
      });
    },
    [user?.uid]
  );

  return (
    <ThemeContext.Provider
      value={{
        theme: preferences.theme,
        setTheme,
        toggleTheme,
        preferences,
        updatePreferences,
        toggleColumn,
        loading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    // Retornar fallback seguro si no está dentro de ThemeProvider
    return {
      theme: 'light',
      setTheme: () => {},
      toggleTheme: () => {},
      preferences: DEFAULT_USER_PREFERENCES,
      updatePreferences: async () => {},
      toggleColumn: async () => {},
      loading: false,
    };
  }
  return context;
};
