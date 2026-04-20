
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Droplets, Plus, X, Search, ChevronRight, Package, Truck, 
  Clock, ShieldAlert, CheckCircle2, LayoutGrid, Info, ArrowLeft,
  ArrowDown, ArrowUp, History, Warehouse, ShoppingCart, Calendar
} from 'lucide-react';
import { 
  SaltWarehouse, SaltSoftener, SaltRefillLog, SaltEntryLog, 
  User, AppTab, UrgencyLevel, SaltStockStatus 
} from '../types';
import { storageService } from '../services/storageService';

interface SalModuleProps {
  user: User;
  onNavigate: (tab: AppTab) => void;
}

const SalModule: React.FC<SalModuleProps> = ({ user, onNavigate }) => {
  const [warehouse, setWarehouse] = useState<SaltWarehouse | null>(null);
  const [softeners, setSofteners] = useState<SaltSoftener[]>([]);
  const [refillLogs, setRefillLogs] = useState<SaltRefillLog[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);

  // Forms
  const [refillForm, setRefillForm] = useState({
    softenerId: '',
    sacks: 1,
    notes: ''
  });

  const [entryForm, setEntryForm] = useState({
    sacks: 20,
    supplier: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setWarehouse(storageService.getSaltWarehouse());
    setSofteners(storageService.getSaltSofteners());
    setRefillLogs(storageService.getSaltRefillLogs());
  };

  const filteredSofteners = useMemo(() => {
    return softeners.filter(s => 
      s.buildingName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.buildingCode.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [softeners, searchQuery]);

  const stockPercentage = useMemo(() => {
    if (!warehouse) return 0;
    // Referencia de stock máximo para la barra visual (ej: 50 sacos)
    return Math.min((warehouse.sacksAvailable / 50) * 100, 100);
  }, [warehouse]);

  const handleRefill = () => {
    if (!refillForm.softenerId) return alert("Selecciona un edificio");
    if (!warehouse || warehouse.sacksAvailable < refillForm.sacks) return alert("No hay suficiente stock en almacén");

    const softener = softeners.find(s => s.id === refillForm.softenerId);
    
    try {
      storageService.saveSaltRefill({
        softenerId: refillForm.softenerId,
        buildingName: softener?.buildingName || 'Desconocido',
        date: new Date().toISOString(),
        sacksUsed: refillForm.sacks,
        userId: user.id,
        userName: user.name,
        notes: refillForm.notes
      });
      
      alert(`Relleno registrado: ${refillForm.sacks} sacos.`);
      setRefillForm({ softenerId: '', sacks: 1, notes: '' });
      loadData();
    } catch (e) {
      alert("Error al guardar: " + e);
    }
  };

  const handleEntry = () => {
    storageService.saveSaltEntry({
      date: new Date().toISOString(),
      sacksReceived: entryForm.sacks,
      supplier: entryForm.supplier || warehouse?.lastSupplier || 'Proveedor General',
      userId: user.id,
      deliveryNote: 'REC-' + Date.now().toString().slice(-6)
    });
    
    alert("Entrada de stock registrada correctamente.");
    setShowEntryModal(false);
    setEntryForm({ sacks: 20, supplier: '', notes: '' });
    loadData();
  };

  const getStatusColor = (status: SaltStockStatus) => {
    switch (status) {
      case 'critico': return 'bg-red-500 text-white';
      case 'bajo': return 'bg-orange-500 text-white';
      default: return 'bg-green-500 text-white';
    }
  };

  if (!warehouse) return null;

  return (
    <div className="w-full max-w-sm mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate(AppTab.BOILERS)} className="w-10 h-10 bg-white border border-gray-100 rounded-xl flex items-center justify-center text-gray-400 active:scale-90 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter text-gray-900 leading-none">Sal de Caldera</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Control Logístico de Almacén</p>
          </div>
        </div>
        <div className="w-12 h-12 bg-white border border-gray-100 rounded-2xl flex items-center justify-center shadow-sm active:scale-95 transition-all" onClick={() => onNavigate(AppTab.HOME)}>
           <LayoutGrid className="w-5 h-5 text-tactical-orange" />
        </div>
      </div>

      {/* STOCK CENTRAL CARD */}
      <section className={`bg-white border-2 rounded-[2.5rem] p-8 shadow-sm transition-all relative overflow-hidden ${warehouse.status === 'critico' ? 'border-red-200' : 'border-gray-100'}`}>
         <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="flex items-center gap-3">
               <div className="p-3 bg-gray-50 border border-gray-100 text-gray-900 rounded-2xl shadow-sm">
                  <Warehouse className="w-6 h-6" />
               </div>
               <div>
                  <h3 className="text-sm font-black uppercase tracking-tight text-gray-900">Stock en Almacén</h3>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Almacén Central USAC</p>
               </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${getStatusColor(warehouse.status)}`}>
               {warehouse.status === 'normal' ? 'STOCK OK' : warehouse.status.toUpperCase()}
            </div>
         </div>

         <div className="flex items-baseline gap-3 mb-6 relative z-10">
            <span className="text-6xl font-black text-gray-900 tracking-tighter">{warehouse.sacksAvailable}</span>
            <span className="text-xl font-black text-gray-400 uppercase">Sacos</span>
            <span className="ml-auto text-xs font-bold text-blue-500 uppercase">≈ {warehouse.sacksAvailable * 25} KG</span>
         </div>

         {/* Barra Visual */}
         <div className="h-4 w-full bg-gray-100 rounded-full mb-8 relative overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ease-out ${warehouse.status === 'critico' ? 'bg-red-500' : warehouse.status === 'bajo' ? 'bg-orange-500' : 'bg-green-500'}`} 
              style={{ width: `${stockPercentage}%` }} 
            />
            <div className="absolute top-0 left-[20%] w-0.5 h-full bg-white/40" title="Mínimo" />
            <div className="absolute top-0 left-[10%] w-0.5 h-full bg-white/40" title="Crítico" />
         </div>

         <div className="grid grid-cols-2 gap-3 relative z-10">
            <button onClick={() => setShowEntryModal(true)} className="p-4 bg-green-500 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-green-500/20">
               <ArrowDown className="w-4 h-4" /> Registrar Entrada
            </button>
            <button onClick={() => setShowOrderModal(true)} className="p-4 bg-red-500 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-red-500/20">
               <ShoppingCart className="w-4 h-4" /> Solicitar Pedido
            </button>
         </div>

         <Warehouse className="absolute -right-4 -bottom-4 w-32 h-32 text-gray-50 -rotate-12" />
      </section>

      {/* QUICK REFILL FORM (REGISTRAR SALIDA) */}
      <section className="bg-white border border-gray-100 rounded-[2.5rem] p-8 text-gray-900 space-y-6 shadow-sm">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-tactical-orange rounded-xl flex items-center justify-center text-black font-black text-xs">+</div>
            <h3 className="text-sm font-black uppercase tracking-tighter">Registrar Relleno (Salida)</h3>
         </div>
         
         <div className="space-y-4">
            <div className="space-y-2">
               <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest px-1">¿Dónde has echado la sal?</label>
               <select 
                 value={refillForm.softenerId} 
                 onChange={e => setRefillForm({...refillForm, softenerId: e.target.value})}
                 className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold text-gray-900 outline-none focus:ring-2 ring-tactical-orange/20"
               >
                  <option value="" className="text-gray-400">Seleccionar Edificio...</option>
                  {softeners.map(s => (
                    <option key={s.id} value={s.id} className="text-gray-900">{s.buildingCode} - {s.buildingName}</option>
                  ))}
               </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest px-1">¿Cuántos sacos?</label>
                  <div className="flex items-center bg-gray-50 border border-gray-100 rounded-2xl p-1">
                     <button onClick={() => setRefillForm(p => ({...p, sacks: Math.max(1, p.sacks-1)}))} className="w-10 h-10 flex items-center justify-center font-black text-tactical-orange">-</button>
                     <input type="number" readOnly value={refillForm.sacks} className="flex-1 bg-transparent text-center font-black text-sm outline-none text-gray-900" />
                     <button onClick={() => setRefillForm(p => ({...p, sacks: p.sacks+1}))} className="w-10 h-10 flex items-center justify-center font-black text-tactical-orange">+</button>
                  </div>
               </div>
               <div className="flex items-end pb-1">
                  <button 
                    onClick={handleRefill}
                    disabled={!refillForm.softenerId || warehouse.sacksAvailable === 0}
                    className="w-full p-4 bg-tactical-orange text-black rounded-2xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg disabled:opacity-30 shadow-tactical-orange/20"
                  >
                    Confirmar Salida
                  </button>
               </div>
            </div>
         </div>
      </section>

      {/* RECENT ACTIVITY LIST */}
      <section className="space-y-4 px-2">
         <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
               <History className="w-4 h-4" /> Últimos Movimientos
            </h3>
         </div>

         <div className="space-y-3">
            {refillLogs.length === 0 ? (
              <div className="py-10 text-center bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-100">
                <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Sin actividad reciente</p>
              </div>
            ) : (
              refillLogs.slice(0, 5).map(log => (
                <div key={log.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                         <Droplets className="w-4 h-4" />
                      </div>
                      <div>
                         <h4 className="text-[10px] font-black text-gray-900 uppercase leading-none">{log.buildingName}</h4>
                         <p className="text-[8px] font-bold text-gray-400 uppercase mt-1">{new Date(log.date).toLocaleDateString()} · por {log.userName.split(' ')[0]}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <div className="text-xs font-black text-gray-900">-{log.sacksUsed} 🧂</div>
                      <div className="text-[8px] font-bold text-gray-300 uppercase mt-0.5">{log.stockBefore} → {log.stockAfter} stock</div>
                   </div>
                </div>
              ))
            )}
         </div>
      </section>

      {/* EDIFICIOS / DESCALCIFICADORES STATUS */}
      <section className="space-y-4 px-2 pt-4">
         <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Estado por Edificios</h3>
         <div className="grid grid-cols-1 gap-3">
            {filteredSofteners.map(soft => (
               <div key={soft.id} className="bg-white border border-gray-100 rounded-[2rem] p-5 flex items-center justify-between shadow-sm group hover:border-gray-900 transition-all">
                  <div className="flex items-center gap-4">
                     <div className="p-3 bg-gray-50 rounded-2xl text-gray-300 group-hover:text-yellow-400 transition-colors">
                        <Droplets className="w-5 h-5" />
                     </div>
                     <div>
                        <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{soft.buildingCode}</div>
                        <h4 className="text-xs font-black text-gray-900 uppercase leading-none">{soft.buildingName}</h4>
                     </div>
                  </div>
                  <div className="text-right">
                     {soft.lastRefillDate ? (
                        <>
                           <div className="text-[10px] font-black text-gray-900 leading-none">{soft.lastRefillSacks} Sacos</div>
                           <div className="text-[8px] font-bold text-gray-400 uppercase mt-1">{new Date(soft.lastRefillDate).toLocaleDateString()}</div>
                        </>
                     ) : (
                        <span className="text-[8px] font-bold text-gray-300 uppercase italic">Sin registros</span>
                     )}
                  </div>
               </div>
            ))}
         </div>
      </section>

      {/* MODAL ENTRADA STOCK */}
      {showEntryModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="w-full max-w-sm bg-white rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <header className="p-6 bg-green-500 text-white flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl"><ArrowDown className="w-6 h-6" /></div>
                    <h3 className="text-lg font-black uppercase tracking-tight">Entrada de Sal</h3>
                 </div>
                 <button onClick={() => setShowEntryModal(false)} className="p-2 text-white/30 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
              </header>

              <main className="flex-1 overflow-y-auto p-8 space-y-6">
                 <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">Sacos Recibidos</label>
                       <input 
                         type="number" 
                         value={entryForm.sacks}
                         onChange={e => setEntryForm({...entryForm, sacks: parseInt(e.target.value) || 0})}
                         className="w-full p-5 bg-gray-50 border border-gray-100 rounded-3xl text-4xl font-black text-center outline-none focus:ring-2 ring-green-500/20"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">Proveedor</label>
                       <input 
                         type="text" 
                         placeholder="Distribuciones García SL..."
                         value={entryForm.supplier}
                         onChange={e => setEntryForm({...entryForm, supplier: e.target.value})}
                         className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none"
                       />
                    </div>
                 </div>

                 <div className="p-6 bg-green-50 border border-green-100 rounded-[2rem] flex items-center justify-between">
                    <div>
                       <span className="text-[9px] font-black text-green-800 uppercase block mb-1">Stock Estimado Final</span>
                       <span className="text-2xl font-black text-green-900">{warehouse.sacksAvailable + entryForm.sacks} Sacos</span>
                    </div>
                    <div className="text-right">
                       <span className="text-[8px] font-bold text-green-600 uppercase block">Peso Total</span>
                       <span className="text-sm font-black text-green-900">{(warehouse.sacksAvailable + entryForm.sacks) * 25} KG</span>
                    </div>
                 </div>
              </main>

              <footer className="p-8 bg-gray-50 border-t border-gray-100 shrink-0">
                 <button 
                  onClick={handleEntry}
                  className="w-full p-6 bg-green-500 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl active:scale-95 transition-all"
                 >
                    Validar Entrada SIGAI
                 </button>
              </footer>
           </div>
        </div>
      )}

      {/* MODAL SOLICITUD PEDIDO */}
      {showOrderModal && (
         <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-white rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
               <div className="p-10 space-y-8">
                  <div className="text-center">
                     <div className="w-20 h-20 bg-red-100 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                        <ShoppingCart className="w-10 h-10" />
                     </div>
                     <h3 className="text-2xl font-black uppercase tracking-tight text-gray-900">Solicitar Pedido</h3>
                     <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2">Reponer stock del almacén</p>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-[2rem] space-y-4">
                     <div className="flex justify-between items-center text-[10px] font-black uppercase">
                        <span className="text-gray-400">Sugerencia SIGAI</span>
                        <span className="text-blue-500">{Math.max(30 - warehouse.sacksAvailable, 10)} Sacos</span>
                     </div>
                     <p className="text-[10px] text-gray-500 leading-relaxed font-medium">Calculado para alcanzar el nivel óptimo de suministro.</p>
                  </div>

                  <div className="space-y-4">
                     <button 
                        onClick={() => { alert("Solicitud de pedido enviada a Logística."); setShowOrderModal(false); }}
                        className="w-full p-6 bg-gray-900 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl active:scale-95 transition-all"
                     >
                        Confirmar Pedido Urgente
                     </button>
                     <button onClick={() => setShowOrderModal(false)} className="w-full p-4 text-gray-400 font-black uppercase text-[9px] tracking-widest">Cancelar</button>
                  </div>
               </div>
            </div>
         </div>
      )}

    </div>
  );
};

export default SalModule;
