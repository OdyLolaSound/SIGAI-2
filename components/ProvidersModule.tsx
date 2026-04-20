
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Truck, Search, Plus, Star, Phone, Mail, 
  MapPin, Globe, ChevronRight, Edit2, Trash2,
  Filter, ArrowLeft, ExternalLink, ShieldCheck,
  CheckCircle2, XCircle, MoreVertical, FileText
} from 'lucide-react';
import { Provider, MaterialCategory } from '../types';
import { storageService } from '../services/storageService';
import ProviderForm from './ProviderForm';

interface ProvidersModuleProps {
  onBack?: () => void;
}

const ProvidersModule: React.FC<ProvidersModuleProps> = ({ onBack }) => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    loadProviders();
    setCategories(storageService.getCategories());
  }, []);

  const loadProviders = () => {
    setProviders(storageService.getProviders());
  };

  const filteredProviders = useMemo(() => {
    return providers.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           p.cif.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           p.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || p.categories.includes(selectedCategory);
      return matchesSearch && matchesCategory;
    }).sort((a, b) => {
      // Preferred first, then by rating
      if (a.isPreferred && !b.isPreferred) return -1;
      if (!a.isPreferred && b.isPreferred) return 1;
      return b.rating - a.rating;
    });
  }, [providers, searchQuery, selectedCategory]);

  const handleDelete = (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este proveedor?')) {
      storageService.deleteProvider(id);
      loadProviders();
    }
  };

  const handleEdit = (provider: Provider) => {
    setEditingProvider(provider);
    setShowForm(true);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-gray-900 transition-all active:scale-90">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tighter text-gray-900 leading-none">Proveedores</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Gestión de Suministros y Logística</p>
          </div>
        </div>
        <button 
          onClick={() => { setEditingProvider(null); setShowForm(true); }}
          className="p-4 bg-gray-900 text-yellow-400 rounded-2xl flex items-center justify-center shadow-xl hover:scale-105 transition-all active:scale-95 gap-2"
        >
          <Plus className="w-5 h-5" />
          <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Nuevo Proveedor</span>
        </button>
      </div>

      {/* search & Filters */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
        <div className="relative">
          <Search className="absolute left-4 top-4 w-5 h-5 text-gray-300" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, CIF, email..."
            className="w-full p-4 pl-12 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-gray-900 outline-none font-bold transition-all text-sm"
          />
        </div>

        <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide">
          <button 
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shrink-0 ${selectedCategory === 'all' ? 'bg-gray-900 text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shrink-0 ${selectedCategory === cat.name ? 'bg-gray-900 text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Providers List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-2">
        {filteredProviders.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-100">
            <Truck className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">No se han encontrado proveedores</p>
          </div>
        ) : (
          filteredProviders.map(prov => (
            <div 
              key={prov.id}
              className={`bg-white rounded-[2.5rem] p-8 border transition-all relative overflow-hidden group hover:shadow-xl ${prov.isPreferred ? 'border-amber-200 ring-1 ring-amber-100' : 'border-gray-100'}`}
            >
              {prov.isPreferred && (
                <div className="absolute top-0 right-0 bg-amber-500 text-black px-4 py-1.5 rounded-bl-2xl text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                  <Star className="w-3 h-3 fill-black" /> Preferido
                </div>
              )}

              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${prov.isPreferred ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-400'}`}>
                    <Truck className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 uppercase text-lg leading-none mb-1">{prov.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{prov.cif}</span>
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-2.5 h-2.5 ${i < Math.round(prov.rating) ? 'text-amber-500 fill-amber-500' : 'text-gray-200'}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleEdit(prov)}
                    className="p-2 bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(prov.id)}
                    className="p-2 bg-gray-50 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                {prov.categories.map(cat => (
                  <span key={cat} className="px-3 py-1 bg-gray-50 text-gray-500 text-[8px] font-black uppercase tracking-widest rounded-lg border border-gray-100">
                    {cat}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-50">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase">
                    <Phone className="w-3.5 h-3.5 text-gray-300" />
                    <span className="truncate">{prov.phone || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase">
                    <Mail className="w-3.5 h-3.5 text-gray-300" />
                    <span className="truncate">{prov.email || 'N/A'}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase">
                    <MapPin className="w-3.5 h-3.5 text-gray-300" />
                    <span className="truncate">{prov.address || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase">
                    <Globe className="w-3.5 h-3.5 text-gray-300" />
                    <span className="truncate">{prov.web || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Pedidos</p>
                    <p className="text-xs font-black text-gray-900">{prov.totalOrders || 0}</p>
                  </div>
                  <div className="w-px h-6 bg-gray-100"></div>
                  <div className="text-center">
                    <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Entrega</p>
                    <p className="text-xs font-black text-gray-900">{prov.deliveryTimeDays || 2}d</p>
                  </div>
                  <div className="w-px h-6 bg-gray-100"></div>
                  <div className="text-center">
                    <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Docs</p>
                    <p className="text-xs font-black text-gray-900">{prov.documents?.length || 0}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleEdit(prov)}
                  className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-900 hover:gap-3 transition-all"
                >
                  Ver Ficha <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showForm && (
        <ProviderForm 
          onClose={() => setShowForm(false)}
          initialData={editingProvider || undefined}
          onSave={() => {
            loadProviders();
            setShowForm(false);
            setEditingProvider(null);
          }}
        />
      )}
    </div>
  );
};

export default ProvidersModule;
