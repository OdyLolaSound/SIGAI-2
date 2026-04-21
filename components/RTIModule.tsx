
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ClipboardCheck, 
  Search, 
  MapPin, 
  AlertTriangle, 
  Euro, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Upload, 
  FileText,
  ChevronRight,
  Filter,
  ArrowRight,
  TrendingUp,
  LayoutGrid,
  ShieldCheck,
  Zap,
  Building2
} from 'lucide-react';
import { RTIWork, RTIReport } from '../types';
import { storageService } from '../services/storageService';

export const RTIModule: React.FC = () => {
  const [works, setWorks] = useState<RTIWork[]>([]);
  const [reports, setReports] = useState<RTIReport[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<'ALFEREZ' | 'MOREJON' | 'OTROS' | 'ALL'>('ALL');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const loadData = () => {
      setWorks(storageService.getRTIWorks());
      setReports(storageService.getRTIReports());
    };
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  const latestReport = useMemo(() => {
    if (reports.length === 0) return null;
    return reports.sort((a, b) => b.inspectionDate.localeCompare(a.inspectionDate))[0];
  }, [reports]);

  const filteredWorks = useMemo(() => {
    return works.filter(work => {
      const matchesSearch = 
        work.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        work.location.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesUnit = selectedUnit === 'ALL' || work.unitId === selectedUnit;
      return matchesSearch && matchesUnit;
    });
  }, [works, searchQuery, selectedUnit]);

  const toggleStatus = async (work: RTIWork) => {
    const updatedWork: RTIWork = {
      ...work,
      status: work.status === 'pendiente' ? 'ejecutado' : 'pendiente',
      updatedAt: new Date().toISOString()
    };
    await storageService.saveRTIWork(updatedWork);
  };

  const handleFileUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      alert('Simulación: Informe subido correctamente.');
    }, 2000);
  };

  const stats = useMemo(() => {
    const pending = works.filter(w => w.status === 'pendiente');
    const executed = works.filter(w => w.status === 'ejecutado');
    return {
      pendingCount: pending.length,
      executedCount: executed.length,
      pendingBudget: pending.reduce((acc, w) => acc + (w.estimatedCost || 0), 0),
      executedBudget: executed.reduce((acc, w) => acc + (w.estimatedCost || 0), 0),
    };
  }, [works]);

  return (
    <div className="flex flex-col w-full max-w-sm md:max-w-7xl mx-auto bg-gray-50 min-h-screen pb-20">
      {/* TACTICAL HEADER */}
      <section className="bg-black text-white p-6 pt-10 rounded-b-[2.5rem] shadow-2xl relative overflow-hidden text-left">
        <div className="absolute top-0 right-0 w-64 h-64 bg-tactical-orange/10 rounded-full blur-3xl -mr-20 -mt-20 shrink-0" />
        
        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-tactical-orange rounded-2xl shadow-[0_0_20px_rgba(242,125,38,0.4)]">
                <ClipboardCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-4xl font-black tracking-tighter uppercase leading-none">RTI INFRA</h1>
                <p className="text-[10px] md:text-sm text-gray-400 font-bold uppercase tracking-widest mt-1">Gestión Técnica • SIGAI v1.6</p>
              </div>
            </div>
            
            <button 
              onClick={handleFileUpload}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl border border-white/10 transition-all active:scale-95"
            >
              <Upload className="w-5 h-5 text-tactical-orange" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* BENTO STATS SUMMARY */}
            <div className="grid grid-cols-2 gap-3 md:col-span-2">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white/5 backdrop-blur-md rounded-3xl p-4 md:p-8 border border-white/10"
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                  <span className="text-[8px] md:text-[10px] font-black uppercase text-gray-400">Pendientes</span>
                </div>
                <div className="text-xl md:text-4xl font-black">{stats.pendingCount}</div>
                <div className="text-[9px] md:text-xs font-bold text-gray-500 mt-1">
                  {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(stats.pendingBudget)}
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white/5 backdrop-blur-md rounded-3xl p-4 md:p-8 border border-white/10"
              >
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  <span className="text-[8px] md:text-[10px] font-black uppercase text-gray-400">Ejecutado</span>
                </div>
                <div className="text-xl md:text-4xl font-black text-green-400">{stats.executedCount}</div>
                <div className="text-[9px] md:text-xs font-bold text-gray-500 mt-1">
                  {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(stats.executedBudget)}
                </div>
              </motion.div>
            </div>

            {latestReport && (
              <div className="flex flex-col justify-center gap-3 bg-tactical-orange/20 p-5 md:p-8 rounded-3xl border border-tactical-orange/30">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-tactical-orange" />
                  <div className="text-[10px] md:text-xs font-black uppercase text-tactical-orange tracking-widest">Informe Vigente (Bienal)</div>
                </div>
                <div className="text-xs md:text-lg font-bold text-white leading-tight">Última Inspección: {latestReport.inspectionDate}</div>
                <div className="text-[10px] md:text-sm font-bold text-tactical-orange/80 uppercase">Próxima Revisión: {latestReport.nextInspectionDate}</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SEARCH AND FILTERS */}
      <div className="p-4 md:p-8 -mt-6 md:-mt-10 relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-8 bg-white rounded-[2rem] shadow-xl p-2 flex items-center gap-2 border border-gray-100">
            <div className="p-3 bg-gray-50 rounded-2xl">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <input 
              type="text" 
              placeholder="Buscar obra o ubicación..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm md:text-base font-bold uppercase placeholder:text-gray-300"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="md:col-span-4 flex gap-2 overflow-x-auto no-scrollbar md:justify-end">
            {(['ALL', 'ALFEREZ', 'MOREJON', 'OTROS'] as const).map(unit => (
              <button
                key={unit}
                onClick={() => setSelectedUnit(unit)}
                className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap
                  ${selectedUnit === unit 
                    ? 'bg-black text-tactical-orange shadow-lg' 
                    : 'bg-white text-gray-400 border border-gray-100 hover:border-gray-900'}`}
              >
                {unit === 'ALL' ? 'Todos' : unit}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* WORKS LIST */}
      <main className="px-4 md:px-8 space-y-12">
        {['ALFEREZ', 'MOREJON', 'OTROS'].map(unitId => {
          const unitWorks = filteredWorks.filter(w => w.unitId === unitId);
          if (unitWorks.length === 0 && selectedUnit !== 'ALL') return null;
          if (selectedUnit !== 'ALL' && selectedUnit !== unitId) return null;

          return (
            <section key={unitId} className="space-y-6">
              <div className="flex items-center gap-3 px-2">
                <div className="w-1.5 h-8 bg-tactical-orange rounded-full" />
                <h2 className="text-sm md:text-xl font-black uppercase tracking-[0.2em] text-gray-900">
                  {unitId === 'ALFEREZ' ? 'Acueratlamiento Alférez Rojas' : 
                   unitId === 'MOREJON' ? 'Residencia Cabo Roig (Morejón)' : 'Otras Instalaciones'}
                </h2>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest hidden md:block">Total Actuaciones</span>
                  <span className="text-[10px] md:text-sm font-black text-white bg-black px-4 py-1 rounded-full">
                    {unitWorks.length}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {unitWorks.map((work, idx) => (
                  <motion.div
                    key={work.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => toggleStatus(work)}
                    className={`bg-white rounded-[2.5rem] p-7 border-2 border-gray-100 shadow-sm relative overflow-hidden group active:scale-[0.98] transition-all hover:border-tactical-orange/30 flex flex-col h-full text-left
                      ${work.status === 'ejecutado' ? 'bg-green-50/20 border-green-100' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl ${work.status === 'ejecutado' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                          {work.status === 'ejecutado' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-[11px] font-black uppercase text-gray-900 leading-none">{work.location}</p>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1.5">ID: {work.id.split('-')[0]}</p>
                        </div>
                      </div>
                      
                      {work.estimatedCost ? (
                        <div className="text-sm font-black text-gray-900 bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100 font-mono shadow-sm">
                          {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(work.estimatedCost)}
                        </div>
                      ) : (
                        <div className="text-[9px] font-black text-gray-400 px-4 py-2 bg-gray-50 rounded-2xl uppercase tracking-tighter italic">Pte. Valoración</div>
                      )}
                    </div>

                    <h3 className="text-sm md:text-base font-bold text-gray-800 leading-relaxed mb-8 uppercase tracking-tight flex-1">
                      {work.description}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-gray-50">
                      <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border
                        ${work.priorityStatus === 'Imprescindible' ? 'bg-red-50 text-red-600 border-red-100' : 
                          work.priorityStatus === 'Conveniente' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                          'bg-gray-50 text-gray-400 border-gray-100'}`}>
                        {work.priorityStatus || work.priority}
                      </div>

                      <div className="flex items-center gap-2">
                        {work.proposedYears.map(year => (
                          <span key={year} className="text-[9px] font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-xl">
                            {year}
                          </span>
                        ))}
                      </div>

                      <div className="ml-auto group/btn flex items-center gap-2 px-4 py-2.5 bg-black rounded-2xl text-white active:scale-95 transition-all cursor-pointer">
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          {work.status === 'pendiente' ? 'Marcar Ejecutado' : 'Revertir'}
                        </span>
                        <ChevronRight className="w-4 h-4 text-tactical-orange group-hover/btn:translate-x-1 transition-transform" />
                      </div>
                    </div>

                    {/* Progress Indicator if executed */}
                    {work.status === 'ejecutado' && (
                      <div className="absolute top-0 right-0 p-3">
                        <div className="flex items-center gap-2 bg-green-500 text-white px-3 py-1 rounded-bl-2xl rounded-tr-none text-[8px] font-black uppercase tracking-widest absolute top-0 right-0">
                          <Zap className="w-3 h-3 fill-current" /> Finalizado
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </section>
          );
        })}
      </main>

      {/* FOOTER OBSERVATIONS RESPONSIVE */}
      <div className="p-4 md:p-8 mt-10">
        <div className="bg-gray-900 text-white rounded-[3rem] p-8 md:p-16 space-y-8 relative overflow-hidden shadow-2xl text-left">
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-tactical-orange/5 rounded-full blur-3xl opacity-50" />
          
          <div className="flex items-center gap-6">
            <div className="p-4 bg-white/10 rounded-3xl shrink-0">
              <Info className="w-8 h-8 text-tactical-orange" />
            </div>
            <div>
              <h3 className="text-lg md:text-2xl font-black uppercase tracking-widest leading-none mb-2">Observaciones Técnicas e Infraestructura</h3>
              <p className="text-[10px] md:text-sm text-gray-500 font-bold uppercase tracking-widest italic">Análisis de Priorización Estratégica</p>
            </div>
          </div>

          <p className="text-xs md:text-base text-gray-400 leading-relaxed font-bold uppercase tracking-tight max-w-4xl">
            La prioridad de las actuaciones se basa en criterios marcados por la Inspección General del Ejército y necesidades sobrevenidas por normativa (PRL, Amianto, PCI). 
            Se debe dar traslado de este resumen a la Jefatura de Propiedades periódicamente para actualización del Plan de Infraestructuras 2026-2028.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
             <div className="p-6 bg-white/5 border border-white/10 rounded-3xl flex flex-col gap-4 transition-all hover:bg-white/10 group cursor-default">
               <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl w-fit group-hover:scale-110 transition-transform">
                 <FileText className="w-6 h-6" />
               </div>
               <div>
                 <div className="text-[10px] font-black text-gray-500 uppercase leading-none mb-2">Cobertura Amianto</div>
                 <div className="text-2xl font-black">85% <span className="text-xs text-green-500 ml-1">+2%</span></div>
               </div>
             </div>
             <div className="p-6 bg-white/5 border border-white/10 rounded-3xl flex flex-col gap-4 transition-all hover:bg-white/10 group cursor-default">
               <div className="p-3 bg-red-500/20 text-red-500 rounded-2xl w-fit group-hover:scale-110 transition-transform">
                 <AlertTriangle className="w-6 h-6" />
               </div>
               <div>
                 <div className="text-[10px] font-black text-gray-500 uppercase leading-none mb-2">Riesgo Estructural</div>
                 <div className="text-2xl font-black uppercase tracking-tight text-green-400">Controlado</div>
               </div>
             </div>
             <div className="p-6 bg-white/5 border border-white/10 rounded-3xl flex flex-col gap-4 transition-all hover:bg-white/10 group cursor-default">
               <div className="p-3 bg-yellow-400/20 text-yellow-400 rounded-2xl w-fit group-hover:scale-110 transition-transform">
                 <Zap className="w-6 h-6" />
               </div>
               <div>
                 <div className="text-[10px] font-black text-gray-500 uppercase leading-none mb-2">Eficiencia Energ.</div>
                 <div className="text-2xl font-black">Nivel B</div>
               </div>
             </div>
             <div className="p-6 bg-white/5 border border-white/10 rounded-3xl flex flex-col gap-4 transition-all hover:bg-white/10 group cursor-default">
               <div className="p-3 bg-tactical-orange/20 text-tactical-orange rounded-2xl w-fit group-hover:scale-110 transition-transform">
                 <Building2 className="w-6 h-6" />
               </div>
               <div>
                 <div className="text-[10px] font-black text-gray-500 uppercase leading-none mb-2">Infra. Crítica</div>
                 <div className="text-2xl font-black">3 Nodos</div>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple Info component for observations
const Info: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);
