
import React, { useState, useEffect } from 'react';
import { FileText, Search, Plus, Trash2, Download, Building, MapPin, Filter, X, FileCode, ImageIcon, AlertCircle } from 'lucide-react';
import { storageService, BUILDINGS } from '../services/storageService';
import { Blueprint, User } from '../types';

interface BlueprintsModuleProps {
  user: User;
}

const BlueprintsModule: React.FC<BlueprintsModuleProps> = ({ user }) => {
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBlueprint, setNewBlueprint] = useState<Partial<Blueprint>>({
    name: '',
    buildingId: '',
    type: 'PDF',
    notes: ''
  });

  useEffect(() => {
    setBlueprints(storageService.getBlueprints());
  }, []);

  const handleSave = async () => {
    if (!newBlueprint.name || !newBlueprint.buildingId) {
      alert('Nombre y Edificio son obligatorios');
      return;
    }

    const blueprint: Blueprint = {
      id: crypto.randomUUID(),
      name: newBlueprint.name,
      buildingId: newBlueprint.buildingId,
      type: newBlueprint.type as any,
      url: '#', // In a real app, this would be the Firebase Storage URL
      uploadedBy: user.name,
      uploadedAt: new Date().toISOString(),
      notes: newBlueprint.notes
    };

    await storageService.saveBlueprint(blueprint);
    setBlueprints(storageService.getBlueprints());
    setShowAddModal(false);
    setNewBlueprint({ name: '', buildingId: '', type: 'PDF', notes: '' });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Seguro que quieres eliminar este plano?')) {
      await storageService.deleteBlueprint(id);
      setBlueprints(storageService.getBlueprints());
    }
  };

  const filteredBlueprints = blueprints.filter(b => {
    const building = BUILDINGS.find(build => build.id === b.buildingId);
    const matchesSearch = b.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         building?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         building?.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBuilding = selectedBuilding === 'all' || b.buildingId === selectedBuilding;
    return matchesSearch && matchesBuilding;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'DWG': return <FileCode className="w-5 h-5 text-blue-500" />;
      case 'IMG': return <ImageIcon className="w-5 h-5 text-purple-500" />;
      default: return <FileText className="w-5 h-5 text-red-500" />;
    }
  };

  if (user.userCategory !== 'Oficina de Control' && user.role !== 'MASTER') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">Acceso Restringido</h2>
        <p className="text-sm text-gray-500 max-w-xs">Solo el personal de la Oficina de Control tiene acceso a la planimetría oficial.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter text-gray-900">Planimetría Oficial</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Gestión de planos AutoCAD y PDF</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="p-4 bg-gray-900 text-yellow-400 rounded-2xl shadow-xl active:scale-95 transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Subir Plano</span>
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar por nombre o código de edificio..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-100 rounded-2xl text-xs font-bold outline-none focus:border-gray-900 transition-all"
            />
          </div>
          <div className="relative">
            <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select 
              value={selectedBuilding}
              onChange={e => setSelectedBuilding(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-100 rounded-2xl text-xs font-bold outline-none focus:border-gray-900 transition-all appearance-none"
            >
              <option value="all">Todos los edificios</option>
              {BUILDINGS.map(b => (
                <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Blueprints Grid */}
      <div className="grid grid-cols-1 gap-4">
        {filteredBlueprints.length > 0 ? (
          filteredBlueprints.map(b => {
            const building = BUILDINGS.find(build => build.id === b.buildingId);
            return (
              <div key={b.id} className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center shadow-inner group-hover:bg-gray-900 group-hover:text-white transition-colors">
                    {getIcon(b.type)}
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight text-gray-900">{b.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <MapPin className="w-3 h-3 text-gray-400" />
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">
                        {building?.code} - {building?.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[8px] font-black bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase tracking-widest">{b.type}</span>
                      <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Subido por {b.uploadedBy}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-3 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all">
                    <Download className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleDelete(b.id)}
                    className="p-3 text-red-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-20 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">No se han encontrado planos</p>
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
                <h3 className="text-xl font-black uppercase tracking-tight">Subir Plano</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-white/30 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </header>

            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 px-2 tracking-widest">Nombre del Plano</label>
                <input 
                  type="text" 
                  value={newBlueprint.name}
                  onChange={e => setNewBlueprint({...newBlueprint, name: e.target.value})}
                  className="w-full p-5 bg-gray-50 rounded-2xl font-bold text-xs outline-none focus:ring-2 ring-yellow-400 transition-all"
                  placeholder="Ej: Planta Baja - Edificio E0009"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 px-2 tracking-widest">Edificio Relacionado</label>
                <select 
                  value={newBlueprint.buildingId}
                  onChange={e => setNewBlueprint({...newBlueprint, buildingId: e.target.value})}
                  className="w-full p-5 bg-gray-50 rounded-2xl font-black uppercase text-[10px] outline-none"
                >
                  <option value="">Seleccionar edificio...</option>
                  {BUILDINGS.map(b => (
                    <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 px-2 tracking-widest">Tipo de Archivo</label>
                  <select 
                    value={newBlueprint.type}
                    onChange={e => setNewBlueprint({...newBlueprint, type: e.target.value as any})}
                    className="w-full p-5 bg-gray-50 rounded-2xl font-black uppercase text-[10px] outline-none"
                  >
                    <option value="PDF">PDF</option>
                    <option value="DWG">AutoCAD (DWG)</option>
                    <option value="IMG">Imagen (JPG/PNG)</option>
                    <option value="DOC">Documento (DOCX)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 px-2 tracking-widest">Archivo</label>
                  <div className="w-full p-5 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 px-2 tracking-widest">Notas Adicionales</label>
                <textarea 
                  value={newBlueprint.notes}
                  onChange={e => setNewBlueprint({...newBlueprint, notes: e.target.value})}
                  className="w-full p-5 bg-gray-50 rounded-2xl font-medium text-xs outline-none h-24 resize-none"
                  placeholder="Detalles sobre la versión, fecha del plano..."
                />
              </div>

              <button 
                onClick={handleSave}
                className="w-full p-6 bg-gray-900 text-yellow-400 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all"
              >
                Guardar en Archivo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlueprintsModule;
