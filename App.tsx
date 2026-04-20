
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import History from './components/History';
import Scanner from './components/Scanner';
import AuthModal from './components/AuthModal';
import AdminPanel from './components/AdminPanel';
import AIRequestFlow from './components/AIRequestFlow';
import AIMaterialFlow from './components/AIMaterialFlow';
import USACManagerPanel from './components/USACManagerPanel';
import CalendarView from './components/CalendarView';
import UnitDashboard from './components/UnitDashboard';
import TeamPanel from './components/TeamPanel';
import GasoilModule from './components/GasoilModule';
import BoilersDashboard from './components/BoilersDashboard';
import SalModule from './components/SalModule';
import TemperatureModule from './components/TemperatureModule';
import MaintenanceModule from './components/MaintenanceModule';
import WaterSyncModule from './components/WaterSyncModule';
import ToolsModule from './components/ToolsModule';
import LaborCalendar from './components/LaborCalendar';
import OCAModule from './components/OCAModule';
import PPTModule from './components/PPTModule';
import BlueprintsModule from './components/BlueprintsModule';
import { RTIModule } from './components/RTIModule';
import VoiceAssistant from './components/VoiceAssistant';
import { AppTab, ServiceType, Building, User, Role } from './types';
import { Zap, Droplets, Flame, ShieldCheck, ChevronRight, User as UserIcon, LogOut, Crown, PlusCircle, LayoutGrid, UserPlus, MessageSquare, Package, ClipboardList, Calendar, Users, Bell, Phone, CheckCircle, Info, Mic } from 'lucide-react';
import { storageService, BUILDINGS } from './services/storageService';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, getDocFromServer } from 'firebase/firestore';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    const saved = localStorage.getItem('sigai_active_tab');
    return (saved as AppTab) || AppTab.HOME;
  });
  const [currentUser, setCurrentUser] = useState<User | null>(storageService.getCurrentUser());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authRole, setAuthRole] = useState<Role | null>(null);
  const [authInitialView, setAuthInitialView] = useState<'login' | 'register'>('login');
  
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(() => {
    const saved = localStorage.getItem('sigai_selected_building');
    return saved ? JSON.parse(saved) : null;
  });
  const [selectedService, setSelectedService] = useState<ServiceType | null>(() => {
    const saved = localStorage.getItem('sigai_selected_service');
    return (saved as ServiceType) || null;
  });
  const [unitMenuOpen, setUnitMenuOpen] = useState(() => {
    return localStorage.getItem('sigai_unit_menu_open') === 'true';
  });
  const [activeUnit, setActiveUnit] = useState<Role | null>(() => {
    return (localStorage.getItem('sigai_active_unit') as Role) || null;
  });
  const [isSyncing, setIsSyncing] = useState(true);
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);

  useEffect(() => {
    // Test Firestore connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, '_connection_test_', 'ping'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        }
      }
    };
    testConnection();

    // Initialize storage immediately
    storageService.init();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        storageService.startListeners(firebaseUser.uid);
        
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            setCurrentUser(userData);
            storageService.setCurrentUser(userData);
          } else {
            // If it's the master admin (email check)
            if (firebaseUser.email === 'JCYebenes@gmail.com' || firebaseUser.email === 'jyebavi@sigai.local') {
              const masterUser: User = {
                id: firebaseUser.uid,
                name: firebaseUser.email === 'jyebavi@sigai.local' ? 'Jyebavi' : 'Administrador Maestro',
                username: firebaseUser.email === 'jyebavi@sigai.local' ? 'jyebavi' : 'admin',
                password: '', // No password needed for OAuth/Firebase Auth
                role: 'MASTER',
                status: 'approved',
                userCategory: 'Oficina de Control',
                assignedBuildings: BUILDINGS.map(b => b.id),
                assignedUnits: ['USAC', 'GCG', 'BOEL', 'GOE4', 'CG', 'GOE3', 'UMOE', 'CECOM'],
                isManto: true,
                leaveDays: []
              };
              await storageService.saveUser(masterUser);
              setCurrentUser(masterUser);
              storageService.setCurrentUser(masterUser);
            } else {
              await signOut(auth);
              setCurrentUser(null);
              storageService.setCurrentUser(null);
            }
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        storageService.stopListeners();
        setCurrentUser(null);
        storageService.setCurrentUser(null);
      }
      setIsSyncing(false);
    });

    // Fallback for syncing to ensure app loads even if auth is slow
    const syncTimeout = setTimeout(() => {
      setIsSyncing(false);
    }, 5000);

    return () => {
      unsubscribe();
      clearTimeout(syncTimeout);
    };
  }, []);

  // Estados para pruebas de notificaciones
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('Service Worker registrado', reg))
        .catch(err => console.error('Error al registrar SW', err));
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert("Este navegador no soporta notificaciones de escritorio");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    
    if (permission === 'granted') {
      new Notification("✅ Notificaciones Activadas", {
        body: "Ahora recibirás alertas de SIGAI-USAC en este dispositivo.",
        icon: "https://ais-pre-4jwwkcx7pzgifiy2cotbsm-512452537019.europe-west2.run.app/favicon.ico"
      });
    }
  };

  useEffect(() => {
    // Reset to HOME if state is inconsistent (e.g. requires user but no user)
    const authRequiredTabs = [
      AppTab.CALENDAR, AppTab.TEAM, AppTab.AI_REQUEST, AppTab.AI_MATERIAL, 
      AppTab.USAC_MANAGER, AppTab.GASOIL, AppTab.BOILERS, AppTab.SALT, 
      AppTab.TEMPERATURES, AppTab.MAINTENANCE, AppTab.WATER_SYNC, AppTab.TOOLS
    ];
    
    if (!currentUser && authRequiredTabs.includes(activeTab)) {
      setActiveTab(AppTab.HOME);
    }
    
    if (!currentUser && unitMenuOpen) {
      setUnitMenuOpen(false);
    }
  }, [currentUser, activeTab, unitMenuOpen]);

  useEffect(() => {
    localStorage.setItem('sigai_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (selectedBuilding) localStorage.setItem('sigai_selected_building', JSON.stringify(selectedBuilding));
    else localStorage.removeItem('sigai_selected_building');
  }, [selectedBuilding]);

  useEffect(() => {
    if (selectedService) localStorage.setItem('sigai_selected_service', selectedService);
    else localStorage.removeItem('sigai_selected_service');
  }, [selectedService]);

  useEffect(() => {
    localStorage.setItem('sigai_unit_menu_open', unitMenuOpen.toString());
  }, [unitMenuOpen]);

  useEffect(() => {
    if (activeUnit) localStorage.setItem('sigai_active_unit', activeUnit);
    else localStorage.removeItem('sigai_active_unit');
  }, [activeUnit]);

  const isMaster = currentUser?.role === 'MASTER';
  const isAuthorized = currentUser?.role === 'USAC' || isMaster;
  
  const hideNav = currentUser !== null;
  const hideHeader = false;

  const handleUnitClick = (role: Role) => {
    if (currentUser && (isMaster || currentUser.assignedUnits?.includes(role))) {
      setActiveUnit(role);
      setUnitMenuOpen(true);
      return;
    }
    setAuthRole(role);
    setAuthInitialView('login');
    setShowAuthModal(true);
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setShowAuthModal(false);
    setUnitMenuOpen(false);
    setSelectedService(null);
  };

  const handleTestPush = () => {
    setPushStatus("Simulando envío...");
    
    // Notificación interna (en la app)
    setTimeout(() => {
      storageService.addNotification({
        id: crypto.randomUUID(),
        userId: currentUser!.id,
        title: '🔔 PRUEBA DE PUSH',
        message: 'Las notificaciones del sistema SIGAI funcionan correctamente.',
        type: 'system',
        read: false,
        date: new Date().toISOString()
      });

      // Notificación real del navegador
      if (notificationPermission === 'granted') {
        try {
          const options = {
            body: 'Las notificaciones del sistema SIGAI funcionan correctamente.',
            icon: 'https://ais-pre-4jwwkcx7pzgifiy2cotbsm-512452537019.europe-west2.run.app/favicon.ico',
            vibrate: [200, 100, 200]
          };
          
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(registration => {
              registration.showNotification('🔔 PRUEBA DE PUSH', options);
            });
          } else {
            new Notification('🔔 PRUEBA DE PUSH', options);
          }
        } catch (e) {
          console.error("Error al disparar notificación nativa", e);
        }
      }

      setPushStatus("✅ ¡Enviado!");
      setTimeout(() => setPushStatus(null), 2000);
    }, 1000);
  };

  const handleTestWhatsApp = () => {
    const phone = currentUser?.phone?.replace(/\+/g, '') || '';
    if (!phone) return alert("Configure su teléfono en el perfil primero.");
    const msg = `🔔 *PRUEBA DE NOTIFICACIÓN SIGAI*\n\nSi has recibido este mensaje, las notificaciones de WhatsApp para la Unidad ${currentUser?.role} están operativas.\n\n_S.E.u.O. USAC 2026_`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleServiceClick = (service: ServiceType) => {
    setSelectedService(service);
    setUnitMenuOpen(false);
    
    if (service === 'luz') {
      setSelectedBuilding(null);
      setActiveTab(AppTab.HOME); // This will trigger the building selection in renderContent
    } else {
      setSelectedBuilding(null);
      setActiveTab(AppTab.HOME);
    }
  };

  const handleRequestClick = (type: 'peticion' | 'material') => {
    if (type === 'peticion') {
      setActiveTab(AppTab.AI_REQUEST);
    } else if (type === 'material') {
      setActiveTab(AppTab.AI_MATERIAL);
    }
  };

  const handleGoHome = () => {
    setActiveTab(AppTab.HOME);
    setUnitMenuOpen(false);
    setSelectedService(null);
    setSelectedBuilding(null);
    setActiveUnit(null);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    storageService.setCurrentUser(null);
    setActiveTab(AppTab.HOME);
    setSelectedService(null);
    setSelectedBuilding(null);
    setUnitMenuOpen(false);
    setActiveUnit(null);
    localStorage.removeItem('sigai_active_tab');
    localStorage.removeItem('sigai_selected_building');
    localStorage.removeItem('sigai_selected_service');
    localStorage.removeItem('sigai_unit_menu_open');
    localStorage.removeItem('sigai_active_unit');
  };

  const handleBack = () => {
    if ([AppTab.AI_REQUEST, AppTab.AI_MATERIAL, AppTab.USAC_MANAGER, AppTab.CALENDAR, AppTab.TEAM, AppTab.GASOIL, AppTab.BOILERS, AppTab.SALT, AppTab.TEMPERATURES, AppTab.MAINTENANCE, AppTab.WATER_SYNC, AppTab.HISTORY, AppTab.TOOLS, AppTab.OCA, AppTab.PPTS, AppTab.BLUEPRINTS, AppTab.RTI].includes(activeTab)) {
       setActiveTab(AppTab.HOME);
       setUnitMenuOpen(true);
       return;
    }
    if (activeTab !== AppTab.HOME) { 
      if (selectedService === 'luz' && activeTab === AppTab.SCAN) {
        setSelectedBuilding(null);
        setSelectedService(null);
        setUnitMenuOpen(true);
        setActiveTab(AppTab.HOME);
        return;
      }
      setActiveTab(AppTab.HOME); 
      return; 
    }
    if (selectedBuilding) { setSelectedBuilding(null); }
    else if (selectedService) { setSelectedService(null); setUnitMenuOpen(true); }
    else if (unitMenuOpen) { 
      setUnitMenuOpen(false); 
      setActiveUnit(null);
    }
  };

  if (isSyncing) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center z-[100]">
        <div className="w-20 h-20 bg-yellow-400 rounded-3xl flex items-center justify-center animate-bounce shadow-2xl mb-8">
          <ShieldCheck className="w-10 h-10 text-black" />
        </div>
        <h2 className="text-white font-black uppercase tracking-[0.3em] text-xs animate-pulse">Sincronizando SIGAI Cloud...</h2>
        <p className="text-gray-500 text-[8px] font-bold uppercase tracking-widest mt-4">Conectando con el servidor central USAC</p>
      </div>
    );
  }

  const renderContent = () => {
    if (activeTab === AppTab.HISTORY) {
      return <History serviceType={selectedService || undefined} building={selectedBuilding || undefined} role={currentUser?.role || 'USAC'} onNavigate={(tab) => setActiveTab(tab)} />;
    }

    if (activeTab === AppTab.CALENDAR && currentUser) {
      return <CalendarView user={currentUser} activeUnit={activeUnit || currentUser.role} onNavigate={setActiveTab} />;
    }

    if (activeTab === AppTab.BOILERS && currentUser) {
      return <BoilersDashboard user={currentUser} onNavigate={setActiveTab} />;
    }

    if (activeTab === AppTab.GASOIL && currentUser) {
      return <GasoilModule user={currentUser} onNavigate={setActiveTab} />;
    }

    if (activeTab === AppTab.SALT && currentUser) {
      return <SalModule user={currentUser} onNavigate={setActiveTab} />;
    }

    if (activeTab === AppTab.TEMPERATURES && currentUser) {
      return <TemperatureModule user={currentUser} onNavigate={setActiveTab} />;
    }

    if (activeTab === AppTab.MAINTENANCE && currentUser) {
      return <MaintenanceModule user={currentUser} onNavigate={setActiveTab} />;
    }

    if (activeTab === AppTab.WATER_SYNC && currentUser) {
      return <WaterSyncModule user={currentUser} onNavigate={setActiveTab} />;
    }

    if (activeTab === AppTab.BLUEPRINTS && (currentUser?.role === 'MASTER' || currentUser?.userCategory === 'Oficina de Control')) return <BlueprintsModule user={currentUser} />;
    if (activeTab === AppTab.PPTS && (currentUser?.role === 'MASTER' || currentUser?.userCategory === 'Oficina de Control')) return <PPTModule user={currentUser} />;
    if (activeTab === AppTab.OCA && (currentUser?.role === 'MASTER' || currentUser?.userCategory === 'Oficina de Control')) return <OCAModule />;
    if (activeTab === AppTab.RTI && (currentUser?.role === 'MASTER' || currentUser?.userCategory === 'Oficina de Control')) return <RTIModule />;

    if (activeTab === AppTab.TOOLS) {
      return <ToolsModule onBack={() => { setActiveTab(AppTab.HOME); setUnitMenuOpen(true); }} />;
    }

    if (activeTab === AppTab.TEAM && currentUser) {
      return <TeamPanel currentUser={currentUser} activeUnit={activeUnit || currentUser.role} />;
    }

    if (activeTab === AppTab.AI_REQUEST && currentUser) {
      return (
        <AIRequestFlow 
          user={currentUser} 
          onClose={() => { setActiveTab(AppTab.HOME); setUnitMenuOpen(true); }} 
          onComplete={() => { alert("Petición registrada correctamente."); setActiveTab(AppTab.HOME); setUnitMenuOpen(true); }} 
        />
      );
    }

    if (activeTab === AppTab.AI_MATERIAL && currentUser) {
      return (
        <AIMaterialFlow 
          user={currentUser}
          onClose={() => { setActiveTab(AppTab.HOME); setUnitMenuOpen(true); }}
          onComplete={() => { alert("Solicitud de material enviada a almacén."); setActiveTab(AppTab.HOME); setUnitMenuOpen(true); }}
        />
      );
    }

    if (activeTab === AppTab.USAC_MANAGER && currentUser) {
      return (
        <USACManagerPanel 
          currentUser={currentUser} 
        />
      );
    }

    if (!selectedService && !unitMenuOpen && activeTab === AppTab.HOME) {
      return (
        <div className="flex flex-col items-center w-full py-6 animate-in fade-in zoom-in-95 max-w-sm mx-auto">
          <div className="text-center mb-8 px-4">
            <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase mb-1">SIGAI-USAC</h2>
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.4em]">Gestión de Instalaciones</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 w-full px-2">
            {currentUser?.assignedUnits?.includes('USAC') && <UnitButton icon="🏢" label='USAC "Rojas Navarrete"' onClick={() => handleUnitClick('USAC')} full />}
            {currentUser?.assignedUnits?.includes('CG') && <UnitButton icon="🏛️" label="Cuartel General" onClick={() => handleUnitClick('CG')} />}
            {currentUser?.assignedUnits?.includes('GCG') && <UnitButton icon="👥" label="Grupo C. General" onClick={() => handleUnitClick('GCG')} />}
            {currentUser?.assignedUnits?.includes('GOE3') && <UnitButton icon="⚔️" label="GOE III" onClick={() => handleUnitClick('GOE3')} />}
            {currentUser?.assignedUnits?.includes('GOE4') && <UnitButton icon="⚔️" label="GOE IV" onClick={() => handleUnitClick('GOE4')} />}
            {currentUser?.assignedUnits?.includes('BOEL') && <UnitButton icon="🦅" label="BOEL XIX" onClick={() => handleUnitClick('BOEL')} />}
            {currentUser?.assignedUnits?.includes('UMOE') && <UnitButton icon="🎖️" label="UMOE" onClick={() => handleUnitClick('UMOE')} />}
            {currentUser?.assignedUnits?.includes('CECOM') && <UnitButton icon="📡" label="CECOM" onClick={() => handleUnitClick('CECOM')} />}
          </div>

          <div className="w-full px-2 mt-8 space-y-4">
            <button 
              onClick={() => { 
                setAuthRole('USAC'); 
                setAuthInitialView('login');
                setShowAuthModal(true); 
              }}
              className="w-full p-6 bg-white border-2 border-gray-900 text-gray-900 rounded-[2rem] font-black uppercase tracking-widest text-[11px] shadow-lg flex items-center justify-center gap-4 active:scale-95 transition-all"
            >
              <UserPlus className="w-5 h-5" /> Solicitar Registro / Alta Técnico
            </button>

            {isAuthorized && (
              <button onClick={() => setActiveTab(AppTab.ADMIN)} className="w-full p-6 bg-gray-900 text-yellow-400 rounded-[2rem] font-black uppercase tracking-widest text-[11px] shadow-2xl flex items-center justify-center gap-4 active:scale-95 transition-all">
                <ShieldCheck className="w-5 h-5" /> {isMaster ? 'Control Maestro SIGAI' : 'Panel Gestión USAC'}
              </button>
            )}
          </div>
        </div>
      );
    }

    if (unitMenuOpen && !selectedService && currentUser && activeTab === AppTab.HOME) {
      return (
        <UnitDashboard 
          user={currentUser}
          activeUnit={activeUnit || currentUser.role}
          onNavigate={setActiveTab}
          onServiceClick={handleServiceClick}
          onRequestClick={handleRequestClick}
        />
      );
    }
    
    if (selectedService && !selectedBuilding) {
      let visibleBuildings = BUILDINGS.filter(b => isMaster || b.unit === currentUser?.role || currentUser?.role === 'USAC');
      
      // Filter for Luz specific sites if service is Luz
      if (selectedService === 'luz') {
        visibleBuildings = BUILDINGS.filter(b => b.id === 'CT_1_2' || b.id === 'CT_3' || b.id === 'BASE_ALICANTE');
      }

      return (
        <div className="space-y-4 py-6 w-full max-w-sm mx-auto animate-in slide-in-from-bottom-5">
          <div className="text-center mb-8 px-4">
            <h2 className="text-2xl font-black uppercase tracking-tight">Seleccionar Edificio</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{selectedService.toUpperCase()}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 px-2">
            {visibleBuildings.map(b => (
              <button 
                key={b.id} 
                onClick={() => {
                  setSelectedBuilding(b);
                  setActiveTab(AppTab.SCAN);
                }} 
                className="w-full flex items-center justify-between p-7 bg-white border-2 border-gray-50 rounded-[2.5rem] hover:border-gray-900 transition-all active:scale-95 shadow-sm group"
              >
                <div className="text-left">
                  <div className="font-black text-lg uppercase text-gray-900">{b.name}</div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{b.code}</div>
                </div>
                <ChevronRight className="text-gray-200 group-hover:text-gray-900 group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (selectedBuilding && selectedService) {
      if (activeTab === AppTab.DASHBOARD) return <Dashboard serviceType={selectedService} building={selectedBuilding} role={currentUser!.role} onNavigate={(tab) => setActiveTab(tab)} />;
      if (activeTab === AppTab.SCAN) return <Scanner serviceType={selectedService} building={selectedBuilding} user={currentUser!} onComplete={() => setActiveTab(AppTab.DASHBOARD)} />;
    }

    if (activeTab === AppTab.ADMIN && isAuthorized && currentUser) return <AdminPanel currentUser={currentUser} />;
    
    if (activeTab === AppTab.SETTINGS && currentUser) return (
      <div className="p-6 space-y-10 max-w-sm mx-auto w-full pb-12">
         <div>
           <h2 className="text-2xl font-black uppercase tracking-tighter mb-4">Mi Perfil</h2>
           <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className={`p-4 rounded-2xl ${isMaster ? 'bg-yellow-400 text-black' : 'bg-gray-900 text-yellow-400'}`}>
                   {isMaster ? <Crown /> : <UserIcon />}
                 </div>
                 <div>
                   <div className="font-black uppercase text-sm">{currentUser.name}</div>
                   <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{currentUser.role}</div>
                 </div>
              </div>
              <button onClick={handleLogout} className="p-4 text-red-500 hover:bg-red-50 rounded-2xl transition-colors">
                <LogOut />
              </button>
           </div>
         </div>

          {/* Gestión de Permisos (Solo para Técnicos Manto y USAC) */}
          {(currentUser.isManto || currentUser.role === 'USAC' || isMaster) && (
            <div className="space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 px-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-red-500" /> Calendario Laboral / Permisos
              </h3>
              <LaborCalendar user={currentUser} onUpdate={(updated) => setCurrentUser(updated)} />
            </div>
          )}

         {/* Panel de Pruebas de Notificaciones */}
         <div className="space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 px-2 flex items-center gap-2">
               <Bell className="w-4 h-4 text-yellow-500" /> Diagnóstico de Alertas
            </h3>
            
            <div className="bg-white border border-gray-100 rounded-[3rem] p-8 shadow-sm space-y-8">
               <div className="space-y-4">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                     <span className="text-gray-400">Push Notifications</span>
                     <span className={notificationPermission === 'granted' ? "text-green-500 flex items-center gap-1" : "text-amber-500 flex items-center gap-1"}>
                        {notificationPermission === 'granted' ? <><CheckCircle className="w-3 h-3" /> Activo</> : <><Info className="w-3 h-3" /> Pendiente</>}
                     </span>
                  </div>
                   {notificationPermission !== 'granted' && (
                     <button 
                       onClick={requestNotificationPermission}
                       className="w-full p-6 bg-yellow-400 text-black rounded-[1.5rem] text-[9px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all mb-4"
                     >
                       Habilitar Notificaciones en este Dispositivo
                     </button>
                   )}

                   <button 
                     onClick={handleTestPush}
                     className="w-full p-6 bg-gray-50 border-2 border-dashed border-gray-200 rounded-[1.5rem] text-[9px] font-black uppercase tracking-widest hover:border-yellow-400 transition-all active:scale-95"
                   >
                     {pushStatus || "Disparar Push de Prueba"}
                   </button>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                     <span className="text-gray-400">WhatsApp Business</span>
                     <span className={currentUser.phone ? "text-green-500 flex items-center gap-1" : "text-amber-500 flex items-center gap-1"}>
                        {currentUser.phone ? <><CheckCircle className="w-3 h-3" /> Configurado</> : <><Info className="w-3 h-3" /> Sin teléfono</>}
                     </span>
                  </div>
                  <button 
                    onClick={handleTestWhatsApp}
                    className="w-full p-6 bg-green-200 border-2 border-dashed border-green-300 text-green-700 rounded-[1.5rem] text-[9px] font-black uppercase tracking-widest hover:bg-green-100 transition-all active:scale-95 flex items-center justify-center gap-3"
                  >
                    <Phone className="w-4 h-4" /> Enviar Mensaje wa.me
                  </button>
               </div>
            </div>

            <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 flex gap-4">
               <ShieldCheck className="w-8 h-8 text-amber-500 shrink-0" />
               <p className="text-[9px] font-bold text-amber-800 uppercase leading-relaxed tracking-tight">
                 Si las notificaciones no llegan, verifique que los permisos de su navegador estén habilitados para este dominio.
               </p>
            </div>
         </div>
      </div>
    );

    // FALLBACK: If we are here and nothing matched, show the main unit selection
    return (
      <div className="flex flex-col items-center w-full py-6 animate-in fade-in zoom-in-95 max-w-sm mx-auto">
        <div className="text-center mb-8 px-4">
          <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase mb-1">SIGAI-USAC</h2>
          <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.4em]">Gestión de Instalaciones</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4 w-full px-2">
          {(!currentUser || currentUser.assignedUnits?.includes('USAC')) && <UnitButton icon="🏢" label='USAC "Rojas Navarrete"' onClick={() => handleUnitClick('USAC')} full />}
          {(!currentUser || currentUser.assignedUnits?.includes('CG')) && <UnitButton icon="🏛️" label="Cuartel General" onClick={() => handleUnitClick('CG')} />}
          {(!currentUser || currentUser.assignedUnits?.includes('GCG')) && <UnitButton icon="👥" label="Grupo C. General" onClick={() => handleUnitClick('GCG')} />}
          {(!currentUser || currentUser.assignedUnits?.includes('GOE3')) && <UnitButton icon="⚔️" label="GOE III" onClick={() => handleUnitClick('GOE3')} />}
          {(!currentUser || currentUser.assignedUnits?.includes('GOE4')) && <UnitButton icon="⚔️" label="GOE IV" onClick={() => handleUnitClick('GOE4')} />}
          {(!currentUser || currentUser.assignedUnits?.includes('BOEL')) && <UnitButton icon="🦅" label="BOEL XIX" onClick={() => handleUnitClick('BOEL')} />}
          {(!currentUser || currentUser.assignedUnits?.includes('UMOE')) && <UnitButton icon="🎖️" label="UMOE" onClick={() => handleUnitClick('UMOE')} />}
          {(!currentUser || currentUser.assignedUnits?.includes('CECOM')) && <UnitButton icon="📡" label="CECOM" onClick={() => handleUnitClick('CECOM')} />}
        </div>

        <div className="w-full px-2 mt-8 space-y-4">
            <button 
              onClick={() => { 
                setAuthRole('USAC'); 
                setAuthInitialView('login');
                setShowAuthModal(true); 
              }}
              className="w-full p-6 bg-white border-2 border-gray-900 text-gray-900 rounded-[2rem] font-black uppercase tracking-widest text-[11px] shadow-lg flex items-center justify-center gap-4 active:scale-95 transition-all"
            >
              <UserPlus className="w-5 h-5" /> Solicitar Registro / Alta Técnico
            </button>

          {isAuthorized && (
            <button onClick={() => setActiveTab(AppTab.ADMIN)} className="w-full p-6 bg-gray-900 text-yellow-400 rounded-[2rem] font-black uppercase tracking-widest text-[11px] shadow-2xl flex items-center justify-center gap-4 active:scale-95 transition-all">
              <ShieldCheck className="w-5 h-5" /> {isMaster ? 'Control Maestro SIGAI' : 'Panel Gestión USAC'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      onBack={(activeTab !== AppTab.HOME || selectedService || unitMenuOpen) ? handleBack : undefined}
      goHome={handleGoHome}
      hideNav={hideNav}
      user={currentUser}
      hideHeader={hideHeader}
    >
      <div className="flex flex-col items-center w-full">
        {isSyncing ? (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <Zap className="w-12 h-12 text-yellow-400 animate-bounce mb-4" />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Sincronizando con SIGAI Cloud...</p>
          </div>
        ) : (
          <div className="w-full">
            {renderContent()}
          </div>
        )}
      </div>

      {/* Voice Assistant Trigger */}
      {currentUser && activeTab === AppTab.HOME && !selectedService && !unitMenuOpen && (
        <button 
          onClick={() => setShowVoiceAssistant(true)}
          className="fixed bottom-10 right-6 w-14 h-14 bg-gray-900 text-yellow-400 rounded-2xl shadow-2xl flex items-center justify-center active:scale-90 transition-all z-50 border-2 border-yellow-400/20"
        >
          <Mic className="w-6 h-6" />
        </button>
      )}

      {/* Voice Assistant Modal */}
      <VoiceAssistant 
        user={currentUser}
        isOpen={showVoiceAssistant} 
        onClose={() => setShowVoiceAssistant(false)} 
        onNavigate={(tab) => {
          setActiveTab(tab);
          if (tab === AppTab.HOME) {
            setUnitMenuOpen(false);
            setSelectedService(null);
            setSelectedBuilding(null);
          } else {
            setUnitMenuOpen(true);
          }
        }} 
      />

      {showAuthModal && authRole && (
        <AuthModal 
          initialRole={authRole} 
          initialView={authInitialView}
          onLogin={handleLoginSuccess} 
          onClose={() => setShowAuthModal(false)} 
        />
      )}
    </Layout>
  );
};

const UnitButton: React.FC<{ icon: string, label: string, onClick: () => void, full?: boolean }> = ({ icon, label, onClick, full }) => (
  <button 
    onClick={onClick} 
    className={`${full ? 'col-span-2 aspect-auto py-8' : 'aspect-square'} flex flex-col items-center justify-center bg-white rounded-[2.5rem] p-4 shadow-xl transition-all active:scale-95 border-4 border-transparent hover:border-gray-900 group`}
  >
    <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">{icon}</div>
    <div className="font-black uppercase tracking-tighter text-[10px] text-gray-900 text-center leading-none px-2">{label}</div>
  </button>
);

export default App;
