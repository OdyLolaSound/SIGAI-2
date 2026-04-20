
import React, { useState, useEffect, useMemo } from 'react';
import { Wrench, Plus, X, Search, LayoutGrid, Info, ArrowLeft, Package, Trash2, ShieldCheck, Clock, Settings, History, Calendar, HardHat, Hammer, Box } from 'lucide-react';
import { Boiler, User, BoilerMaintenanceRecord, BoilerPart, BoilerStatus, AppTab } from '../types';
import { storageService, PIEZAS_COMUNES } from '../services/storageService';
import { getLocalDateString } from '../services/dateUtils';

interface MaintenanceModuleProps {
  user: User;
  onNavigate: (tab: AppTab) => void;
}

const MaintenanceModule: React.FC<MaintenanceModuleProps> = ({ user, onNavigate }) => {
  const [boilers, setBoilers] = useState<Boiler[]>([]);
  const [records, setRecords] = useState<BoilerMaintenanceRecord[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedBoilerId, setSelectedBoilerId] = useState('');

  // Form State
  const [form, setForm] = useState({
    type: 'correctivo' as any,
    title: '',
    description: '',
    parts: [] as { name: string, quantity: number, cost: number }[],
    laborCost: 0,
    performedBy: user.name,
    isExternal: false,
    externalCompany: '',
    statusAfter: 'operativa' as BoilerStatus,
    requiresFollowUp: false
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setBoilers(storageService.getBoilers());
    setRecords(storageService.getBoilerMaintenance());
  };

  const totalPartsCost = useMemo(() => {
    return form.parts.reduce((sum, p) => sum + (p.quantity * p.cost), 0);
  }, [form.parts]);

  const handleAddPart = (part: BoilerPart) => {
    setForm(prev => ({
      ...prev,
      parts: [...prev.parts, { name: part.name, quantity: 1, cost: part.price }]
    }));
  };

  const submitRecord = () => {
    if (!selectedBoilerId || !form.title) return alert("Rellena los campos obligatorios");

    const record: BoilerMaintenanceRecord = {
      id: crypto.randomUUID(),
      boilerId: selectedBoilerId,
      date: getLocalDateString(),
      type: form.type,
      title: form.title,
      description: form.description,
      partsReplaced: form.parts,
      laborCost: form.laborCost,
      totalCost: totalPartsCost + form.laborCost,
      performedBy: form.performedBy,
      isExternal: form.isExternal,
      externalCompany: form.externalCompany,
      statusAfter: form.statusAfter,
      userId: user.id,
      userName: user.name,
      requiresFollowUp: form.requiresFollowUp
    };

    storageService.saveBoilerMaintenance(record);
    alert("Intervención técnica registrada.");
    setShowModal(false);
    loadData();
  };

  return (
    <div className="w-full max-w-sm mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate(AppTab.BOILERS)} className="w-10 h-10 bg-white border border-gray-100 rounded-xl flex items-center justify-center text-gray-400 active:scale-90 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter text-gray-900 leading-none">Mantenimiento</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Intervenciones y Piezas</p>
          </div>
        </div>
        <div className="w-12 h-12 bg-white border border-gray-100 rounded-2xl flex items-center justify-center shadow-sm active:scale-95 transition-all" onClick={() => onNavigate(AppTab.HOME)}>
           <LayoutGrid className="w-5 h-5 text-tactical-orange" />
        </div>
      </div>

      {/* QUICK ACTION */}
      <div className="px-2">
         <button onClick={() => { setSelectedBoilerId(''); setShowModal(true); }} className="w-full p-8 bg-white border border-gray-100 text-gray-900 rounded-[2.5rem] font-black uppercase tracking-widest text-xs shadow-sm flex items-center justify-center gap-4 active:scale-95 transition-all">
            <Wrench className="w-6 h-6 text-tactical-orange" /> Registrar Reparación
         </button>
      </div>

      {/* RECENT RECORDS */}
      <div className="space-y-4 px-2">
         <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
            <History className="w-4 h-4" /> Actividad Técnica Reciente
         </h3>

         <div className="space-y-4">
            {records.length === 0 ? (
               <div className="py-20 text-center bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Sin registros de mantenimiento</p>
               </div>
            ) : (
               records.slice(0, 8).map(record => {
                  const boiler = boilers.find(b => b.id === record.boilerId);
                  return (
                     <div key={record.id} className="bg-white border border-gray-100 rounded-[2rem] p-6 shadow-sm relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-4">
                           <div>
                              <div className="text-[8px] font-black uppercase text-gray-400">{boiler?.buildingCode}</div>
                              <h4 className="text-[10px] font-black uppercase text-gray-900">{record.title}</h4>
                           </div>
                           <div className={`px-2 py-0.5 rounded text-[7px] font-black uppercase ${record.type === 'averia' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                              {record.type}
                           </div>
                        </div>

                        <p className="text-[10px] text-gray-500 font-medium line-clamp-2 mb-4 leading-relaxed italic">"{record.description}"</p>

                        <div className="flex items-center justify-between border-t border-gray-50 pt-4">
                           <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-gray-50 rounded-lg"><Clock className="w-3 h-3 text-gray-400" /></div>
                              <span className="text-[9px] font-black text-gray-400">{new Date(record.date).toLocaleDateString()}</span>
                           </div>
                           <div className="text-right">
                              <span className="text-[10px] font-black text-gray-900">{record.totalCost.toFixed(2)} €</span>
                           </div>
                        </div>
                     </div>
                  );
               })
            )}
         </div>
      </div>

      {/* MODAL MANTENIMIENTO */}
      {showModal && (
         <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-white rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
               <header className="p-6 bg-gray-900 text-white flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                     <Wrench className="w-6 h-6 text-yellow-400" />
                     <h3 className="text-lg font-black uppercase tracking-tight">Parte de Trabajo</h3>
                  </div>
                  <button onClick={() => setShowModal(false)} className="p-2 text-white/30 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
               </header>

               <main className="flex-1 overflow-y-auto p-8 space-y-8">
                  <div className="space-y-4">
                     <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Instalación *</label>
                        <select 
                          value={selectedBoilerId} 
                          onChange={e => setSelectedBoilerId(e.target.value)}
                          className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none"
                        >
                           <option value="">Seleccionar Caldera...</option>
                           {boilers.map(b => (
                              <option key={b.id} value={b.id}>{b.buildingCode} - {b.buildingName}</option>
                           ))}
                        </select>
                     </div>

                     <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Título Intervención *</label>
                        <input 
                           type="text" 
                           placeholder="Ej: Cambio de fotocélula..."
                           value={form.title}
                           onChange={e => setForm({...form, title: e.target.value})}
                           className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none"
                        />
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Tipo</label>
                           <select 
                              value={form.type}
                              onChange={e => setForm({...form, type: e.target.value as any})}
                              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[10px] font-black uppercase outline-none"
                           >
                              <option value="correctivo">Correctivo</option>
                              <option value="averia">Avería</option>
                              <option value="limpieza">Limpieza</option>
                              <option value="revision">Revisión</option>
                           </select>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Estado Final</label>
                           <select 
                              value={form.statusAfter}
                              onChange={e => setForm({...form, statusAfter: e.target.value as any})}
                              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[10px] font-black uppercase outline-none"
                           >
                              <option value="operativa">Operativa</option>
                              <option value="averiada">Averiada</option>
                              <option value="en_mantenimiento">Pendiente</option>
                           </select>
                        </div>
                     </div>
                  </div>

                  {/* DESPIECE TÉCNICO */}
                  <div className="space-y-4">
                     <div className="flex items-center justify-between px-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Piezas de Repuesto</label>
                        <span className="text-[10px] font-black text-blue-500 uppercase">{totalPartsCost.toFixed(2)} €</span>
                     </div>
                     <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {PIEZAS_COMUNES.map(p => (
                           <button key={p.id} onClick={() => handleAddPart(p)} className="shrink-0 p-3 bg-gray-50 border border-gray-100 rounded-xl text-[9px] font-black uppercase tracking-tight hover:border-yellow-400 transition-all active:scale-90">
                              + {p.name}
                           </button>
                        ))}
                     </div>

                     <div className="space-y-2">
                        {form.parts.map((p, i) => (
                           <div key={i} className="flex items-center justify-between bg-blue-50 p-3 rounded-xl border border-blue-100">
                              <span className="text-[10px] font-bold text-blue-900">{p.name}</span>
                              <div className="flex items-center gap-3">
                                 <span className="text-[9px] font-black text-blue-400">x{p.quantity}</span>
                                 <button onClick={() => setForm(prev => ({ ...prev, parts: prev.parts.filter((_, idx) => idx !== i) }))} className="text-red-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>

                  <div className="space-y-2">
                     <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Descripción Técnica</label>
                     <textarea 
                        placeholder="Detalla la acción realizada..." 
                        value={form.description}
                        onChange={e => setForm({...form, description: e.target.value})}
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[11px] font-medium outline-none h-24 resize-none"
                     />
                  </div>

                  <div className="bg-gray-900 rounded-[2rem] p-8 text-white space-y-4">
                     <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                        <span className="text-gray-500">Coste Total de Intervención</span>
                        <span className="text-yellow-400 font-mono">ESTIMADO</span>
                     </div>
                     <div className="text-5xl font-black text-white leading-none">{(totalPartsCost + form.laborCost).toFixed(2)} <span className="text-xl opacity-40">€</span></div>
                  </div>
               </main>

               <footer className="p-8 bg-gray-50 border-t border-gray-100">
                  <button 
                     onClick={submitRecord}
                     disabled={!selectedBoilerId || !form.title}
                     className="w-full p-6 bg-gray-900 text-yellow-400 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl active:scale-95 transition-all disabled:opacity-30"
                  >
                     Firmar y Cerrar Parte
                  </button>
               </footer>
            </div>
         </div>
      )}

    </div>
  );
};

export default MaintenanceModule;
