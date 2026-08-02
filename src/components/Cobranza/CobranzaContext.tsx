// @ts-nocheck
import { createContext, useContext } from 'react';

const CobranzaContext = createContext<any>(null);

export function useCobranza() {
  return useContext(CobranzaContext);
}

export default CobranzaContext;
