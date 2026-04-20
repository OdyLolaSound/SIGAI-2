
import React, { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Zap, TrendingUp, AlertCircle, Droplets, Flame, Cpu, Info, History as HistoryIcon, Camera } from 'lucide-react';
import { Reading, ServiceType, Building, Role, AppTab } from '../types';
import { storageService } from '../services/storageService';

interface DashboardProps {
  serviceType: ServiceType;
  building: Building;
  role: Role;
  onNavigate: (tab: AppTab) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ serviceType, building, role, onNavigate }) => {
  const readings = useMemo(() => storageService.getReadings(building.id, serviceType), [building, serviceType]);
  const last = readings[readings.length - 1];
  
  const chartData = useMemo(() => {
    return readings.map(r => ({
      name: new Date(r.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      c1: r.consumption1 || 0,
      c2: r.consumption2 || 0
    })).slice(-15);
  }, [readings]);

  const unitStr = serviceType === 'agua' ? 'm³' : serviceType === 'caldera' ? 'h/m³' : 'kWh';

  const colorTheme = {
    luz: 'bg-yellow-400 text-black',
    agua: 'bg-blue-500 text-white',
    caldera: 'bg-orange-500 text-white'
  };

  const accentColor = {
    luz: '#fbbf24',
    agua: '#60a5fa',
    caldera: '#f97316'
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 w-full max-w-sm mx-auto">
      <div className="flex items-center gap-4 mb-2">
         <div className={`p-3.5 rounded-2xl shadow-lg transition-transform hover:rotate-6 ${colorTheme[serviceType]}`}>
            {serviceType === 'luz' && <Zap className="w-6 h-6" />}
            {serviceType === 'agua' && <Droplets className="w-6 h-6" />}
            {serviceType === 'caldera' && <Flame className="w-6 h-6" />}
         </div>
         <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-gray-900 leading-none mb-1">{building.name}</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">{building.unit} · {building.code}</p>
         </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm transition-all hover:border-gray-200">
          <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-2">Acumulada</div>
          <div className="text-2xl font-black data-value text-gray-900 leading-tight">
            {last ? last.value1.toLocaleString('es-ES') : '0,0'}
          </div>
          <div className="text-[10px] opacity-20 font-black uppercase mt-1">{unitStr}</div>
        </div>
        
        <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm transition-all hover:border-gray-200">
          <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-2">Hoy</div>
          <div className="text-2xl font-black data-value text-emerald-600 leading-tight">
            +{last?.consumption1 ? last.consumption1.toLocaleString('es-ES') : '0,0'}
          </div>
          <div className="text-[10px] opacity-40 font-black uppercase mt-1 text-emerald-600/60">{unitStr}</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm overflow-hidden relative border border-gray-100">
        <div className="flex items-center justify-between mb-8 relative z-10">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Histórico de Consumo</h3>
          <TrendingUp className="w-4 h-4 text-tactical-orange" />
        </div>

        <div className="h-48 relative z-10">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorMain" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={accentColor[serviceType]} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={accentColor[serviceType]} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#00000005" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 8, fontWeight: 800}} dy={10} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '16px', fontSize: '10px', color: '#000' }} itemStyle={{ color: accentColor[serviceType] }} />
                <Area type="monotone" dataKey="c1" stroke={accentColor[serviceType]} strokeWidth={3} fillOpacity={1} fill="url(#colorMain)" animationDuration={1500} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-10 gap-3">
               <AlertCircle className="w-10 h-10" />
               <p className="text-[10px] font-black uppercase tracking-widest">Esperando datos operativos</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-8">
        <button 
          onClick={() => onNavigate(AppTab.HISTORY)}
          className="flex items-center justify-center gap-3 p-6 bg-white border border-gray-100 rounded-[2rem] font-black uppercase text-[10px] tracking-widest text-gray-600 active:scale-95 transition-all shadow-sm hover:bg-gray-50"
        >
          <HistoryIcon className="w-4 h-4" /> Historial
        </button>
        <button 
          onClick={() => onNavigate(AppTab.SCAN)}
          className="flex items-center justify-center gap-3 p-6 bg-tactical-orange text-black rounded-[2rem] font-black uppercase text-[10px] tracking-widest active:scale-90 transition-all shadow-lg shadow-tactical-orange/20"
        >
          <Camera className="w-4 h-4" /> Registrar
        </button>
      </div>

      <div className="bg-white p-5 rounded-[2rem] flex gap-4 items-center border border-gray-100 shadow-sm">
        <Info className="w-5 h-5 text-tactical-orange" />
        <p className="text-[9px] text-gray-500 font-bold uppercase leading-relaxed tracking-tight italic">
          El control en {building.code} garantiza la operatividad de la unidad.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
