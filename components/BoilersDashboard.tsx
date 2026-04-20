
import React, { useMemo } from 'react';
import { Flame, Fuel, Droplets, Thermometer, Wrench, ChevronRight, LayoutGrid, ShieldAlert } from 'lucide-react';
import { AppTab, User } from '../types';
import { storageService } from '../services/storageService';

interface BoilersDashboardProps {
  user: User;
  onNavigate: (tab: AppTab) => void;
}

const BoilersDashboard: React.FC<BoilersDashboardProps> = ({ user, onNavigate }) => {
  const gasoilTanks = useMemo(() => storageService.getGasoilTanks(), []);
  const saltWarehouse = useMemo(() => storageService.getSaltWarehouse(), []);
  const boilers = useMemo(() => storageService.getBoilers(), []);
  const readings = useMemo(() => storageService.getBoilerReadings(), []);

  const alerts = useMemo(() => {
    const fuelCritical = gasoilTanks.filter(t => t.alertStatus === 'critico').length;
    const boilerCritical = boilers.filter(b => b.status === 'averiada' || b.status === 'fuera_servicio').length;
    const tempAlerts = readings.filter(r => r.alerts.length > 0 && (new Date().getTime() - new Date(r.date).getTime() < 86400000)).length;
    return { fuelCritical, boilerCritical, tempAlerts };
  }, [gasoilTanks, boilers, readings]);

  return (
    <div className="w-full max-w-sm mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white border border-gray-100 rounded-2xl shadow-sm">
             <Flame className="w-6 h-6 text-tactical-orange" />
          </div>
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tighter text-gray-900 leading-none">Calderas</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Módulo Técnico SIGAI</p>
          </div>
        </div>
        <div className="w-12 h-12 bg-white border border-gray-100 rounded-2xl flex items-center justify-center shadow-sm active:scale-95 transition-all" onClick={() => onNavigate(AppTab.HOME)}>
           <LayoutGrid className="w-5 h-5 text-tactical-orange" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-2">
        {/* GRID DE ACCESOS */}
        <div className="grid grid-cols-2 gap-4">
           <HubCard 
            icon={<Fuel className="w-6 h-6" />}
            title="Gasoil"
            label="Niveles Carga"
            badge={alerts.fuelCritical > 0 ? `${alerts.fuelCritical}` : undefined}
            color="bg-orange-600"
            onClick={() => onNavigate(AppTab.GASOIL)}
           />
           <HubCard 
            icon={<Droplets className="w-6 h-6" />}
            title="Sal"
            label="Stock Almacén"
            badge={saltWarehouse.sacksAvailable <= saltWarehouse.criticalAlertLevel ? '!' : undefined}
            color="bg-blue-500"
            onClick={() => onNavigate(AppTab.SALT)}
           />
           <HubCard 
            icon={<Thermometer className="w-6 h-6" />}
            title="Temperat."
            label="Tomas Diarias"
            badge={alerts.tempAlerts > 0 ? `${alerts.tempAlerts}` : undefined}
            color="bg-red-500"
            onClick={() => onNavigate(AppTab.TEMPERATURES)}
           />
           <HubCard 
            icon={<Wrench className="w-6 h-6" />}
            title="Mantenim."
            label="Averías Piezas"
            badge={alerts.boilerCritical > 0 ? `${alerts.boilerCritical}` : undefined}
            color="bg-gray-800"
            onClick={() => onNavigate(AppTab.MAINTENANCE)}
           />
        </div>

        {/* RESUMEN DE ESTADO */}
        <section className="bg-white border border-gray-100 rounded-[2.5rem] p-8 text-gray-900 space-y-6 shadow-sm relative overflow-hidden">
           <div className="relative z-10">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6">Estado de Instalaciones</h3>
              <div className="space-y-4">
                 {boilers.map(boiler => (
                   <div key={boiler.id} className="flex items-center justify-between border-b border-gray-50 pb-3">
                      <div>
                        <div className="text-[10px] font-black uppercase text-gray-400">{boiler.buildingCode}</div>
                        <div className="text-xs font-bold text-gray-900">{boiler.buildingName}</div>
                      </div>
                      <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${boiler.status === 'operativa' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600 animate-pulse'}`}>
                         {boiler.status.replace('_', ' ')}
                      </div>
                   </div>
                 ))}
              </div>
           </div>
           <Flame className="absolute -right-10 -bottom-10 w-48 h-48 text-gray-50 rotate-12" />
        </section>
      </div>
    </div>
  );
};

const HubCard: React.FC<{ icon: React.ReactNode, title: string, label: string, badge?: string, color: string, onClick: () => void }> = ({ icon, title, label, badge, color, onClick }) => (
  <button onClick={onClick} className="bg-white border border-gray-100 rounded-[2.5rem] p-6 text-left shadow-sm hover:shadow-xl transition-all relative overflow-hidden group active:scale-95">
     <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
        {icon}
     </div>
     {badge && (
       <div className="absolute top-6 right-6 w-5 h-5 bg-red-600 text-white text-[10px] font-black flex items-center justify-center rounded-full shadow-lg border-2 border-white">
          {badge}
       </div>
     )}
     <h4 className="text-lg font-black uppercase tracking-tight text-gray-900 leading-none mb-1">{title}</h4>
     <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
  </button>
);

export default BoilersDashboard;
