import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface VisibleColumnsConfig {
  folio: boolean;
  client: boolean;
  kilos: boolean;
  total: boolean;
  status: boolean;
  dueDate: boolean;
  cr: boolean;
  actions: boolean;
  department: boolean;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  visibleColumns: VisibleColumnsConfig;
  taskPriorityOrder: string[];
  compactMode: boolean;
  updatedAt?: any;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'light',
  visibleColumns: {
    folio: true,
    client: true,
    kilos: true,
    total: true,
    status: true,
    dueDate: true,
    cr: true,
    actions: true,
    department: true,
  },
  taskPriorityOrder: ['overdue', 'in_review', 'pedido', 'collected'],
  compactMode: false,
};

const LOCAL_PREFERENCES_KEY = 'cb_user_preferences_cache';

export const savePreferences = async (
  userId: string,
  preferences: Partial<UserPreferences>
): Promise<void> => {
  const current = getLocalUserPreferences();
  const merged: UserPreferences = {
    ...current,
    ...preferences,
    visibleColumns: {
      ...current.visibleColumns,
      ...(preferences.visibleColumns || {}),
    },
  };

  saveLocalUserPreferences(merged);

  if (!userId) return;

  try {
    const userDoc = doc(db, 'userPreferences', userId);
    await setDoc(
      userDoc,
      {
        ...merged,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('[userPreferencesService] Error al guardar preferencias en Firestore:', error);
  }
};

export const loadPreferences = async (userId: string): Promise<UserPreferences> => {
  const local = getLocalUserPreferences();

  if (!userId) return local;

  try {
    const userDoc = doc(db, 'userPreferences', userId);
    const snap = await getDoc(userDoc);

    if (snap.exists()) {
      const data = snap.data() as Partial<UserPreferences>;
      const merged: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        ...data,
        visibleColumns: {
          ...DEFAULT_USER_PREFERENCES.visibleColumns,
          ...(data.visibleColumns || {}),
        },
      };
      saveLocalUserPreferences(merged);
      return merged;
    }
  } catch (error) {
    console.warn('[userPreferencesService] Error al cargar de Firestore, usando local:', error);
  }

  return local;
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers de Caché Local
// ────────────────────────────────────────────────────────────────────────────

export function getLocalUserPreferences(): UserPreferences {
  try {
    if (typeof localStorage !== 'undefined') {
      const savedTheme = localStorage.getItem('cb-theme');
      const saved = localStorage.getItem(LOCAL_PREFERENCES_KEY);

      let prefs = DEFAULT_USER_PREFERENCES;
      if (saved) {
        const parsed = JSON.parse(saved);
        prefs = {
          ...DEFAULT_USER_PREFERENCES,
          ...parsed,
          visibleColumns: {
            ...DEFAULT_USER_PREFERENCES.visibleColumns,
            ...(parsed.visibleColumns || {}),
          },
        };
      }

      if (savedTheme === 'dark' || savedTheme === 'light') {
        prefs.theme = savedTheme;
      }

      return prefs;
    }
  } catch {
    // Ignore storage parse issues
  }
  return DEFAULT_USER_PREFERENCES;
}

export function saveLocalUserPreferences(prefs: UserPreferences) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_PREFERENCES_KEY, JSON.stringify(prefs));
      localStorage.setItem('cb-theme', prefs.theme);
    }
  } catch {
    // Ignore quota issues
  }
}
