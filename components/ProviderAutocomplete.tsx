
import React, { useState, useEffect, useRef } from 'react';
import { Truck, Check, Search, Plus } from 'lucide-react';
import { Provider } from '../types';
import { storageService } from '../services/storageService';

interface ProviderAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectProvider?: (provider: Provider) => void;
  placeholder?: string;
  className?: string;
}

const ProviderAutocomplete: React.FC<ProviderAutocompleteProps> = ({ 
  value, 
  onChange, 
  onSelectProvider,
  placeholder = "Nombre de la empresa...",
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Provider[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const providers = storageService.getProviders();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (value && isOpen) {
      const filtered = providers.filter(p => 
        p.name.toLowerCase().includes(value.toLowerCase()) ||
        p.commercialName?.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [value, isOpen, providers]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-blue-500/20 transition-all"
        autoComplete="off"
      />
      
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-[120] left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="p-2 border-b border-gray-50 bg-gray-50">
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest px-2">Empresas sugeridas</p>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {suggestions.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.name);
                  onSelectProvider?.(p);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between group transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-900 uppercase">{p.name}</p>
                    <p className="text-[8px] font-bold text-gray-400 uppercase">{p.email || p.contactEmail || 'Sin email'}</p>
                  </div>
                </div>
                <Check className="w-4 h-4 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderAutocomplete;
