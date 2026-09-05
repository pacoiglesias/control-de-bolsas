import { useState, useEffect, useCallback } from 'react';
import { getLastUsed, addHistory } from '../services/historyService';
import { useAuth } from '../context/AuthContext';

export interface SuggestionItem {
  id?: string;
  name: string;
  [key: string]: any;
}

export const useSuggestions = (type: string, searchTerm: string = '') => {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { user } = useAuth();

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const history = await getLastUsed(user?.uid || 'default_user', type);
      
      const term = searchTerm.trim().toLowerCase();
      const filtered = term
        ? history.filter((item) => {
            if (typeof item === 'string') {
              return item.toLowerCase().includes(term);
            }
            const name = String(item?.name || item?.razonSocial || item?.label || item?.description || item?.folio || '');
            return name.toLowerCase().includes(term);
          })
        : history;

      setSuggestions(filtered);
    } catch (err) {
      console.warn(`[useSuggestions] Error al obtener sugerencias para ${type}:`, err);
    } finally {
      setLoading(false);
    }
  }, [type, searchTerm, user?.uid]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const recordUsage = useCallback(
    async (item: any) => {
      if (!item) return;
      const uid = user?.uid || 'default_user';
      await addHistory(uid, type, item);
      // Actualizar sugerencias inmediatamente
      fetchSuggestions();
    },
    [type, user?.uid, fetchSuggestions]
  );

  return { suggestions, loading, recordUsage, refresh: fetchSuggestions };
};
