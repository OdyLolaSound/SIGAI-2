
import React, { useState } from 'react';
import { ShieldCheck, User as UserIcon, Lock, ChevronLeft, ChevronRight, UserPlus, AlertCircle, Crown, Phone } from 'lucide-react';
import { Role, User } from '../types';
import { storageService, cleanData } from '../services/storageService';

import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

interface AuthModalProps {
  initialRole: Role;
  initialView?: 'login' | 'register';
  onLogin: (user: User) => void;
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ initialRole, initialView = 'login', onLogin, onClose }) => {
  const [view, setView] = useState<'login' | 'register' | 'pending' | 'complementary'>(initialView);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    phone: '',
    role: initialRole,
    specialty: '',
    isManto: false
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Map username to email for Firebase Auth
      const cleanUsername = formData.username.trim().toLowerCase();
      const email = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@sigai.local`;
      const userCredential = await signInWithEmailAndPassword(auth, email, formData.password);
      const firebaseUser = userCredential.user;

      // Fetch user profile from Firestore
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (!userDoc.exists()) {
        setError('Perfil de usuario no encontrado en la base de datos');
        return;
      }

      const user = userDoc.data() as User;
      
      // Check if user has the right role for this unit
      if (user.role !== 'MASTER' && user.role !== initialRole) {
        setError('Acceso no autorizado para esta unidad');
        return;
      }

      if (user.status !== 'approved' && user.role !== 'MASTER') {
        setView('pending');
        return;
      }

      onLogin(user);
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('El acceso con Email/Contraseña no está habilitado en la consola de Firebase.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Credenciales incorrectas. Si es un proyecto nuevo, asegúrese de haberse registrado primero.');
      } else {
        setError('Credenciales incorrectas o usuario no registrado');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      // Fetch user profile from Firestore
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      if (userDoc.exists()) {
        const user = userDoc.data() as User;
        onLogin(user);
      } else {
        // If user doesn't exist in Firestore, they need to complete registration
        // But for master emails, we can auto-approve
        const isMasterEmail = firebaseUser.email === 'JCYebenes@gmail.com' || firebaseUser.email === 'jyebavi@sigai.local';
        
        if (isMasterEmail) {
          const masterUser: User = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || (firebaseUser.email === 'jyebavi@sigai.local' ? 'Jyebavi' : 'Administrador Maestro'),
            username: firebaseUser.email?.split('@')[0] || 'admin',
            password: '',
            role: 'MASTER',
            status: 'approved',
            userCategory: 'Oficina de Control',
            assignedBuildings: [],
            assignedUnits: ['USAC', 'CG', 'GCG', 'GOE3', 'GOE4', 'BOEL', 'UMOE', 'CECOM'],
            phone: '',
            isManto: true,
            leaveDays: []
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), cleanData(masterUser));
          onLogin(masterUser);
        } else {
          // For other users, we need them to fill complementary data
          setFormData({
            ...formData,
            name: firebaseUser.displayName || '',
            email: firebaseUser.email || '',
            username: firebaseUser.email?.split('@')[0] || ''
          });
          setView('complementary');
        }
      }
    } catch (err: any) {
      console.error("Google login error:", err);
      setError('Error al iniciar sesión con Google: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!formData.username || !formData.password) {
      setError('Todos los campos son obligatorios');
      return;
    }

    setLoading(true);
    try {
      // Use the provided email or generate one if not provided
      const cleanUsername = formData.username.trim().toLowerCase();
      const email = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@sigai.local`;
      const userCredential = await createUserWithEmailAndPassword(auth, email, formData.password);
      const firebaseUser = userCredential.user;

      const isMasterAdmin = cleanUsername === 'admin' || cleanUsername === 'jyebavi';

      const newUser: User = {
        id: firebaseUser.uid,
        name: formData.name || formData.username, // Use username as fallback name
        username: formData.username,
        password: '', // Don't store plain password in Firestore
        role: isMasterAdmin ? 'MASTER' : formData.role,
        status: isMasterAdmin ? 'approved' : 'pending',
        userCategory: isMasterAdmin ? 'Oficina de Control' : 'Técnico',
        assignedBuildings: [],
        assignedUnits: isMasterAdmin ? ['USAC', 'CG', 'GCG', 'GOE3', 'GOE4', 'BOEL', 'UMOE', 'CECOM'] : [formData.role],
        phone: formData.phone,
        isManto: true,
        leaveDays: []
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), cleanData(newUser));
      
      // After initial registration, move to complementary data view
      setView('complementary');
    } catch (err: any) {
      console.error("Registration error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError('El nombre de usuario o email ya está registrado');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('El registro con Email/Contraseña no está habilitado. Por favor, contacte con el administrador para habilitarlo en la consola de Firebase.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres');
      } else {
        setError(`Error al registrar: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  if (view === 'complementary') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
        <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col relative border border-gray-100 p-10">
          <h2 className="text-2xl font-black text-center uppercase tracking-tighter mb-2 text-gray-900">Datos Complementarios</h2>
          <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mb-8">Completa tu perfil técnico</p>
          
          <div className="space-y-4">
            <div className="relative">
              <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Nombre y Apellidos" 
                className="w-full p-5 pl-14 bg-gray-50 rounded-2xl outline-none focus:ring-2 ring-tactical-orange/20 text-[11px] font-bold border border-gray-100"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div className="relative">
              <ShieldCheck className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Cargo / Empleo (ej. Cabo 1º, Soldado...)" 
                className="w-full p-5 pl-14 bg-gray-50 rounded-2xl outline-none focus:ring-2 ring-tactical-orange/20 text-[11px] font-bold border border-gray-100"
                value={formData.specialty}
                onChange={e => setFormData({...formData, specialty: e.target.value})}
              />
            </div>

            <div className="relative">
              <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="tel" 
                placeholder="Número de Teléfono" 
                className="w-full p-5 pl-14 bg-gray-50 rounded-2xl outline-none focus:ring-2 ring-tactical-orange/20 text-[11px] font-bold border border-gray-100"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
            </div>
            
            <div className="relative">
              <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select 
                className="w-full p-5 pl-14 bg-gray-50 rounded-2xl outline-none focus:ring-2 ring-tactical-orange/20 text-[11px] font-bold border border-gray-100 appearance-none"
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value as Role})}
              >
                <option value="USAC">Unidad: USAC</option>
                <option value="CG">Unidad: CG</option>
                <option value="GCG">Unidad: GCG</option>
                <option value="GOE3">Unidad: GOE III</option>
                <option value="GOE4">Unidad: GOE IV</option>
                <option value="BOEL">Unidad: BOEL XIX</option>
                <option value="UMOE">Unidad: UMOE</option>
                <option value="CECOM">Unidad: CECOM</option>
              </select>
            </div>

            <button 
              onClick={async () => {
                setLoading(true);
                try {
                  const userRef = doc(db, 'users', auth.currentUser!.uid);
                  await setDoc(userRef, cleanData({
                    name: formData.name,
                    phone: formData.phone,
                    role: formData.role,
                    specialty: formData.specialty,
                    assignedUnits: [formData.role],
                    userCategory: 'Técnico',
                    isManto: true
                  }), { merge: true });
                  setView('pending');
                } catch (e) {
                  setError('Error al guardar datos complementarios');
                } finally {
                  setLoading(false);
                }
              }}
              className="w-full p-6 bg-tactical-orange text-black rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 mt-4"
            >
              Finalizar Registro <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'pending') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
        <div className="w-full max-w-sm bg-white rounded-[2.5rem] p-10 text-center shadow-2xl relative border border-gray-100">
          <button onClick={onClose} className="absolute top-6 left-6 p-2 text-gray-400 hover:text-gray-900 transition-all active:scale-90">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="w-20 h-20 bg-tactical-orange/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-tactical-orange/20">
            <AlertCircle className="w-10 h-10 text-tactical-orange" />
          </div>
          <h2 className="text-xl font-black uppercase mb-3 text-gray-900">Solicitud Enviada</h2>
          <p className="text-xs text-gray-400 font-medium leading-relaxed mb-8">
            Tu registro como técnico de <strong className="text-tactical-orange">{formData.role}</strong> está pendiente de validación central.
          </p>
          <button onClick={onClose} className="w-full p-5 bg-tactical-orange text-black rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl active:scale-95 transition-all shadow-tactical-orange/20">
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col relative border border-gray-100">
        <button 
          onClick={view === 'register' ? () => setView('login') : onClose} 
          className="absolute top-8 left-8 p-2 text-gray-400 hover:text-gray-900 transition-all active:scale-90 z-10"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div className="p-10 pt-14">
          <div className="flex justify-center mb-8">
            <div className="bg-tactical-orange/10 p-4 rounded-3xl shadow-xl rotate-3 border border-tactical-orange/20">
               <ShieldCheck className="w-10 h-10 text-tactical-orange -rotate-3" />
            </div>
          </div>
          <h2 className="text-3xl font-black text-center uppercase tracking-tighter mb-1 text-gray-900">
            {view === 'login' ? 'Acceso SIGAI' : 'Registro Técnico'}
          </h2>
          <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em] mb-10">Unidad: {initialRole}</p>

          <form onSubmit={view === 'login' ? handleLogin : handleRegister} className="space-y-4">
            {error && <div className="p-4 bg-red-50 text-red-600 text-[10px] font-black rounded-2xl border border-red-100 uppercase">{error}</div>}
            
            <div className="relative">
              <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Nombre de Usuario" 
                disabled={loading}
                className="w-full p-5 pl-14 bg-gray-50 rounded-2xl outline-none focus:ring-2 ring-tactical-orange/20 text-[11px] font-bold border border-gray-100 text-gray-900 disabled:opacity-50 transition-all"
                value={formData.username}
                onChange={e => setFormData({...formData, username: e.target.value})}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="password" 
                placeholder="Contraseña" 
                disabled={loading}
                className="w-full p-5 pl-14 bg-gray-50 rounded-2xl outline-none focus:ring-2 ring-tactical-orange/20 text-[11px] font-bold border border-gray-100 text-gray-900 disabled:opacity-50 transition-all"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full p-6 bg-tactical-orange text-black rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 mt-4 hover:bg-tactical-orange/90 disabled:opacity-50 shadow-tactical-orange/20"
            >
              {loading ? 'Procesando...' : (view === 'login' ? 'Entrar' : 'Registrarse')} <ChevronRight className="w-4 h-4 text-black" />
            </button>

            {view === 'login' && (
              <div className="mt-4">
                <div className="relative flex items-center justify-center mb-4">
                  <div className="border-t border-gray-200 w-full"></div>
                  <span className="bg-white px-4 text-[8px] font-black text-gray-400 uppercase tracking-widest absolute">O entrar con</span>
                </div>
                
                <button 
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full p-5 bg-white border-2 border-gray-100 text-gray-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
                  Google
                </button>
              </div>
            )}
          </form>
        </div>

        <div className="p-8 bg-gray-50 text-center flex flex-col gap-4 border-t border-gray-100">
          {view === 'login' ? (
            <button 
              onClick={() => setView('register')} 
              className="w-full p-4 bg-white border-2 border-gray-900 text-gray-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-900 hover:text-white transition-all flex flex-col items-center justify-center gap-1 active:scale-95"
            >
              <span className="text-gray-400 font-bold text-[8px]">¿No tienes cuenta?</span>
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Registrarse en SIGAI
              </div>
            </button>
          ) : (
            <button onClick={() => setView('login')} className="text-[10px] font-black uppercase text-gray-400 hover:text-tactical-orange transition-colors">
              Ya tengo una cuenta, entrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
