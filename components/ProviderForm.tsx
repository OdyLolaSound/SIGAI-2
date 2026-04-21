import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Camera, Loader2, Check, AlertTriangle, 
  Save, Phone, Mail, MapPin, Globe, Tag, 
  Star, ShieldCheck, Info, RefreshCw,
  FileText, Upload, Trash2, Download, Plus
} from 'lucide-react';
import { Provider, MaterialCategory, ProviderDocument } from '../types';
import { storageService } from '../services/storageService';
import { compressImage } from '../lib/imageUtils';
import { extractProviderInfo } from '../services/geminiService';

interface ProviderFormProps {
  onClose: () => void;
  onSave: (provider: Provider) => void;
  initialData?: Partial<Provider>;
}

const ProviderForm: React.FC<ProviderFormProps> = ({ onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState<Partial<Provider>>({
    name: '',
    cif: '',
    phone: '',
    email: '',
    categories: [],
    address: '',
    web: '',
    isPreferred: false,
    rating: 4.0,
    status: 'activo',
    ...initialData
  });

  const [scanning, setScanning] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [duplicate, setDuplicate] = useState<Provider | null>(null);
  const [categorias, setCategorias] = useState<MaterialCategory[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCategorias(storageService.getCategories());
  }, []);

  const checkDuplicate = (name: string, email?: string, phone?: string, cif?: string) => {
    const existing = storageService.findProvider({ name, email, phone, cif });
    setDuplicate(existing);
  };

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        // Compress for OCR processing
        const compressed = await compressImage(base64, 1600, 1600, 0.8);
        const info = await extractProviderInfo(compressed);
        if (info) {
          setFormData(prev => ({
            ...prev,
            name: info.name || prev.name,
            cif: info.cif || prev.cif,
            phone: info.phone || prev.phone,
            email: info.email || prev.email,
            categories: info.categories.length > 0 ? info.categories : prev.categories,
            address: info.address || prev.address,
            web: info.website || prev.web
          }));
          checkDuplicate(info.name, info.email, info.phone, info.cif);
        }
      } catch (err) {
        console.error("Scan error:", err);
      } finally {
        setScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleCategory = (cat: string) => {
    const current = formData.categories || [];
    if (current.includes(cat)) {
      setFormData({ ...formData, categories: current.filter(c => c !== cat) });
    } else {
      setFormData({ ...formData, categories: [...current, cat] });
    }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      let content = event.target?.result as string;
      
      // If it's an image, compress it to stay under 1MB limit
      if (file.type.startsWith('image/')) {
        try {
          content = await compressImage(content, 1200, 1200, 0.7);
        } catch (err) {
          console.error("Doc compression error:", err);
        }
      }

      const newDoc: ProviderDocument = {
        id: crypto.randomUUID(),
        name: file.name,
        type: 'Presupuesto',
        date: new Date().toISOString(),
        content: content,
        fileType: file.type
      };
      setFormData(prev => ({
        ...prev,
        documents: [...(prev.documents || []), newDoc]
      }));
      setUploadingDoc(false);
    };
    reader.readAsDataURL(file);
  };

  const removeDoc = (id: string) => {
    setFormData(prev => ({
      ...prev,
      documents: (prev.documents || []).filter(d => d.id !== id)
    }));
  };

  const updateDocType = (id: string, type: ProviderDocument['type']) => {
    setFormData(prev => ({
      ...prev,
      documents: (prev.documents || []).map(d => d.id === id ? { ...d, type } : d)
    }));
  };

  const downloadDoc = (doc: ProviderDocument) => {
    const link = document.createElement('a');
    link.href = doc.content;
    link.download = doc.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    const provider: Provider = {
      id: duplicate?.id || crypto.randomUUID(),
      name: formData.name,
      cif: formData.cif || '',
      phone: formData.phone || '',
      email: formData.email || '',
      categories: formData.categories || [],
      address: formData.address || '',
      web: formData.web || '',
      isPreferred: formData.isPreferred || false,
      rating: formData.rating || 4.0,
      totalOrders: duplicate?.totalOrders || 0,
      hasCustomerAccount: duplicate?.hasCustomerAccount || false,
      generalDiscount: duplicate?.generalDiscount || 0,
      deliveryTimeDays: duplicate?.deliveryTimeDays || 2,
      doesShipping: duplicate?.doesShipping || true,
      status: 'activo',
      createdAt: duplicate?.createdAt || new Date().toISOString(),
      documents: formData.documents || []
    };

    if (duplicate) {
      storageService.updateProvider(provider);
    } else {
      storageService.saveProvider(provider);
    }
    
    onSave(provider);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-8 bg-white border-b border-gray-100 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
              <TruckIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter leading-none">
                {duplicate ? 'Actualizar Proveedor' : 'Nuevo Proveedor'}
              </h3>
              <p className="text-blue-600 text-[9px] font-black uppercase tracking-widest mt-1">Gestión de Suministros</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {/* Scan Button */}
          <div className="bg-amber-50 border-2 border-dashed border-amber-200 rounded-[2rem] p-6 text-center space-y-4">
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mb-2">
                {scanning ? <Loader2 className="w-8 h-8 animate-spin" /> : <Camera className="w-8 h-8" />}
              </div>
              <h4 className="text-xs font-black uppercase tracking-widest text-amber-900">Escanear Tarjeta / Albarán</h4>
              <p className="text-[10px] font-bold text-amber-700/60 uppercase">La IA extraerá los datos automáticamente</p>
            </div>
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleScan}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={scanning}
              className="px-6 py-3 bg-amber-500 text-black rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              {scanning ? 'Procesando...' : 'Abrir Cámara'}
            </button>
          </div>

          {/* Duplicate Alert */}
          {duplicate && (
            <div className="bg-blue-50 border-2 border-blue-100 rounded-3xl p-6 flex gap-4 animate-in slide-in-from-top-2">
              <ShieldCheck className="w-8 h-8 text-blue-500 shrink-0" />
              <div className="flex-1">
                <h5 className="text-[10px] font-black text-blue-900 uppercase tracking-widest mb-1">Proveedor Existente Detectado</h5>
                <p className="text-[10px] font-bold text-blue-700/70 leading-relaxed uppercase">
                  Hemos encontrado a "{duplicate.name}" en la base de datos.
                </p>
                <div className="flex gap-3 mt-3">
                  <button 
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        ...duplicate,
                        id: duplicate.id // ensure we keep the duplicate ID for updating
                      });
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[8px] font-black uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all"
                  >
                    Cargar datos existentes
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setDuplicate(null);
                      setFormData(prev => ({ ...prev, id: undefined }));
                    }}
                    className="px-4 py-2 bg-white text-blue-500 border border-blue-200 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-blue-50 transition-all"
                  >
                    Nuevo (Ignorar)
                  </button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Nombre de la Empresa *</label>
                <input 
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({...formData, name: e.target.value});
                    checkDuplicate(e.target.value, formData.email, formData.phone, formData.cif);
                  }}
                  placeholder="Ej: Ferretería García..."
                  className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-amber-500 outline-none font-bold transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">CIF / NIF *</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-4 w-5 h-5 text-gray-300" />
                  <input 
                    type="text"
                    required
                    value={formData.cif}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setFormData({...formData, cif: val});
                      checkDuplicate(formData.name || '', formData.email, formData.phone, val);
                    }}
                    placeholder="B12345678"
                    className="w-full p-4 pl-12 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-amber-500 outline-none font-bold transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Teléfono</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-4 w-5 h-5 text-gray-300" />
                  <input 
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="965..."
                    className="w-full p-4 pl-12 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-amber-500 outline-none font-bold transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-4 w-5 h-5 text-gray-300" />
                  <input 
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="pedidos@..."
                    className="w-full p-4 pl-12 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-amber-500 outline-none font-bold transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Categorías de Suministro</label>
              <div className="flex flex-wrap gap-2">
                {categorias.map(cat => (
                  <button 
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.name)}
                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${formData.categories?.includes(cat.name) ? 'bg-blue-600 text-white shadow-lg scale-105' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Dirección Física</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-4 w-5 h-5 text-gray-300" />
                <input 
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="Calle, Ciudad..."
                  className="w-full p-4 pl-12 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-amber-500 outline-none font-bold transition-all"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Sitio Web</label>
                <div className="relative">
                  <Globe className="absolute left-4 top-4 w-5 h-5 text-gray-300" />
                  <input 
                    type="text"
                    value={formData.web}
                    onChange={(e) => setFormData({...formData, web: e.target.value})}
                    placeholder="www.empresa.com"
                    className="w-full p-4 pl-12 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-amber-500 outline-none font-bold transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Valoración</label>
                <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button 
                        key={star}
                        type="button"
                        onClick={() => setFormData({...formData, rating: star})}
                        className={`transition-all ${star <= (formData.rating || 0) ? 'text-amber-500' : 'text-gray-200'}`}
                      >
                        <Star className={`w-5 h-5 ${star <= (formData.rating || 0) ? 'fill-amber-500' : ''}`} />
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-black text-gray-900">{formData.rating?.toFixed(1)}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-[2rem] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                  <Star className="w-5 h-5 fill-amber-500" />
                </div>
                <div>
                  <h6 className="font-black text-gray-900 uppercase text-[10px]">Proveedor Preferido</h6>
                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Aparecerá primero en las búsquedas</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setFormData({...formData, isPreferred: !formData.isPreferred})}
                className={`w-12 h-6 rounded-full transition-all relative ${formData.isPreferred ? 'bg-amber-500' : 'bg-gray-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.isPreferred ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            {/* Documents Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <h6 className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Documentos y Presupuestos</h6>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  ref={docInputRef}
                  onChange={handleDocUpload}
                />
                <button 
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  disabled={uploadingDoc}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all"
                >
                  {uploadingDoc ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Añadir Archivo
                </button>
              </div>

              <div className="space-y-2">
                {(!formData.documents || formData.documents.length === 0) ? (
                  <div className="p-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100 text-center">
                    <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">No hay documentos guardados</p>
                  </div>
                ) : (
                  formData.documents.map(doc => (
                    <div key={doc.id} className="bg-white border border-gray-100 p-4 rounded-2xl flex items-center justify-between group hover:border-blue-200 transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-gray-900 uppercase truncate" title={doc.name}>{doc.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <select 
                              value={doc.type}
                              onChange={(e) => updateDocType(doc.id, e.target.value as any)}
                              className="text-[8px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase outline-none"
                            >
                              <option value="Presupuesto">Presupuesto</option>
                              <option value="Factura">Factura</option>
                              <option value="Albarán">Albarán</option>
                              <option value="Contrato">Contrato</option>
                              <option value="Otro">Otro</option>
                            </select>
                            <span className="text-[8px] font-bold text-gray-300 uppercase">{new Date(doc.date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          type="button"
                          onClick={() => downloadDoc(doc)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Descargar"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => removeDoc(doc.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button 
              type="submit"
              className="w-full p-6 bg-blue-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
            >
              {duplicate ? <RefreshCw className="w-5 h-5" /> : <Save className="w-5 h-5" />}
              {duplicate ? 'Actualizar Ficha Proveedor' : 'Guardar Nuevo Proveedor'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const TruckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 17h4V5H2v12h3" />
    <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5" />
    <circle cx="7.5" cy="17.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </svg>
);

export default ProviderForm;
