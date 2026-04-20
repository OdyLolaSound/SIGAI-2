
import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Trash2, Download, CheckCircle2, Globe, FileSpreadsheet, LayoutGrid, Zap, Droplets, Filter, X, Fuel, Thermometer, Wrench, Package, ClipboardList, Warehouse } from 'lucide-react';
import { Reading, ServiceType, Building, Role, AppTab } from '../types';
import { storageService, BUILDINGS } from '../services/storageService';
import * as XLSX from 'xlsx';

interface HistoryProps {
  serviceType?: ServiceType;
  building?: Building;
  role: Role;
  onNavigate: (tab: AppTab) => void;
}

const History: React.FC<HistoryProps> = ({ serviceType: initialServiceType, building, role, onNavigate }) => {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [filterService, setFilterService] = useState<ServiceType | 'all'>(initialServiceType || 'all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const sType = filterService === 'all' ? undefined : filterService;
    setReadings(storageService.getReadings(building?.id, sType).reverse());
  }, [building?.id, filterService]);

  const filteredReadings = useMemo(() => {
    return readings.filter(r => {
      const date = r.date;
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;
      return true;
    });
  }, [readings, startDate, endDate]);

  const exportToExcel = () => {
    const data = filteredReadings.map(r => {
      const b = BUILDINGS.find(build => build.id === r.buildingId);
      return {
        'Fecha': new Date(r.date).toLocaleDateString('es-ES'),
        'Edificio': b?.name || r.buildingId,
        'Código': b?.code || '',
        'Unidad': b?.unit || '',
        'Servicio': r.serviceType.toUpperCase(),
        'Valor 1': r.value1,
        'Consumo 1': r.consumption1 || 0,
        'Valor 2': r.value2 || '',
        'Consumo 2': r.consumption2 || '',
        'Presión': r.pressure || '',
        'Temperatura': r.temperature || '',
        'Origen': r.origin === 'telematica' ? 'Telemática' : 'Manual',
        'Pico': r.isPeak ? 'SÍ' : 'NO',
        'Notas': r.note || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial");
    
    const fileName = `HISTORIAL_SIGAI_${building?.code || 'GLOBAL'}_${filterService}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleDelete = (id: string) => {
    storageService.deleteReading(id);
    const sType = filterService === 'all' ? undefined : filterService;
    setReadings(storageService.getReadings(building?.id, sType).reverse());
    setDeletingId(null);
  };

  const getServiceIcon = (type: ServiceType) => {
    switch (type) {
      case 'luz': return <Zap className="w-4 h-4" />;
      case 'agua': return <Droplets className="w-4 h-4" />;
      case 'gasoil': return <Fuel className="w-4 h-4" />;
      case 'temperatura': return <Thermometer className="w-4 h-4" />;
      case 'mantenimiento': return <Wrench className="w-4 h-4" />;
      case 'material': return <Package className="w-4 h-4" />;
      case 'peticion': return <ClipboardList className="w-4 h-4" />;
      case 'sal': return <Warehouse className="w-4 h-4" />;
      default: return <ClipboardList className="w-4 h-4" />;
    }
  };

  const serviceTypes: { id: ServiceType | 'all', label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'luz', label: 'Luz' },
    { id: 'agua', label: 'Agua' },
    { id: 'gasoil', label: 'Gasoil' },
    { id: 'sal', label: 'Sal' },
    { id: 'temperatura', label: 'Temp' },
    { id: 'mantenimiento', label: 'Manto' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12 w-full max-w-sm mx-auto">
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-xl font-black uppercase text-gray-900 tracking-tight">
            {building ? 'Registros' : 'Historial Global'}
          </h2>
          {!building && <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Todos los edificios</p>}
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowFilters(!showFilters)} 
            className={`p-3 rounded-xl shadow-sm active:scale-95 transition-all ${showFilters ? 'bg-tactical-orange text-black' : 'bg-white border border-gray-100 text-gray-400'}`}
          >
            <Filter className="w-4 h-4" />
          </button>
          <button onClick={exportToExcel} className="p-3 bg-white text-tactical-orange rounded-xl shadow-sm active:scale-95 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 border border-gray-100">
             <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white border border-gray-100 rounded-[2rem] p-6 shadow-xl space-y-6 animate-in zoom-in-95 duration-200">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Filtrar por Servicio</label>
            <div className="flex flex-wrap gap-2">
              {serviceTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => setFilterService(type.id)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filterService === type.id ? 'bg-tactical-orange text-black shadow-md' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Desde</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-[11px] font-bold text-gray-900 focus:ring-2 focus:ring-tactical-orange outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hasta</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-[11px] font-bold text-gray-900 focus:ring-2 focus:ring-tactical-orange outline-none"
              />
            </div>
          </div>

          <button 
            onClick={() => {
              setFilterService('all');
              setStartDate('');
              setEndDate('');
            }}
            className="w-full py-3 text-[9px] font-black text-red-500 uppercase tracking-widest border border-red-100 rounded-xl hover:bg-red-50 transition-colors"
          >
            Limpiar Filtros
          </button>
        </div>
      )}

      <div className="space-y-4">
        {filteredReadings.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-[3rem] border-2 border-dashed border-gray-100 flex flex-col items-center gap-4">
            <Calendar className="w-12 h-12 text-gray-100" />
            <p className="text-[10px] font-black uppercase text-gray-300 tracking-widest">Sin registros para estos filtros</p>
          </div>
        ) : (
          filteredReadings.map((r) => {
            const b = BUILDINGS.find(build => build.id === r.buildingId);
            const isLuz = r.serviceType === 'luz';
            
            return (
              <div key={r.id} className="bg-white border border-gray-100 rounded-[2.5rem] p-6 shadow-sm relative overflow-hidden group">
                {r.origin === 'telematica' && <div className="absolute top-0 right-0 p-1.5 bg-blue-600 rounded-bl-xl shadow-inner"><Globe className="w-4 h-4 text-white" /></div>}
                {r.isPeak && <div className="absolute top-0 left-0 w-1 h-full bg-red-600" />}
                
                <div className="flex justify-between items-start mb-4 border-b border-gray-50 pb-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-200" />
                        {new Date(r.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${r.serviceType === 'luz' ? 'bg-tactical-orange/10 text-tactical-orange' : r.serviceType === 'agua' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'}`}>
                        {getServiceIcon(r.serviceType)}
                        <span className="text-[8px] font-black uppercase tracking-widest">
                          {r.serviceType}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">
                        {b?.name || r.buildingId}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {deletingId === r.id ? (
                      <div className="flex items-center gap-2 animate-in slide-in-from-right-2">
                        <button 
                          onClick={() => handleDelete(r.id)}
                          className="px-3 py-1.5 bg-red-600 text-white text-[8px] font-black uppercase rounded-lg shadow-lg shadow-red-600/20"
                        >
                          Confirmar
                        </button>
                        <button 
                          onClick={() => setDeletingId(null)}
                          className="p-1.5 bg-gray-100 text-gray-400 rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setDeletingId(r.id)} 
                        className="text-red-200 hover:text-red-500 transition-colors ml-4"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className={`grid ${isLuz ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="text-[9px] font-black text-gray-400 uppercase mb-2">
                      {isLuz ? 'Lectura A' : r.serviceType === 'agua' ? 'Lectura m³' : 'Lectura'}
                    </div>
                    <div className="text-xl font-black data-value text-gray-900 leading-none">{r.value1.toLocaleString('es-ES')}</div>
                    <div className="text-[10px] font-black text-emerald-600 mt-2 flex items-center gap-1">
                       <CheckCircle2 className="w-3 h-3" /> +{r.consumption1?.toLocaleString('es-ES')}
                    </div>
                  </div>
                  {isLuz && (
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="text-[9px] font-black text-gray-400 uppercase mb-2">Lectura B</div>
                      <div className="text-xl font-black data-value text-gray-900 leading-none">{r.value2?.toLocaleString('es-ES')}</div>
                      <div className="text-[10px] font-black text-blue-600 mt-2 flex items-center gap-1">
                         <CheckCircle2 className="w-3 h-3" /> +{r.consumption2?.toLocaleString('es-ES')}
                      </div>
                    </div>
                  )}
                </div>
                {r.note && (
                  <div className="mt-4 p-3 bg-tactical-orange/5 rounded-xl border border-tactical-orange/10 text-[9px] font-bold text-tactical-orange/80 italic">
                    "{r.note}"
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Navegación Contextual */}
      <button 
        onClick={() => {
          if (building && initialServiceType) {
            onNavigate(AppTab.DASHBOARD);
          } else {
            onNavigate(AppTab.HOME);
          }
        }}
        className="w-full flex items-center justify-center gap-3 p-6 bg-white border border-gray-100 text-tactical-orange rounded-[2rem] font-black uppercase text-[11px] tracking-widest active:scale-95 transition-all shadow-sm mt-4"
      >
        <LayoutGrid className="w-4 h-4" /> {building ? 'Volver al Panel' : 'Volver al Inicio'}
      </button>
    </div>
  );
};

export default History;
