
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Flame, Fuel, Droplets, AlertTriangle, CheckCircle2, 
  History, Plus, ChevronRight, X, Search, Filter, 
  ArrowRight, Euro, Truck, TrendingDown, LayoutGrid,
  Clock, Calendar, Camera, Info, ShieldAlert
} from 'lucide-react';
import { GasoilTank, User, GasoilReading, RefuelRequest, GasoilAlertStatus, AppTab, UrgencyLevel } from '../types';
import { storageService } from '../services/storageService';

interface GasoilModuleProps {
  user: User;
  onNavigate: (tab: AppTab) => void;
}

const GasoilModule: React.FC<GasoilModuleProps> = ({ user, onNavigate }) => {
  const [tanks, setTanks] = useState<GasoilTank[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showReadingModal, setShowReadingModal] = useState(false);
  const [showRefuelModal, setShowRefuelModal] = useState(false);
  const [selectedTankId, setSelectedTankId] = useState<string | null>(null);

  // Forms
  const [readingForm, setReadingForm] = useState({
    tankId: '',
    percentage: 50,
    litres: 0,
    method: 'visual' as const,
    notes: ''
  });

  const [refuelForm, setRefuelForm] = useState({
    type: 'manual' as const,
    priority: 'Media' as UrgencyLevel,
    selectedTankIds: [] as string[],
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setTanks(storageService.getGasoilTanks());
  };

  const filteredTanks = useMemo(() => {
    return tanks.filter(t => {
      const matchesSearch = t.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            t.buildingCode.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'all' || t.alertStatus === filterStatus;
      return matchesSearch && matchesStatus;
    }).sort((a, b) => a.currentLevel - b.currentLevel);
  }, [tanks, searchQuery, filterStatus]);

  const stats = useMemo(() => {
    const critical = tanks.filter(t => t.alertStatus === 'critico').length;
    const low = tanks.filter(t => t.alertStatus === 'bajo').length;
    const attention = tanks.filter(t => t.alertStatus === 'atencion').length;
    const totalLitres = tanks.reduce((sum, t) => sum + t.currentLitres, 0);
    return { critical, low, attention, totalLitres };
  }, [tanks]);

  const selectedTank = useMemo(() => {
    return tanks.find(t => t.id === readingForm.tankId);
  }, [tanks, readingForm.tankId]);

  const handlePercentageChange = (val: number) => {
    if (!selectedTank) return;
    const litres = Math.round((val / 100) * selectedTank.totalCapacity);
    setReadingForm(prev => ({ ...prev, percentage: val, litres }));
  };

  const handleLitresChange = (val: number) => {
    if (!selectedTank) return;
    const percentage = Math.round((val / selectedTank.totalCapacity) * 100);
    setReadingForm(prev => ({ ...prev, litres: val, percentage }));
  };

  const submitReading = () => {
    if (!readingForm.tankId) return alert("Selecciona un depósito");
    
    const reading: GasoilReading = {
      id: crypto.randomUUID(),
      tankId: readingForm.tankId,
      date: new Date().toISOString(),
      percentage: readingForm.percentage,
      litres: readingForm.litres,
      method: readingForm.method,
      userId: user.id,
      notes: readingForm.notes
    };

    storageService.saveGasoilReading(reading);
    loadData();
    setShowReadingModal(false);
    alert("Lectura registrada correctamente.");
  };

  const submitRefuelRequest = () => {
    if (refuelForm.selectedTankIds.length === 0) return alert("Selecciona al menos un depósito");
    
    let totalLitres = 0;
    refuelForm.selectedTankIds.forEach(id => {
      const tank = tanks.find(t => t.id === id);
      if (tank) totalLitres += (tank.totalCapacity - tank.currentLitres);
    });

    const request: RefuelRequest = {
      id: `RF-${Math.floor(Math.random()*10000)}`,
      date: new Date().toISOString(),
      userId: user.id,
      type: refuelForm.type,
      priority: refuelForm.priority,
      status: 'pending',
      totalLitres,
      estimatedCost: totalLitres * 1.25, // Mock price
      tankIds: refuelForm.selectedTankIds,
      notes: refuelForm.notes
    };

    storageService.saveRefuelRequest(request);
    setShowRefuelModal(false);
    alert("Solicitud de repostaje enviada.");
  };

  const getStatusColor = (status: GasoilAlertStatus) => {
    switch (status) {
      case 'critico': return 'bg-red-500 text-white shadow-red-500/20';
      case 'bajo': return 'bg-orange-500 text-white shadow-orange-500/20';
      case 'atencion': return 'bg-yellow-400 text-black shadow-yellow-500/20';
      default: return 'bg-green-500 text-white shadow-green-500/20';
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter text-gray-900 leading-none">Gestión Gasoil</h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Control de Combustible USAC</p>
        </div>
        <div className="w-12 h-12 bg-white border border-gray-100 rounded-2xl flex items-center justify-center shadow-sm active:scale-95 transition-all" onClick={() => onNavigate(AppTab.HOME)}>
           <LayoutGrid className="w-5 h-5 text-tactical-orange" />
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="grid grid-cols-2 gap-4 px-2">
         <button onClick={() => { setReadingForm({ ...readingForm, tankId: '' }); setShowReadingModal(true); }} className="p-6 bg-white border border-gray-100 text-gray-900 rounded-[2rem] font-black uppercase tracking-widest text-[9px] shadow-sm flex items-center justify-center gap-3 active:scale-95 transition-all hover:border-tactical-orange/30">
            <Plus className="w-4 h-4 text-tactical-orange" /> Registrar Lectura
         </button>
         <button onClick={() => setShowRefuelModal(true)} className="p-6 bg-amber-500 text-black rounded-[2rem] font-black uppercase tracking-widest text-[9px] shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-amber-600">
            <Fuel className="w-4 h-4" /> Solicitar Carga
         </button>
      </div>

      {/* STATS SUMMARY */}
      <div className="grid grid-cols-3 gap-3 px-2">
         <StatBadge label="CRÍTICO" val={stats.critical} color="bg-red-50 text-red-600 border-red-100" />
         <StatBadge label="BAJO" val={stats.low} color="bg-orange-50 text-orange-600 border-orange-100" />
         <StatBadge label="ATENCIÓN" val={stats.attention} color="bg-yellow-50 text-yellow-600 border-yellow-100" />
      </div>

      {/* FILTERS */}
      <div className="px-2 space-y-3">
         <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar por edificio..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl text-[11px] font-bold outline-none focus:ring-2 ring-gray-900/5 transition-all"
            />
         </div>
      </div>

      {/* TANK LIST */}
      <div className="space-y-4 px-2">
        {filteredTanks.length === 0 ? (
          <div className="py-20 text-center bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-100">
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Sin depósitos</p>
          </div>
        ) : (
          filteredTanks.map(tank => (
            <div key={tank.id} className="bg-white border border-gray-100 rounded-[2.5rem] p-6 shadow-sm relative overflow-hidden group">
               <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-gray-50 rounded-xl text-gray-400">
                        <span className="text-[8px] font-black">{tank.buildingCode}</span>
                     </div>
                     <div>
                        <h4 className="font-black text-xs uppercase text-gray-900 leading-none">{tank.fullName}</h4>
                        <p className="text-[8px] font-bold text-gray-400 uppercase mt-1">Capacidad: {tank.totalCapacity} L</p>
                     </div>
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${getStatusColor(tank.alertStatus)}`}>
                     {tank.alertStatus}
                  </div>
               </div>

               {/* TANK VISUAL */}
               <div className="flex items-center gap-6 mb-6">
                  <div className="w-16 h-28 bg-gray-50 border-4 border-gray-200 rounded-3xl relative overflow-hidden shadow-inner">
                     <div 
                        className={`absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-out ${tank.currentLevel <= 10 ? 'bg-red-500' : tank.currentLevel <= 30 ? 'bg-orange-400' : 'bg-blue-500'}`}
                        style={{ height: `${tank.currentLevel}%` }}
                     >
                        <div className="absolute top-0 left-0 right-0 h-2 bg-white/20 animate-pulse" />
                     </div>
                     <div className="absolute inset-0 flex items-center justify-center font-black text-xs text-gray-900 mix-blend-difference">
                        {tank.currentLevel}%
                     </div>
                  </div>

                  <div className="flex-1 space-y-4">
                     <div className="grid grid-cols-1 gap-2">
                        <div className="flex justify-between items-center text-[9px] font-black">
                           <span className="text-gray-400 uppercase">Litros Actuales</span>
                           <span className="text-gray-900">{tank.currentLitres} L</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden">
                           <div className={`h-full transition-all duration-1000 ${tank.currentLevel <= 30 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${tank.currentLevel}%` }} />
                        </div>
                     </div>

                     <div className="flex justify-between items-center text-[9px] font-black">
                        <span className="text-gray-400 uppercase">Faltan</span>
                        <span className="text-red-500">{tank.totalCapacity - tank.currentLitres} L</span>
                     </div>
                     
                     {tank.daysRemaining && (
                        <div className="p-3 bg-gray-50 rounded-xl flex items-center gap-3">
                           <Clock className="w-3 h-3 text-blue-500" />
                           <span className="text-[9px] font-black uppercase text-gray-600">Autonomía: {tank.daysRemaining} días</span>
                        </div>
                     )}
                  </div>
               </div>

               <div className="flex gap-2">
                  <button onClick={() => { setReadingForm({ ...readingForm, tankId: tank.id, percentage: tank.currentLevel, litres: tank.currentLitres }); setShowReadingModal(true); }} className="flex-1 p-3 bg-gray-50 text-gray-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-gray-900 hover:text-white transition-all active:scale-95">
                     Actualizar
                  </button>
                  <button onClick={() => { setRefuelForm({ ...refuelForm, selectedTankIds: [tank.id] }); setShowRefuelModal(true); }} className="flex-1 p-3 border border-gray-100 text-gray-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:border-amber-500 hover:text-amber-500 transition-all active:scale-95">
                     Cargar
                  </button>
               </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL LECTURA */}
      {showReadingModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="w-full max-w-sm bg-white rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <header className="p-6 bg-white border-b border-gray-100 text-gray-900 flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-tactical-orange rounded-xl flex items-center justify-center shadow-md">
                       <Plus className="w-5 h-5 text-black" />
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-tight">Nueva Lectura</h3>
                 </div>
                 <button onClick={() => setShowReadingModal(false)} className="p-2 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-6 h-6" /></button>
              </header>

              <main className="flex-1 overflow-y-auto p-6 space-y-6">
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Depósito *</label>
                    <select 
                      value={readingForm.tankId} 
                      onChange={(e) => setReadingForm({...readingForm, tankId: e.target.value})}
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[11px] font-bold outline-none focus:border-tactical-orange transition-all"
                    >
                      <option value="">Seleccionar depósito...</option>
                      {tanks.map(t => (
                        <option key={t.id} value={t.id}>{t.buildingCode} - {t.fullName}</option>
                      ))}
                    </select>
                 </div>

                 {selectedTank && (
                   <div className="space-y-6 animate-in slide-in-from-bottom-5">
                      <div className="p-6 bg-gray-50 border border-gray-100 rounded-[2rem] text-gray-900 text-center">
                         <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Nivel Actual (%)</span>
                         <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={readingForm.percentage}
                            onChange={(e) => handlePercentageChange(parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-tactical-orange mb-4"
                         />
                         <div className="text-6xl font-black text-tactical-orange font-mono tracking-tighter">{readingForm.percentage}%</div>
                         <div className="mt-4 text-[11px] font-bold text-gray-400">≈ {readingForm.litres} Litros</div>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Método de Medición</label>
                            <select 
                              value={readingForm.method} 
                              onChange={(e) => setReadingForm({...readingForm, method: e.target.value as any})}
                              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[11px] font-bold outline-none focus:border-tactical-orange transition-all"
                            >
                               <option value="visual">👁️ Visual / Reloj</option>
                               <option value="varilla">📏 Varilla de Medición</option>
                               <option value="sensor">📡 Sensor Automático</option>
                               <option value="estimado">🤔 Estimación Manual</option>
                            </select>
                         </div>
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Observaciones</label>
                            <textarea 
                              placeholder="Indica anomalías..." 
                              value={readingForm.notes}
                              onChange={(e) => setReadingForm({...readingForm, notes: e.target.value})}
                              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[11px] font-medium outline-none h-24 resize-none focus:border-tactical-orange transition-all"
                            />
                         </div>
                      </div>
                   </div>
                 )}
              </main>

              <footer className="p-6 bg-gray-50 border-t border-gray-100 shrink-0">
                 <button 
                  onClick={submitReading}
                  disabled={!readingForm.tankId}
                  className="w-full p-6 bg-tactical-orange text-black rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all disabled:opacity-50 shadow-tactical-orange/20"
                 >
                    Validar Lectura SIGAI
                 </button>
              </footer>
           </div>
        </div>
      )}

      {/* MODAL REPOSTAJE */}
      {showRefuelModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="w-full max-w-sm bg-white rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <header className="p-6 bg-amber-500 text-black flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-3 text-black">
                    <Fuel className="w-6 h-6" />
                    <h3 className="text-lg font-black uppercase tracking-tight">Solicitud de Carga</h3>
                 </div>
                 <button onClick={() => setShowRefuelModal(false)} className="p-2 text-black/30 hover:text-black transition-colors"><X className="w-6 h-6" /></button>
              </header>

              <main className="flex-1 overflow-y-auto p-6 space-y-8">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block px-2">Selección de Depósitos</label>
                    <div className="space-y-2">
                       {tanks.map(t => (
                         <button 
                          key={t.id} 
                          onClick={() => {
                            const selected = refuelForm.selectedTankIds.includes(t.id);
                            setRefuelForm({
                              ...refuelForm,
                              selectedTankIds: selected 
                                ? refuelForm.selectedTankIds.filter(id => id !== t.id)
                                : [...refuelForm.selectedTankIds, t.id]
                            });
                          }}
                          className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${refuelForm.selectedTankIds.includes(t.id) ? 'bg-amber-50 border-amber-400 text-amber-900' : 'bg-gray-50 border-gray-100 text-gray-400 opacity-60'}`}
                         >
                            <div className="flex flex-col items-start">
                               <span className="text-[9px] font-black uppercase">{t.buildingCode}</span>
                               <span className="text-[11px] font-bold">{t.fullName}</span>
                            </div>
                            <div className="text-right">
                               <span className="text-[10px] font-black block">{t.currentLevel}%</span>
                               <span className="text-[8px] font-bold uppercase text-red-500">+{t.totalCapacity - t.currentLitres}L</span>
                            </div>
                         </button>
                       ))}
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-gray-400 px-2 tracking-widest">Prioridad</label>
                      <select 
                        value={refuelForm.priority}
                        onChange={(e) => setRefuelForm({...refuelForm, priority: e.target.value as any})}
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-black uppercase text-[10px] outline-none focus:border-amber-500 transition-all"
                      >
                         <option value="Baja">Baja</option>
                         <option value="Media">Media</option>
                         <option value="Alta">Alta</option>
                         <option value="Crítica">Urgente</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-gray-400 px-2 tracking-widest">Tipo</label>
                      <select 
                        value={refuelForm.type}
                        onChange={(e) => setRefuelForm({...refuelForm, type: e.target.value as any})}
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-black uppercase text-[10px] outline-none focus:border-amber-500 transition-all"
                      >
                         <option value="manual">Manual</option>
                         <option value="emergencia">Emergencia</option>
                      </select>
                    </div>
                 </div>

                 <div className="bg-gray-900 rounded-[2rem] p-8 text-white space-y-6 shadow-xl">
                    <div className="flex justify-between items-center">
                       <div>
                          <p className="text-[10px] font-black text-amber-500 uppercase mb-1">Total Estimado</p>
                          <h4 className="text-4xl font-black text-white leading-none">
                             {refuelForm.selectedTankIds.reduce((sum, id) => {
                               const t = tanks.find(tank => tank.id === id);
                               return sum + (t ? (t.totalCapacity - t.currentLitres) : 0);
                             }, 0)} L
                          </h4>
                       </div>
                       <Truck className="w-10 h-10 text-amber-500" />
                    </div>
                 </div>
              </main>

              <footer className="p-6 bg-gray-50 border-t border-gray-100 shrink-0">
                 <button 
                  onClick={submitRefuelRequest}
                  disabled={refuelForm.selectedTankIds.length === 0}
                  className="w-full p-6 bg-amber-500 text-black rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all disabled:opacity-50"
                 >
                    Enviar Solicitud de Carga
                 </button>
              </footer>
           </div>
        </div>
      )}

    </div>
  );
};

const StatBadge: React.FC<{ label: string, val: number, color: string }> = ({ label, val, color }) => (
  <div className={`p-4 rounded-[1.5rem] border text-center transition-all ${color}`}>
     <div className="text-xl font-black mb-0.5 font-mono">{val}</div>
     <div className="text-[8px] font-black uppercase tracking-widest opacity-80">{label}</div>
  </div>
);

export default GasoilModule;
