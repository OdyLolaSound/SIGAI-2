
import React, { useState, useEffect } from 'react';
import { X, Send, User, Clock, MapPin, AlertCircle, Plus, Trash2, CheckSquare, Save, AlertTriangle, Building, Briefcase, Phone, Globe, Info, Mic, Loader2 } from 'lucide-react';
import { CalendarTask, User as UserType, UrgencyLevel, ChecklistItem, ExternalUser, ExternalCategory } from '../types';
import { storageService } from '../services/storageService';
import { getLocalDateString } from '../services/dateUtils';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface TaskFormProps {
  user: UserType;
  initialDate: string;
  task?: CalendarTask;
  onClose: () => void;
}

const TASK_TYPES = ['Mantenimiento Preventivo', 'Mantenimiento Correctivo', 'Inspección', 'Limpieza', 'Revisión', 'Reparación', 'Instalación', 'Otro'] as const;
const PRIORITIES: UrgencyLevel[] = ['Rutina', 'Baja', 'Media', 'Alta', 'Crítica'];
const STATUSES = ['Pendiente', 'En Progreso', 'Completada', 'Cancelada', 'Pospuesta'] as const;
const EXTERNAL_CATEGORIES: ExternalCategory[] = ['Contratista', 'Proveedor', 'Otro Departamento', 'Empresa Externa', 'Técnico Externo', 'Personal Temporal'];

const TaskForm: React.FC<TaskFormProps> = ({ user, initialDate, task, onClose }) => {
  const [formData, setFormData] = useState<Partial<CalendarTask>>({
    title: '',
    description: '',
    type: 'Revisión',
    startDate: initialDate,
    startTime: '08:00',
    priority: 'Media',
    status: 'Pendiente',
    assignedTo: [],
    externalAssignments: [],
    location: '',
    recurrence: 'No',
    reminder: ['15 min antes'],
    checklist: []
  });

  const [newCheckItem, setNewCheckItem] = useState('');
  const [team, setTeam] = useState<UserType[]>([]);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [suggestedChecklist, setSuggestedChecklist] = useState<ChecklistItem[] | null>(null);
  
  // External Logic
  const [showExternalModal, setShowExternalModal] = useState(false);
  const [externalForm, setExternalForm] = useState<Partial<ExternalUser>>({
    name: '',
    category: 'Contratista',
    phone: '',
    specialty: '',
    company: ''
  });

  useEffect(() => {
    setTeam(storageService.getUsers().filter(u => u.role !== 'MASTER'));
    if (task) {
      setFormData(task);
    }
  }, [task]);

  // Similarity Detection
  useEffect(() => {
    if (task || !formData.title || formData.title.length < 4) {
      setSuggestedChecklist(null);
      return;
    }

    const timer = setTimeout(() => {
      const allTasks = storageService.getTasks();
      const normalizedTitle = formData.title!.toLowerCase().trim();
      
      const similar = allTasks.find(t => {
        const tTitle = t.title.toLowerCase().trim();
        return (tTitle === normalizedTitle || tTitle.includes(normalizedTitle) || normalizedTitle.includes(tTitle)) 
               && t.checklist && t.checklist.length > 0;
      });

      if (similar && (!formData.checklist || formData.checklist.length === 0)) {
        setSuggestedChecklist(similar.checklist);
      } else {
        setSuggestedChecklist(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.title, task, formData.checklist]);

  const applySuggestedChecklist = () => {
    if (suggestedChecklist) {
      setFormData(prev => ({
        ...prev,
        checklist: suggestedChecklist.map(item => ({ ...item, id: crypto.randomUUID(), completed: false }))
      }));
      setSuggestedChecklist(null);
    }
  };

  const handleSave = async () => {
    let finalTitle = formData.title?.trim();
    
    // Auto-generate title if empty
    if (!finalTitle && formData.description?.trim()) {
      setIsProcessingAI(true);
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Analiza esta descripción técnica de una tarea de mantenimiento y genera un título corto (máximo 5 palabras) que resuma lo más importante. Solo devuelve el título, nada más.\n\nDescripción: ${formData.description}`,
        });
        finalTitle = response.text?.replace(/["*]/g, '').trim() || 'Nueva Tarea';
        setFormData(prev => ({ ...prev, title: finalTitle }));
      } catch (error) {
        console.error("Error generating title:", error);
        finalTitle = 'Nueva Tarea';
      } finally {
        setIsProcessingAI(false);
      }
    }

    if (!finalTitle) return alert("El título es obligatorio");
    if (!formData.startDate) return alert("La fecha es obligatoria");

    const newTask: CalendarTask = {
      id: task?.id || crypto.randomUUID(),
      title: finalTitle,
      description: formData.description || '',
      type: formData.type as any || 'Otro',
      startDate: formData.startDate || getLocalDateString(new Date()),
      startTime: formData.startTime || null,
      endDate: formData.endDate || null,
      endTime: formData.endTime || null,
      priority: formData.priority as UrgencyLevel || 'Media',
      status: formData.status as any || 'Pendiente',
      assignedTo: formData.assignedTo || [],
      externalAssignments: formData.externalAssignments || [],
      location: formData.location || '',
      recurrence: formData.recurrence as any || 'No',
      reminder: formData.reminder || [],
      checklist: formData.checklist || [],
      createdBy: task?.createdBy || user.id,
      createdAt: task?.createdAt || new Date().toISOString()
    };

    storageService.saveTask(newTask);

    // Notify assigned users if it's a new task or new assignments
    const newAssignments = newTask.assignedTo.filter(uid => !task?.assignedTo.includes(uid));
    newAssignments.forEach(uid => {
      // We notify everyone assigned, including the creator if they assigned it to themselves
      // as they might want the alert on their dashboard
      storageService.addNotification({
        id: crypto.randomUUID(),
        userId: uid,
        title: 'Nueva Tarea Asignada',
        message: `Se te ha asignado la tarea: ${newTask.title}`,
        type: 'task_assigned',
        read: false,
        date: new Date().toISOString(),
        relatedId: newTask.id
      });
    });

    onClose();
  };

  const handleDelete = () => {
    if (task) {
      storageService.deleteTask(task.id);
      onClose();
    }
  };

  const toggleUserAssignment = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedTo: prev.assignedTo?.includes(userId)
        ? prev.assignedTo.filter(id => id !== userId)
        : [...(prev.assignedTo || []), userId]
    }));
  };

  const handleAddExternal = () => {
    if (!externalForm.name || !externalForm.phone) return alert("Nombre y teléfono obligatorios");
    
    const newExternal: ExternalUser = {
      id: crypto.randomUUID(),
      name: externalForm.name || '',
      category: externalForm.category as ExternalCategory,
      phone: externalForm.phone || '',
      company: externalForm.company,
      specialty: externalForm.specialty,
      createdAt: new Date().toISOString()
    };

    // Guardar en agenda global para reutilizar si se desea
    storageService.saveExternalContact(newExternal);

    setFormData(prev => ({
      ...prev,
      externalAssignments: [...(prev.externalAssignments || []), newExternal]
    }));

    setShowExternalModal(false);
    setExternalForm({ name: '', category: 'Contratista', phone: '', specialty: '', company: '' });
  };

  const removeExternal = (id: string) => {
    setFormData(prev => ({
      ...prev,
      externalAssignments: prev.externalAssignments?.filter(e => e.id !== id)
    }));
  };

  const addChecklistItem = () => {
    if (!newCheckItem.trim()) return;
    setFormData(prev => ({
      ...prev,
      checklist: [...(prev.checklist || []), { id: crypto.randomUUID(), text: newCheckItem, completed: false }]
    }));
    setNewCheckItem('');
  };

  const removeChecklistItem = (id: string) => {
    setFormData(prev => ({
      ...prev,
      checklist: prev.checklist?.filter(item => item.id !== id)
    }));
  };

  const startVoiceDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta el dictado por voz.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsRecording(false);
      setIsProcessingAI(true);

      try {
        // AI Cleanup
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Eres un asistente técnico experto. He dictado una descripción de una tarea y puede tener errores de reconocimiento o palabras extrañas. Por favor, corrígela para que sea profesional y coherente, manteniendo todos los detalles técnicos. Solo devuelve el texto corregido.\n\nTexto dictado: ${transcript}`,
        });
        
        const correctedText = response.text?.trim() || transcript;
        setFormData(prev => ({
          ...prev,
          description: prev.description ? `${prev.description}\n${correctedText}` : correctedText
        }));

        // If title is empty, suggest one immediately
        if (!formData.title?.trim()) {
          const titleResponse = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Genera un título corto y profesional para esta tarea: ${correctedText}. Solo devuelve el título.`,
          });
          setFormData(prev => ({ ...prev, title: titleResponse.text?.replace(/["*]/g, '').trim() || prev.title }));
        }
      } catch (error) {
        console.error("AI processing error:", error);
        setFormData(prev => ({
          ...prev,
          description: prev.description ? `${prev.description}\n${transcript}` : transcript
        }));
      } finally {
        setIsProcessingAI(false);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === 'not-allowed') {
        alert("Error: Permiso de micrófono denegado. Actívalo en tu navegador.");
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-xl p-4 flex flex-col items-center justify-center animate-in zoom-in-95 duration-300">
      <div className="w-full max-w-sm bg-white rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh] relative">
        
        {/* Header Oficial */}
        <header className="p-6 bg-gray-900 text-white flex justify-between items-center shrink-0 border-b border-white/5">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-yellow-400 rounded-2xl flex items-center justify-center">
               <Plus className="w-6 h-6 text-black" />
             </div>
             <h3 className="text-xl font-black uppercase tracking-tight">{task ? 'Editar Tarea' : 'Nueva Tarea'}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-white/30 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Título y Desc */}
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Título de la tarea" 
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              className="w-full text-xl font-black uppercase tracking-tight border-b-2 border-gray-100 py-2 outline-none focus:border-yellow-400 transition-all placeholder:text-gray-200"
            />
            <div className="relative">
              <textarea 
                placeholder="Descripción técnica..." 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full text-xs font-medium text-gray-500 bg-gray-50 p-4 pr-12 rounded-2xl outline-none resize-none h-24"
              />
              <button 
                onClick={startVoiceDictation}
                disabled={isRecording || isProcessingAI}
                className={`absolute right-3 bottom-3 p-3 rounded-xl transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-gray-400 hover:text-yellow-500 shadow-sm'}`}
              >
                {isProcessingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Fecha y Hora */}
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-gray-50 p-4 rounded-[2rem] border border-gray-100">
                <label className="text-[8px] font-black uppercase text-gray-400 block mb-2 tracking-widest">Fecha Inicio</label>
                <input 
                  type="date" 
                  value={formData.startDate}
                  onChange={e => setFormData({...formData, startDate: e.target.value})}
                  className="bg-transparent font-black text-xs outline-none w-full" 
                />
             </div>
             <div className="bg-gray-50 p-4 rounded-[2rem] border border-gray-100">
                <label className="text-[8px] font-black uppercase text-gray-400 block mb-2 tracking-widest">Hora</label>
                <input 
                  type="time" 
                  value={formData.startTime}
                  onChange={e => setFormData({...formData, startTime: e.target.value})}
                  className="bg-transparent font-black text-xs outline-none w-full" 
                />
             </div>
          </div>

          {/* Prioridad y Estado */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-gray-400 px-2 tracking-widest">Prioridad</label>
              <select 
                value={formData.priority}
                onChange={e => setFormData({...formData, priority: e.target.value as UrgencyLevel})}
                className="w-full p-4 bg-gray-900 text-white rounded-[1.5rem] font-black uppercase text-[10px] outline-none"
              >
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-gray-400 px-2 tracking-widest">Estado</label>
              <select 
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as any})}
                className="w-full p-4 bg-white border-2 border-gray-100 text-gray-900 rounded-[1.5rem] font-black uppercase text-[10px] outline-none"
              >
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Asignación Híbrida: Interno y Externo */}
          <div className="space-y-4">
             <label className="text-[9px] font-black uppercase text-gray-400 px-2 tracking-widest flex items-center justify-between">
                <span>Personal Asignado</span>
                <span className="text-[8px] text-yellow-500 uppercase">Híbrido</span>
             </label>

             {/* Personal Interno */}
             <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {team.map(member => (
                  <button 
                    key={member.id}
                    onClick={() => toggleUserAssignment(member.id)}
                    className={`shrink-0 flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${formData.assignedTo?.includes(member.id) ? 'bg-gray-900 border-yellow-400 text-white shadow-lg' : 'bg-gray-50 border-gray-100 text-gray-400'}`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-black uppercase text-[10px]">
                      {member.name.substring(0,2)}
                    </div>
                    <div className="text-left pr-2">
                      <div className="text-[9px] font-black uppercase leading-none">{member.name.split(' ')[0]}</div>
                      <div className="text-[7px] opacity-60 mt-0.5">{member.specialty || 'Técnico'}</div>
                    </div>
                  </button>
                ))}
             </div>

             {/* Personal Externo */}
             <div className="space-y-2">
                {formData.externalAssignments?.map(ext => (
                  <div key={ext.id} className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 bg-amber-200 text-amber-700 rounded-lg flex items-center justify-center"><Building className="w-4 h-4" /></div>
                       <div>
                          <div className="text-[10px] font-black uppercase text-gray-900 leading-none mb-1">{ext.name}</div>
                          <div className="text-[8px] font-bold text-amber-600 uppercase tracking-widest">{ext.category} · {ext.specialty || 'General'}</div>
                       </div>
                    </div>
                    <button onClick={() => removeExternal(ext.id)} className="p-2 text-red-300 hover:text-red-500 transition-colors">
                       <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <button 
                  onClick={() => setShowExternalModal(true)}
                  className="w-full p-4 border-2 border-dashed border-amber-200 rounded-2xl text-amber-600 font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 hover:bg-amber-50 transition-all"
                >
                  <Plus className="w-4 h-4" /> Añadir Externo (Contratista/Proveedor)
                </button>
             </div>
          </div>

          {/* Checklist */}
          <div className="space-y-3">
             <label className="text-[9px] font-black uppercase text-gray-400 px-2 tracking-widest">Procedimiento / Checklist</label>
             
             {/* Sugerencia de Checklist */}
             <AnimatePresence>
               {suggestedChecklist && (
                 <motion.div 
                   initial={{ opacity: 0, height: 0 }}
                   animate={{ opacity: 1, height: 'auto' }}
                   exit={{ opacity: 0, height: 0 }}
                   className="overflow-hidden"
                 >
                   <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-3 space-y-3">
                     <div className="flex items-center gap-2 text-yellow-700">
                       <AlertTriangle className="w-4 h-4" />
                       <span className="text-[9px] font-black uppercase tracking-tight">Tarea similar detectada</span>
                     </div>
                     <p className="text-[10px] text-yellow-800 font-bold">¿Quieres importar las {suggestedChecklist.length} subtareas de una tarea anterior similar?</p>
                     <button 
                       onClick={applySuggestedChecklist}
                       className="w-full py-2 bg-yellow-400 text-black rounded-xl font-black uppercase text-[8px] tracking-widest shadow-sm active:scale-95 transition-all"
                     >
                       Importar Procedimiento
                     </button>
                   </div>
                 </motion.div>
               )}
             </AnimatePresence>

             <div className="bg-gray-50 p-4 rounded-[2.5rem] border border-gray-100 space-y-3">
                {formData.checklist?.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl shadow-sm">
                    <div className="flex items-center gap-3">
                      <CheckSquare className="w-4 h-4 text-gray-200" />
                      <span className="text-[11px] font-bold text-gray-700">{item.text}</span>
                    </div>
                    <button onClick={() => removeChecklistItem(item.id)} className="text-red-200 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Nuevo paso..." 
                    value={newCheckItem}
                    onChange={e => setNewCheckItem(e.target.value)}
                    className="flex-1 bg-white p-3 rounded-xl text-[11px] font-bold outline-none border border-transparent focus:border-yellow-400 transition-all"
                    onKeyPress={e => e.key === 'Enter' && addChecklistItem()}
                  />
                  <button onClick={addChecklistItem} className="p-3 bg-gray-900 text-yellow-400 rounded-xl active:scale-90 transition-all"><Plus className="w-4 h-4" /></button>
                </div>
             </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-[2rem] border border-gray-100 flex items-center gap-4">
             <MapPin className="w-5 h-5 text-gray-300" />
             <input 
                type="text" 
                placeholder="Ubicación Detallada..." 
                value={formData.location}
                onChange={e => setFormData({...formData, location: e.target.value})}
                className="bg-transparent font-black text-xs outline-none w-full uppercase" 
             />
          </div>

          {/* Zona de Peligro */}
          {task && (
            <div className="pt-6 border-t border-gray-100">
               {!showConfirmDelete ? (
                 <button 
                  onClick={() => setShowConfirmDelete(true)}
                  className="w-full p-4 text-red-400 font-black uppercase text-[9px] tracking-[0.2em] flex items-center justify-center gap-2"
                 >
                   <Trash2 className="w-4 h-4" /> Eliminar Tarea Oficial
                 </button>
               ) : (
                 <div className="bg-red-50 p-4 rounded-2xl space-y-3 animate-in slide-in-from-top-2">
                    <p className="text-[8px] font-black text-red-600 uppercase text-center tracking-widest">¿Confirmar eliminación absoluta?</p>
                    <div className="flex gap-2">
                       <button onClick={handleDelete} className="flex-1 p-3 bg-red-600 text-white rounded-xl font-black uppercase text-[8px]">Sí, borrar</button>
                       <button onClick={() => setShowConfirmDelete(false)} className="flex-1 p-3 bg-gray-200 text-gray-600 rounded-xl font-black uppercase text-[8px]">Cancelar</button>
                    </div>
                 </div>
               )}
            </div>
          )}
        </main>

        <footer className="p-8 bg-gray-50 border-t border-gray-100 shrink-0">
           <button 
            onClick={handleSave}
            className="w-full p-6 bg-gray-900 text-yellow-400 rounded-[2.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
           >
             <Save className="w-5 h-5" /> {task ? 'Actualizar Tarea' : 'Guardar y Notificar'}
           </button>
        </footer>

        {/* Modal Personal Externo (Anidado con Backdrop Diferente) */}
        {showExternalModal && (
          <div className="fixed inset-0 z-[80] bg-gray-900/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
             <div className="w-full max-w-xs bg-white rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                <header className="p-6 bg-amber-500 text-white flex justify-between items-center">
                   <h4 className="font-black uppercase text-sm tracking-tight">Registro Externo</h4>
                   <button onClick={() => setShowExternalModal(false)}><X className="w-5 h-5" /></button>
                </header>
                <div className="p-6 space-y-4">
                   <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-gray-400 px-1">Empresa / Nombre *</label>
                      <input 
                        type="text" 
                        value={externalForm.name}
                        onChange={e => setExternalForm({...externalForm, name: e.target.value})}
                        className="w-full p-4 bg-gray-50 rounded-xl font-bold text-xs outline-none focus:ring-2 ring-amber-200 transition-all"
                        placeholder="Ej: Montajes S.A."
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-gray-400 px-1">Categoría</label>
                      <select 
                        value={externalForm.category}
                        onChange={e => setExternalForm({...externalForm, category: e.target.value as ExternalCategory})}
                        className="w-full p-4 bg-gray-50 rounded-xl font-black uppercase text-[10px] outline-none"
                      >
                         {EXTERNAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-gray-400 px-1">WhatsApp *</label>
                      <div className="flex gap-2">
                        <div className="bg-gray-50 p-4 rounded-xl text-[10px] font-black text-gray-400">+34</div>
                        <input 
                          type="tel" 
                          value={externalForm.phone}
                          onChange={e => setExternalForm({...externalForm, phone: e.target.value})}
                          className="flex-1 p-4 bg-gray-50 rounded-xl font-bold text-xs outline-none"
                          placeholder="612..."
                        />
                      </div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-gray-400 px-1">Especialidad Técnica</label>
                      <input 
                        type="text" 
                        value={externalForm.specialty}
                        onChange={e => setExternalForm({...externalForm, specialty: e.target.value})}
                        className="w-full p-4 bg-gray-50 rounded-xl font-bold text-xs outline-none"
                        placeholder="Ej: Electricidad"
                      />
                   </div>
                   
                   <div className="bg-blue-50 p-4 rounded-2xl flex gap-3 items-center">
                      <Info className="w-4 h-4 text-blue-500 shrink-0" />
                      <p className="text-[8px] font-bold text-blue-800 uppercase leading-snug">Se guardará en la Agenda de la USAC para futuras asignaciones.</p>
                   </div>

                   <button 
                    onClick={handleAddExternal}
                    className="w-full p-5 bg-gray-900 text-yellow-400 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all mt-2"
                   >
                     Vincular a Tarea
                   </button>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskForm;
