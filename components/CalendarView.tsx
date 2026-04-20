
import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, MapPin, User, CheckCircle2, AlertCircle, AlertTriangle, Send, Trash2, X, Building, Users, Search } from 'lucide-react';
import { CalendarTask, User as UserType, UrgencyLevel, AppTab, ExternalUser, Role } from '../types';
import { storageService } from '../services/storageService';
import { getLocalDateString, isHoliday } from '../services/dateUtils';
import TaskForm from './TaskForm';

interface CalendarViewProps {
  user: UserType;
  activeUnit: Role;
  onNavigate: (tab: AppTab) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ user, activeUnit, onNavigate }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<CalendarTask | undefined>(undefined);
  const [taskToDelete, setTaskToDelete] = useState<CalendarTask | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const isMaster = user.role === 'MASTER';

  useEffect(() => {
    const allTasks = storageService.getTasks();
    const filteredTasks = allTasks.filter(t => 
      isMaster || 
      t.createdBy === user.id || 
      t.assignedTo.includes(user.id) ||
      t.type === activeUnit
    );
    setTasks(filteredTasks);
  }, [showForm, activeUnit, isMaster, user.id]);

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const date = new Date(year, month, 1);
    const days = [];
    const firstDay = date.getDay() === 0 ? 6 : date.getDay() - 1; 
    
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [currentDate]);

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  const getPriorityColor = (priority: UrgencyLevel) => {
    switch (priority) {
      case 'Crítica': return 'bg-red-500';
      case 'Alta': return 'bg-orange-500';
      case 'Media': return 'bg-yellow-400';
      case 'Baja': return 'bg-green-500';
      case 'Rutina': return 'bg-blue-400';
      default: return 'bg-gray-300';
    }
  };

  const selectedTasks = useMemo(() => {
    const dateStr = getLocalDateString(selectedDate);
    return tasks.filter(t => t.startDate === dateStr).sort((a,b) => (a.startTime || '').localeCompare(b.startTime || ''));
  }, [tasks, selectedDate]);

  const filteredSearchTasks = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return tasks.filter(t => 
      t.title.toLowerCase().includes(query) || 
      t.description.toLowerCase().includes(query) ||
      t.location?.toLowerCase().includes(query) ||
      t.type.toLowerCase().includes(query)
    ).sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [tasks, searchQuery]);

  const techniciansOff = useMemo(() => {
    const dateStr = getLocalDateString(selectedDate);
    return storageService.getUsers().filter(u => (u.isManto || u.role === 'USAC') && u.leaveDays?.includes(dateStr)).map(u => {
      const entry = u.leaveEntries?.find(e => dateStr >= e.startDate && dateStr <= e.endDate);
      return { ...u, leaveType: entry?.type };
    });
  }, [selectedDate]);

  const handleToggleTaskStatus = (task: CalendarTask) => {
    const newStatus = task.status === 'Completada' ? 'Pendiente' : 'Completada';
    storageService.saveTask({ ...task, status: newStatus });
    setTasks(storageService.getTasks());
  };

  const handleDeleteTask = () => {
    if (taskToDelete) {
      storageService.deleteTask(taskToDelete.id);
      setTasks(storageService.getTasks());
      setTaskToDelete(null);
    }
  };

  const handleSendToWhatsApp = (task: CalendarTask, external?: ExternalUser) => {
    let phone = '';
    let targetName = '';

    if (external) {
      phone = external.phone.replace(/\+/g, '');
      targetName = external.name;
    } else {
      const assignedUsers = storageService.getUsers().filter(u => task.assignedTo.includes(u.id));
      if (assignedUsers.length === 0) return alert("Asigna técnicos primero.");
      phone = assignedUsers[0].phone?.replace(/\+/g, '') || '';
      targetName = assignedUsers[0].name;
    }

    const msg = `🔔 *ORDEN DE TRABAJO SIGAI USAC*\n━━━━━━━━━━━━━━\n👤 *Para:* ${targetName}\n📋 *Tarea:* ${task.title}\n📅 *Fecha:* ${task.startDate}\n⏰ *Hora:* ${task.startTime || 'S/N'}\n🏢 *Ubicación:* ${task.location || 'N/A'}\n⚡ *Prioridad:* ${task.priority}\n📝 *Descripción:* ${task.description}\n━━━━━━━━━━━━━━\n👨‍✈️ *Asignado por:* ${user.name}\n_Favor confirmar recepción respondiendo "OK"_`;
    
    window.open(`https://wa.me/${phone.startsWith('34') ? phone : '34'+phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="w-full max-w-sm mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header Calendario */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center shadow-lg">
            <CalendarIcon className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase text-gray-900 tracking-tighter leading-none">Mi Agenda</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
              {currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => changeMonth(-1)} className="p-3 bg-white border border-gray-100 rounded-xl shadow-sm active:scale-90"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => changeMonth(1)} className="p-3 bg-white border border-gray-100 rounded-xl shadow-sm active:scale-90"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Buscador */}
      <div className="px-2">
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-yellow-500 transition-colors">
            <Search className="w-4 h-4" />
          </div>
          <input 
            type="text"
            placeholder="BUSCAR EN LA AGENDA..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-[10px] font-black uppercase tracking-widest outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/10 transition-all shadow-sm"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {searchQuery.trim() ? (
        /* Resultados de Búsqueda */
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
              <Search className="w-3 h-3" />
              Resultados para "{searchQuery}"
            </h3>
            <span className="text-[8px] font-black bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {filteredSearchTasks.length} ENCONTRADOS
            </span>
          </div>

          <div className="space-y-3">
            {filteredSearchTasks.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-100">
                <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">No se encontraron coincidencias</p>
              </div>
            ) : (
              filteredSearchTasks.map((task, idx) => (
                <div 
                  key={`search-${task.id}-${idx}`}
                  onClick={() => {
                    setSelectedDate(new Date(task.startDate));
                    setSearchQuery('');
                  }}
                  className="bg-white rounded-[2rem] p-5 shadow-sm border border-gray-100 hover:border-yellow-400 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${getPriorityColor(task.priority)}`}>
                        <CalendarIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-black text-[11px] uppercase text-gray-900 leading-none group-hover:text-yellow-600 transition-colors">{task.title}</h4>
                        <p className="text-[8px] font-bold text-gray-400 uppercase mt-1">{task.startDate} · {task.startTime || 'S/N'}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-yellow-500 transition-all" />
                  </div>
                  <p className="text-[9px] text-gray-500 font-bold line-clamp-1 uppercase tracking-tight">{task.description}</p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Grid del Mes */}
      <div className="bg-white rounded-[2.5rem] p-6 border border-gray-100 shadow-sm">
        <div className="grid grid-cols-7 gap-1 mb-4">
          {['L','M','X','J','V','S','D'].map(d => (
            <div key={d} className="text-center text-[9px] font-black text-gray-300 uppercase py-2">{d}</div>
          ))}
          {daysInMonth.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="h-12" />;
            const dateStr = getLocalDateString(day);
            const dayTasks = tasks.filter(t => t.startDate === dateStr);
            const isSelected = selectedDate.toDateString() === day.toDateString();
            const isToday = new Date().toDateString() === day.toDateString();
            const isDayHoliday = isHoliday(day);
            return (
              <button 
                key={dateStr}
                onClick={() => setSelectedDate(new Date(day))}
                className={`relative h-12 flex flex-col items-center justify-center rounded-xl transition-all active:scale-90 ${isSelected ? 'bg-gray-900 text-white shadow-xl scale-110 z-10' : isToday ? 'bg-yellow-50 text-gray-900' : isDayHoliday ? 'bg-amber-50 text-amber-700' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <span className={`text-[11px] font-black ${isSelected ? 'text-white' : isDayHoliday ? 'text-amber-700' : 'text-gray-900'}`}>{day.getDate()}</span>
                <div className="flex flex-col items-center gap-0.5 mt-1">
                  {isDayHoliday && (
                    <div className="text-[6px] font-black uppercase text-amber-500 leading-none mb-0.5">Festivo</div>
                  )}
                  {dayTasks.length > 0 && (
                    <div className="flex gap-0.5">
                      {dayTasks.slice(0, 3).map((t, i) => (
                        <div key={i} className={`w-1 h-1 rounded-full ${getPriorityColor(t.priority)}`} />
                      ))}
                    </div>
                  )}
                  {storageService.getUsers().some(u => u.isManto && u.leaveDays?.includes(dateStr)) && (
                    <div className="w-4 h-0.5 bg-red-400 rounded-full" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Agenda Diaria */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
           <h3 className="text-sm font-black uppercase text-gray-900 tracking-widest flex items-center gap-2">
             <Clock className="w-4 h-4 text-yellow-500" />
             Tareas del {selectedDate.getDate()} de {selectedDate.toLocaleString('es-ES', { month: 'short' })}
           </h3>
           <button 
            onClick={() => { setEditingTask(undefined); setShowForm(true); }}
            className="p-3 bg-yellow-400 text-black rounded-xl shadow-lg active:scale-95 flex items-center gap-2 text-[9px] font-black uppercase"
           >
             <Plus className="w-4 h-4" /> Nueva
           </button>
        </div>

        {/* Técnicos de Baja/Libres */}
        {techniciansOff.length > 0 && (
          <div className="px-2">
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[8px] font-black text-red-400 uppercase tracking-widest mb-1">Técnicos no disponibles</div>
                <div className="flex flex-wrap gap-2">
                  {techniciansOff.map(tech => (
                    <div key={tech.id} className="flex flex-col">
                      <span className="text-[10px] font-black text-red-600 uppercase">{tech.name}</span>
                      {tech.leaveType && (
                        <span className="text-[7px] font-bold text-red-400 uppercase tracking-tighter">{tech.leaveType}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {selectedTasks.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-100 flex flex-col items-center gap-3">
              <CalendarIcon className="w-10 h-10 text-gray-200" />
              <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Sin trabajos programados</p>
            </div>
          ) : (
            selectedTasks.map((task, idx) => (
              <div 
                key={`${task.id}-${idx}`} 
                className={`bg-white rounded-[2rem] p-5 shadow-sm border transition-all ${task.status === 'Completada' ? 'border-green-100 opacity-60' : 'border-gray-100'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${getPriorityColor(task.priority)}`}>
                      {task.priority === 'Crítica' ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="font-black text-[11px] uppercase text-gray-900 leading-none">{task.title}</h4>
                      <p className="text-[8px] font-bold text-gray-400 uppercase mt-1">{task.type} · {task.startTime || 'Todo el día'}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleToggleTaskStatus(task)}
                    className={`p-2 rounded-lg transition-colors ${task.status === 'Completada' ? 'text-green-500 bg-green-50' : 'text-gray-200 hover:text-green-500'}`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Asignaciones Resumen */}
                <div className="flex flex-wrap gap-1 mb-4">
                   {task.assignedTo.length > 0 && (
                     <div className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full text-[7px] font-black uppercase flex items-center gap-1 border border-blue-100">
                        <Users className="w-2 h-2" /> {task.assignedTo.length} Técnicos USAC
                     </div>
                   )}
                   {task.externalAssignments?.map(ext => (
                     <div key={ext.id} className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full text-[7px] font-black uppercase flex items-center gap-1 border border-amber-100">
                        <Building className="w-2 h-2" /> {ext.name.substring(0,10)}..
                     </div>
                   ))}
                </div>

                <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-gray-400">
                      <MapPin className="w-3 h-3" />
                      <span className="text-[8px] font-black uppercase">{task.location || 'S/N'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {/* Botón WhatsApp General / Primer Externo */}
                    <button 
                      onClick={() => handleSendToWhatsApp(task, task.externalAssignments?.[0])}
                      className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-all active:scale-90"
                      title="Enviar Orden por WhatsApp"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => { setEditingTask(task); setShowForm(true); }}
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all active:scale-90"
                    >
                      <Plus className="w-4 h-4 rotate-45" />
                    </button>
                    <button 
                      onClick={() => setTaskToDelete(task)}
                      className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all active:scale-90"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )}

  {/* Modal Confirmación Borrado */}
      {taskToDelete && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="w-full max-w-xs bg-white rounded-[2.5rem] p-8 text-center shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                 <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-gray-900 mb-2">¿Eliminar Tarea?</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase leading-relaxed mb-8 tracking-widest px-2">
                Esta acción es irreversible y afectará a los técnicos y contratistas asignados.
              </p>
              <div className="space-y-3">
                 <button onClick={handleDeleteTask} className="w-full p-5 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">Eliminar permanentemente</button>
                 <button onClick={() => setTaskToDelete(null)} className="w-full p-4 text-gray-400 font-black uppercase text-[10px] tracking-widest">Cancelar</button>
              </div>
           </div>
        </div>
      )}

      {showForm && (
        <TaskForm 
          user={user} 
          initialDate={getLocalDateString(selectedDate)}
          task={editingTask}
          onClose={() => { setShowForm(false); setEditingTask(undefined); }} 
        />
      )}
    </div>
  );
};

export default CalendarView;
