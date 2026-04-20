
import React, { useState, useEffect, useMemo } from 'react';
import { Thermometer, Plus, X, Search, ChevronRight, LayoutGrid, Info, ArrowLeft, ThermometerSnowflake, Gauge, AlertTriangle, CheckCircle2, History } from 'lucide-react';
import { Boiler, User, BoilerTemperatureReading, AppTab } from '../types';
import { storageService } from '../services/storageService';
import { getLocalDateString } from '../services/dateUtils';

interface TemperatureModuleProps {
  user: User;
  onNavigate: (tab: AppTab) => void;
}

const TemperatureModule: React.FC<TemperatureModuleProps> = ({ user, onNavigate }) => {
  const [boilers, setBoilers] = useState<Boiler[]>([]);
  const [readings, setReadings] = useState<BoilerTemperatureReading[]>([]);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [selectedBoilerId, setSelectedBoilerId] = useState('');

  // Form State
  const [form, setForm] = useState({
    tempImpulsion: 70,
    tempRetorno: 50,
    pressure: 1.5,
    isOn: true,
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setBoilers(storageService.getBoilers());
    setReadings(storageService.getBoilerReadings());
  };

  const selectedBoiler = useMemo(() => boilers.find(b => b.id === selectedBoilerId), [boilers, selectedBoilerId]);

  const currentAlerts = useMemo(() => {
    if (!selectedBoiler) return [];
    const alerts = [];
    if (form.tempImpulsion > selectedBoiler.refTemps.impulsionMax) alerts.push("TEMP. IMPULSIÓN EXCESIVA");
    if (form.tempImpulsion < selectedBoiler.refTemps.impulsionMin) alerts.push("TEMP. IMPULSIÓN BAJA");
    if (form.pressure > selectedBoiler.refTemps.pressureMax) alerts.push("PRESIÓN ALTA");
    if (form.pressure < selectedBoiler.refTemps.pressureMin) alerts.push("PRESIÓN BAJA");
    return alerts;
  }, [selectedBoiler, form]);

  const submitReading = () => {
    if (!selectedBoilerId) return alert("Selecciona una caldera");
    
    const newReading: BoilerTemperatureReading = {
      id: crypto.randomUUID(),
      boilerId: selectedBoilerId,
      date: getLocalDateString(),
      tempImpulsion: form.tempImpulsion,
      tempRetorno: form.tempRetorno,
      pressure: form.pressure,
      isOn: form.isOn,
      userId: user.id,
      userName: user.name,
      alerts: currentAlerts,
      notes: form.notes
    };

    storageService.saveBoilerReading(newReading);
    alert("Lectura registrada en SIGAI.");
    setShowEntryModal(false);
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
            <h2 className="text-2xl font-black uppercase tracking-tighter text-gray-900 leading-none">Temperaturas</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Control Térmico Diario</p>
          </div>
        </div>
        <div className="w-12 h-12 bg-white border border-gray-100 rounded-2xl flex items-center justify-center shadow-sm active:scale-95 transition-all" onClick={() => onNavigate(AppTab.HOME)}>
           <LayoutGrid className="w-5 h-5 text-tactical-orange" />
        </div>
      </div>

      {/* QUICK ENTRY ACTION */}
      <div className="px-2">
         <button onClick={() => { setSelectedBoilerId(''); setShowEntryModal(true); }} className="w-full p-8 bg-red-600 text-white rounded-[2.5rem] font-black uppercase tracking-widest text-xs shadow-2xl flex items-center justify-center gap-4 active:scale-95 transition-all">
            <Thermometer className="w-6 h-6" /> Registrar Nueva Lectura
         </button>
      </div>

      {/* RECENT READINGS LIST */}
      <div className="space-y-4 px-2">
         <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
            <History className="w-4 h-4" /> Histórico de Lecturas
         </h3>
         
         <div className="space-y-4">
            {readings.length === 0 ? (
               <div className="py-20 text-center bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Sin lecturas registradas</p>
               </div>
            ) : (
               readings.slice(0, 10).map(reading => {
                  const boiler = boilers.find(b => b.id === reading.boilerId);
                  return (
                     <div key={reading.id} className="bg-white border border-gray-100 rounded-[2rem] p-6 shadow-sm relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-4">
                           <div>
                              <div className="text-[8px] font-black uppercase text-gray-400">{boiler?.buildingCode}</div>
                              <h4 className="text-[11px] font-black uppercase text-gray-900">{boiler?.buildingName}</h4>
                           </div>
                           <div className="text-right">
                              <div className="text-[9px] font-black text-gray-900">{new Date(reading.date).toLocaleDateString()}</div>
                              <div className="text-[8px] font-bold text-gray-400 uppercase mt-0.5">{new Date(reading.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                           </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                           <div className="bg-gray-50 p-3 rounded-2xl text-center">
                              <span className="text-[8px] font-black text-gray-400 uppercase block mb-1">Impul.</span>
                              <span className={`text-sm font-black ${reading.alerts.some(a => a.includes('IMPUL')) ? 'text-red-500' : 'text-gray-900'}`}>{reading.tempImpulsion}°C</span>
                           </div>
                           <div className="bg-gray-50 p-3 rounded-2xl text-center">
                              <span className="text-[8px] font-black text-gray-400 uppercase block mb-1">Retor.</span>
                              <span className="text-sm font-black text-gray-900">{reading.tempRetorno}°C</span>
                           </div>
                           <div className="bg-gray-50 p-3 rounded-2xl text-center">
                              <span className="text-[8px] font-black text-gray-400 uppercase block mb-1">Pres.</span>
                              <span className={`text-sm font-black ${reading.alerts.some(a => a.includes('PRES')) ? 'text-red-500' : 'text-gray-900'}`}>{reading.pressure} b</span>
                           </div>
                        </div>

                        {reading.alerts.length > 0 && (
                           <div className="mt-3 flex flex-wrap gap-1">
                              {reading.alerts.map((a, i) => (
                                 <span key={i} className="px-2 py-0.5 bg-red-100 text-red-600 rounded text-[7px] font-black uppercase">{a}</span>
                              ))}
                           </div>
                        )}
                     </div>
                  );
               })
            )}
         </div>
      </div>

      {/* MODAL ENTRY */}
      {showEntryModal && (
         <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-white rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
               <header className="p-6 bg-red-600 text-white flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                     <Thermometer className="w-6 h-6" />
                     <h3 className="text-lg font-black uppercase tracking-tight">Nueva Lectura</h3>
                  </div>
                  <button onClick={() => setShowEntryModal(false)} className="p-2 text-white/30 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
               </header>

               <main className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="space-y-2">
                     <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Caldera / Edificio *</label>
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

                  {selectedBoiler && (
                     <div className="space-y-8 animate-in slide-in-from-bottom-5">
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Impulsión (°C)</label>
                              <input 
                                 type="number" 
                                 value={form.tempImpulsion} 
                                 onChange={e => setForm({...form, tempImpulsion: parseFloat(e.target.value) || 0})}
                                 className={`w-full p-5 bg-gray-50 border rounded-3xl text-3xl font-black text-center outline-none ${form.tempImpulsion > selectedBoiler.refTemps.impulsionMax || form.tempImpulsion < selectedBoiler.refTemps.impulsionMin ? 'border-red-500 text-red-600 bg-red-50' : 'border-gray-100'}`}
                              />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Presión (bar)</label>
                              <input 
                                 type="number" 
                                 step="0.1"
                                 value={form.pressure} 
                                 onChange={e => setForm({...form, pressure: parseFloat(e.target.value) || 0})}
                                 className={`w-full p-5 bg-gray-50 border rounded-3xl text-3xl font-black text-center outline-none ${form.pressure > selectedBoiler.refTemps.pressureMax || form.pressure < selectedBoiler.refTemps.pressureMin ? 'border-red-500 text-red-600 bg-red-50' : 'border-gray-100'}`}
                              />
                           </div>
                        </div>

                        {currentAlerts.length > 0 && (
                           <div className="p-4 bg-red-600 rounded-[1.5rem] text-white space-y-2 shadow-lg shadow-red-500/20">
                              <div className="flex items-center gap-2">
                                 <AlertTriangle className="w-4 h-4" />
                                 <span className="text-[9px] font-black uppercase tracking-widest">Aviso de Seguridad</span>
                              </div>
                              <ul className="text-[10px] font-bold list-disc pl-4 opacity-90">
                                 {currentAlerts.map((a, i) => <li key={i}>{a}</li>)}
                              </ul>
                           </div>
                        )}

                        <div className="space-y-2">
                           <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Observaciones</label>
                           <textarea 
                              placeholder="Ej: Quemador arranca con dificultad..." 
                              value={form.notes}
                              onChange={e => setForm({...form, notes: e.target.value})}
                              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[11px] font-medium outline-none h-24 resize-none"
                           />
                        </div>
                     </div>
                  )}
               </main>

               <footer className="p-6 bg-gray-50 border-t border-gray-100">
                  <button 
                     onClick={submitReading}
                     disabled={!selectedBoilerId}
                     className="w-full p-6 bg-gray-900 text-yellow-400 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl active:scale-95 transition-all disabled:opacity-30"
                  >
                     Validar Lectura Oficial
                  </button>
               </footer>
            </div>
         </div>
      )}

    </div>
  );
};

export default TemperatureModule;
