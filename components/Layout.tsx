
import React, { useState, useEffect } from 'react';
import { ShieldCheck, ChevronLeft, Crown, User as UserIcon, Home as HomeIcon, Calendar as CalendarIcon, Bell } from 'lucide-react';
import { AppTab, User, CalendarTask, AppNotification } from '../types';
import { storageService } from '../services/storageService';
import { getLocalDateString } from '../services/dateUtils';
import NotificationCenter from './NotificationCenter';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  onBack?: () => void;
  goHome?: () => void;
  hideNav?: boolean;
  hideHeader?: boolean;
  user?: User | null;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, onBack, goHome, hideNav, hideHeader, user }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [todayTasksCount, setTodayTasksCount] = useState(0);

  const isMaster = user?.role === 'MASTER';
  const isUSAC = user?.role === 'USAC' || isMaster;

  useEffect(() => {
    if (user) {
      const updateBadges = () => {
        const notifications = storageService.getNotifications(user.id);
        setUnreadCount(notifications.filter(n => !n.read).length);

        const tasks = storageService.getTasks();
        const todayStr = getLocalDateString();
        const count = tasks.filter(t => t.startDate === todayStr && t.status !== 'Completada').length;
        setTodayTasksCount(count);
      };
      
      updateBadges();
      const interval = setInterval(updateBadges, 10000);
      return () => clearInterval(interval);
    }
  }, [user]);

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-gray-50 shadow-2xl relative overflow-hidden text-gray-900">
      {/* Header Premium - Tactical Designer Edition */}
      {!hideHeader && (
        <header className={`p-4 sticky top-0 z-40 flex items-center justify-between transition-all duration-500 ${isMaster ? 'bg-tactical-orange shadow-[0_4px_20px_rgba(242,125,38,0.3)]' : 'bg-white border-b border-gray-100'}`}>
          <div className="flex items-center gap-3">
            {goHome && (
              <button onClick={goHome} className={`p-2.5 rounded-2xl transition-all active:scale-90 shadow-sm ${isMaster ? 'bg-black/10 text-black hover:bg-black/20' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                <HomeIcon className="w-5 h-5" />
              </button>
            )}
            {onBack && (
              <button onClick={onBack} className={`p-2.5 rounded-2xl transition-all active:scale-90 shadow-sm ${isMaster ? 'bg-black/10 text-black hover:bg-black/20' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-3 ml-1">
              <div className="relative group">
                {isMaster && (
                  <div className="absolute inset-0 bg-white/40 rounded-2xl blur-lg animate-pulse" />
                )}
                <div className={`${isMaster ? 'bg-black' : 'bg-tactical-orange'} p-2.5 rounded-2xl shadow-xl relative z-10 transform transition-transform group-hover:scale-105`}>
                  {isMaster ? <Crown className="w-5 h-5 text-tactical-orange" /> : <ShieldCheck className="w-5 h-5 text-white" />}
                </div>
              </div>
              <div className="flex flex-col">
                <h1 className={`text-base font-black tracking-tighter uppercase leading-none ${isMaster ? 'text-black' : 'text-gray-900'}`}>
                  {isMaster ? 'MASTER' : 'SIGAI'}
                </h1>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${isMaster ? 'bg-black animate-pulse' : 'bg-tactical-orange'}`} />
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isMaster ? 'text-black/60' : 'text-gray-400'}`}>
                    {user?.name.split(' ')[0] || 'OPERADOR'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5">
            {user && (
              <>
                <button 
                  onClick={() => setActiveTab(AppTab.CALENDAR)}
                  className={`p-3 rounded-2xl relative transition-all active:scale-90 shadow-sm ${isMaster ? 'bg-black/10 text-black hover:bg-black/20' : 'bg-gray-50 text-gray-600 border border-gray-100'}`}
                >
                  <CalendarIcon className="w-5 h-5" />
                  {todayTasksCount > 0 && (
                    <span className={`absolute -top-1 -right-1 w-5 h-5 text-[9px] font-black flex items-center justify-center rounded-full shadow-lg border-2 ${isMaster ? 'bg-black text-tactical-orange border-tactical-orange' : 'bg-red-500 text-white border-white'}`}>
                      {todayTasksCount}
                    </span>
                  )}
                </button>

                <button 
                  onClick={() => setShowNotifications(true)}
                  className={`p-3 rounded-2xl relative transition-all active:scale-90 shadow-sm ${isMaster ? 'bg-black/10 text-black hover:bg-black/20' : 'bg-gray-50 text-gray-600 border border-gray-100'}`}
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className={`absolute -top-1 -right-1 w-5 h-5 text-[9px] font-black flex items-center justify-center rounded-full shadow-lg border-2 ${isMaster ? 'bg-black text-tactical-orange border-tactical-orange' : 'bg-red-500 text-white border-white'}`}>
                      {unreadCount}
                    </span>
                  )}
                </button>

                <button 
                  onClick={() => setActiveTab(AppTab.SETTINGS)}
                  className={`group p-1 rounded-2xl transition-all active:scale-90 ${isMaster ? 'bg-black/10 hover:bg-black/20' : 'bg-gray-50 border border-gray-100 hover:bg-gray-100'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner transition-colors ${isMaster ? 'bg-black text-tactical-orange' : 'bg-white text-tactical-orange'}`}>
                    <UserIcon className="w-5 h-5" />
                  </div>
                </button>
              </>
            )}
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1 p-5 w-full flex flex-col items-center">
        {children}
      </main>

      {showNotifications && user && (
        <NotificationCenter 
          userId={user.id} 
          onClose={() => setShowNotifications(false)} 
          onTaskClick={(taskId) => {
            setShowNotifications(false);
            setActiveTab(AppTab.CALENDAR);
          }}
        />
      )}
    </div>
  );
};

export default Layout;
