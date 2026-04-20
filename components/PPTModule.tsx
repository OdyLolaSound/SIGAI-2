
import React, { useState, useEffect } from 'react';
import { 
  FileText, Search, Plus, Trash2, Download, Building, 
  Calendar, Filter, X, CheckCircle2, AlertTriangle, 
  Clock, Briefcase, Sparkles, Loader2, ChevronRight,
  ChevronDown, ListChecks, CalendarPlus, MapPin, Settings
} from 'lucide-react';
import { storageService, BUILDINGS } from '../services/storageService';
import { PPT, PPTTask, User, UrgencyLevel, CalendarTask, OCACertificate } from '../types';
import { getLocalDateString } from '../services/dateUtils';
import { GoogleGenAI } from "@google/genai";
import VisitCertificate from './VisitCertificate';
import PPTExecutionControl from './PPTExecutionControl';
import PPTExecutionHistory from './PPTExecutionHistory';

interface PPTModuleProps {
  user: User;
}

const PPTModule: React.FC<PPTModuleProps> = ({ user }) => {
  const [ppts, setPpts] = useState<PPT[]>([]);
  const [ocaCertificates, setOcaCertificates] = useState<OCACertificate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubCategory, setSelectedSubCategory] = useState<'all' | 'sectorial' | 'no_sectorial'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [expandedPpt, setExpandedPpt] = useState<string | null>(null);
  const [showVisitCert, setShowVisitCert] = useState(false);
  const [showExecutionControl, setShowExecutionControl] = useState(false);
  const [showExecutionHistory, setShowExecutionHistory] = useState(false);
  const [selectedPptForAction, setSelectedPptForAction] = useState<PPT | null>(null);
  
  const [newPpt, setNewPpt] = useState<Partial<PPT>>({
    title: '',
    category: 'Otros',
    isSectorial: true,
    buildingIds: [],
    validFrom: new Date().toISOString().split('T')[0],
    validTo: '',
    tasks: [],
    status: 'active'
  });

  useEffect(() => {
    setPpts(storageService.getPPTS());
    setOcaCertificates(storageService.getOCACertificates());
  }, []);

  const handleSave = async () => {
    if (!newPpt.title || !newPpt.category) {
      alert('Título y Categoría son obligatorios');
      return;
    }

    const ppt: PPT = {
      id: crypto.randomUUID(),
      title: newPpt.title,
      category: newPpt.category as any,
      isSectorial: newPpt.isSectorial ?? true,
      buildingIds: newPpt.buildingIds || [],
      companyName: newPpt.companyName,
      validFrom: newPpt.validFrom || new Date().toISOString(),
      validTo: newPpt.validTo || '',
      tasks: newPpt.tasks || [],
      status: 'active',
      createdAt: new Date().toISOString()
    };

    await storageService.savePPT(ppt);
    setPpts(storageService.getPPTS());
    setShowAddModal(false);
    setNewPpt({ title: '', category: 'Otros', tasks: [], status: 'active' });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Seguro que quieres eliminar este Sectorial?')) {
      await storageService.deletePPT(id);
      setPpts(storageService.getPPTS());
    }
  };

  const simulateAIExtraction = async () => {
    setIsExtracting(true);
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    const mockTasks: PPTTask[] = [
      {
        id: crypto.randomUUID(),
        description: 'Revisión mensual de niveles y engrase',
        frequency: 'mensual',
        equipment: 'Ascensor Principal',
        location: 'Edificio USAC',
        priority: 'Media'
      },
      {
        id: crypto.randomUUID(),
        description: 'Prueba de paracaídas y limitador de velocidad',
        frequency: 'anual',
        equipment: 'Ascensor Tropa',
        location: 'Alojamiento B',
        priority: 'Crítica'
      },
      {
        id: crypto.randomUUID(),
        description: 'Inspección técnica reglamentaria (OCA)',
        frequency: 'bienal',
        equipment: 'Instalación General',
        location: 'Cuartel General',
        priority: 'Alta'
      }
    ];

    setNewPpt(prev => ({
      ...prev,
      tasks: mockTasks,
      title: prev.title || 'Sectorial Extraído por IA'
    }));
    setIsExtracting(false);
  };

  const filteredPpts = ppts.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.companyName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSubCategory = selectedSubCategory === 'all' || 
                              (selectedSubCategory === 'sectorial' && p.isSectorial) ||
                              (selectedSubCategory === 'no_sectorial' && !p.isSectorial);
    return matchesSearch && matchesCategory && matchesSubCategory;
  });

  const handleGenerateChecklist = (ppt: PPT) => {
    // If it has buildingIds (Anexo B), filter tasks or warn
    const buildingsInAnexoB = ppt.buildingIds || [];
    
    const newTask: CalendarTask = {
      id: crypto.randomUUID(),
      title: `Checklist: ${ppt.title}`,
      description: `Tareas de cumplimiento según PPT: ${ppt.title}. Empresa: ${ppt.companyName || 'N/A'}. ${buildingsInAnexoB.length > 0 ? `Instalaciones Anexo B: ${buildingsInAnexoB.join(', ')}` : ''}`,
      type: 'Inspección',
      startDate: getLocalDateString(new Date()),
      startTime: '08:00',
      priority: 'Media',
      status: 'Pendiente',
      assignedTo: [],
      location: 'Acuartelamiento',
      checklist: ppt.tasks.map(t => ({
        id: crypto.randomUUID(),
        text: `[${t.frequency.toUpperCase()}] ${t.description}`,
        completed: false
      })),
      createdBy: user.id,
      createdAt: new Date().toISOString()
    };

    storageService.saveTask(newTask);
    alert('✅ Checklist generado en la Agenda para el día de hoy.');
  };

  if (user.userCategory !== 'Oficina de Control' && user.role !== 'MASTER') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">Acceso Restringido</h2>
        <p className="text-sm text-gray-500 max-w-xs">Solo el personal de la Oficina de Control tiene acceso a los Sectoriales.</p>
      </div>
    );
  }

  if (showVisitCert && selectedPptForAction) {
    return <VisitCertificate onBack={() => setShowVisitCert(false)} />;
  }

  if (showExecutionControl && selectedPptForAction) {
    return <PPTExecutionControl ppt={selectedPptForAction} onBack={() => setShowExecutionControl(false)} />;
  }

  if (showExecutionHistory && selectedPptForAction) {
    return <PPTExecutionHistory ppt={selectedPptForAction} onBack={() => setShowExecutionHistory(false)} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter text-gray-900">Contratos (PPTs)</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mantenimientos y Normativa Sectorial</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="p-4 bg-gray-900 text-yellow-400 rounded-2xl shadow-xl active:scale-95 transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Nuevo Contrato</span>
          </button>
        </div>

        {/* Subcategory Tabs */}
        <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
          <button 
            onClick={() => setSelectedSubCategory('all')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedSubCategory === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Todos
          </button>
          <button 
            onClick={() => setSelectedSubCategory('sectorial')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedSubCategory === 'sectorial' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Sectoriales
          </button>
          <button 
            onClick={() => setSelectedSubCategory('no_sectorial')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedSubCategory === 'no_sectorial' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            No Sectoriales
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Buscar por título o empresa..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-100 rounded-2xl text-xs font-bold outline-none focus:border-gray-900 transition-all"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select 
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-100 rounded-2xl text-xs font-bold outline-none focus:border-gray-900 transition-all appearance-none"
              >
                <option value="all">Todas las categorías</option>
                <option value="Ascensores">Ascensores</option>
                <option value="Centros de Transformación">Centros de Transformación</option>
                <option value="Legionella">Legionella</option>
                <option value="Térmicas">Térmicas</option>
                <option value="Piscinas">Piscinas</option>
                <option value="Jardinería">Jardinería</option>
                <option value="Otros">Otros</option>
              </select>
            </div>
          </div>
      </div>

      {/* PPTs List */}
      <div className="space-y-4">
        {filteredPpts.length > 0 ? (
          filteredPpts.map(p => (
            <div key={p.id} className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden transition-all hover:shadow-md">
              <div 
                className="p-6 flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedPpt(expandedPpt === p.id ? null : p.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-900">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight text-gray-900">{p.title}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${p.isSectorial ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                        {p.isSectorial ? 'Sectorial' : 'No Sectorial'}
                      </span>
                      <span className="text-[8px] font-black bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full uppercase tracking-widest">{p.category}</span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{p.companyName || 'Empresa no asignada'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Tareas</div>
                    <div className="text-xs font-black text-gray-900">{p.tasks.length}</div>
                  </div>
                  {expandedPpt === p.id ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                </div>
              </div>

              {expandedPpt === p.id && (
                <div className="px-6 pb-6 pt-2 border-t border-gray-50 animate-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-4 bg-gray-50 rounded-2xl">
                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1">Vigencia</span>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-gray-700">
                        <Calendar className="w-3 h-3" />
                        {new Date(p.validFrom).toLocaleDateString()} - {p.validTo ? new Date(p.validTo).toLocaleDateString() : 'Indefinido'}
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl">
                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1">Anexo B (Instalaciones)</span>
                      <div className="text-[10px] font-bold text-gray-700 truncate">
                        {p.buildingIds && p.buildingIds.length > 0 ? p.buildingIds.join(', ') : 'Todas'}
                      </div>
                    </div>
                  </div>

                  {p.isSectorial ? (
                    <div className="space-y-3 mb-3">
                      <button 
                        onClick={() => {
                          setSelectedPptForAction(p);
                          setShowExecutionControl(true);
                        }}
                        className="w-full p-4 bg-gray-900 text-yellow-400 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                      >
                        <ListChecks className="w-4 h-4" />
                        Control de Ejecución (Visita)
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedPptForAction(p);
                          setShowExecutionHistory(true);
                        }}
                        className="w-full p-4 bg-white border-2 border-gray-900 text-gray-900 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
                      >
                        <Clock className="w-4 h-4" />
                        Ver Historial de Visitas
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        setSelectedPptForAction(p);
                        setShowVisitCert(true);
                      }}
                      className="w-full mb-3 p-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                    >
                      <FileText className="w-4 h-4" />
                      Generar Certificado de Visita
                    </button>
                  )}

                  <button 
                    onClick={() => handleGenerateChecklist(p)}
                    className="w-full mb-6 p-4 bg-white border-2 border-gray-100 text-gray-900 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
                  >
                    <CalendarPlus className="w-4 h-4" />
                    Agendar Checklist en Agenda
                  </button>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <ListChecks className="w-4 h-4 text-gray-400" />
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Tareas de Mantenimiento</span>
                    </div>
                    {p.tasks.map(task => (
                      <div key={task.id} className="p-4 bg-white border border-gray-100 rounded-2xl flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            task.priority === 'Crítica' ? 'bg-red-500' : 
                            task.priority === 'Alta' ? 'bg-orange-500' : 'bg-blue-500'
                          }`} />
                          <div>
                            <p className="text-xs font-bold text-gray-800">{task.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[8px] font-black uppercase text-gray-400 tracking-widest">{task.frequency}</span>
                              {task.equipment && (
                                <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1">
                                  <Settings className="w-2 h-2" /> {task.equipment}
                                </span>
                              )}
                              {task.location && (
                                <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1">
                                  <MapPin className="w-2 h-2" /> {task.location}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-gray-100 group-hover:text-green-500 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
            <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">No hay sectoriales registrados</p>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-white rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <header className="p-8 bg-gray-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-400 rounded-2xl flex items-center justify-center">
                  <Plus className="w-6 h-6 text-black" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight">Nuevo Contrato</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-white/30 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </header>

            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-hide">
              <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl mb-4">
                <button 
                  onClick={() => setNewPpt({...newPpt, isSectorial: true})}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${newPpt.isSectorial ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
                >
                  Sectorial
                </button>
                <button 
                  onClick={() => setNewPpt({...newPpt, isSectorial: false})}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!newPpt.isSectorial ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
                >
                  No Sectorial
                </button>
              </div>
              <div className="p-6 bg-blue-50 rounded-[2rem] border border-blue-100 space-y-3">
                <div className="flex items-center gap-2 text-blue-800">
                  <Sparkles className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Extracción Inteligente</span>
                </div>
                <p className="text-[10px] text-blue-600 font-medium leading-relaxed">
                  Sube el PDF del Sectorial y la IA extraerá automáticamente las tareas de mantenimiento y su frecuencia.
                </p>
                <button 
                  onClick={simulateAIExtraction}
                  disabled={isExtracting}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  {isExtracting ? 'Analizando Documento...' : 'Escanear Sectorial (PDF)'}
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 px-2 tracking-widest">Título del Sectorial</label>
                  <input 
                    type="text" 
                    value={newPpt.title}
                    onChange={e => setNewPpt({...newPpt, title: e.target.value})}
                    className="w-full p-5 bg-gray-50 rounded-2xl font-bold text-xs outline-none focus:ring-2 ring-yellow-400 transition-all"
                    placeholder="Ej: Mantenimiento Ascensores 2024"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-400 px-2 tracking-widest">Categoría</label>
                    <select 
                      value={newPpt.category}
                      onChange={e => setNewPpt({...newPpt, category: e.target.value as any})}
                      className="w-full p-5 bg-gray-50 rounded-2xl font-black uppercase text-[10px] outline-none"
                    >
                      <option value="Ascensores">Ascensores</option>
                      <option value="Centros de Transformación">Centros de Transformación</option>
                      <option value="Legionella">Legionella</option>
                      <option value="Térmicas">Térmicas</option>
                      <option value="Piscinas">Piscinas</option>
                      <option value="Jardinería">Jardinería</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-400 px-2 tracking-widest">Empresa</label>
                    <input 
                      type="text" 
                      value={newPpt.companyName}
                      onChange={e => setNewPpt({...newPpt, companyName: e.target.value})}
                      className="w-full p-5 bg-gray-50 rounded-2xl font-bold text-xs outline-none"
                      placeholder="Nombre empresa..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 px-2 tracking-widest">Anexo B (Instalaciones)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {BUILDINGS.map(b => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          const current = newPpt.buildingIds || [];
                          if (current.includes(b.id)) {
                            setNewPpt({...newPpt, buildingIds: current.filter(id => id !== b.id)});
                          } else {
                            setNewPpt({...newPpt, buildingIds: [...current, b.id]});
                          }
                        }}
                        className={`p-3 rounded-xl text-[9px] font-bold uppercase transition-all border-2 ${
                          (newPpt.buildingIds || []).includes(b.id) 
                            ? 'bg-gray-900 text-white border-gray-900' 
                            : 'bg-gray-50 text-gray-400 border-transparent hover:border-gray-200'
                        }`}
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-400 px-2 tracking-widest">Desde</label>
                    <input 
                      type="date" 
                      value={newPpt.validFrom}
                      onChange={e => setNewPpt({...newPpt, validFrom: e.target.value})}
                      className="w-full p-5 bg-gray-50 rounded-2xl font-bold text-xs outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-400 px-2 tracking-widest">Hasta</label>
                    <input 
                      type="date" 
                      value={newPpt.validTo}
                      onChange={e => setNewPpt({...newPpt, validTo: e.target.value})}
                      className="w-full p-5 bg-gray-50 rounded-2xl font-bold text-xs outline-none"
                    />
                  </div>
                </div>

                {newPpt.tasks && newPpt.tasks.length > 0 && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-gray-400 px-2 tracking-widest">Tareas Extraídas ({newPpt.tasks.length})</label>
                    <div className="space-y-3">
                      {newPpt.tasks.map((t, idx) => (
                        <div key={t.id} className="p-5 bg-green-50 border border-green-100 rounded-[2rem] space-y-4">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            <span className="text-xs font-bold text-green-800">{t.description}</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[8px] font-black uppercase text-green-600 px-1">Equipo/Instalación</label>
                              <input 
                                type="text"
                                value={t.equipment || ''}
                                onChange={e => {
                                  const updatedTasks = [...(newPpt.tasks || [])];
                                  updatedTasks[idx] = { ...updatedTasks[idx], equipment: e.target.value };
                                  setNewPpt({ ...newPpt, tasks: updatedTasks });
                                }}
                                className="w-full p-3 bg-white border border-green-200 rounded-xl text-[10px] font-bold outline-none focus:border-green-500"
                                placeholder="Ej: Ascensor 1"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] font-black uppercase text-green-600 px-1">Ubicación Exacta</label>
                              <input 
                                type="text"
                                value={t.location || ''}
                                onChange={e => {
                                  const updatedTasks = [...(newPpt.tasks || [])];
                                  updatedTasks[idx] = { ...updatedTasks[idx], location: e.target.value };
                                  setNewPpt({ ...newPpt, tasks: updatedTasks });
                                }}
                                className="w-full p-3 bg-white border border-green-200 rounded-xl text-[10px] font-bold outline-none focus:border-green-500"
                                placeholder="Ej: Planta Baja"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={handleSave}
                className="w-full p-6 bg-gray-900 text-yellow-400 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all"
              >
                Guardar Sectorial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PPTModule;
