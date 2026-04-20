
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
  ArrowRight
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
    // In a real app, we'd have a listener setup
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

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans">
      {/* HEADER SECTION - TECHNICAL DASHBOARD STYLE */}
      <header className="border-b border-[#141414] p-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <ClipboardCheck className="w-8 h-8" />
              <h1 className="font-serif italic text-4xl tracking-tight uppercase">RTI</h1>
            </div>
            <p className="font-mono text-xs opacity-60 uppercase tracking-widest">
              Revista Técnica de la Infraestructura • Registro Bienal
            </p>
          </div>

          <AnimatePresence mode="wait">
            {latestReport && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-[#141414] p-4 flex flex-col md:flex-row gap-8 shadow-[4px_4px_0px_#141414]"
              >
                <div>
                  <label className="font-serif italic text-[10px] uppercase opacity-50 block mb-1">Última Revisión</label>
                  <div className="font-mono font-bold flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {latestReport.inspectionDate}
                  </div>
                </div>
                <div>
                  <label className="font-serif italic text-[10px] uppercase opacity-50 block mb-1">Próxima Revisión</label>
                  <div className="font-mono font-bold flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {latestReport.nextInspectionDate}
                  </div>
                </div>
                <div>
                  <label className="font-serif italic text-[10px] uppercase opacity-50 block mb-1">Estado</label>
                  <div className={`font-mono font-bold px-2 py-0.5 border border-current flex items-center gap-2 ${latestReport.status === 'vigente' ? 'text-green-700' : 'text-red-700'}`}>
                    <CheckCircle2 className="w-4 h-4" />
                    {latestReport.status.toUpperCase()}
                  </div>
                </div>
                <button 
                  onClick={handleFileUpload}
                  disabled={isUploading}
                  className="bg-[#141414] text-[#E4E3E0] px-4 py-2 font-mono text-xs hover:bg-[#333] transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {isUploading ? 'SUBIENDO...' : 'NUEVA REVISTA'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* FILTER BAR */}
      <div className="border-b border-[#141414] bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row">
          <div className="flex-1 flex items-center border-b md:border-b-0 md:border-r border-[#141414] px-4 py-2">
            <Search className="w-5 h-5 opacity-40 mr-3" />
            <input 
              type="text" 
              placeholder="BUSCAR OBRA POR DESCRIPCIÓN O UBICACIÓN..."
              className="w-full bg-transparent border-none focus:ring-0 font-mono text-sm uppercase p-2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center overflow-x-auto no-scrollbar">
            {(['ALL', 'ALFEREZ', 'MOREJON', 'OTROS'] as const).map(unit => (
              <button
                key={unit}
                onClick={() => setSelectedUnit(unit)}
                className={`px-6 py-4 font-serif italic text-xs uppercase tracking-widest border-r border-[#141414] transition-all whitespace-nowrap
                  ${selectedUnit === unit ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-[#f0f0f0]'}`}
              >
                {unit === 'ALL' ? 'Ver Todos' : unit}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT - DATA GRID */}
      <main className="max-w-7xl mx-auto p-8">
        <div className="grid grid-cols-1 gap-12">
          {['ALFEREZ', 'MOREJON', 'OTROS'].map(unitId => {
            const unitWorks = filteredWorks.filter(w => w.unitId === unitId);
            if (unitWorks.length === 0 && selectedUnit !== 'ALL') return null;
            if (selectedUnit !== 'ALL' && selectedUnit !== unitId) return null;

            return (
              <section key={unitId} className="border border-[#141414] bg-white shadow-[8px_8px_0px_#141414]">
                <div className="bg-[#141414] text-[#E4E3E0] p-4 border-b border-[#141414] flex justify-between items-center">
                  <h2 className="font-serif italic text-xl uppercase tracking-tighter">
                    {unitId === 'ALFEREZ' ? 'Acuartelamiento Alférez Rojas Navarrete' : 
                     unitId === 'MOREJON' ? 'Cabo Roig (Morejón)' : 'Otros Establecimientos'}
                  </h2>
                  <span className="font-mono text-xs opacity-70">{unitWorks.length} ACCIONES</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead>
                      <tr className="border-b border-[#141414] bg-[#f9f9f9]">
                        <th className="p-4 font-serif italic text-[11px] uppercase opacity-50 tracking-tighter">Loc.</th>
                        <th className="p-4 font-serif italic text-[11px] uppercase opacity-50 tracking-tighter">Descripción de la Obra</th>
                        <th className="p-4 font-serif italic text-[11px] uppercase opacity-50 tracking-tighter">Presupuesto</th>
                        <th className="p-4 font-serif italic text-[11px] uppercase opacity-50 tracking-tighter">Prioridad</th>
                        <th className="p-4 font-serif italic text-[11px] uppercase opacity-50 tracking-tighter">Riesgo</th>
                        <th className="p-4 font-serif italic text-[11px] uppercase opacity-50 tracking-tighter">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-sm">
                      {unitWorks.map(work => (
                        <tr 
                          key={work.id} 
                          className="border-b border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors group cursor-pointer"
                          onClick={() => toggleStatus(work)}
                        >
                          <td className="p-4 align-top w-48">
                            <div className="flex items-start gap-2">
                              <MapPin className="w-3 h-3 mt-1 opacity-50" />
                              <span className="leading-tight">{work.location}</span>
                            </div>
                          </td>
                          <td className="p-4 align-top max-w-md">
                            <div className="font-bold mb-1 uppercase leading-tight">{work.description}</div>
                            <div className="flex flex-wrap gap-2">
                              {work.proposedYears.map(year => (
                                <span key={year} className="text-[10px] border border-current px-1 opacity-70 group-hover:opacity-100">{year}</span>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 align-top whitespace-nowrap">
                            {work.estimatedCost ? (
                              <div className="flex items-center gap-1 font-bold">
                                {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(work.estimatedCost)}
                              </div>
                            ) : (
                              <span className="opacity-30">EN ESTUDIO</span>
                            )}
                          </td>
                          <td className="p-4 align-top">
                            <span className={`px-2 py-0.5 border border-current text-[10px] font-bold ${
                              work.priorityStatus === 'Imprescindible' ? 'bg-red-900/10 text-red-700 group-hover:text-red-300' :
                              work.priorityStatus === 'Conveniente' ? 'bg-blue-900/10 text-blue-700 group-hover:text-blue-300' :
                              'opacity-50'
                            }`}>
                              {work.priorityStatus || work.priority}
                            </span>
                          </td>
                          <td className="p-4 align-top">
                            <div className="flex items-center gap-1 text-[10px] opacity-70">
                              <AlertTriangle className="w-3 h-3" />
                              {work.risk}
                            </div>
                          </td>
                          <td className="p-4 align-top w-32">
                            <div className={`flex items-center gap-2 px-3 py-1 border border-current rounded-full text-[10px] font-bold uppercase transition-all
                              ${work.status === 'ejecutado' 
                                ? 'bg-green-700 text-white border-green-700 group-hover:bg-[#E4E3E0] group-hover:text-green-800 group-hover:border-transparent' 
                                : 'opacity-40 group-hover:opacity-100 group-hover:bg-[#E4E3E0] group-hover:text-[#141414] group-hover:border-transparent'}`}>
                              {work.status === 'ejecutado' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                              {work.status}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>

        {/* SUMMARY SECTION */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="border border-[#141414] p-6 bg-white shadow-[4px_4px_0px_#141414]">
            <h3 className="font-serif italic text-xl mb-4 border-b border-[#141414] pb-2">RESUMEN ECONÓMICO</h3>
            <div className="space-y-4 font-mono">
              <div className="flex justify-between border-b border-[#eee] pb-2">
                <span className="opacity-50">TOTAL PENDIENTE</span>
                <span className="font-bold">
                  {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
                    works.filter(w => w.status === 'pendiente').reduce((acc, w) => acc + (w.estimatedCost || 0), 0)
                  )}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#eee] pb-2 text-green-700">
                <span className="opacity-50 uppercase">EJECUTADO 2024-25</span>
                <span className="font-bold">
                   {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
                    works.filter(w => w.status === 'ejecutado').reduce((acc, w) => acc + (w.estimatedCost || 0), 0)
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 border border-[#141414] p-6 bg-white shadow-[4px_4px_0px_#141414]">
            <h3 className="font-serif italic text-xl mb-4 border-b border-[#141414] pb-2">OBSERVACIONES TÉCNICAS</h3>
            <p className="font-mono text-sm leading-relaxed opacity-80">
              La prioridad de las actuaciones se basa en criterios marcados por la Inspección General del Ejército y necesidades sobrevenidas por normativa (PRL, Amianto, PCI). 
              Se debe dar traslado de este resumen a la Jefatura de Propiedades periódicamente para actualización del Plan de Infraestructuras.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-[#141414] text-[#E4E3E0] font-mono text-[10px]">
                <FileText className="w-3 h-3" />
                COBERTURA AMIANTO: 85%
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-[#141414] text-[#E4E3E0] font-mono text-[10px]">
                <AlertTriangle className="w-3 h-3" />
                RIESGO ESTRUCTURAL: CONTROLADO
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-20 border-t border-[#141414] p-8 text-center bg-[#141414] text-[#E4E3E0]">
        <div className="font-mono text-[10px] tracking-widest uppercase opacity-40">
          Unidad de Servicios de Acuartelamiento • Sección de Mantenimiento • {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
};
