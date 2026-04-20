import React, { useState, useMemo, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Package, Send, Loader2, CheckCircle2, X, ChevronRight, 
  Wrench, Truck, AlertTriangle, ShieldAlert, 
  Lightbulb, Info, Plus, Trash2, ArrowRight, HardHat, ListChecks,
  Hammer, ShieldCheck, Euro, FileText, Check, ChevronLeft,
  Paintbrush, Droplets, Zap, Ruler, Thermometer, Construction, ShoppingCart,
  ArrowLeft, MessageSquare, Star, Phone, Mail, Save, Share2, Clock, MapPin,
  Minus, PlusCircle, History, LayoutGrid, FileStack
} from 'lucide-react';
import { User as UserType, RequestItem, Provider, MaterialCategory, MaterialItem } from '../types';
import { storageService, BUILDINGS } from '../services/storageService';
import { suggestMaterialsForTask } from '../services/geminiService';
import ProviderForm from './ProviderForm';

interface AIMaterialFlowProps {
  user: UserType;
  onClose: () => void;
  onComplete: () => void;
}

type FlowStep = 'INICIO' | 'DIRECTO' | 'ASISTIDO' | 'PROVEEDORES' | 'CONFIRMAR';

const AIMaterialFlow: React.FC<AIMaterialFlowProps> = ({ user, onClose, onComplete }) => {
  const [step, setStep] = useState<FlowStep>('INICIO');
  const [modoAnterior, setModoAnterior] = useState<FlowStep>('DIRECTO');
  
  // Items del pedido
  const [items, setItems] = useState<MaterialItem[]>([]);
  const [nuevoItem, setNuevoItem] = useState<Partial<MaterialItem>>({
    name: '',
    quantity: 1,
    unit: 'unidades',
    category: '',
    reference: '',
    notes: ''
  });

  // Modo asistido (IA)
  const [mensajesIA, setMensajesIA] = useState<{ role: 'usuario' | 'asistente', content: string, materiales?: any[] }[]>([]);
  const [inputIA, setInputIA] = useState('');
  const [iaEscribiendo, setIaEscribiendo] = useState(false);
  const [materialesSeleccionados, setMaterialesSeleccionados] = useState<any[]>([]);

  // Proveedores
  const [proveedores, setProveedores] = useState<Provider[]>([]);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<Provider | null>(null);
  const [dividirProveedores, setDividirProveedores] = useState(false);
  const [showProviderForm, setShowProviderForm] = useState(false);

  // Pedido final
  const [pedido, setPedido] = useState({
    prioridad: 'normal' as 'baja' | 'normal' | 'alta' | 'urgente',
    fechaNecesaria: '',
    edificioId: '',
    notes: ''
  });
  const [metodoEnvio, setMetodoEnvio] = useState<'email' | 'whatsapp' | 'save'>('email');
  const [showConfirmSave, setShowConfirmSave] = useState(false);

  // Datos auxiliares
  const [categorias, setCategorias] = useState<MaterialCategory[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputNombreRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCategorias(storageService.getCategories());
    setProveedores(storageService.getProviders());
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajesIA, iaEscribiendo]);

  const categoriasNecesarias = useMemo(() => {
    const cats = new Set<string>();
    items.forEach(item => {
      if (item.category) cats.add(item.category);
    });
    return Array.from(cats);
  }, [items]);

  const proveedoresPreferidos = useMemo(() => {
    return proveedores.filter(p => {
      if (!p.isPreferred) return false;
      return p.categories.some(cat => categoriasNecesarias.includes(cat));
    });
  }, [proveedores, categoriasNecesarias]);

  const proveedoresCompatibles = useMemo(() => {
    return proveedores.filter(p => {
      if (p.isPreferred) return false;
      return p.categories.some(cat => categoriasNecesarias.includes(cat));
    });
  }, [proveedores, categoriasNecesarias]);

  const handleBack = () => {
    if (step === 'INICIO') onClose();
    else if (step === 'DIRECTO') {
      setStep(modoAnterior === 'ASISTIDO' ? 'ASISTIDO' : 'INICIO');
    }
    else if (step === 'ASISTIDO') setStep('INICIO');
    else if (step === 'PROVEEDORES') setStep(modoAnterior);
    else if (step === 'CONFIRMAR') {
      const needsProv = items.filter(i => i.needsRequest).length > 0;
      setStep(needsProv ? 'PROVEEDORES' : 'DIRECTO');
    }
  };

  const getCategoriaIcono = (categoria: string) => {
    const cat = categorias.find(c => c.name === categoria);
    return cat?.icon || '📦';
  };

  const addItem = () => {
    if (!nuevoItem.name?.trim()) return;
    
    const item: MaterialItem = {
      id: crypto.randomUUID(),
      name: nuevoItem.name,
      quantity: nuevoItem.quantity || 1,
      unit: nuevoItem.unit || 'unidades',
      category: nuevoItem.category || 'otros',
      reference: nuevoItem.reference || '',
      notes: nuevoItem.notes || '',
      needsRequest: true
    };

    setItems([...items, item]);
    setNuevoItem({
      name: '',
      quantity: 1,
      unit: 'unidades',
      category: '',
      reference: '',
      notes: ''
    });
    inputNombreRef.current?.focus();
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const toggleItemRequest = (id: string) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, needsRequest: !item.needsRequest } : item
    ));
  };

  const handleEnviarMensajeIA = async () => {
    const texto = inputIA.trim();
    if (!texto) return;
    
    const nuevosMensajes = [...mensajesIA, { role: 'usuario' as const, content: texto }];
    setMensajesIA(nuevosMensajes);
    setInputIA('');
    setIaEscribiendo(true);
    
    try {
      const result = await suggestMaterialsForTask(texto, nuevosMensajes.map(m => ({ role: m.role, content: m.content })));
      setMensajesIA([...nuevosMensajes, { 
        role: 'asistente', 
        content: result.respuesta, 
        materiales: result.materiales 
      }]);
    } catch (error) {
      setMensajesIA([...nuevosMensajes, { 
        role: 'asistente', 
        content: 'Lo siento, ha ocurrido un error. ¿Puedes intentarlo de nuevo?' 
      }]);
    } finally {
      setIaEscribiendo(false);
    }
  };

  const toggleMaterialSeleccionado = (mat: any) => {
    const exists = materialesSeleccionados.find(m => m.nombre === mat.nombre);
    if (exists) {
      setMaterialesSeleccionados(materialesSeleccionados.filter(m => m.nombre !== mat.nombre));
    } else {
      setMaterialesSeleccionados([...materialesSeleccionados, mat]);
    }
  };

  const continuarConMaterialesIA = () => {
    const mappedItems: MaterialItem[] = materialesSeleccionados.map(m => ({
      id: crypto.randomUUID(),
      name: m.nombre,
      quantity: m.cantidad,
      unit: m.unidad || 'unidades',
      category: m.categoria || 'otros',
      description: m.descripcion,
      isAiSuggested: true,
      needsRequest: true
    }));
    setItems(mappedItems);
    setModoAnterior('ASISTIDO');
    setStep('DIRECTO');
  };

  const calcularMatch = (proveedor: Provider) => {
    if (categoriasNecesarias.length === 0) return 100;
    const coincidencias = proveedor.categories.filter(cat => categoriasNecesarias.includes(cat)).length;
    return Math.round((coincidencias / categoriasNecesarias.length) * 100);
  };

  const generatePDF = (request: RequestItem) => {
    const doc = new jsPDF();
    const itemsToRequest = request.items?.filter(i => i.needsRequest) || [];
    
    // Header
    doc.setFillColor(31, 41, 55); // gray-900
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('SIGAI - SOLICITUD DE MATERIAL', 105, 18, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`REGISTRO: ${request.registrationNumber}`, 105, 28, { align: 'center' });
    
    // Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL PEDIDO', 14, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date(request.date).toLocaleDateString()}`, 14, 58);
    doc.text(`Solicitante: ${user.name} (${user.role})`, 14, 64);
    doc.text(`Prioridad: ${request.priority?.toUpperCase()}`, 14, 70);
    doc.text(`Edificio: ${BUILDINGS.find(b => b.id === request.buildingId)?.name || 'No especificado'}`, 14, 76);
    
    doc.setFont('helvetica', 'bold');
    doc.text('PROVEEDOR', 120, 50);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nombre: ${request.providerName || 'Varios / Dividido'}`, 120, 58);
    if (request.providerId) {
      const prov = proveedores.find(p => p.id === request.providerId);
      if (prov) {
        doc.text(`Tel: ${prov.phone || '-'}`, 120, 64);
        doc.text(`Email: ${prov.email || '-'}`, 120, 70);
      }
    }

    // Items Table
    autoTable(doc, {
      startY: 85,
      head: [['Categoría', 'Material', 'Cantidad', 'Unidad', 'Referencia']],
      body: itemsToRequest.map(i => [
        i.category.toUpperCase(),
        i.name,
        i.quantity,
        i.unit,
        i.reference || '-'
      ]),
      headStyles: { fillColor: [31, 41, 55] },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 150;

    if (request.notes) {
      doc.setFont('helvetica', 'bold');
      doc.text('NOTAS / INSTRUCCIONES:', 14, finalY + 15);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const splitNotes = doc.splitTextToSize(request.notes, 180);
      doc.text(splitNotes, 14, finalY + 22);
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Este documento es un justificante oficial de solicitud generado por SIGAI-USAC.', 105, 285, { align: 'center' });

    return doc;
  };

  const handleFinalizar = (skipConfirm = false, downloadPDF = true) => {
    if (metodoEnvio === 'save' && !skipConfirm) {
      setShowConfirmSave(true);
      return;
    }

    const itemsToRequest = items.filter(i => i.needsRequest);
    const itemsInStock = items.filter(i => !i.needsRequest);
    const totalCost = itemsToRequest.reduce((acc, curr) => acc + (curr.estimatedTotalPrice || 0), 0);
    const regNum = storageService.getNextRegistrationNumber();
    
    const newItem: RequestItem = {
      id: crypto.randomUUID(),
      registrationNumber: regNum,
      userId: user.id,
      unit: user.role,
      type: 'material',
      title: items.length === 1 ? `Pedido: ${items[0].name}` : `Pedido Material (${items.length} items)`,
      description: `Pedido para ${proveedorSeleccionado?.name || 'Varios proveedores'}\nPrioridad: ${pedido.prioridad}\nNotas: ${pedido.notes}${itemsInStock.length > 0 ? `\n\nMaterial en Almacén: ${itemsInStock.map(i => i.name).join(', ')}` : ''}`,
      status: 'pendiente',
      date: new Date().toISOString(),
      items: items,
      providerId: proveedorSeleccionado?.id,
      providerName: proveedorSeleccionado?.name,
      priority: pedido.prioridad,
      buildingId: pedido.edificioId,
      notes: pedido.notes,
      totalEstimatedCost: totalCost,
      neededDate: pedido.fechaNecesaria,
      methodSent: metodoEnvio
    };

    storageService.saveRequest(newItem);

    if (metodoEnvio === 'whatsapp') {
      const msg = `📦 *NUEVO PEDIDO SIGAI [${regNum}]*\n\nHola ${proveedorSeleccionado?.name || 'Proveedor'}, adjunto pedido de material:\n\n${itemsToRequest.map(i => `- ${i.name} (x${i.quantity} ${i.unit})`).join('\n')}\n\n*Prioridad:* ${pedido.prioridad.toUpperCase()}\n*Edificio:* ${BUILDINGS.find(b => b.id === pedido.edificioId)?.name || '-'}\n*Notas:* ${pedido.notes}\n\n_Enviado desde SIGAI-USAC_`;
      
      const doc = generatePDF(newItem);
      doc.save(`Pedido_${regNum}.pdf`);
      
      const phone = proveedorSeleccionado?.phone || '';
      window.open(`https://wa.me/${phone.replace(/\+/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
    } else if (metodoEnvio === 'email') {
      const subject = `SOLICITUD MATERIAL SIGAI - ${regNum} - ${user.role}`;
      const body = `Hola,\n\nSe adjunta solicitud de material con número de registro ${regNum}.\n\nDetalles:\n- Solicitante: ${user.name}\n- Prioridad: ${pedido.prioridad.toUpperCase()}\n- Edificio: ${BUILDINGS.find(b => b.id === pedido.edificioId)?.name || '-'}\n\nNotas: ${pedido.notes}\n\nSaludos,\nSIGAI-USAC`;
      
      const doc = generatePDF(newItem);
      doc.save(`Pedido_${regNum}.pdf`);
      
      const email = proveedorSeleccionado?.email || '';
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } else if (metodoEnvio === 'save' && skipConfirm && downloadPDF) {
      const doc = generatePDF(newItem);
      doc.save(`Pedido_${regNum}.pdf`);
    }

    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-gray-50 flex flex-col animate-in fade-in duration-300 overflow-hidden">
      {/* Header */}
      <header className="p-6 flex items-center justify-between bg-white shrink-0 shadow-sm border-b border-gray-100">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleBack}
            className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-900 hover:bg-gray-100 transition-all active:scale-90"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-gray-900 font-black uppercase tracking-tighter text-xl leading-none">Solicitud Material</h2>
            <p className="text-blue-600 text-[9px] font-black uppercase tracking-widest mt-1">Suministro v2.0</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-gray-500 hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 flex flex-col items-center">
        <div className="w-full max-w-2xl">
          
          {/* STEP 1: INICIO */}
          {step === 'INICIO' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-5">
              <div className="text-center py-6">
                <h3 className="text-3xl font-black text-gray-900 uppercase tracking-tighter mb-2">📦 ¿Qué necesitas pedir?</h3>
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em]">Selecciona el modo de solicitud</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <button 
                  onClick={() => { setStep('DIRECTO'); setModoAnterior('DIRECTO'); }}
                  className="flex flex-col items-start p-8 bg-white border-2 border-gray-100 rounded-[3rem] shadow-sm hover:border-amber-500 hover:scale-[1.02] transition-all group text-left"
                >
                  <div className="w-16 h-16 bg-green-50 rounded-3xl flex items-center justify-center mb-6 group-hover:bg-green-100 transition-colors">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h4 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-2">Ya sé qué pedir</h4>
                  <p className="text-gray-400 text-xs font-medium leading-relaxed mb-6">Tengo claro el material que necesito, con nombre, referencia o descripción.</p>
                  <div className="space-y-2 w-full">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-300 uppercase"><Hammer className="w-3 h-3" /> 10 tornillos 6x40</div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-300 uppercase"><Zap className="w-3 h-3" /> Fluorescente LED</div>
                  </div>
                  <div className="mt-8 self-end w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-amber-500">
                    <ChevronRight className="w-6 h-6" />
                  </div>
                </button>

                <button 
                  onClick={() => { setStep('ASISTIDO'); setModoAnterior('ASISTIDO'); }}
                  className="flex flex-col items-start p-8 bg-white border-2 border-gray-100 rounded-[3rem] shadow-sm hover:border-blue-500 hover:scale-[1.02] transition-all group text-left"
                >
                  <div className="w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center mb-6 group-hover:bg-blue-100 transition-colors">
                    <MessageSquare className="w-8 h-8 text-blue-600" />
                  </div>
                  <h4 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-2">Necesito ayuda</h4>
                  <p className="text-gray-400 text-xs font-medium leading-relaxed mb-6">Sé lo que quiero arreglar pero no sé exactamente qué material necesito.</p>
                  <div className="space-y-2 w-full">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-300 uppercase"><Info className="w-3 h-3" /> La puerta no cierra</div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-300 uppercase"><Droplets className="w-3 h-3" /> Fuga en el baño</div>
                  </div>
                  <div className="mt-8 self-end w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-amber-500">
                    <ChevronRight className="w-6 h-6" />
                  </div>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-8">
                <button className="flex flex-col items-center gap-2 p-4 bg-white rounded-3xl border border-gray-100 hover:bg-gray-50 transition-colors">
                  <History className="w-5 h-5 text-gray-400" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">Historial</span>
                </button>
                <button className="flex flex-col items-center gap-2 p-4 bg-white rounded-3xl border border-gray-100 hover:bg-gray-50 transition-colors">
                  <FileStack className="w-5 h-5 text-gray-400" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">Plantillas</span>
                </button>
                <button className="flex flex-col items-center gap-2 p-4 bg-white rounded-3xl border border-gray-100 hover:bg-gray-50 transition-colors">
                  <LayoutGrid className="w-5 h-5 text-gray-400" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">Catálogo</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2A: DIRECTO */}
          {step === 'DIRECTO' && (
            <div className="space-y-8 animate-in slide-in-from-right-10 pb-12">
              <div className="flex items-center justify-between pt-4">
                <button onClick={handleBack} className="p-3 bg-white border-2 border-gray-100 text-gray-400 rounded-2xl hover:text-gray-900 transition-all active:scale-90">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <h3 className="text-3xl font-black text-gray-900 uppercase tracking-tighter mb-1">📝 Lista</h3>
                  <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Paso 2: Materiales</p>
                </div>
                <div className="w-11" />
              </div>

              <div className="bg-white border-2 border-gray-100 p-8 rounded-[3rem] shadow-sm space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">¿Qué necesitas? *</label>
                    <input 
                      ref={inputNombreRef}
                      type="text"
                      value={nuevoItem.name}
                      onChange={(e) => setNuevoItem({...nuevoItem, name: e.target.value})}
                      placeholder="Ej: Tornillos 6x40..."
                      className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-amber-500 outline-none font-bold transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Cantidad *</label>
                      <div className="flex items-center bg-gray-50 rounded-2xl overflow-hidden border-2 border-transparent focus-within:border-amber-500 transition-all">
                        <button onClick={() => setNuevoItem({...nuevoItem, quantity: Math.max(1, (nuevoItem.quantity || 1) - 1)})} className="p-4 hover:bg-gray-100"><Minus className="w-4 h-4" /></button>
                        <input 
                          type="number"
                          value={nuevoItem.quantity}
                          onChange={(e) => setNuevoItem({...nuevoItem, quantity: parseInt(e.target.value) || 1})}
                          className="w-full bg-transparent text-center font-black outline-none"
                        />
                        <button onClick={() => setNuevoItem({...nuevoItem, quantity: (nuevoItem.quantity || 1) + 1})} className="p-4 hover:bg-gray-100"><Plus className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Unidad</label>
                      <select 
                        value={nuevoItem.unit}
                        onChange={(e) => setNuevoItem({...nuevoItem, unit: e.target.value})}
                        className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-amber-500 outline-none font-bold appearance-none"
                      >
                        <option value="unidades">Uds</option>
                        <option value="metros">Mts</option>
                        <option value="litros">Lts</option>
                        <option value="kg">Kg</option>
                        <option value="cajas">Cajas</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Categoría</label>
                  <div className="flex flex-wrap gap-2">
                    {categorias.map(cat => (
                      <button 
                        key={cat.id}
                        onClick={() => setNuevoItem({...nuevoItem, category: cat.name})}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${nuevoItem.category === cat.name ? 'bg-amber-500 text-black shadow-lg scale-105' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                      >
                        {cat.icon} {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Referencia (Opcional)</label>
                    <input 
                      type="text"
                      value={nuevoItem.reference}
                      onChange={(e) => setNuevoItem({...nuevoItem, reference: e.target.value})}
                      placeholder="REF-12345..."
                      className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-amber-500 outline-none font-bold transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Notas</label>
                    <input 
                      type="text"
                      value={nuevoItem.notes}
                      onChange={(e) => setNuevoItem({...nuevoItem, notes: e.target.value})}
                      placeholder="Color, marca..."
                      className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-amber-500 outline-none font-bold transition-all"
                    />
                  </div>
                </div>

                <button 
                  onClick={addItem}
                  disabled={!nuevoItem.name}
                  className="w-full p-6 bg-blue-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                >
                  <PlusCircle className="w-5 h-5" /> Añadir a la lista
                </button>
              </div>

              {items.length > 0 && (
                <div className="space-y-4 animate-in slide-in-from-bottom-5">
                  <div className="flex items-center justify-between px-4">
                    <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">🛒 Tu Lista ({items.length})</h5>
                    <button onClick={() => setItems([])} className="text-[8px] font-black text-red-500 uppercase tracking-widest">Limpiar todo</button>
                  </div>
                  <div className="bg-green-50 p-4 rounded-2xl border border-green-100 flex items-center gap-3">
                    <Info className="w-4 h-4 text-green-600" />
                    <p className="text-[9px] font-bold text-green-700 uppercase leading-tight">
                      Marca los materiales que ya tienes en almacén para no incluirlos en el pedido oficial.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {items.map(item => (
                      <div key={item.id} className={`bg-white p-6 rounded-[2rem] border transition-all flex items-center justify-between group ${item.needsRequest ? 'border-gray-100' : 'border-green-200 bg-green-50/30'}`}>
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => toggleItemRequest(item.id)}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${item.needsRequest ? 'bg-gray-50' : 'bg-green-500 text-white shadow-lg shadow-green-200'}`}
                          >
                            {item.needsRequest ? getCategoriaIcono(item.category) : <Check className="w-5 h-5" />}
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className={`font-black uppercase text-xs ${item.needsRequest ? 'text-gray-900' : 'text-green-700'}`}>{item.name}</p>
                              {!item.needsRequest && <span className="text-[7px] font-black bg-green-500 text-white px-1.5 py-0.5 rounded-md uppercase tracking-widest">En Almacén</span>}
                            </div>
                            <p className="text-[9px] font-bold text-gray-400 uppercase">{item.quantity} {item.unit} {item.reference && `• Ref: ${item.reference}`}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => toggleItemRequest(item.id)}
                            className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${item.needsRequest ? 'bg-gray-100 text-gray-400 hover:bg-amber-100 hover:text-amber-600' : 'bg-green-500 text-white'}`}
                          >
                            {item.needsRequest ? 'Pedir' : 'Tengo'}
                          </button>
                          <button onClick={() => removeItem(item.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={handleBack}
                      className="flex-1 p-8 bg-white border-2 border-gray-100 text-gray-400 rounded-[2.5rem] font-black uppercase tracking-widest text-sm active:scale-95 transition-all flex items-center justify-center gap-4"
                    >
                      <ArrowLeft className="w-6 h-6" /> Volver
                    </button>
                    <button 
                      onClick={() => {
                        const itemsToRequest = items.filter(i => i.needsRequest);
                        if (itemsToRequest.length > 0) {
                          setModoAnterior(step);
                          setStep('PROVEEDORES');
                        } else {
                          // Si no hay nada que pedir, preguntamos si quiere ir a proveedores de todas formas (por si quiere dividir o ver algo)
                          // o simplemente finalizamos el registro.
                          setStep('CONFIRMAR');
                          setMetodoEnvio('save');
                        }
                      }}
                      className="flex-[2] p-8 bg-blue-600 text-white rounded-[2.5rem] font-black uppercase tracking-widest text-sm shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4"
                    >
                      {items.filter(i => i.needsRequest).length > 0 ? (
                        <>Buscar Proveedores <ArrowRight className="w-6 h-6" /></>
                      ) : (
                        <>Finalizar Registro <CheckCircle2 className="w-6 h-6" /></>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2B: ASISTIDO */}
          {step === 'ASISTIDO' && (
            <div className="flex flex-col h-[70vh] bg-white border-2 border-gray-100 rounded-[3rem] shadow-sm overflow-hidden animate-in slide-in-from-right-10">
              <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <button onClick={handleBack} className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Asistente IA</span>
                <div className="w-9" />
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0">🤖</div>
                  <div className="bg-blue-50 p-6 rounded-[2rem] rounded-tl-none space-y-3 max-w-[85%]">
                    <p className="text-xs font-bold text-blue-900 leading-relaxed">¡Hola! Cuéntame qué necesitas arreglar o qué problema tienes, y te ayudaré a identificar los materiales necesarios.</p>
                    <div className="flex flex-wrap gap-2">
                      {['Fuga en baño', 'Puerta no cierra', 'Cambiar enchufe'].map(t => (
                        <button key={t} onClick={() => setInputIA(t)} className="px-3 py-1.5 bg-white/50 rounded-lg text-[9px] font-black text-blue-600 uppercase border border-blue-100 hover:bg-white transition-all">{t}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {mensajesIA.map((msg, idx) => (
                  <div key={idx} className={`flex gap-4 ${msg.role === 'usuario' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${msg.role === 'usuario' ? 'bg-gray-100' : 'bg-blue-100'}`}>
                      {msg.role === 'usuario' ? '👤' : '🤖'}
                    </div>
                    <div className={`p-6 rounded-[2rem] space-y-4 max-w-[85%] ${msg.role === 'usuario' ? 'bg-gray-100 text-gray-900 rounded-tr-none' : 'bg-blue-50 text-blue-900 rounded-tl-none'}`}>
                      <p className="text-xs font-bold leading-relaxed">{msg.content}</p>
                      
                      {msg.materiales && msg.materiales.length > 0 && (
                        <div className="space-y-3 pt-2">
                          <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Materiales Sugeridos:</p>
                          <div className="space-y-2">
                            {msg.materiales.map((mat, mIdx) => (
                              <div 
                                key={mIdx} 
                                onClick={() => toggleMaterialSeleccionado(mat)}
                                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-3 ${materialesSeleccionados.find(m => m.nombre === mat.nombre) ? 'bg-white border-blue-500 shadow-md' : 'bg-white/50 border-transparent hover:border-blue-200'}`}
                              >
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${materialesSeleccionados.find(m => m.nombre === mat.nombre) ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                  {materialesSeleccionados.find(m => m.nombre === mat.nombre) ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                </div>
                                <div className="flex-1">
                                  <p className="text-[10px] font-black uppercase text-gray-900">{mat.nombre}</p>
                                  <p className="text-[8px] font-bold text-gray-400 uppercase">{mat.cantidad} {mat.unidad} • {mat.categoria}</p>
                                </div>
                                <div className="text-lg">{getCategoriaIcono(mat.categoria)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {iaEscribiendo && (
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0">🤖</div>
                    <div className="bg-blue-50 p-6 rounded-[2rem] rounded-tl-none">
                      <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-100">
                {materialesSeleccionados.length > 0 && (
                  <button 
                    onClick={continuarConMaterialesIA}
                    className="w-full mb-4 p-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 animate-in slide-in-from-bottom-2"
                  >
                    Continuar con {materialesSeleccionados.length} materiales <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                <div className="flex gap-3">
                  <textarea 
                    value={inputIA}
                    onChange={(e) => setInputIA(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleEnviarMensajeIA())}
                    placeholder="Describe el problema..."
                    className="flex-1 p-4 bg-white rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none font-bold text-xs resize-none"
                    rows={1}
                  />
                  <button 
                    onClick={handleEnviarMensajeIA}
                    disabled={!inputIA.trim() || iaEscribiendo}
                    className="w-12 h-12 bg-gray-900 text-amber-500 rounded-2xl flex items-center justify-center shrink-0 disabled:opacity-50 transition-all active:scale-90"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PROVEEDORES */}
          {step === 'PROVEEDORES' && (
            <div className="space-y-8 animate-in slide-in-from-right-10 pb-12">
              <div className="flex items-center justify-between pt-4">
                <button onClick={handleBack} className="p-3 bg-white border-2 border-gray-100 text-gray-400 rounded-2xl hover:text-gray-900 transition-all active:scale-90">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <h3 className="text-3xl font-black text-gray-900 uppercase tracking-tighter mb-1">🏪 Proveedores</h3>
                  <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Paso 3: Suministro</p>
                </div>
                <div className="w-11" />
              </div>

              <div className="bg-gray-900 p-8 rounded-[3rem] text-white space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <Package className="w-5 h-5 text-amber-500" />
                  <h5 className="text-[10px] font-black uppercase tracking-widest">Resumen de Pedido</h5>
                </div>
                <div className="flex flex-wrap gap-2">
                  {items.map(i => (
                    <span key={i.id} className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest flex items-center gap-2 ${i.needsRequest ? 'bg-white/10 text-amber-500' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>
                      {i.needsRequest ? getCategoriaIcono(i.category) : <Check className="w-3 h-3" />} {i.name} (x{i.quantity})
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-8">
                {proveedoresPreferidos.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-4">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <h5 className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Proveedores Preferidos</h5>
                    </div>
                    <div className="grid gap-4">
                      {proveedoresPreferidos.map(prov => (
                        <button 
                          key={prov.id}
                          onClick={() => setProveedorSeleccionado(prev => prev?.id === prov.id ? null : prov)}
                          className={`p-6 bg-white border-2 rounded-[2.5rem] text-left transition-all relative overflow-hidden group ${proveedorSeleccionado?.id === prov.id ? 'border-amber-500 shadow-xl scale-[1.02]' : 'border-gray-100 hover:border-amber-200'}`}
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h6 className="font-black text-gray-900 uppercase text-sm">{prov.name}</h6>
                              <div className="flex items-center gap-1 mt-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star key={i} className={`w-2.5 h-2.5 ${i < Math.round(prov.rating) ? 'text-amber-500 fill-amber-500' : 'text-gray-200'}`} />
                                ))}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg uppercase tracking-widest">Match {calcularMatch(prov)}%</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {prov.categories.map(cat => (
                              <span key={cat} className={`text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${categoriasNecesarias.includes(cat) ? 'bg-gray-900 text-amber-500' : 'bg-gray-50 text-gray-300'}`}>
                                {cat}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-4 text-[9px] font-bold text-gray-400 uppercase">
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {prov.phone}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {prov.deliveryTimeDays}d</span>
                          </div>
                          {proveedorSeleccionado?.id === prov.id && (
                            <div className="absolute top-4 right-4 w-6 h-6 bg-amber-500 text-black rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {proveedoresCompatibles.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-4">
                      <ShoppingCart className="w-4 h-4 text-gray-400" />
                      <h5 className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Otros Proveedores</h5>
                    </div>
                    <div className="grid gap-4">
                      {proveedoresCompatibles.map(prov => (
                        <button 
                          key={prov.id}
                          onClick={() => setProveedorSeleccionado(prev => prev?.id === prov.id ? null : prov)}
                          className={`p-6 bg-white border-2 rounded-[2.5rem] text-left transition-all relative ${proveedorSeleccionado?.id === prov.id ? 'border-gray-900 shadow-xl scale-[1.02]' : 'border-gray-100 hover:border-gray-200'}`}
                        >
                          <div className="flex justify-between items-start mb-4">
                            <h6 className="font-black text-gray-900 uppercase text-sm">{prov.name}</h6>
                            <span className="text-[8px] font-black text-gray-400 bg-gray-50 px-2 py-1 rounded-lg uppercase tracking-widest">Match {calcularMatch(prov)}%</span>
                          </div>
                          <div className="flex items-center gap-4 text-[9px] font-bold text-gray-400 uppercase">
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {prov.phone}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {prov.deliveryTimeDays}d</span>
                          </div>
                          {proveedorSeleccionado?.id === prov.id && (
                            <div className="absolute top-4 right-4 w-6 h-6 bg-gray-900 text-amber-500 rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white p-8 rounded-[3rem] border-2 border-dashed border-gray-200 text-center space-y-4">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">¿No encuentras el proveedor?</p>
                  <button 
                    onClick={() => setShowProviderForm(true)}
                    className="px-6 py-3 bg-gray-50 text-gray-900 rounded-2xl font-black uppercase text-[9px] tracking-widest hover:bg-gray-100 transition-all"
                  >
                    Añadir Proveedor Nuevo
                  </button>
                </div>

                <div className={`p-8 rounded-[3rem] border-2 transition-all ${dividirProveedores ? 'bg-amber-50 border-amber-200 shadow-lg' : 'bg-white border-gray-100'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${dividirProveedores ? 'bg-amber-500 text-black' : 'bg-amber-50 text-amber-600'}`}>
                        <Share2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h6 className="font-black text-gray-900 uppercase text-xs">Dividir Pedido</h6>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">Asignar materiales a varios proveedores</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setDividirProveedores(!dividirProveedores);
                        if (!dividirProveedores) setProveedorSeleccionado(null);
                      }}
                      className={`w-14 h-8 rounded-full transition-all relative ${dividirProveedores ? 'bg-amber-500' : 'bg-gray-200'}`}
                    >
                      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${dividirProveedores ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                  {dividirProveedores && (
                    <div className="bg-white/60 p-4 rounded-2xl border border-amber-100">
                      <p className="text-[9px] font-bold text-amber-800 uppercase leading-tight">
                        Modo Multiproveedor activo. Podrás especificar los detalles de cada proveedor en el siguiente paso o en las notas finales.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={handleBack}
                  className="flex-1 p-8 bg-white border-2 border-gray-100 text-gray-400 rounded-[2.5rem] font-black uppercase tracking-widest text-sm active:scale-95 transition-all flex items-center justify-center gap-4"
                >
                  <ArrowLeft className="w-6 h-6" /> Volver
                </button>
                <button 
                  onClick={() => setStep('CONFIRMAR')}
                  disabled={!proveedorSeleccionado && !dividirProveedores}
                  className="flex-[2] p-8 bg-blue-600 text-white rounded-[2.5rem] font-black uppercase tracking-widest text-sm shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-50"
                >
                  Configurar Envío <ArrowRight className="w-6 h-6" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: CONFIRMAR */}
          {step === 'CONFIRMAR' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-5 pb-12">
              <div className="flex items-center justify-between pt-4">
                <button onClick={handleBack} className="p-3 bg-white border-2 border-gray-100 text-gray-400 rounded-2xl hover:text-gray-900 transition-all active:scale-90">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <h3 className="text-3xl font-black text-gray-900 uppercase tracking-tighter mb-1">📤 Confirmar</h3>
                  <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Paso 4: Envío</p>
                </div>
                <div className="w-11" />
              </div>

              <div className="bg-white border-2 border-gray-100 rounded-[3rem] overflow-hidden shadow-sm">
                <div className="p-8 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-black text-gray-900 uppercase text-sm">{proveedorSeleccionado?.name || 'Varios Proveedores'}</h4>
                      <p className="text-[9px] font-bold text-gray-400 uppercase">{items.length} materiales seleccionados</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {items.map(i => (
                      <div key={i.id} className={`flex justify-between items-center text-[10px] font-bold uppercase ${i.needsRequest ? '' : 'opacity-40'}`}>
                        <span className="flex items-center gap-2">
                          {i.needsRequest ? <div className="w-1 h-1 bg-amber-500 rounded-full" /> : <Check className="w-3 h-3 text-green-500" />}
                          <span className={i.needsRequest ? 'text-gray-500' : 'text-gray-400 line-through'}>{i.name}</span>
                        </span>
                        <span className="text-gray-900">x{i.quantity} {i.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-8 space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Prioridad</label>
                      <div className="flex gap-2">
                        {(['baja', 'normal', 'alta', 'urgente'] as const).map(p => (
                          <button 
                            key={p}
                            onClick={() => setPedido({...pedido, prioridad: p})}
                            className={`flex-1 py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${pedido.prioridad === p ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Fecha Necesaria</label>
                      <input 
                        type="date"
                        value={pedido.fechaNecesaria}
                        onChange={(e) => setPedido({...pedido, fechaNecesaria: e.target.value})}
                        className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-amber-500 outline-none font-bold text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Lugar de Entrega</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-4 w-5 h-5 text-gray-300" />
                      <select 
                        value={pedido.edificioId}
                        onChange={(e) => setPedido({...pedido, edificioId: e.target.value})}
                        className="w-full p-4 pl-12 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-amber-500 outline-none font-bold text-xs appearance-none"
                      >
                        <option value="">Selecciona edificio...</option>
                        {BUILDINGS.map(b => (
                          <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Notas / Instrucciones</label>
                    <textarea 
                      value={pedido.notes}
                      onChange={(e) => setPedido({...pedido, notes: e.target.value})}
                      placeholder="Horario de entrega, persona de contacto..."
                      className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-amber-500 outline-none font-bold text-xs resize-none h-24"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4">Método de Envío</h5>
                <div className="grid grid-cols-3 gap-4">
                  <button 
                    onClick={() => setMetodoEnvio('email')}
                    className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 ${metodoEnvio === 'email' ? 'bg-white border-amber-500 shadow-xl scale-105' : 'bg-white border-gray-100 opacity-60'}`}
                  >
                    <Mail className={`w-6 h-6 ${metodoEnvio === 'email' ? 'text-amber-500' : 'text-gray-300'}`} />
                    <span className="text-[8px] font-black uppercase tracking-widest">Email</span>
                  </button>
                  <button 
                    onClick={() => setMetodoEnvio('whatsapp')}
                    className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 ${metodoEnvio === 'whatsapp' ? 'bg-white border-green-500 shadow-xl scale-105' : 'bg-white border-gray-100 opacity-60'}`}
                  >
                    <MessageSquare className={`w-6 h-6 ${metodoEnvio === 'whatsapp' ? 'text-green-500' : 'text-gray-300'}`} />
                    <span className="text-[8px] font-black uppercase tracking-widest">WhatsApp</span>
                  </button>
                  <button 
                    onClick={() => setMetodoEnvio('save')}
                    className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 ${metodoEnvio === 'save' ? 'bg-white border-blue-600 shadow-xl scale-105' : 'bg-white border-gray-100 opacity-60'}`}
                  >
                    <Save className={`w-6 h-6 ${metodoEnvio === 'save' ? 'text-blue-600' : 'text-gray-300'}`} />
                    <span className="text-[8px] font-black uppercase tracking-widest">Guardar</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={handleBack}
                  className="flex-1 p-8 bg-white border-2 border-gray-100 text-gray-400 rounded-[2.5rem] font-black uppercase tracking-widest text-sm active:scale-95 transition-all flex items-center justify-center gap-4"
                >
                  <ArrowLeft className="w-6 h-6" /> Volver
                </button>
                <button 
                  onClick={() => handleFinalizar()}
                  className="flex-[2] p-8 bg-blue-600 text-white rounded-[2.5rem] font-black uppercase tracking-widest text-sm shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4"
                >
                  {metodoEnvio === 'save' ? <Save className="w-6 h-6" /> : <Send className="w-6 h-6" />}
                  {metodoEnvio === 'save' ? 'Guardar Solicitud' : 'Enviar Pedido Oficial'}
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {showProviderForm && (
        <ProviderForm 
          onClose={() => setShowProviderForm(false)}
          onSave={(prov) => {
            setProveedores(storageService.getProviders());
            setProveedorSeleccionado(prov);
            setShowProviderForm(false);
          }}
        />
      )}

      {showConfirmSave && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto text-amber-600 mb-4">
                <Save className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tighter">Guardar Solicitud</h3>
              <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Elige cómo quieres registrar el pedido</p>
            </div>
            
            <div className="grid gap-4">
              <button 
                onClick={() => handleFinalizar(true, false)}
                className="w-full p-6 bg-gray-50 hover:bg-gray-100 rounded-2xl text-left flex items-center gap-4 transition-all group"
              >
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-400 group-hover:text-gray-900 shadow-sm">
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-black uppercase text-[10px] text-gray-900">Solo en la App</p>
                  <p className="text-[8px] font-bold text-gray-400 uppercase">Se guardará en el historial de SIGAI</p>
                </div>
              </button>

              <button 
                onClick={() => handleFinalizar(true, true)}
                className="w-full p-6 bg-blue-600 hover:bg-blue-700 rounded-2xl text-left flex items-center gap-4 transition-all group"
              >
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white shadow-sm">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-black uppercase text-[10px] text-white">Guardar y Generar PDF</p>
                  <p className="text-[8px] font-bold text-blue-100 uppercase">Se guardará y descargará el documento</p>
                </div>
              </button>
            </div>

            <button 
              onClick={() => setShowConfirmSave(false)}
              className="w-full py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-900 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIMaterialFlow;
