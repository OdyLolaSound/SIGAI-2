
import React, { useState, useEffect } from 'react';
import { UserCheck, ShieldCheck, Building2, UserX, Check, Lock, RefreshCcw, Crown, CheckCircle2, Phone, Mail, Edit2, Save, XCircle, Trash2, Circle } from 'lucide-react';
import { User, Building, Role, UserCategory } from '../types';
import { storageService, BUILDINGS } from '../services/storageService';
import { db } from '../firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';

interface AdminPanelProps {
  currentUser: User;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>(storageService.getUsers());
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingDetailsId, setEditingDetailsId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', username: '', userCategory: undefined as UserCategory | undefined });
  const [tempBuildings, setTempBuildings] = useState<string[]>([]);
  const [tempUnits, setTempUnits] = useState<Role[]>([]);
  const [tempCategory, setTempCategory] = useState<UserCategory | undefined>(undefined);
  const isMaster = currentUser.role === 'MASTER';

  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    // Escuchar cambios en tiempo real de los usuarios
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
      setUsers(usersData);
    });

    // Simulación de estados online (en un sistema real usaríamos Firebase Presence)
    const interval = setInterval(() => {
      // Simulamos que algunos usuarios están conectados
      const randomOnline = users
        .filter(() => Math.random() > 0.7)
        .map(u => u.id);
      setOnlineUsers(prev => [...new Set([...randomOnline, currentUser.id])]);
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [currentUser.id]);

  const handleApprove = (userId: string) => {
    setEditingUserId(userId);
    const user = users.find(u => u.id === userId);
    setTempBuildings(user?.assignedBuildings || []);
    setTempUnits(user?.assignedUnits || []);
    setTempCategory(user?.userCategory);
  };

  const saveApproval = (userId: string) => {
    const isTécnico = tempCategory === 'Técnico';
    storageService.updateUserStatus(userId, 'approved', tempBuildings, tempUnits, tempCategory, isTécnico);
    setUsers(storageService.getUsers());
    setEditingUserId(null);
  };

  const handleResetPass = (userId: string) => {
    const newPass = prompt('Introduzca la nueva contraseña para el usuario:');
    if (newPass) {
      storageService.resetUserPassword(userId, newPass);
      alert('Contraseña actualizada con éxito');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('¿ESTÁ SEGURO? Esta acción eliminará permanentemente al usuario y no podrá acceder al sistema.')) {
      setIsDeleting(userId);
      try {
        await storageService.deleteUser(userId);
        setUsers(prev => prev.filter(u => u.id !== userId));
      } catch (error) {
        alert('Error al eliminar usuario');
      } finally {
        setIsDeleting(null);
      }
    }
  };

  const handleReject = (userId: string) => {
    if (confirm('¿Rechazar este registro de usuario?')) {
      storageService.updateUserStatus(userId, 'rejected', [], []);
      setUsers(storageService.getUsers());
    }
  };

  const handleEditDetails = (user: User) => {
    setEditingDetailsId(user.id);
    setEditForm({
      name: user.name,
      phone: user.phone || '',
      username: user.username,
      userCategory: user.userCategory
    });
  };

  const saveDetails = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      const updatedUser: User = {
        ...user,
        name: editForm.name,
        phone: editForm.phone,
        username: editForm.username,
        userCategory: editForm.userCategory,
        isManto: editForm.userCategory === 'Técnico'
      };
      await storageService.updateUser(updatedUser);
      setEditingDetailsId(null);
    }
  };

  const handleWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const handleEmail = (email: string) => {
    window.location.href = `mailto:${email}`;
  };

  const toggleBuilding = (id: string) => {
    setTempBuildings(prev => 
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  };

  const toggleUnit = (role: Role) => {
    setTempUnits(prev => {
      const isRemovingUSAC = role === 'USAC' && prev.includes('USAC');
      if (isRemovingUSAC) {
        setTempBuildings([]); // Clear buildings if USAC is removed
      }
      return prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role];
    });
  };

  const ROLES_LIST: Role[] = ['USAC', 'CG', 'GCG', 'GOE3', 'GOE4', 'BOEL', 'UMOE', 'CECOM'];

  // El Master ve a TODOS excepto a sí mismo. El Admin USAC solo ve a técnicos de otras unidades.
  const filteredUsers = users.filter(u => u.id !== currentUser.id);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 w-full max-w-sm md:max-w-7xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-black uppercase tracking-tight text-gray-900">
          {isMaster ? 'GESTIÓN MAESTRA DE PERSONAL' : 'GESTIÓN DE PERSONAL'}
        </h2>
        <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
          {isMaster ? 'Control Supremo SIGAI' : 'Administración Central USAC'}
        </p>
      </div>

      <div className="space-y-4">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-gray-100">
             <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">No hay usuarios para gestionar</p>
          </div>
        ) : (
          filteredUsers.map(user => (
            <div key={user.id} className={`bg-white border rounded-[2.5rem] p-6 shadow-sm transition-all ${user.status === 'pending' ? 'border-tactical-orange/30' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-4 gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="relative">
                      <div className={`p-3 rounded-2xl ${user.status === 'pending' ? 'bg-tactical-orange/10 text-tactical-orange' : 'bg-gray-50 text-gray-400'}`}>
                        {user.role === 'MASTER' ? <Crown className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                      </div>
                      {onlineUsers.includes(user.id) && (
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-tactical-emerald border-2 border-white rounded-full animate-pulse" title="En línea" />
                      )}
                    </div>
                    <div className="text-left">
                    {editingDetailsId === user.id ? (
                      <div className="space-y-2 mt-2">
                        <input 
                          type="text" 
                          value={editForm.name} 
                          onChange={e => setEditForm({...editForm, name: e.target.value})}
                          className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-bold text-gray-900 outline-none focus:border-tactical-orange"
                          placeholder="Nombre completo"
                        />
                        <input 
                          type="text" 
                          value={editForm.username} 
                          onChange={e => setEditForm({...editForm, username: e.target.value})}
                          className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-bold text-gray-900 outline-none focus:border-tactical-orange"
                          placeholder="Email / Usuario"
                        />
                        <input 
                          type="text" 
                          value={editForm.phone} 
                          onChange={e => setEditForm({...editForm, phone: e.target.value})}
                          className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-bold text-gray-900 outline-none focus:border-tactical-orange"
                          placeholder="Teléfono"
                        />
                        <select
                          value={editForm.userCategory || ''}
                          onChange={e => setEditForm({...editForm, userCategory: e.target.value as any})}
                          className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-bold text-gray-900 outline-none focus:border-tactical-orange"
                        >
                          <option value="">Sin Categoría</option>
                          <option value="Oficina de Control">Oficina de Control</option>
                          <option value="Técnico">Técnico</option>
                        </select>
                        <div className="flex gap-2">
                          <button onClick={() => saveDetails(user.id)} className="flex-1 p-2 bg-tactical-emerald text-black rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1 shadow-lg shadow-tactical-emerald/20">
                            <Save className="w-3 h-3" /> Guardar
                          </button>
                          <button onClick={() => setEditingDetailsId(null)} className="flex-1 p-2 bg-gray-100 text-gray-400 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1">
                            <XCircle className="w-3 h-3" /> Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="font-black uppercase text-sm leading-none mb-1 truncate text-gray-900" title={user.name}>
                          {user.name}
                        </div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>Unidad: {user.role}</span>
                          <span className="flex items-center gap-1">
                            @{user.username}
                            <button onClick={() => handleEmail(user.username)} className="text-tactical-orange hover:scale-110 transition-transform">
                              <Mail className="w-3 h-3" />
                            </button>
                          </span>
                          <span className="flex items-center gap-1">
                            {user.phone || 'Sin teléfono'}
                            <a 
                              href={user.phone ? `tel:${user.phone}` : '#'} 
                              onClick={(e) => !user.phone && e.preventDefault()}
                              className={`${user.phone ? 'text-gray-400' : 'text-gray-200 cursor-not-allowed'} hover:scale-110 transition-transform`}
                              title={user.phone ? 'Llamar' : 'Teléfono no disponible'}
                            >
                              <Phone className="w-3 h-3" />
                            </a>
                            <button 
                              onClick={() => user.phone && handleWhatsApp(user.phone)} 
                              className={`${user.phone ? 'text-tactical-emerald' : 'text-gray-200 cursor-not-allowed'} hover:scale-110 transition-transform`} 
                              title={user.phone ? 'WhatsApp' : 'WhatsApp no disponible'}
                            >
                              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.634 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                              </svg>
                            </button>
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${user.status === 'approved' ? 'bg-tactical-emerald/20 text-tactical-emerald' : 'bg-tactical-orange/20 text-tactical-orange'}`}>
                    {user.status === 'approved' ? 'Activo' : 'Pendiente'}
                  </div>
                  {editingDetailsId !== user.id && (isMaster || currentUser.role === 'USAC') && (
                    <button 
                      onClick={() => handleEditDetails(user)} 
                      className="p-2 text-tactical-orange bg-tactical-orange/10 rounded-lg hover:bg-tactical-orange/20 transition-all shadow-sm"
                      title="Editar Detalles"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

                  {editingUserId === user.id ? (
                    <div className="space-y-6 border-t border-gray-50 pt-6 animate-in slide-in-from-top-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase text-tactical-orange tracking-widest">Configuración de Acceso</p>
                        <button onClick={() => setEditingUserId(null)} className="p-2 text-gray-400 hover:text-gray-600">
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <div>
                        <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-3">Categoría de Usuario (Permisos):</p>
                        <div className="grid grid-cols-2 gap-2">
                          {(['Oficina de Control', 'Técnico'] as UserCategory[]).map(cat => (
                            <button 
                              key={cat} 
                              onClick={() => setTempCategory(cat)} 
                              className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${tempCategory === cat ? 'border-tactical-emerald/50 bg-tactical-emerald/10 text-gray-900' : 'border-gray-50 bg-gray-50 text-gray-300'}`}
                            >
                              <Circle className={`w-3 h-3 ${tempCategory === cat ? 'fill-tactical-emerald text-tactical-emerald' : 'opacity-20'}`} />
                              <span className="text-[10px] font-black uppercase">{cat}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-3">Unidades Autorizadas (Botones):</p>
                        <div className="grid grid-cols-2 gap-2">
                          {ROLES_LIST.map(role => (
                            <button key={role} onClick={() => toggleUnit(role)} className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${tempUnits.includes(role) ? 'border-tactical-orange/50 bg-tactical-orange/10 text-gray-900' : 'border-gray-50 bg-gray-50 text-gray-300'}`}>
                              <CheckCircle2 className={`w-3 h-3 ${tempUnits.includes(role) ? 'text-tactical-orange opacity-100' : 'opacity-20'}`} />
                              <span className="text-[10px] font-black uppercase">{role}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {tempUnits.includes('USAC') && (
                        <div className="animate-in slide-in-from-top-2 duration-300">
                          <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-3 flex items-center gap-2">
                            <Building2 className="w-3 h-3 text-tactical-orange" /> Edificios Autorizados para Lecturas (Solo USAC):
                          </p>
                          <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 scrollbar-hide bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                            {BUILDINGS.filter(b => b.hasBoiler || b.id.startsWith('CT_')).map(b => (
                              <button key={b.id} onClick={() => toggleBuilding(b.id)} className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${tempBuildings.includes(b.id) ? 'border-tactical-orange/50 bg-tactical-orange/10 text-gray-900' : 'border-white bg-white text-gray-400'}`}>
                                <div className="flex items-center gap-3">
                                   <div className={`p-1.5 rounded-lg ${tempBuildings.includes(b.id) ? 'bg-tactical-orange text-white' : 'bg-gray-100 text-gray-400'}`}>
                                      <Building2 className="w-3.5 h-3.5" />
                                   </div>
                                   <div className="text-left">
                                      <div className="text-[10px] font-black uppercase leading-none">{b.name}</div>
                                      <div className="text-[8px] font-bold opacity-50 mt-1">{b.code}</div>
                                   </div>
                                </div>
                                {tempBuildings.includes(b.id) && <Check className="w-4 h-4 text-tactical-orange" />}
                              </button>
                            ))}
                          </div>
                          <p className="text-[8px] text-gray-400 font-bold uppercase mt-2 px-2 italic">
                            * Solo se muestran edificios con calderas o centros de transformación.
                          </p>
                        </div>
                      )}

                      <button onClick={() => saveApproval(user.id)} className="w-full p-5 bg-tactical-orange text-black rounded-[2rem] font-black uppercase text-xs tracking-widest mt-2 shadow-xl active:scale-95 transition-all shadow-tactical-orange/20">
                        {user.status === 'pending' ? 'Aprobar y Guardar Acceso' : 'Actualizar Configuración'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(user.id)} className="flex-[2] p-3 bg-gray-50 text-gray-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all border border-gray-100">Gestionar</button>
                      {isMaster && (
                        <>
                          <button onClick={() => handleResetPass(user.id)} title="Reset Password" className="p-3 bg-tactical-orange/10 text-tactical-orange rounded-2xl active:scale-90 transition-all border border-tactical-orange/20">
                            <Lock className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(user.id)} 
                            disabled={isDeleting === user.id}
                            className="p-3 bg-red-50 text-red-600 rounded-2xl active:scale-90 transition-all border border-red-100 disabled:opacity-50"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
