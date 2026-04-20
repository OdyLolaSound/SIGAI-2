
import React, { useState, useEffect } from 'react';
import { X, Bell, Trash2, Calendar, CheckCircle2, AlertCircle, ShieldCheck, Clock } from 'lucide-react';
import { AppNotification } from '../types';
import { storageService } from '../services/storageService';

interface NotificationCenterProps {
  userId: string;
  onClose: () => void;
  onTaskClick: (taskId: string) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ userId, onClose, onTaskClick }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    setNotifications(storageService.getNotifications(userId));
  }, [userId]);

  const handleMarkRead = (id: string) => {
    storageService.markNotificationAsRead(id);
    setNotifications(storageService.getNotifications(userId));
  };

  const handleDeleteOne = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // Optimistic update
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await storageService.deleteNotification(id);
    } catch (error) {
      // Rollback if failed
      setNotifications(storageService.getNotifications(userId));
    }
  };

  const handleClearAll = async () => {
    // Optimistic update
    setNotifications([]);
    try {
      await storageService.clearNotifications(userId);
    } catch (error) {
      // Rollback if failed
      setNotifications(storageService.getNotifications(userId));
    }
  };

  const getTypeIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'task_assigned': return <Calendar className="w-4 h-4 text-blue-500" />;
      case 'task_overdue': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'task_completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      default: return <Bell className="w-4 h-4 text-yellow-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-300">
      <div onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-[320px] bg-gray-50 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 border-l border-gray-100">
        <header className="p-8 bg-white text-gray-900 flex justify-between items-center shrink-0 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-tactical-orange/10 rounded-2xl border border-tactical-orange/20">
              <Bell className="w-6 h-6 text-tactical-orange" />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tighter">Alertas</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{notifications.filter(n => !n.read).length} pendientes</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-300 hover:text-gray-900 transition-all active:scale-90"><X className="w-6 h-6" /></button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
          <div className="flex justify-between items-center px-2 mb-4">
            <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Histórico de Mensajes</span>
            <button onClick={handleClearAll} className="text-[9px] font-black uppercase text-red-500 flex items-center gap-1 hover:text-red-600 transition-colors">
               <Trash2 className="w-3 h-3" /> Limpiar
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-20 gap-4 text-gray-400">
               <ShieldCheck className="w-16 h-16" />
               <p className="text-[10px] font-black uppercase tracking-widest">Sin notificaciones</p>
            </div>
          ) : (
            notifications.map((n, idx) => (
              <div 
                key={`${n.id}-${idx}`} 
                onClick={() => {
                  handleMarkRead(n.id);
                  if (n.relatedId) onTaskClick(n.relatedId);
                }}
                className={`group p-5 rounded-[2rem] border transition-all active:scale-95 relative overflow-hidden cursor-pointer ${n.read ? 'bg-white border-gray-100 opacity-60' : 'bg-white border-tactical-orange/20 shadow-lg shadow-tactical-orange/5'}`}
              >
                {!n.read && <div className="absolute top-0 right-0 w-8 h-8 bg-tactical-orange rounded-bl-3xl flex items-center justify-center"><div className="w-2 h-2 bg-black rounded-full animate-pulse" /></div>}
                <div className="flex gap-4">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${n.read ? 'bg-gray-50' : 'bg-gray-50 shadow-sm border border-gray-100'}`}>
                    {getTypeIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className={`text-[11px] font-black uppercase leading-none mb-1 ${n.read ? 'text-gray-500' : 'text-gray-900'}`}>{n.title}</h4>
                      <button 
                        onClick={(e) => handleDeleteOne(e, n.id)}
                        className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                        title="Eliminar notificación"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-snug line-clamp-2">{n.message}</p>
                    <div className="flex items-center gap-2 mt-3 text-[8px] font-black text-gray-300 uppercase">
                      <Clock className="w-3 h-3" />
                      {new Date(n.date).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </main>

        <footer className="p-8 bg-white border-t border-gray-100 text-center">
           <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest">SIGAI-USAC v1.1 © 2026</p>
        </footer>
      </div>
    </div>
  );
};

export default NotificationCenter;
