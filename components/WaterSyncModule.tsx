
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Droplets, Settings, ShieldCheck, RefreshCw, AlertTriangle, 
  CheckCircle2, Clock, Globe, LayoutGrid, ArrowLeft, 
  Activity, Gauge, Key, Lock, History,
  Plus, Trash2, X, AlertCircle, Database, ArrowUpRight, ArrowDownRight,
  TrendingUp, FileSpreadsheet, Keyboard, BarChart3, Info, Terminal, Search
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, 
  CartesianGrid, ReferenceLine, BarChart, Bar, Cell
} from 'recharts';
import { WaterAccount, WaterSyncLog, AppTab, User, Reading } from '../types';
import { storageService } from '../services/storageService';
import { getLocalDateString, isWorkDay, isHoliday, parseDateString } from '../services/dateUtils';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

interface WaterSyncModuleProps {
  user: User;
  onNavigate: (tab: AppTab) => void;
}

const WaterSyncModule: React.FC<WaterSyncModuleProps> = ({ user, onNavigate }) => {
  const [account, setAccount] = useState<WaterAccount | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [logs, setLogs] = useState<WaterSyncLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Manual Form
  const [manualForm, setManualForm] = useState({
    date: getLocalDateString(),
    value: 0,
    consumption: 0
  });

  useEffect(() => {
    // Initial load
    loadData();

    // Set up real-time listeners for this module
    // Only if auth is ready
    if (!auth.currentUser) return;

    const unsubReadings = onSnapshot(
      query(collection(db, 'readings'), where('serviceType', '==', 'agua')),
      (snapshot) => {
        const reads = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Reading[];
        setReadings(reads.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      },
      (error) => {
        // Silent fail for permission errors during transitions
        if (error.code !== 'permission-denied') {
          console.error("Error in readings snapshot:", error);
        }
      }
    );

    const unsubAccount = onSnapshot(
      collection(db, 'water_accounts'),
      (snapshot) => {
        if (!snapshot.empty) {
          setAccount(snapshot.docs[0].data() as WaterAccount);
        }
      },
      (error) => {
        if (error.code !== 'permission-denied') {
          console.error("Error in account snapshot:", error);
        }
      }
    );

    const unsubLogs = onSnapshot(
      collection(db, 'water_sync_logs'),
      (snapshot) => {
        setLogs(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as WaterSyncLog[]);
      },
      (error) => {
        if (error.code !== 'permission-denied') {
          console.error("Error in logs snapshot:", error);
        }
      }
    );

    return () => {
      unsubReadings();
      unsubAccount();
      unsubLogs();
    };
  }, [auth.currentUser]);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLines]);

  const loadData = () => {
    const acc = storageService.getWaterAccount();
    const reads = storageService.getReadings('BASE_ALICANTE', 'agua');
    console.log(`[DEBUG] WaterSyncModule loadData: ${reads.length} readings found`);
    setAccount(acc);
    setReadings(reads.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setLogs(storageService.getWaterSyncLogs());
  };

  useEffect(() => {
    // Retry loading data after a short delay to ensure cache is populated
    const timer = setTimeout(loadData, 1000);
    const timer2 = setTimeout(loadData, 3000);
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, []);

  // --- STATS CALCULATIONS ---
  const stats = useMemo(() => {
    if (readings.length === 0) return { today: 0, yesterday: 0, total: 0, week: 0, weekPrev: 0, month: 0, monthPrev: 0, avg: 0 };
    
    const now = new Date();
    const todayStr = getLocalDateString(now);
    
    const yesterdayDate = new Date();
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterdayDate);
    
    const today = readings.find(r => r.date === todayStr)?.consumption1 || 0;
    const yesterday = readings.find(r => r.date === yesterdayStr)?.consumption1 || 0;
    
    const total = readings.reduce((s, r) => s + (r.consumption1 || 0), 0);
    
    // Week
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(now.getDate() - 7);
    const fourteenDaysAgo = new Date(); fourteenDaysAgo.setDate(now.getDate() - 14);
    const week = readings.filter(r => new Date(r.date) >= sevenDaysAgo).reduce((s, r) => s + (r.consumption1 || 0), 0);
    const weekPrev = readings.filter(r => new Date(r.date) >= fourteenDaysAgo && new Date(r.date) < sevenDaysAgo).reduce((s, r) => s + (r.consumption1 || 0), 0);

    // Month
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = readings.filter(r => new Date(r.date) >= startMonth).reduce((s, r) => s + (r.consumption1 || 0), 0);
    const monthPrev = readings.filter(r => new Date(r.date) >= startPrevMonth && new Date(r.date) < startMonth).reduce((s, r) => s + (r.consumption1 || 0), 0);

    // Avg 30 days
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(now.getDate() - 30);
    const last30 = readings.filter(r => new Date(r.date) >= thirtyDaysAgo);
    const avg = last30.length > 0 ? last30.reduce((s, r) => s + (r.consumption1 || 0), 0) / last30.length : 8.5;

    return { today, yesterday, total, week, weekPrev, month, monthPrev, avg };
  }, [readings]);

  const trendToday = useMemo(() => {
    if (!stats.avg) return { val: 0, icon: null, color: 'text-gray-400' };
    const diff = ((stats.today - stats.avg) / stats.avg) * 100;
    if (diff > 15) return { val: diff, icon: <ArrowUpRight className="w-3 h-3" />, color: 'text-red-500' };
    if (diff < -15) return { val: diff, icon: <ArrowDownRight className="w-3 h-3" />, color: 'text-green-500' };
    return { val: diff, icon: null, color: 'text-blue-500' };
  }, [stats]);

  const chartData = useMemo(() => {
    return readings.slice(0, 15).reverse().map(r => ({
      name: new Date(r.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      consumo: r.consumption1,
      esPico: r.isPeak
    }));
  }, [readings]);

  const handleManualEntry = () => {
    if (manualForm.value <= 0) return alert("Indique una lectura válida");
    
    const deterministicId = `water_BASE_ALICANTE_${manualForm.date}`;
    const timestamp = parseDateString(manualForm.date).toISOString();

    const newReading: Reading = {
      id: deterministicId,
      buildingId: 'BASE_ALICANTE',
      date: manualForm.date,
      timestamp: timestamp,
      userId: user.id,
      serviceType: 'agua',
      origin: 'manual',
      value1: manualForm.value,
      consumption1: manualForm.consumption || 0,
      isPeak: (manualForm.consumption || 0) > (isWorkDay(manualForm.date) ? (account?.peakThresholdM3 || 90) : (account?.peakThresholdM3 || 60))
    };

    storageService.saveReading(newReading);
    loadData();
    setShowManualModal(false);
    alert("Lectura manual registrada.");
  };

  const handleSync = async () => {
    if (!account) return;
    setLoading(true);
    setShowTerminal(true);
    setTerminalLines(["[SYSTEM] Inicializando entorno de análisis telemático..."]);
    
    const res = await storageService.simulateWaterSync(account.id, (msg) => {
      setTerminalLines(prev => [...prev, msg]);
    });

    setTimeout(() => {
      loadData();
      setLoading(false);
      if (res.success) {
        setTerminalLines(prev => [...prev, `[SUCCESS] ${res.message}`]);
      } else {
        setTerminalLines(prev => [...prev, `[ERROR] ${res.message}`]);
      }
    }, 1000);
  };

  if (!account) {
    return (
      <div className="w-full max-w-sm mx-auto p-10 text-center space-y-6">
        <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto animate-pulse">
          <Droplets className="w-10 h-10 text-blue-500" />
        </div>
        <h2 className="text-xl font-black uppercase">Configurando Canal...</h2>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
          Sincronizando parámetros telemáticos con el servidor central. Por favor, espere.
        </p>
        <div className="space-y-3">
          <button 
            onClick={() => {
              setAccount(storageService.getWaterAccount());
              setShowConfigModal(true);
            }}
            className="w-full p-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20"
          >
            Configurar Manualmente
          </button>
          <button 
            onClick={() => onNavigate(AppTab.HOME)}
            className="w-full p-5 bg-gray-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest"
          >
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  const getNextCycleTime = () => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(now.getHours() + 1);
    next.setMinutes(0);
    next.setSeconds(0);
    return next.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-full max-w-sm mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate(AppTab.HOME)} className="w-10 h-10 bg-white border border-gray-100 rounded-xl flex items-center justify-center text-gray-400 active:scale-90 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter text-gray-900 leading-none">Agua Principal</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Telemetría Aguas de Alicante</p>
          </div>
        </div>
        <div className="flex gap-2">
           <div className="text-[8px] font-mono text-gray-400 self-center mr-2">
             R: {readings.length} | A: {account.status}
           </div>
           <button 
            onClick={async () => {
              await storageService.seedWaterData();
              loadData();
              alert("Datos forzados. Compruebe si aparecen.");
            }}
            className="p-3 bg-white border border-gray-100 rounded-xl text-gray-400 shadow-sm active:scale-90"
            title="Forzar Carga de Datos"
          >
            <Database className="w-5 h-5" />
          </button>
          <button onClick={() => setShowConfigModal(true)} className="p-3 bg-white border border-gray-100 rounded-xl text-gray-400 shadow-sm active:scale-90"><Settings className="w-5 h-5" /></button>
           <div className="w-12 h-12 bg-white border border-gray-100 rounded-2xl flex items-center justify-center shadow-sm active:scale-95 transition-all" onClick={() => onNavigate(AppTab.HOME)}>
              <LayoutGrid className="w-5 h-5 text-tactical-orange" />
           </div>
        </div>
      </div>

      {/* TERMINAL / DEBUG CONSOLE */}
      {showTerminal && (
        <div className="bg-gray-900 rounded-[2rem] p-6 mx-2 border border-gray-800 shadow-2xl space-y-4 animate-in slide-in-from-top-4">
           <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                 <Terminal className="w-4 h-4 text-green-500" />
                 <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Puppeteer Analysis Engine</span>
              </div>
              <button onClick={() => setShowTerminal(false)} className="text-gray-600 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
           </div>
           <div className="h-40 overflow-y-auto font-mono text-[9px] text-green-400/80 space-y-1.5 scrollbar-hide">
              {terminalLines.map((line, i) => (
                <div key={i} className="flex gap-2">
                   <span className="text-gray-700 shrink-0 select-none">$</span>
                   <span className="leading-relaxed">{line}</span>
                </div>
              ))}
              <div ref={terminalEndRef} />
           </div>
        </div>
      )}

      {/* SYNC STATUS BAR */}
      <div className="bg-white border border-gray-100 rounded-[2rem] p-4 mx-2 flex items-center justify-between shadow-sm">
         <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${account.status === 'conectada' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-[9px] font-black uppercase text-gray-500">{account.status === 'conectada' ? 'Telemando En Línea' : 'Error de Conexión'}</span>
         </div>
         <button onClick={handleSync} disabled={loading} className="p-3 bg-white border border-gray-100 text-gray-900 rounded-2xl flex items-center gap-2 text-[8px] font-black uppercase tracking-widest active:scale-95 disabled:opacity-50 shadow-sm">
            {loading ? <RefreshCw className="w-3 h-3 animate-spin text-tactical-orange" /> : <RefreshCw className="w-3 h-3 text-tactical-orange" />} {loading ? 'Escaneando...' : 'Analizar Web'}
         </button>
      </div>

      {/* AUTOMATION STATUS GRID */}
      <div className="grid grid-cols-2 gap-4 px-2">
        <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-blue-50 rounded-xl">
              <RefreshCw className={`w-4 h-4 text-blue-500 ${loading ? 'animate-spin' : ''}`} />
            </div>
            <div className="px-2 py-1 bg-green-50 text-green-600 rounded-lg text-[8px] font-black uppercase">Auto</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Próximo Ciclo</div>
            <div className="text-lg font-black text-gray-900">{getNextCycleTime()}</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-purple-50 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-purple-500" />
            </div>
            <div className="px-2 py-1 bg-purple-50 text-purple-600 rounded-lg text-[8px] font-black uppercase">OK</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Estado Motor</div>
            <div className="text-lg font-black text-gray-900">Activo</div>
          </div>
        </div>
      </div>

      {/* COMPARATIVE CARDS GRID */}
      <div className="grid grid-cols-2 gap-4 px-2">
         <div className="bg-blue-600 p-6 rounded-[2.5rem] text-white shadow-xl space-y-1 relative overflow-hidden">
            <span className="text-[8px] font-black uppercase opacity-60 tracking-widest">Consumo Ayer</span>
            <div className="flex items-baseline gap-1">
               <span className="text-4xl font-black">{stats.yesterday.toFixed(1)}</span>
               <span className="text-xs font-bold opacity-60 uppercase">m³</span>
            </div>
            <div className={`flex items-center gap-1 text-[8px] font-black uppercase bg-white/20 px-2 py-0.5 rounded-full w-fit ${trendToday.val > 0 ? 'text-red-300' : 'text-green-300'}`}>
               {trendToday.icon} {trendToday.val > 0 ? '+' : ''}{trendToday.val.toFixed(0)}% vs media
            </div>
            <Droplets className="absolute -right-4 -bottom-4 w-20 h-20 opacity-10 -rotate-12" />
         </div>

         <div className="bg-white border border-gray-100 p-6 rounded-[2.5rem] shadow-sm space-y-4">
            <div className="space-y-1">
               <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Consumo Total</span>
               <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-gray-900">{stats.total.toFixed(0)}</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">m³</span>
               </div>
               <p className="text-[7px] font-bold text-gray-400 uppercase">Histórico Registrado</p>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
               <div className="h-full bg-blue-500" style={{ width: '100%' }} />
            </div>
         </div>

         <div className="col-span-2 bg-gray-900 rounded-[2.5rem] p-6 text-white shadow-2xl flex items-center justify-between">
            <div className="space-y-1">
               <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Acumulado Mes</span>
               <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-blue-400">{stats.month.toFixed(0)}</span>
                  <span className="text-sm font-bold text-gray-500 uppercase">m³</span>
               </div>
               <p className="text-[9px] font-bold text-gray-500 uppercase">vs {stats.monthPrev.toFixed(0)} m³ en {new Date(new Date().setMonth(new Date().getMonth()-1)).toLocaleString('es-ES', { month: 'short' })}</p>
            </div>
            <div className="p-4 bg-white/5 rounded-3xl border border-white/10 text-center">
               <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest block mb-1">Media 30d</span>
               <div className="text-xl font-black">{stats.avg.toFixed(1)}</div>
               <span className="text-[7px] font-bold text-gray-600 uppercase">m³/Día</span>
            </div>
         </div>
      </div>

      {/* EVOLUTION CHART */}
      <section className="bg-white border border-gray-100 rounded-[2.5rem] p-8 mx-2 shadow-sm space-y-6">
         <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
               <BarChart3 className="w-4 h-4 text-blue-500" /> Evolución 15 Días
            </h3>
            <div className="flex items-center gap-2 text-[8px] font-black text-green-500 uppercase">
               <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Media Diaria
            </div>
         </div>
         
         <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={chartData}>
                  <defs>
                     <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                     </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 8, fill: '#94a3b8', fontWeight: 800}} dy={10} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px' }}
                    cursor={{ stroke: '#3b82f6', strokeWidth: 2 }}
                  />
                  <ReferenceLine y={stats.avg} stroke="#22c55e" strokeDasharray="5 5" label={{ position: 'right', value: 'MEDIA', fontSize: 7, fill: '#22c55e', fontWeight: 'bold' }} />
                  <ReferenceLine y={account.peakThresholdM3} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'left', value: 'ALERTA', fontSize: 7, fill: '#ef4444', fontWeight: 'bold' }} />
                  <Area 
                    type="monotone" 
                    dataKey="consumo" 
                    stroke="#3b82f6" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorWater)" 
                    animationDuration={1500}
                  />
               </AreaChart>
            </ResponsiveContainer>
         </div>
      </section>

      {/* RECENT READINGS LIST */}
      <section className="space-y-4 px-2">
         <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
               <History className="w-4 h-4" /> Histórico de Lecturas
            </h3>
            <div className="flex gap-2">
               <button onClick={() => setShowManualModal(true)} className="p-2.5 bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-blue-500 transition-colors active:scale-90 shadow-sm"><Keyboard className="w-4 h-4" /></button>
               <button className="p-2.5 bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-green-500 transition-colors active:scale-90 shadow-sm"><FileSpreadsheet className="w-4 h-4" /></button>
            </div>
         </div>

         <div className="bg-white border border-gray-100 rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className="divide-y divide-gray-50">
               {readings.slice(0, 7).map((r, idx) => (
                  <div key={`${r.id}-${idx}`} className={`p-5 flex items-center justify-between group transition-all ${r.isPeak ? 'bg-red-50/50' : 'hover:bg-gray-50'}`}>
                     <div className="flex items-center gap-4">
                        <div className={`p-2.5 rounded-2xl flex items-center justify-center shrink-0 ${r.isPeak ? 'bg-red-100 text-red-600' : r.origin === 'telematica' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                           {r.isPeak ? <AlertTriangle className="w-4 h-4 animate-bounce" /> : r.origin === 'telematica' ? <Globe className="w-4 h-4" /> : <Keyboard className="w-4 h-4" />}
                        </div>
                        <div>
                           <div className="text-[10px] font-black text-gray-900 uppercase">{new Date(r.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long' })}</div>
                           <div className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{r.origin === 'telematica' ? 'Sync Portal Aguas' : 'Entrada Manual'}</div>
                        </div>
                     </div>
                     <div className="text-right">
                        <div className="text-xs font-black text-gray-900 leading-none">{r.consumption1?.toFixed(1)} m³</div>
                        <div className={`text-[8px] font-black uppercase mt-1.5 ${r.isPeak ? 'text-red-500' : 'text-green-500'}`}>
                           {r.isPeak ? 'PICO DETECTADO' : 'NORMAL'}
                        </div>
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </section>

      {/* MODAL CONFIGURACIÓN */}
      {showConfigModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="w-full max-w-sm bg-white rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <header className="p-6 bg-gray-900 text-white flex justify-between items-center shrink-0 border-b border-white/5">
                 <div className="flex items-center gap-3">
                    <Settings className="w-6 h-6 text-yellow-400" />
                    <h3 className="text-lg font-black uppercase tracking-tight">Scraper Config</h3>
                 </div>
                 <button onClick={() => setShowConfigModal(false)} className="p-2 text-white/30 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
              </header>

              <main className="flex-1 overflow-y-auto p-8 space-y-8">
                 <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                       <Key className="w-4 h-4 text-blue-500" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Acceso Portal Cliente</span>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Usuario Web (CIF/DNI)</label>
                       <input 
                         type="text" 
                         value={account.webUser}
                         onChange={e => setAccount({...account, webUser: e.target.value})}
                         className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[11px] font-bold outline-none focus:ring-2 ring-blue-500/20"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Contraseña Portal</label>
                       <input 
                         type="password" 
                         value={account.password || ''}
                         onChange={e => setAccount({...account, password: e.target.value})}
                         className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[11px] font-bold outline-none focus:ring-2 ring-blue-500/20"
                       />
                    </div>
                 </div>

                 {/* Advanced Selectors Section */}
                 <div className="space-y-4 bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                       <Search className="w-4 h-4 text-purple-500" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Selectores DOM (Análisis)</span>
                    </div>
                    <div className="space-y-3">
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-gray-400 uppercase px-1">Input Usuario</label>
                          <input 
                            type="text" 
                            value={account.selectors?.userField}
                            onChange={e => setAccount({...account, selectors: { ...account.selectors!, userField: e.target.value }})}
                            className="w-full p-3 bg-white border border-gray-100 rounded-xl text-[9px] font-mono outline-none"
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-gray-400 uppercase px-1">Input Password</label>
                          <input 
                            type="text" 
                            value={account.selectors?.passField}
                            onChange={e => setAccount({...account, selectors: { ...account.selectors!, passField: e.target.value }})}
                            className="w-full p-3 bg-white border border-gray-100 rounded-xl text-[9px] font-mono outline-none"
                          />
                       </div>
                    </div>
                 </div>

                 <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 space-y-6">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-amber-200 rounded-xl text-amber-700"><Gauge className="w-5 h-5" /></div>
                       <span className="text-[10px] font-black uppercase tracking-widest text-amber-900">Parámetros de Alerta</span>
                    </div>
                    <div className="space-y-2">
                       <div className="flex justify-between items-center text-[9px] font-black uppercase">
                          <span className="text-amber-800">Sensibilidad Pico (%)</span>
                          <span className="bg-amber-200 px-2 py-0.5 rounded text-amber-900">{account.peakThresholdPercent}%</span>
                       </div>
                       <input 
                        type="range" min="10" max="200" step="5"
                        value={account.peakThresholdPercent}
                        onChange={e => setAccount({...account, peakThresholdPercent: parseInt(e.target.value)})}
                        className="w-full h-1.5 bg-amber-200 rounded-lg appearance-none accent-amber-600 cursor-pointer" 
                       />
                    </div>
                 </div>
              </main>

              <footer className="p-8 bg-gray-50 border-t border-gray-100 shrink-0">
                 <button 
                  onClick={() => { storageService.saveWaterAccount(account); setShowConfigModal(false); loadData(); }}
                  className="w-full p-6 bg-gray-900 text-yellow-400 rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all"
                 >
                    Guardar Parámetros
                 </button>
              </footer>
           </div>
        </div>
      )}

      {/* MODAL ENTRADA MANUAL */}
      {showManualModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="w-full max-w-sm bg-white rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <header className="p-6 bg-blue-600 text-white flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-3">
                    <Keyboard className="w-6 h-6" />
                    <h3 className="text-lg font-black uppercase tracking-tight">Entrada Manual</h3>
                 </div>
                 <button onClick={() => setShowManualModal(false)} className="p-2 text-white/30 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
              </header>

              <main className="flex-1 overflow-y-auto p-8 space-y-6">
                 <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Fecha de Lectura</label>
                       <input 
                         type="date" 
                         value={manualForm.date}
                         onChange={e => setManualForm({...manualForm, date: e.target.value})}
                         className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[11px] font-bold outline-none"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Lectura Contador (m³ Acum.)</label>
                       <input 
                         type="number" 
                         value={manualForm.value}
                         onChange={e => setManualForm({...manualForm, value: parseFloat(e.target.value) || 0})}
                         placeholder="Ej: 12467"
                         className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[11px] font-bold outline-none"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Consumo del Periodo (m³)</label>
                       <input 
                         type="number" 
                         value={manualForm.consumption}
                         onChange={e => setManualForm({...manualForm, consumption: parseFloat(e.target.value) || 0})}
                         placeholder="Ej: 8.5"
                         className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[11px] font-bold outline-none"
                       />
                    </div>
                 </div>
                 
                 <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex gap-3">
                    <Info className="w-4 h-4 text-blue-500 shrink-0" />
                    <p className="text-[8px] font-bold text-blue-800 uppercase leading-snug">Utilice esta opción si el portal de Aguas de Alicante presenta caídas de servicio.</p>
                 </div>
              </main>

              <footer className="p-8 bg-gray-50 border-t border-gray-100 shrink-0">
                 <button 
                  onClick={handleManualEntry}
                  className="w-full p-6 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all"
                 >
                    Registrar en SIGAI
                 </button>
              </footer>
           </div>
        </div>
      )}

    </div>
  );
};

export default WaterSyncModule;
