
import React, { useMemo, useState } from 'react';
import { Users, Calendar, CheckCircle, XCircle, ChevronRight, Phone, Mail, Award, Settings2, X, ChevronLeft, Plus, ShieldCheck, Briefcase, FileText, Edit2 } from 'lucide-react';
import { User, LeaveEntry, LeaveType, Role, UserCategory } from '../types';
import { storageService, BUILDINGS } from '../services/storageService';
import { getLocalDateString } from '../services/dateUtils';
import { db } from '../firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';

interface TeamPanelProps {
  currentUser: User;
  activeUnit: Role;
}

const TeamPanel: React.FC<TeamPanelProps> = ({ currentUser, activeUnit }) => {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [managingTech, setManagingTech] = useState<User | null>(null);
  const [editingTech, setEditingTech] = useState<User | null>(null);
  const [isGeneralCalendar, setIsGeneralCalendar] = useState(false);
  const [requestingLeaveTech, setRequestingLeaveTech] = useState<User | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const today = getLocalDateString();

  const isMaster = currentUser.role === 'MASTER';

  React.useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
      setAllUsers(usersData);
    }, (error) => {
      console.error("Error listening to users in TeamPanel:", error);
    });
    return () => unsubscribe();
  }, []);

  const mantoTechs = useMemo(() => {
    return allUsers.filter(u => 
      (u.isManto || u.userCategory === 'Técnico') && 
      u.status === 'approved' && 
      (isMaster || u.assignedUnits?.includes(activeUnit))
    );
  }, [allUsers, activeUnit, isMaster]);

  const isAvailable = (user: User) => {
    return !user.leaveDays || !user.leaveDays.includes(today);
  };

  const handleUpdateLeaveDays = (userId: string, leaveDays: string[]) => {
    storageService.updateUserLeaveDays(userId, leaveDays);
    setAllUsers(storageService.getUsers());
    if (managingTech?.id === userId) {
      setManagingTech(prev => prev ? { ...prev, leaveDays } : null);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-5 duration-500">
      <div className="px-2 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">Equipo USAC Manto</h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em]">Disponibilidad en Tiempo Real</p>
        </div>
        {(currentUser.role === 'MASTER' || currentUser.role === 'USAC') && (
          <button 
            onClick={() => {
              setIsGeneralCalendar(true);
              setManagingTech(mantoTechs[0] || currentUser);
            }}
            className="p-4 bg-gray-900 text-yellow-400 rounded-2xl shadow-xl active:scale-95 transition-all flex flex-col items-center gap-1"
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[7px] font-black uppercase">Calendario</span>
          </button>
        )}
      </div>

      <div className="px-2 space-y-4">
        <button 
          onClick={() => {
            setIsGeneralCalendar(true);
            setManagingTech(mantoTechs[0] || currentUser);
          }}
          className="w-full p-6 bg-white border-2 border-gray-100 rounded-[2rem] shadow-sm flex items-center justify-between group hover:border-yellow-400 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-50 text-yellow-600 rounded-2xl flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="text-left">
              <div className="text-sm font-black uppercase text-gray-900 leading-none mb-1">Calendario Laboral</div>
              <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Alicante · Festivos y Fines</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-yellow-500 transition-colors" />
        </button>

        {(currentUser.role === 'MASTER' || currentUser.role === 'USAC') && (
          <button 
            onClick={() => setShowCreateModal(true)}
            className="w-full p-6 bg-gray-900 text-white rounded-[2rem] shadow-xl flex items-center justify-between group active:scale-95 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-400 text-black rounded-2xl flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div className="text-left">
                <div className="text-sm font-black uppercase leading-none mb-1">Técnicos USAC</div>
                <div className="text-[9px] text-yellow-400/60 font-bold uppercase tracking-widest">Alta de Nuevo Operario</div>
              </div>
            </div>
            <Plus className="w-5 h-5 text-yellow-400" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 px-2">
        {mantoTechs.length === 0 ? (
          <div className="p-10 text-center bg-white rounded-[3rem] border-2 border-dashed border-gray-100">
            <Users className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No hay técnicos de mantenimiento registrados.</p>
          </div>
        ) : (
          mantoTechs.map(tech => {
            const available = isAvailable(tech);
            return (
              <div key={tech.id} className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-gray-50 relative overflow-hidden group">
                <div className="flex items-center justify-between gap-4 relative z-10">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="relative">
                      <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center text-yellow-400 text-xl font-black">
                        {tech.name.charAt(0)}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center ${available ? 'bg-green-500' : 'bg-red-500'}`}>
                        {available ? <CheckCircle className="w-3 h-3 text-white" /> : <XCircle className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                  
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <button 
                          onClick={() => {
                            setIsGeneralCalendar(false);
                            setManagingTech(tech);
                          }}
                          className="font-black text-sm uppercase truncate hover:text-yellow-500 transition-colors"
                        >
                          {tech.name}
                        </button>
                        {tech.role === 'MASTER' && <Award className="w-3 h-3 text-yellow-500" />}
                      </div>
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-3">{tech.specialty || 'Técnico Polivalente'}</p>
                    
                      <div className="flex gap-2">
                        {(currentUser.role === 'MASTER' || currentUser.role === 'USAC') && (
                          <button 
                            onClick={() => setManagingTech(tech)}
                            className="p-2 bg-yellow-400 text-black rounded-lg hover:bg-yellow-500 transition-colors flex items-center gap-2 text-[8px] font-black uppercase"
                          >
                            <Calendar className="w-3 h-3" /> Calendario
                          </button>
                        )}
                        <div className="flex gap-1">
                          <a 
                            href={tech.phone ? `tel:${tech.phone}` : '#'} 
                            onClick={(e) => !tech.phone && e.preventDefault()}
                            className={`p-2 rounded-lg transition-colors ${tech.phone ? 'bg-gray-50 text-gray-400 hover:text-gray-900' : 'bg-gray-50 text-gray-200 cursor-not-allowed'}`}
                            title={tech.phone ? 'Llamar' : 'Teléfono no disponible'}
                          >
                            <Phone className="w-3 h-3" />
                          </a>
                          <button 
                            onClick={() => {
                              if (tech.phone) {
                                const cleanPhone = tech.phone.replace(/\D/g, '');
                                window.open(`https://wa.me/${cleanPhone}`, '_blank');
                              }
                            }}
                            className={`p-2 rounded-lg transition-colors ${tech.phone ? 'bg-green-50 text-green-500 hover:bg-green-100' : 'bg-gray-50 text-gray-200 cursor-not-allowed'}`}
                            title={tech.phone ? 'WhatsApp' : 'WhatsApp no disponible'}
                          >
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.634 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                            </svg>
                          </button>
                        </div>
                        <button 
                          onClick={() => window.location.href = `mailto:${tech.username}`}
                          className="p-2 bg-blue-50 rounded-lg text-blue-500 hover:bg-blue-100 transition-colors"
                        >
                          <Mail className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {(currentUser.role === 'MASTER' || currentUser.role === 'USAC') && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTech(tech);
                        }}
                        className="p-2 text-blue-500 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors shadow-sm"
                        title="Editar Técnico"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className="text-right">
                      <div className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg mb-1 ${available ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        {available ? 'Disponible' : 'En Permiso'}
                      </div>
                      <div className="text-[7px] text-gray-400 font-bold uppercase">Hoy</div>
                    </div>
                  </div>
                </div>

                {!available && tech.leaveDays && (
                   <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-red-400" />
                      <span className="text-[8px] font-black text-red-400 uppercase">Próxima incorporación: {getNextAvailableDate(tech.leaveDays, today)}</span>
                   </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="bg-gray-900 rounded-[2.5rem] p-8 text-white mx-2 shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <h4 className="text-lg font-black uppercase tracking-tight mb-2">Resumen de Fuerza</h4>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-white/10 p-4 rounded-2xl">
              <div className="text-2xl font-black text-yellow-400">{mantoTechs.filter(isAvailable).length}</div>
              <div className="text-[8px] font-bold uppercase tracking-widest opacity-60">Operativos</div>
            </div>
            <div className="bg-white/10 p-4 rounded-2xl">
              <div className="text-2xl font-black text-red-400">{mantoTechs.filter(t => !isAvailable(t)).length}</div>
              <div className="text-[8px] font-bold uppercase tracking-widest opacity-60">Baja/Permiso</div>
            </div>
          </div>
        </div>
        <Users className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 rotate-12" />
      </div>

      {managingTech && (
        <AvailabilityModal 
          tech={managingTech} 
          isGeneral={isGeneralCalendar}
          allTechs={allUsers.filter(u => u.isManto && u.status === 'approved')}
          onClose={() => setManagingTech(null)} 
          onUpdate={handleUpdateLeaveDays}
          onRequestLeave={() => setRequestingLeaveTech(managingTech)}
        />
      )}

      {showCreateModal && (
        <CreateTechModal 
          activeUnit={activeUnit}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setAllUsers(storageService.getUsers());
            setShowCreateModal(false);
          }}
        />
      )}

      {editingTech && (
        <EditTechModal 
          tech={editingTech}
          onClose={() => setEditingTech(null)}
          onUpdated={() => {
            setAllUsers(storageService.getUsers());
            setEditingTech(null);
          }}
        />
      )}

      {requestingLeaveTech && (
        <LeaveRequestModal 
          tech={requestingLeaveTech}
          onClose={() => setRequestingLeaveTech(null)}
          onSuccess={() => {
            setAllUsers(storageService.getUsers());
            setRequestingLeaveTech(null);
            setManagingTech(null);
          }}
        />
      )}
    </div>
  );
};

interface CreateTechModalProps {
  activeUnit: Role;
  onClose: () => void;
  onCreated: () => void;
}

const CreateTechModal: React.FC<CreateTechModalProps> = ({ activeUnit, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('1234');
  const [userCategory, setUserCategory] = useState<UserCategory>('Técnico');

  const handleCreate = () => {
    if (!name || !username) return alert("Nombre y Usuario son obligatorios");
    
    const newUser: User = {
      id: crypto.randomUUID(),
      name,
      username,
      password,
      role: activeUnit,
      status: 'approved',
      assignedBuildings: activeUnit === 'USAC' ? BUILDINGS.map(b => b.id) : [],
      assignedUnits: [activeUnit],
      isManto: userCategory === 'Técnico',
      userCategory,
      specialty,
      phone,
      leaveDays: []
    };

    storageService.saveUser(newUser);
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-white rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="bg-gray-900 p-8 text-white relative">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-yellow-400 text-black rounded-2xl flex items-center justify-center font-black text-xl">
              <Plus className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight leading-none">Nuevo Técnico</h3>
              <p className="text-[9px] text-yellow-400 font-bold uppercase tracking-widest mt-1">Alta en USAC Manto</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-4">
          <div className="space-y-1">
            <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Categoría de Usuario</label>
            <div className="flex gap-2">
              <button 
                onClick={() => setUserCategory('Técnico')}
                className={`flex-1 p-3 rounded-xl text-[10px] font-black uppercase transition-all ${userCategory === 'Técnico' ? 'bg-gray-900 text-yellow-400 shadow-lg' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}
              >
                Técnico
              </button>
              <button 
                onClick={() => setUserCategory('Oficina de Control')}
                className={`flex-1 p-3 rounded-xl text-[10px] font-black uppercase transition-all ${userCategory === 'Oficina de Control' ? 'bg-gray-900 text-yellow-400 shadow-lg' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}
              >
                Oficina de Control
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Nombre Completo</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Juan Pérez"
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:border-yellow-400 transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Especialidad</label>
            <input 
              type="text" 
              value={specialty} 
              onChange={e => setSpecialty(e.target.value)}
              placeholder="Ej: Electricista / Fontanero"
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:border-yellow-400 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Usuario</label>
              <input 
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)}
                placeholder="juan.perez"
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:border-yellow-400 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:border-yellow-400 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Teléfono (WhatsApp)</label>
            <input 
              type="tel" 
              value={phone} 
              onChange={e => setPhone(e.target.value)}
              placeholder="34600000000"
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:border-yellow-400 transition-all"
            />
          </div>

          <button 
            onClick={handleCreate}
            className="w-full mt-4 p-5 bg-gray-900 text-yellow-400 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all"
          >
            Dar de Alta Oficialmente
          </button>
        </div>
      </div>
    </div>
  );
};

interface EditTechModalProps {
  tech: User;
  onClose: () => void;
  onUpdated: () => void;
}

const EditTechModal: React.FC<EditTechModalProps> = ({ tech, onClose, onUpdated }) => {
  const [name, setName] = useState(tech.name);
  const [specialty, setSpecialty] = useState(tech.specialty || '');
  const [phone, setPhone] = useState(tech.phone || '');
  const [username, setUsername] = useState(tech.username);

  const handleUpdate = () => {
    if (!name || !username) return alert("Nombre y Usuario son obligatorios");
    
    const updatedUser: User = {
      ...tech,
      name,
      username,
      specialty,
      phone
    };

    storageService.updateUser(updatedUser);
    onUpdated();
  };

  const handleDelete = () => {
    if (confirm(`¿Estás seguro de que deseas eliminar a ${tech.name}?`)) {
      storageService.updateUserStatus(tech.id, 'rejected', [], []);
      onUpdated();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-white rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="bg-gray-900 p-8 text-white relative">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-500 text-white rounded-2xl flex items-center justify-center font-black text-xl">
              <Edit2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight leading-none">Editar Técnico</h3>
              <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest mt-1">Modificar Datos de Operario</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-4">
          <div className="space-y-1">
            <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Nombre Completo</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)}
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:border-blue-400 transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Especialidad</label>
            <input 
              type="text" 
              value={specialty} 
              onChange={e => setSpecialty(e.target.value)}
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:border-blue-400 transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Usuario / Email</label>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)}
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:border-blue-400 transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Teléfono (WhatsApp)</label>
            <input 
              type="tel" 
              value={phone} 
              onChange={e => setPhone(e.target.value)}
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:border-blue-400 transition-all"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              onClick={handleDelete}
              className="flex-1 p-4 bg-red-50 text-red-500 rounded-2xl font-black uppercase text-[9px] tracking-widest active:scale-95 transition-all"
            >
              Eliminar
            </button>
            <button 
              onClick={handleUpdate}
              className="flex-[2] p-4 bg-gray-900 text-blue-400 rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-xl active:scale-95 transition-all"
            >
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface AvailabilityModalProps {
  tech: User;
  isGeneral: boolean;
  allTechs: User[];
  onClose: () => void;
  onUpdate: (userId: string, leaveDays: string[]) => void;
  onRequestLeave: () => void;
}

const ALICANTE_HOLIDAYS_2026 = [
  '2026-01-01', '2026-01-06', '2026-03-19', '2026-04-02', '2026-04-03', '2026-04-06', '2026-04-16',
  '2026-05-01', '2026-06-24', '2026-08-15', '2026-10-09', '2026-10-12', '2026-11-01', '2026-11-02',
  '2026-12-06', '2026-12-07', '2026-12-08', '2026-12-25'
];

const AvailabilityModal: React.FC<AvailabilityModalProps> = ({ tech, isGeneral, allTechs, onClose, onUpdate, onRequestLeave }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const leaveDays = tech.leaveDays || [];

  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const date = new Date(year, month, 1);
    const days = [];
    const firstDay = date.getDay() === 0 ? 6 : date.getDay() - 1; 
    
    for (let i = 0; i < firstDay; i++) days.push(null);
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [currentMonth]);

  const toggleDay = (dateStr: string) => {
    const newLeaveDays = leaveDays.includes(dateStr)
      ? leaveDays.filter(d => d !== dateStr)
      : [...leaveDays, dateStr];
    onUpdate(tech.id, newLeaveDays);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-white rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="bg-gray-900 p-8 text-white relative">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-yellow-400 text-black rounded-2xl flex items-center justify-center font-black text-xl">
              {tech.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight leading-none">
                {isGeneral ? 'Calendario Laboral General' : tech.name}
              </h3>
              <p className="text-[9px] text-yellow-400 font-bold uppercase tracking-widest mt-1">Calendario Laboral Alicante</p>
            </div>
          </div>
          {!isGeneral && (
            <button 
              onClick={onRequestLeave}
              className="mt-4 w-full p-3 bg-yellow-400 text-black rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all"
            >
              <FileText className="w-4 h-4" /> Solicitar Día / Permiso
            </button>
          )}
        </div>

        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-sm font-black uppercase tracking-widest text-gray-900">
              {currentMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
            </h4>
            <div className="flex gap-2">
              <button onClick={() => {
                const d = new Date(currentMonth);
                d.setMonth(d.getMonth() - 1);
                setCurrentMonth(d);
              }} className="p-2 bg-gray-50 rounded-lg text-gray-400 active:scale-90"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => {
                const d = new Date(currentMonth);
                d.setMonth(d.getMonth() + 1);
                setCurrentMonth(d);
              }} className="p-2 bg-gray-50 rounded-lg text-gray-400 active:scale-90"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {['L','M','X','J','V','S','D'].map(d => (
              <div key={d} className="text-center text-[8px] font-black text-gray-300 uppercase py-2">{d}</div>
            ))}
            {daysInMonth.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="h-10" />;
              const dateStr = getLocalDateString(day);
              const isLeave = leaveDays.includes(dateStr);
              const isToday = getLocalDateString() === dateStr;
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const isHoliday = ALICANTE_HOLIDAYS_2026.includes(dateStr);
              const anyoneOnLeave = isGeneral && allTechs.some(u => u.leaveDays?.includes(dateStr));

              return (
                <button 
                  key={dateStr}
                  onClick={() => !isGeneral && toggleDay(dateStr)}
                  disabled={isGeneral}
                  className={`h-10 rounded-xl flex items-center justify-center text-[10px] font-black transition-all active:scale-90 relative ${
                    !isGeneral && isLeave 
                      ? 'bg-red-500 text-white shadow-lg shadow-red-200' 
                      : isHoliday
                        ? 'bg-purple-100 text-purple-700 border border-purple-200'
                        : isWeekend
                          ? 'bg-blue-50 text-blue-600 border border-blue-100'
                          : isToday 
                            ? 'bg-yellow-50 text-gray-900 border border-yellow-200' 
                            : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {day.getDate()}
                  {isHoliday && <div className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full border border-white" />}
                  {anyoneOnLeave && <div className="absolute bottom-1 w-1 h-1 bg-red-500 rounded-full" />}
                </button>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100 grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <span className="text-[7px] font-black uppercase text-gray-400">Baja/Libre</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-100 rounded-full" />
                <span className="text-[7px] font-black uppercase text-gray-400">Finde</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-100 rounded-full" />
                <span className="text-[7px] font-black uppercase text-gray-400">Festivo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-100 rounded-full" />
                <span className="text-[7px] font-black uppercase text-gray-400">Activo</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-full mt-6 px-6 py-4 bg-gray-900 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">
            Cerrar Calendario
          </button>
        </div>
      </div>
    </div>
  );
};

function getNextAvailableDate(leaveDays: string[], today: string): string {
  const checkDate = new Date(today);
  for (let i = 0; i < 60; i++) {
    checkDate.setDate(checkDate.getDate() + 1);
    const checkStr = getLocalDateString(checkDate);
    if (!leaveDays.includes(checkStr)) {
      const d = new Date(checkStr);
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    }
  }
  return "Próximamente";
}

interface LeaveRequestModalProps {
  tech: User;
  onClose: () => void;
  onSuccess: () => void;
}

const LEAVE_TYPES: LeaveType[] = [
  'VA - VACACIONES',
  'AP - ASUNTOS PROPIOS',
  'DO - DESCANSO OBLIGATORIO',
  'DA - DESCANSO ADICIONAL',
  'MA - MANIOBRAS',
  'BM - BAJA MÉDICA',
  'AZ - ENFERMO DOMICILIO',
  'PV - PERMISOS VARIOS',
  'VA - VACACIONES (AÑO ANTERIOR)',
  'AP - ASUNTOS PROPIOS (AÑO ANTERIOR)',
  'CON - CONCILIACIÓN FAMILIAR',
  'CS - COMISIÓN DE SERVICIO',
  'CS - EJERCICIOS VARIOS',
  'SG - SERVICIO DE GUARDIA',
  'JIP - JORNADA DE INSTRUCCIÓN PROLONGADA',
  'JIC - JORNADA DE INSTRUCCIÓN CONTINUA',
  'CU - CURSO',
  'FH - FLEXIBILIDAD HORARIA',
  'RJ - REDUCCIÓN DE JORNADA',
  'Otro'
];

const LeaveRequestModal: React.FC<LeaveRequestModalProps> = ({ tech, onClose, onSuccess }) => {
  const [type, setType] = useState<LeaveType>('VA - VACACIONES');
  const [startDate, setStartDate] = useState(getLocalDateString());
  const [endDate, setEndDate] = useState(getLocalDateString());
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    const entry: LeaveEntry = {
      id: crypto.randomUUID(),
      userId: tech.id,
      userName: tech.name,
      type,
      startDate,
      endDate,
      notes,
      status: 'approved',
      createdAt: new Date().toISOString(),
      approvers: [],
      approvals: []
    };
    
    storageService.addLeaveEntry(tech.id, entry);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-white rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="bg-gray-900 p-8 text-white relative">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-yellow-400 text-black rounded-2xl flex items-center justify-center font-black text-xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight leading-none">Solicitar Día</h3>
              <p className="text-[9px] text-yellow-400 font-bold uppercase tracking-widest mt-1">{tech.name}</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-4">
          <div className="space-y-1">
            <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Tipo de Permiso</label>
            <select 
              value={type}
              onChange={(e) => setType(e.target.value as LeaveType)}
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:border-yellow-400 transition-all appearance-none"
            >
              {LEAVE_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Desde</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:border-yellow-400 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Hasta</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:border-yellow-400 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-2">Notas / Observaciones</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional..."
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:border-yellow-400 transition-all h-24 resize-none"
            />
          </div>

          <button 
            onClick={handleSave}
            className="w-full mt-4 p-5 bg-gray-900 text-yellow-400 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all"
          >
            Confirmar Solicitud
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamPanel;
