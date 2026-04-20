
import React, { useMemo, useState, useEffect } from 'react';
import { 
  Calendar, MessageSquare, Package, Zap, Droplets, Flame, 
  Users, ClipboardList, Camera, FileText, BookOpen, Map,
  ChevronRight, ArrowUpRight, ArrowDownRight, AlertCircle,
  TrendingUp, Settings, ShieldAlert, Timer, CheckCircle2,
  Warehouse, FileSpreadsheet, HardHat, Fuel, Globe, Bell,
  Wrench, X, Clock, CalendarDays, ShieldCheck, ClipboardCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppTab, User, ServiceType, Building, Role, UrgencyLevel, AppNotification } from '../types';
import { storageService, BUILDINGS } from '../services/storageService';
import { getLocalDateString } from '../services/dateUtils';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

interface UnitDashboardProps {
  user: User;
  activeUnit: Role;
  onNavigate: (tab: AppTab) => void;
  onServiceClick: (service: ServiceType) => void;
  onRequestClick: (type: 'peticion' | 'material') => void;
}

const UnitDashboard: React.FC<UnitDashboardProps> = ({ user, activeUnit, onNavigate, onServiceClick, onRequestClick }) => {
  const isMaster = user.role === 'MASTER';
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [confirmCloseId, setConfirmCloseId] = useState<string | null>(null);
  const [snoozeData, setSnoozeData] = useState<{ id: string, date: string } | null>(null);
  const [showTechList, setShowTechList] = useState(false);

  // REAL-TIME NOTIFICATIONS LISTENER
  useEffect(() => {
    // We want to see notifications for the specific user AND general system notifications ('all')
    const userIds = Array.from(new Set([user.id, 'all']));
    const q = query(
      collection(db, 'notifications'),
      where('userId', 'in', userIds),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as AppNotification[];
      // Sort by date descending
      setNotifications(data.sort((a, b) => b.date.localeCompare(a.date)));
    });

    return () => unsubscribe();
  }, [user.id]);
  
  // DATA CALCULATIONS
  const tasks = useMemo(() => storageService.getTasks().filter(t => isMaster || t.type === activeUnit), [activeUnit, isMaster]);
  const todayTasks = useMemo(() => {
    const today = getLocalDateString();
    return tasks.filter(t => t.startDate === today && t.status !== 'Completada');
  }, [tasks]);

  const requests = useMemo(() => {
    const all = storageService.getRequests().filter(r => isMaster || r.unit === activeUnit);
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeUnit, isMaster]);
  
  const pendingAcceptanceRequests = useMemo(() => {
    return requests.filter(r => 
      r.status === 'asignada' && 
      r.assignedTechnicians?.includes(user.id) &&
      r.acceptanceStatus?.[user.id] === 'pending'
    );
  }, [requests, user.id]);

  const team = useMemo(() => storageService.getUsers().filter(u => isMaster || u.assignedUnits?.includes(activeUnit)), [activeUnit, isMaster]);
  const waterReadings = useMemo(() => storageService.getReadings('BASE_ALICANTE', 'agua'), []);
  
  const pendingTasksCount = tasks.filter(t => t.status !== 'Completada').length;
  const urgentRequests = requests.filter(r => r.urgency === 'Crítica' && r.status !== 'closed').length;
  const mediumRequests = requests.filter(r => (r.urgency === 'Alta' || r.urgency === 'Media') && r.status !== 'closed').length;
  
  const techniciansStatus = useMemo(() => {
    const today = getLocalDateString();
    return team.filter(u => u.status === 'approved' && u.isManto)
      .map(u => {
        const isOnLeave = u.leaveDays?.includes(today);
        const entry = u.leaveEntries?.find(e => today >= e.startDate && today <= e.endDate);
        return {
          id: u.id,
          name: u.name,
          isActive: !isOnLeave,
          leaveType: entry?.type
        };
      });
  }, [team]);

  const activeTechs = techniciansStatus.filter(t => t.isActive).length;

  // Real data for water
  const waterLast = waterReadings[waterReadings.length - 1];
  const waterStats = useMemo(() => {
    const today = waterLast?.consumption1 || 0;
    const isPeak = waterLast?.isPeak || false;
    return { val: today, isPeak };
  }, [waterLast]);

  const stats = {
    luz: { val: 2450, trend: '+12%', up: true, unit: 'kWh' },
    agua: { val: waterStats.val, trend: waterStats.isPeak ? 'ALERTA' : 'Normal', up: waterStats.isPeak, unit: 'm³' },
    caldera: { val: 68, trend: 'Ok', up: null, unit: '°C' }
  };

  const progresoGeneral = useMemo(() => {
    const total = requests.length;
    if (total === 0) return 100;
    const closed = requests.filter(r => r.status === 'closed').length;
    return Math.round((closed / total) * 100);
  }, [requests]);

  const isRestricted = !isMaster && activeUnit !== 'USAC';
  const isTecnico = user.userCategory === 'Técnico';
  
  const handleMarkRead = (id: string) => {
    storageService.markNotificationAsRead(id);
    setConfirmCloseId(null);
  };

  const handleAcceptRequest = async (requestId: string) => {
    await storageService.acceptRequest(requestId, user.id);
    // Add a notification for the manager? Maybe later.
  };

  const handleSnooze = async () => {
    if (!snoozeData) return;
    
    const notification = notifications.find(n => n.id === snoozeData.id);
    if (!notification || !notification.relatedId) return;
    
    const task = storageService.getTasks().find(t => t.id === notification.relatedId);
    if (task) {
      const updatedTask = {
        ...task,
        startDate: snoozeData.date,
        status: 'Pospuesta' as const
      };
      
      await storageService.saveTask(updatedTask);
      await storageService.markNotificationAsRead(notification.id);
      
      // Add a system notification about the snooze
      await storageService.addNotification({
        id: crypto.randomUUID(),
        userId: user.id,
        title: 'Tarea Pospuesta',
        message: `Has pospuesto "${task.title}" para el ${snoozeData.date}`,
        type: 'system',
        read: false,
        date: new Date().toISOString()
      });
    }
    setSnoozeData(null);
  };

  return (
    <div className="w-full max-w-sm mx-auto space-y-10 pb-12 animate-in fade-in duration-500">
      
      {/* PENDIENTES DE ACEPTACIÓN (SOLO TÉCNICOS) */}
      {pendingAcceptanceRequests.length > 0 && (
        <div className="px-2 space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500 px-4">Tareas Pendientes de Aceptación</h3>
          {pendingAcceptanceRequests.map(req => (
            <div key={req.id} className="bg-blue-600 border-2 border-blue-500 rounded-3xl p-6 flex flex-col gap-4 shadow-xl animate-in slide-in-from-right-4">
              <div className="flex gap-4">
                <div className="bg-white p-3 rounded-2xl text-blue-600 h-fit">
                  <Wrench className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-[11px] font-black uppercase text-white">{req.title}</h4>
                  <p className="text-[9px] font-bold text-blue-100 leading-relaxed uppercase tracking-tight line-clamp-2">
                    {req.description}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Map className="w-3 h-3 text-blue-200" />
                    <span className="text-[8px] font-black text-blue-200 uppercase">{req.locationData?.buildingName || 'Ubicación N/D'}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => handleAcceptRequest(req.id)}
                className="w-full py-4 bg-white text-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Aceptar Recepción de Trabajo
              </button>
            </div>
          ))}
        </div>
      )}

      {/* NOTIFICACIONES CRÍTICAS Y TAREAS DE HOY */}
      {(notifications.length > 0 || todayTasks.length > 0) && (
        <div className="px-2 space-y-3">
          {/* Tareas de Hoy (Si no hay notificación específica) */}
          {todayTasks.length > 0 && notifications.every(n => n.type !== 'today_summary') && (
            <div key="today-tasks-banner" className="bg-red-600 border-2 border-red-500 rounded-3xl p-5 flex flex-col gap-3 animate-in slide-in-from-top-4 shadow-lg relative overflow-hidden">
               <div className="flex gap-4">
                  <div className="bg-white p-3 rounded-2xl text-red-600 h-fit">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-[11px] font-black uppercase text-white">Tareas Programadas para Hoy</h4>
                    <p className="text-[10px] font-bold text-red-100 leading-relaxed uppercase tracking-tight">
                      Tienes {todayTasks.length} {todayTasks.length === 1 ? 'tarea pendiente' : 'tareas pendientes'} para hoy.
                    </p>
                  </div>
               </div>
               <button 
                 onClick={() => onNavigate(AppTab.CALENDAR)}
                 className="w-full py-3 bg-white text-red-600 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm active:scale-95"
               >
                 Ver Agenda de Hoy
               </button>
            </div>
          )}

          {/* Notificaciones Reales */}
          {notifications.map((n, idx) => (
            <div key={`${n.id}-${idx}`} className="bg-red-50 border-2 border-red-100 rounded-3xl p-5 flex flex-col gap-3 animate-in slide-in-from-top-4 shadow-sm relative overflow-hidden">
              <div className="flex gap-4">
                <div className="bg-red-500 p-3 rounded-2xl text-white h-fit">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-[11px] font-black uppercase text-red-900">{n.title}</h4>
                    <button 
                      onClick={() => setConfirmCloseId(n.id)} 
                      className="text-[8px] font-black text-red-400 uppercase bg-red-100/50 px-2 py-1 rounded-lg active:scale-90 transition-all"
                    >
                      Cerrar
                    </button>
                  </div>
                  <p className="text-[10px] font-bold text-red-700 leading-relaxed uppercase tracking-tight">{n.message}</p>
                </div>
              </div>
              
              {n.type === 'task_assigned' && n.relatedId && (
                <div className="flex gap-2 mt-1">
                  <button 
                    onClick={() => onNavigate(AppTab.CALENDAR)}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm active:scale-95"
                  >
                    Ver en Agenda
                  </button>
                  <button 
                    onClick={() => setSnoozeData({ id: n.id, date: getLocalDateString() })}
                    className="flex-1 py-3 bg-white border border-red-200 text-red-600 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95"
                  >
                    Posponer
                  </button>
                </div>
              )}

              {/* Overlay de Confirmación de Cierre */}
              {confirmCloseId === n.id && (
                <div className="absolute inset-0 bg-red-600/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center z-10 animate-in fade-in zoom-in-95">
                  <p className="text-white font-black uppercase text-[10px] mb-4 tracking-widest">¿Confirmar lectura y cerrar alerta?</p>
                  <div className="flex gap-3 w-full">
                    <button 
                      onClick={() => handleMarkRead(n.id)}
                      className="flex-1 py-3 bg-white text-red-600 rounded-xl font-black uppercase text-[9px] shadow-xl active:scale-95"
                    >
                      Sí, Cerrar
                    </button>
                    <button 
                      onClick={() => setConfirmCloseId(null)}
                      className="flex-1 py-3 bg-red-800 text-white/70 rounded-xl font-black uppercase text-[9px] active:scale-95"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Overlay de Posponer (Date Picker) */}
              {snoozeData?.id === n.id && (
                <div className="absolute inset-0 bg-gray-900/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center z-10 animate-in fade-in zoom-in-95">
                  <div className="bg-yellow-400 p-2 rounded-xl mb-3">
                    <CalendarDays className="w-5 h-5 text-black" />
                  </div>
                  <p className="text-white font-black uppercase text-[10px] mb-4 tracking-widest">Elegir Nueva Fecha</p>
                  <input 
                    type="date" 
                    value={snoozeData.date}
                    onChange={(e) => setSnoozeData({ ...snoozeData, date: e.target.value })}
                    className="w-full p-3 bg-white rounded-xl font-black text-xs mb-4 outline-none text-center"
                  />
                  <div className="flex gap-3 w-full">
                    <button 
                      onClick={handleSnooze}
                      className="flex-1 py-3 bg-yellow-400 text-black rounded-xl font-black uppercase text-[9px] shadow-xl active:scale-95"
                    >
                      Confirmar
                    </button>
                    <button 
                      onClick={() => setSnoozeData(null)}
                      className="flex-1 py-3 bg-gray-800 text-white/70 rounded-xl font-black uppercase text-[9px] active:scale-95"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* HEADER UNIDAD */}
      <div className="relative overflow-hidden bg-gray-900 rounded-[2.5rem] p-8 text-white shadow-2xl">
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
             <div className="bg-yellow-400 p-3 rounded-2xl">
                <HardHat className="w-6 h-6 text-black" />
             </div>
             <div className="flex gap-2">
               {notifications.length > 0 && (
                 <div className="relative">
                   <Bell className="w-5 h-5 text-yellow-400 animate-swing" />
                   <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                 </div>
               )}
               <button onClick={() => onNavigate(AppTab.SETTINGS)} className="p-2 bg-white/10 rounded-xl">
                  <Settings className="w-5 h-5 text-gray-400" />
               </button>
             </div>
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tighter leading-none mb-2">
            {isMaster ? `MÓDULO MAESTRO (${activeUnit})` : `UNIDAD ${activeUnit}`}
          </h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em]">
            {isRestricted ? 'Solicitud de Apoyo Técnico' : 'Sistema Integrado de Apoyo'}
          </p>
        </div>
        <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
          <Warehouse className="w-32 h-32" />
        </div>
      </div>

      {/* SECCIÓN: GESTIÓN DE PETICIONES (RESTRICTED OR FULL) */}
      <section className="space-y-4 px-2">
        <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-yellow-500" /> {isRestricted ? 'Nueva Solicitud' : 'Gestión Operativa'}
        </h3>
        <div className="grid grid-cols-1 gap-4">
          {(!isRestricted || isTecnico) && (
            <ActionButton 
              icon={<Calendar className="w-6 h-6" />}
              title="Mi Agenda"
              desc="Tareas y mantenimiento"
              badge={pendingTasksCount > 0 ? `${pendingTasksCount} Pendientes` : undefined}
              onClick={() => onNavigate(AppTab.CALENDAR)}
              color="bg-white border-gray-100"
            />
          )}
          
          <div className={`grid ${(isRestricted && !isTecnico) ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
            <ActionButton 
              icon={<MessageSquare className="w-5 h-5" />}
              title="Abrir Parte"
              desc="Incidencias IA"
              onClick={() => onRequestClick('peticion')}
              color="bg-blue-50 border-blue-100 text-blue-900"
              compact={!isRestricted}
            />
            <ActionButton 
              icon={<Package className="w-5 h-5" />}
              title="Materiales"
              desc="Gestión Almacén"
              onClick={() => onRequestClick('material')}
              color="bg-amber-50 border-amber-100 text-amber-900"
              compact={!isRestricted}
            />
          </div>
        </div>
      </section>

      {/* SECCIÓN: MIS PETICIONES (SOLO PARA UNIDADES QUE NO SON USAC O MASTER) */}
      {isRestricted && (
        <section className="space-y-4 px-2">
          <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-blue-500" /> Mis Peticiones
          </h3>
          <div className="space-y-3">
            {requests.length === 0 ? (
              <div className="p-10 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-gray-100">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">No has realizado peticiones aún</p>
              </div>
            ) : (
              requests.map(req => (
                <div key={req.id} className="bg-white border border-gray-100 rounded-[2rem] p-5 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${req.type === 'peticion' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                        {req.type === 'peticion' ? <Wrench className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-[10px] font-black text-gray-900 uppercase leading-none mb-1">{req.title}</div>
                        <div className="text-[8px] font-bold text-gray-400 uppercase">Nº: {req.id.split('-')[0]}</div>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest ${
                      req.status === 'closed' ? 'bg-green-100 text-green-600' : 
                      req.status === 'in_progress' ? 'bg-blue-100 text-blue-600' : 
                      req.status === 'asignada' ? 'bg-amber-100 text-amber-600' : 
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {req.status === 'open' ? 'Abierta' : 
                       req.status === 'in_progress' ? 'En Curso' : 
                       req.status === 'asignada' ? 'Asignada' : 
                       req.status === 'closed' ? 'Resuelta' : 'Pendiente'}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[8px] font-bold text-gray-400 uppercase">
                    <span>{new Date(req.date).toLocaleDateString()}</span>
                    <span>{req.category}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {!isRestricted && !isTecnico && (
        <>
          {/* SECCIÓN 2: CONSUMOS Y SUMINISTROS */}
          <section className="space-y-4 px-2">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-500" /> Consumos y Suministros
              </h3>
              <button onClick={() => onNavigate(AppTab.HISTORY)} className="text-[9px] font-black text-blue-600 uppercase">Historial</button>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              <ConsumptionCard 
                icon={<Zap className="w-5 h-5" />} 
                title="Luz" 
                value={stats.luz.val} 
                unit={stats.luz.unit}
                trend={stats.luz.trend}
                up={stats.luz.up}
                color="bg-yellow-400"
                onClick={() => onServiceClick('luz')}
              />
              <ConsumptionCard 
                icon={<Droplets className="w-5 h-5" />} 
                title="Agua" 
                value={stats.agua.val} 
                unit={stats.agua.unit}
                trend={stats.agua.trend}
                up={stats.agua.up}
                color={stats.agua.up ? "bg-red-500" : "bg-blue-500"}
                onClick={() => onNavigate(AppTab.WATER_SYNC)}
              />
              <ConsumptionCard 
                icon={<Flame className="w-5 h-5" />} 
                title="Calderas" 
                value={19} 
                unit="Tanques"
                trend="Control SIGAI"
                up={null}
                color="bg-orange-600"
                onClick={() => onNavigate(AppTab.BOILERS)}
              />
            </div>
          </section>

          {/* SECCIÓN 3: EQUIPO Y GESTIÓN USAC */}
          <section className="space-y-4 px-2">
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" /> Mi Equipo USAC
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-white border border-gray-100 rounded-[2.5rem] p-6 shadow-sm">
                 <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                       <div className="p-3 bg-purple-50 rounded-xl text-purple-600"><Users className="w-5 h-5" /></div>
                       <div>
                          <span className="text-[10px] font-black text-gray-900 uppercase">Técnicos Activos</span>
                          <div className="text-2xl font-black">{activeTechs}</div>
                       </div>
                    </div>
                    <button onClick={() => onNavigate(AppTab.TEAM)} className="p-3 bg-gray-900 text-white rounded-xl shadow-lg active:scale-95">
                       <ChevronRight className="w-4 h-4" />
                    </button>
                 </div>

                  {techniciansStatus.length > 0 && (
                    <div className="mb-6 space-y-3">
                      <button 
                        onClick={() => setShowTechList(!showTechList)}
                        className="w-full flex justify-between items-center text-[8px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-2 hover:text-gray-900 transition-colors"
                      >
                        <span>Estado del Equipo Hoy</span>
                        <ChevronRight className={`w-3 h-3 transition-transform duration-300 ${showTechList ? 'rotate-90' : ''}`} />
                      </button>
                      
                      <AnimatePresence>
                        {showTechList && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-1 gap-2 pt-2">
                              {techniciansStatus.map((tech, idx) => (
                                <div key={`${tech.id}-${idx}`} className="flex justify-between items-center p-2 rounded-xl bg-gray-50/50 border border-gray-100/50">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${tech.isActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                                    <span className="text-[10px] font-black text-gray-900 uppercase truncate max-w-[120px]">{tech.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {!tech.isActive && (
                                      <span className="text-[7px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-lg uppercase tracking-tighter">
                                        {tech.leaveType || 'Libre'}
                                      </span>
                                    )}
                                    <span className={`text-[7px] font-black uppercase tracking-widest ${tech.isActive ? 'text-green-600' : 'text-red-400'}`}>
                                      {tech.isActive ? 'Disponible' : 'No Disponible'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                 
                 <div className="grid grid-cols-3 gap-3">
                    <StatusBox label="Urgente" val={urgentRequests} color="text-red-600 bg-red-50" />
                    <StatusBox label="Media" val={mediumRequests} color="text-amber-600 bg-amber-50" />
                    <StatusBox label="Finalizado" val={requests.filter(r => r.status === 'closed').length} color="text-green-600 bg-green-50" />
                 </div>

                 <div className="mt-6 space-y-2">
                    <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-gray-400">
                       <span>SLA Diario</span>
                       <span>{progresoGeneral}%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                       <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${progresoGeneral}%` }} />
                    </div>
                 </div>
              </div>

              <button 
                onClick={() => onNavigate(AppTab.USAC_MANAGER)}
                className="w-full p-6 bg-gray-900 text-yellow-400 rounded-[2rem] font-black uppercase tracking-widest text-[10px] shadow-2xl flex items-center justify-center gap-4 active:scale-95 transition-all"
              >
                <ClipboardList className="w-5 h-5" /> Panel Gestión de Prioridades
              </button>

              {/* SECCIÓN: SEGURIDAD E INSPECCIONES (OCA) */}
              {user.role === 'MASTER' && (
                <section className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-red-500" /> Seguridad e Inspecciones
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    <ActionButton 
                      icon={<ShieldCheck className="w-6 h-6" />}
                      title="Certificados OCA"
                      desc="Inspecciones reglamentarias"
                      onClick={() => onNavigate(AppTab.OCA)}
                      color="bg-red-50 border-red-100 text-red-900"
                    />
                    <ActionButton 
                      icon={<FileText className="w-6 h-6" />}
                      title="Sectoriales (PPT)"
                      desc="Pliegos y mantenimientos"
                      onClick={() => onNavigate(AppTab.PPTS)}
                      color="bg-gray-50 border-gray-100 text-gray-900"
                    />
                    <ActionButton 
                      icon={<ClipboardCheck className="w-6 h-6" />}
                      title="RTI (Infraestructura)"
                      desc="Resumen obras y revistas"
                      onClick={() => onNavigate(AppTab.RTI)}
                      color="bg-amber-50 border-amber-100 text-amber-900"
                    />
                  </div>
                </section>
              )}

              {/* SECCIÓN: HERRAMIENTAS DE TRABAJO (SOLO USAC Y MASTER) */}
              {(user.role === 'USAC' || user.role === 'MASTER') && (
                <button 
                  onClick={() => onNavigate(AppTab.TOOLS)}
                  className="w-full p-6 bg-white border-2 border-gray-900 text-gray-900 rounded-[2rem] font-black uppercase tracking-widest text-[10px] shadow-xl flex items-center justify-center gap-4 active:scale-95 transition-all mt-4"
                >
                  <Wrench className="w-5 h-5" /> Herramientas de Trabajo
                </button>
              )}
            </div>
          </section>
        </>
      )}

    </div>
  );
};

const ActionButton: React.FC<{ icon: React.ReactNode, title: string, desc: string, badge?: string, onClick: () => void, color: string, compact?: boolean }> = ({ icon, title, desc, badge, onClick, color, compact }) => (
  <button 
    onClick={onClick} 
    className={`${color} border-2 rounded-[2.5rem] shadow-sm text-left flex items-center transition-all active:scale-95 group relative overflow-hidden ${compact ? 'p-3 gap-2' : 'p-6 justify-between'}`}
  >
    <div className={`flex items-center relative z-10 ${compact ? 'gap-2' : 'gap-4'}`}>
      <div className={`rounded-2xl shrink-0 flex items-center justify-center ${compact ? 'w-10 h-10 bg-white/50' : 'p-4 bg-gray-900 text-yellow-400 shadow-xl'}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <h4 className="font-black text-[11px] uppercase leading-none mb-1 truncate">{title}</h4>
        <p className={`opacity-60 font-bold uppercase tracking-widest truncate ${compact ? 'text-[7px]' : 'text-[9px]'}`}>{desc}</p>
        {badge && <span className="inline-block mt-2 px-2 py-0.5 bg-red-600 text-white text-[7px] font-black rounded-lg uppercase">{badge}</span>}
      </div>
    </div>
    {!compact && <ChevronRight className="w-5 h-5 opacity-20 group-hover:translate-x-1 transition-transform" />}
  </button>
);

const ConsumptionCard: React.FC<{ icon: React.ReactNode, title: string, value: number, unit: string, trend: string, up: boolean | null, color: string, onClick: () => void }> = ({ icon, title, value, unit, trend, up, color, onClick }) => (
  <button onClick={onClick} className="min-w-[140px] bg-white border border-gray-100 rounded-[2rem] p-5 shadow-sm active:scale-95 transition-all text-left">
     <div className="flex items-center justify-between mb-4">
        <div className={`${color} p-2 rounded-xl text-white`}>{icon}</div>
        {up !== null && (
          <div className={`flex items-center text-[9px] font-black ${up ? 'text-red-500' : 'text-green-500'}`}>
             {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
             {trend}
          </div>
        )}
     </div>
     <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{title}</h4>
     <div className="flex items-baseline gap-1">
        <span className="text-xl font-black text-gray-900">{value}</span>
        <span className="text-[8px] font-bold text-gray-400 uppercase">{unit}</span>
     </div>
  </button>
);

const StatusBox: React.FC<{ label: string, val: number, color: string }> = ({ label, val, color }) => (
  <div className={`${color} p-3 rounded-2xl text-center border border-current opacity-80`}>
     <div className="text-xs font-black mb-0.5">{val}</div>
     <div className="text-[7px] font-black uppercase tracking-tighter">{label}</div>
  </div>
);

export default UnitDashboard;
