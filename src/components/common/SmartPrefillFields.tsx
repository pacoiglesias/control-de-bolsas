import React, { useState } from 'react';
import { Autocomplete, TextField } from './Autocomplete';
import { useSuggestions } from '../../hooks/useSuggestions';
import { addHistory } from '../../services/historyService';
import { useAuth } from '../../context/AuthContext';

export interface SmartFieldProps {
  value?: any;
  onChange: (newValue: any) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export const ClienteField: React.FC<SmartFieldProps> = ({
  value,
  onChange,
  label = 'Cliente / Destino',
  placeholder = 'Ej. GRUPO TEXTIL PROVIDENCIA...',
  disabled = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { suggestions } = useSuggestions('cliente', searchTerm);
  const { user } = useAuth();

  return (
    <Autocomplete
      options={suggestions}
      getOptionLabel={(option) =>
        typeof option === 'string' ? option : option?.name || option?.label || ''
      }
      value={value}
      onChange={(_, newValue) => {
        onChange(newValue);
        if (newValue && user?.uid) {
          addHistory(user.uid, 'cliente', newValue);
        }
      }}
      onInputChange={(_, newInput) => setSearchTerm(newInput)}
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder={placeholder} disabled={disabled} />
      )}
    />
  );
};

export const ProveedorField: React.FC<SmartFieldProps> = ({
  value,
  onChange,
  label = 'Proveedor / Maquilador',
  placeholder = 'Ej. Andrés Gutiérrez...',
  disabled = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { suggestions } = useSuggestions('proveedor', searchTerm);
  const { user } = useAuth();

  return (
    <Autocomplete
      options={suggestions}
      getOptionLabel={(option) =>
        typeof option === 'string' ? option : option?.name || option?.label || ''
      }
      value={value}
      onChange={(_, newValue) => {
        onChange(newValue);
        if (newValue && user?.uid) {
          addHistory(user.uid, 'proveedor', newValue);
        }
      }}
      onInputChange={(_, newInput) => setSearchTerm(newInput)}
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder={placeholder} disabled={disabled} />
      )}
    />
  );
};

export const ProductoField: React.FC<SmartFieldProps> = ({
  value,
  onChange,
  label = 'Producto / SKU / Descripción',
  placeholder = 'Ej. Bolsa de Polietileno Transparente...',
  disabled = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { suggestions } = useSuggestions('producto', searchTerm);
  const { user } = useAuth();

  return (
    <Autocomplete
      options={suggestions}
      getOptionLabel={(option) =>
        typeof option === 'string' ? option : option?.name || option?.label || ''
      }
      value={value}
      onChange={(_, newValue) => {
        onChange(newValue);
        if (newValue && user?.uid) {
          addHistory(user.uid, 'producto', newValue);
        }
      }}
      onInputChange={(_, newInput) => setSearchTerm(newInput)}
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder={placeholder} disabled={disabled} />
      )}
    />
  );
};
