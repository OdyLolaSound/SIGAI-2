
import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  Calendar, 
  AlertTriangle, 
  Clock, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  ExternalLink, 
  Building, 
  FileText,
  Trash2,
  CheckCircle2,
  DollarSign,
  Send,
  Mail,
  LayoutGrid,
  List,
  Info,
  ChevronRight,
  MoreVertical,
  Zap,
  Flame,
  Droplets,
  Wind,
  Shield,
  Activity,
  FileDown,
  ArrowUpDown,
  ChevronDown,
  Copy
} from 'lucide-react';
import { OCACertificate, Building as BuildingType, Provider } from '../types';
import { storageService, BUILDINGS } from '../services/storageService';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ProviderAutocomplete from './ProviderAutocomplete';

const OCAModule: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingCert, setEditingCert] = useState<OCACertificate | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [selectedCertId, setSelectedCertId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'expiring' | 'caducado'>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({
    key: 'expirationDate',
    direction: 'asc'
  });

  // Form states for auto-fill
  const [formMaintenanceCompany, setFormMaintenanceCompany] = useState('');
  const [formContact, setFormContact] = useState('');

  React.useEffect(() => {
    if (showForm) {
      if (editingCert) {
        setFormMaintenanceCompany(editingCert.maintenanceCompany || '');
        setFormContact(editingCert.contact || '');
      } else {
        setFormMaintenanceCompany('');
        setFormContact('');
      }
    }
  }, [editingCert, showForm]);

  const handleSelectProvider = (p: Provider) => {
    setFormMaintenanceCompany(p.name);
    setFormContact(p.email || p.contactEmail || p.phone || '');
  };

  const certificates = storageService.getOCACertificates();
  const [certs, setCerts] = React.useState<OCACertificate[]>(certificates);

  React.useEffect(() => {
    const unsubscribe = storageService.subscribe(() => {
      console.log('[DEBUG] OCAModule: Storage updated, refreshing local state');
      setCerts([...storageService.getOCACertificates()]);
    });
    return unsubscribe;
  }, []);

  const currentYear = new Date().getFullYear();

  const types = useMemo(() => {
    const allTypes = certs.map(c => c.type).filter(Boolean);
    return Array.from(new Set(allTypes)) as string[];
  }, [certs]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    // dateStr is expected to be YYYY-MM-DD
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    return `${day}-${month}-${year}`;
  };

  const categories = [
    'Baja Tensión', 'Alta Tensión', 'Equipos a Presión', 'Ascensores', 
    'Incendios', 'Legionella', 'Gas', 'Petrolíferas', 
    'Climatización', 'Pararrayos', 'LMT', 'Transformadores', 
    'Líneas de Vida', 'Otros'
  ];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Baja Tensión':
      case 'Alta Tensión':
      case 'Transformadores':
      case 'LMT': return <Zap className="w-4 h-4" />;
      case 'Incendios': return <Flame className="w-4 h-4" />;
      case 'Legionella': return <Droplets className="w-4 h-4" />;
      case 'Climatización': return <Wind className="w-4 h-4" />;
      case 'Petrolíferas':
      case 'Gas': return <Flame className="w-4 h-4" />;
      case 'Líneas de Vida': return <Shield className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const filteredCerts = useMemo(() => {
    return certs
      .filter(c => {
        const matchesSearch = 
          c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.buildingName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.maintenanceCompany?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.installation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.denomination?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === 'all' || c.category === filterCategory;
        const matchesStatus = filterStatus === 'all' || 
                             (filterStatus === 'expiring' && new Date(c.expirationDate).getFullYear() === currentYear) ||
                             (filterStatus === 'caducado' && c.status === 'caducado');
        const matchesType = filterType === 'all' || c.type === filterType;
        return matchesSearch && matchesCategory && matchesStatus && matchesType;
      })
      .sort((a, b) => {
        const order = sortConfig.direction === 'asc' ? 1 : -1;
        const valA = (a as any)[sortConfig.key] || '';
        const valB = (b as any)[sortConfig.key] || '';
        return valA < valB ? -order : valA > valB ? order : 0;
      });
  }, [certs, searchTerm, filterCategory, filterStatus, filterType, currentYear, sortConfig]);

  const expiringThisYear = useMemo(() => {
    return certs.filter(c => {
      const expYear = new Date(c.expirationDate).getFullYear();
      return expYear === currentYear;
    });
  }, [certs, currentYear]);

  const getStatusColor = (status: OCACertificate['status']) => {
    switch (status) {
      case 'vigente': return 'bg-green-100 text-green-700 border-green-200';
      case 'expirando': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'caducado': return 'bg-red-100 text-red-700 border-red-200';
      case 'pendiente_presupuesto': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const handleDelete = async (id: string) => {
    console.log('[DEBUG] handleDelete confirming for ID:', id);
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    
    try {
      console.log('[DEBUG] Executing deletion for ID:', deleteConfirmId);
      await storageService.deleteOCACertificate(deleteConfirmId);
      console.log('[DEBUG] Deletion successful');
      setDeleteConfirmId(null);
    } catch (e) {
      console.error('[DEBUG] Error performing deletion:', e);
      setDeleteConfirmId(null);
    }
  };

  const handleDuplicate = (cert: OCACertificate) => {
    // Create a copy without the ID to force a new one on save
    const duplicate = { ...cert, id: '' };
    setEditingCert(duplicate);
    setShowForm(true);
  };

  const handleNotify = (certs: OCACertificate[], title: string) => {
    const sorted = [...certs].sort((a, b) => a.expirationDate.localeCompare(b.expirationDate));
    const list = sorted.map(c => {
      let line = `- ${c.title} (${c.buildingName}): Expira el ${c.expirationDate}`;
      if (c.documentUrl) {
        line += `\n  Documento: ${c.documentUrl}`;
      }
      return line;
    }).join('\n\n');
    
    const subject = `${title} - SIGAI`;
    const body = `Hola,\n\nEnvío relación de revisiones periódicas (${title}) para su conocimiento y gestión:\n\n${list}\n\nSaludos.`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleDownloadPDF = (certs: OCACertificate[], title: string, fileName: string) => {
    const doc = new jsPDF();
    const sorted = [...certs].sort((a, b) => a.expirationDate.localeCompare(b.expirationDate));
    
    // Header
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generado el: ${new Date().toLocaleDateString()}`, 14, 30);
    
    // Table
    const tableData = sorted.map(c => [
      c.buildingName,
      c.title,
      c.category,
      c.expirationDate,
      c.maintenanceCompany || 'N/C'
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Edificio', 'Instalación', 'Categoría', 'Vencimiento', 'Empresa']],
      body: tableData,
      headStyles: { fillColor: [17, 24, 39], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { top: 40 },
    });

    doc.save(`${fileName}.pdf`);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button 
          onClick={() => setFilterStatus('all')}
          className={`p-6 rounded-[2.5rem] border shadow-sm flex items-center gap-4 transition-all active:scale-95 text-left ${filterStatus === 'all' ? 'bg-blue-600 text-white border-blue-500 ring-4 ring-blue-100' : 'bg-white border-gray-100 text-gray-900 hover:border-blue-200'}`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${filterStatus === 'all' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'}`}>
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest ${filterStatus === 'all' ? 'text-blue-100' : 'text-gray-400'}`}>Total Revisiones</p>
            <p className="text-2xl font-black">{certs.length}</p>
          </div>
        </button>

        <div className={`p-6 rounded-[2.5rem] border shadow-sm flex items-center justify-between transition-all ${filterStatus === 'expiring' ? 'bg-amber-500 text-white border-amber-400 ring-4 ring-amber-100' : 'bg-amber-50 border-amber-100 text-amber-900 hover:border-amber-200'}`}>
          <button 
            onClick={() => setFilterStatus('expiring')}
            className="flex items-center gap-4 flex-1 text-left active:scale-95 transition-all"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${filterStatus === 'expiring' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-600'}`}>
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest ${filterStatus === 'expiring' ? 'text-amber-100' : 'text-amber-800'}`}>Expira este año</p>
              <p className="text-2xl font-black">{expiringThisYear.length}</p>
            </div>
          </button>
          {expiringThisYear.length > 0 && (
            <div className="flex gap-2 ml-4">
              <button 
                onClick={(e) => { e.stopPropagation(); handleDownloadPDF(expiringThisYear, `Vencimientos ${currentYear}`, `vencimientos_${currentYear}`); }}
                className={`p-3 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-90 ${filterStatus === 'expiring' ? 'bg-white text-amber-600' : 'bg-white text-blue-600'}`}
                title="Descargar PDF de Vencimientos"
              >
                <FileDown className="w-5 h-5" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleNotify(expiringThisYear, `Vencimientos ${currentYear}`); }}
                className={`p-3 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-90 ${filterStatus === 'expiring' ? 'bg-white text-amber-800' : 'bg-white text-amber-600'}`}
                title="Notificar Vencimientos por Email"
              >
                <Mail className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        <div className={`p-6 rounded-[2.5rem] border shadow-sm flex items-center justify-between transition-all ${filterStatus === 'caducado' ? 'bg-red-600 text-white border-red-500 ring-4 ring-red-100' : 'bg-red-50 border-red-100 text-red-900 hover:border-red-200'}`}>
          <button 
            onClick={() => setFilterStatus('caducado')}
            className="flex items-center gap-4 flex-1 text-left active:scale-95 transition-all"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${filterStatus === 'caducado' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'}`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest ${filterStatus === 'caducado' ? 'text-red-100' : 'text-red-800'}`}>Caducados</p>
              <p className="text-2xl font-black">{certificates.filter(c => c.status === 'caducado').length}</p>
            </div>
          </button>
          {certificates.filter(c => c.status === 'caducado').length > 0 && (
            <div className="flex gap-2 ml-4">
              <button 
                onClick={(e) => { e.stopPropagation(); handleDownloadPDF(certificates.filter(c => c.status === 'caducado'), 'Revisiones Caducadas', 'revisiones_caducadas'); }}
                className={`p-3 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-90 ${filterStatus === 'caducado' ? 'bg-white text-red-600' : 'bg-white text-red-600'}`}
                title="Descargar PDF de Caducados"
              >
                <FileDown className="w-5 h-5" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleNotify(certificates.filter(c => c.status === 'caducado'), 'Revisiones Caducadas'); }}
                className={`p-3 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-90 ${filterStatus === 'caducado' ? 'bg-white text-red-800' : 'bg-white text-red-600'}`}
                title="Notificar Caducados por Email"
              >
                <Mail className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text"
            placeholder="Buscar por instalación, denominación, edificio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 rounded-xl text-xs font-bold outline-none focus:ring-2 ring-blue-500/20 transition-all"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
            <button 
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
              title="Vista Tabla"
            >
              <List className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'cards' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
              title="Vista Tarjetas"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <select 
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="flex-1 md:flex-none px-4 py-3 bg-gray-50 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none border-none"
          >
            <option value="all">Todas las Categorías</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="flex-1 md:flex-none px-4 py-3 bg-gray-50 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none border-none"
          >
            <option value="all">Todos los Tipos</option>
            {types.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button 
            onClick={() => { setEditingCert(null); setShowForm(true); }}
            className="px-6 py-3 bg-gray-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-black transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        </div>
      </div>

      {/* List / Table */}
      <div className="overflow-hidden">
        {filteredCerts.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-100">
            <ShieldCheck className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">No se encontraron registros</p>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCerts.map(cert => (
              <motion.div 
                layout
                key={cert.id}
                className="bg-white rounded-[2.5rem] p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-5">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                    cert.status === 'caducado' ? 'bg-red-50 text-red-500' : 
                    cert.status === 'expirando' ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500'
                  }`}>
                    {getCategoryIcon(cert.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight truncate">{cert.title}</h4>
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border shrink-0 ${getStatusColor(cert.status)}`}>
                        {cert.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 mt-3">
                      <div className="flex items-center gap-1.5 text-gray-400">
                        <Building className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase truncate">{cert.buildingName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase">Exp: {formatDate(cert.expirationDate)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-400">
                        <Info className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase">{cert.type || 'N/C'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-400">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase truncate">{cert.maintenanceCompany || 'Sin empresa'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setEditingCert(cert); setShowForm(true); }}
                      className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                      title="Editar"
                    >
                      <Plus className="w-4 h-4 rotate-45" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDuplicate(cert); }}
                      className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all"
                      title="Duplicar"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    {cert.documentUrl && (
                      <a 
                        href={cert.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-all"
                        title="Descargar PDF"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                    <button 
                      onClick={(e) => { 
                        console.log('[DEBUG] Card: Trash button clicked for ID:', cert.id);
                        e.stopPropagation(); 
                        handleDelete(cert.id); 
                      }}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {cert.status !== 'vigente' && !cert.budgetRequested && (
                    <button 
                      onClick={() => storageService.saveOCACertificate({ ...cert, status: 'pendiente_presupuesto', budgetRequested: true })}
                      className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all flex items-center gap-2"
                    >
                      <DollarSign className="w-3.5 h-3.5" /> Presupuesto
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-x-auto max-h-[70vh] overflow-y-auto relative scrollbar-hide">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="sticky top-0 z-10">
                  <th 
                    onClick={() => handleSort('buildingId')}
                    className="sticky top-0 bg-gray-50 px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 first:rounded-tl-[2rem] cursor-pointer hover:text-blue-600 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      Edificio {sortConfig.key === 'buildingId' && <ArrowUpDown className="w-3 h-3" />}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('installation')}
                    className="sticky top-0 bg-gray-50 px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 cursor-pointer hover:text-blue-600 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      Instalación / Denominación {sortConfig.key === 'installation' && <ArrowUpDown className="w-3 h-3" />}
                    </div>
                  </th>
                  <th className="sticky top-0 bg-gray-50 px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Categoría</th>
                  <th 
                    onClick={() => handleSort('type')}
                    className="sticky top-0 bg-gray-50 px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 cursor-pointer hover:text-blue-600 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      Tipo {sortConfig.key === 'type' && <ArrowUpDown className="w-3 h-3" />}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('lastInspectionDate')}
                    className="sticky top-0 bg-gray-50 px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 cursor-pointer hover:text-blue-600 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      Última Fecha {sortConfig.key === 'lastInspectionDate' && <ArrowUpDown className="w-3 h-3" />}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('expirationDate')}
                    className="sticky top-0 bg-gray-50 px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 cursor-pointer hover:text-blue-600 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      Próxima Fecha {sortConfig.key === 'expirationDate' && <ArrowUpDown className="w-3 h-3" />}
                    </div>
                  </th>
                  <th className="sticky top-0 bg-gray-50 px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Estado</th>
                  <th className="sticky top-0 bg-gray-50 px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 last:rounded-tr-[2rem]">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredCerts.map(cert => (
                  <tr 
                    key={cert.id} 
                    onClick={() => setSelectedCertId(selectedCertId === cert.id ? null : cert.id)}
                    className={`cursor-pointer transition-all ${
                      selectedCertId === cert.id 
                        ? 'bg-blue-50/80 shadow-inner' 
                        : 'hover:bg-gray-50/50'
                    } group`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-gray-900">{cert.buildingId}</span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase truncate max-w-[120px]">{cert.buildingName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-800">{cert.installation || cert.title}</span>
                        <span className="text-[10px] font-mono text-gray-400">{cert.denomination || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-gray-50 rounded-lg text-gray-400">
                          {getCategoryIcon(cert.category)}
                        </div>
                        <span className="text-[10px] font-bold text-gray-600 uppercase">{cert.category}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-black text-gray-500 uppercase px-2 py-1 bg-gray-100 rounded-md">
                        {cert.type || 'N/C'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono text-gray-600">{formatDate(cert.lastInspectionDate)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-mono font-bold ${
                        cert.status === 'caducado' ? 'text-red-600' : 
                        cert.status === 'expirando' ? 'text-amber-600' : 'text-gray-900'
                      }`}>
                        {formatDate(cert.expirationDate)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border inline-block ${getStatusColor(cert.status)}`}>
                        {cert.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditingCert(cert); setShowForm(true); }}
                          className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Plus className="w-4 h-4 rotate-45" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDuplicate(cert); }}
                          className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all"
                          title="Duplicar"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        {cert.documentUrl && (
                          <a 
                            href={cert.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-all"
                            title="Descargar PDF"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        <button 
                          onClick={(e) => { 
                            console.log('[DEBUG] Table: Trash button clicked for ID:', cert.id);
                            e.stopPropagation(); 
                            handleDelete(cert.id); 
                          }}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Trash2 className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-2">¿Eliminar registro?</h3>
                <p className="text-gray-500 font-medium mb-8">
                  Esta acción no se puede deshacer. El certificado OCA y sus tareas asociadas serán eliminados permanentemente.
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={confirmDelete}
                    className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 bg-gray-900 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter">
                    {editingCert?.id ? 'Editar Registro' : editingCert ? 'Duplicar Registro' : 'Nueva Revisión Periódica'}
                  </h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Gestión de Mantenimiento Legal e Inspecciones</p>
                </div>
                <button onClick={() => setShowForm(false)} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <form className="p-8 space-y-8 max-h-[80vh] overflow-y-auto scrollbar-hide" onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const building = BUILDINGS.find(b => b.id === formData.get('buildingId'));
                
                const cert: OCACertificate = {
                  id: editingCert?.id || crypto.randomUUID(),
                  title: formData.get('title') as string,
                  category: formData.get('category') as any,
                  buildingId: formData.get('buildingId') as string,
                  buildingName: building?.name || '',
                  installation: formData.get('installation') as string,
                  denomination: formData.get('denomination') as string,
                  legislation: formData.get('legislation') as string,
                  capacity: formData.get('capacity') as string,
                  industryRegistrationDate: formData.get('industryRegistrationDate') as string,
                  inspectionType: formData.get('inspectionType') as string,
                  frequency: formData.get('frequency') as string,
                  lastInspectionDate: formData.get('lastInspectionDate') as string,
                  expirationDate: formData.get('expirationDate') as string,
                  periodicityYears: Number(formData.get('periodicityYears')),
                  type: formData.get('type') as any,
                  isSectorial: formData.get('isSectorial') === 'true',
                  maintenanceCompany: formData.get('maintenanceCompany') as string,
                  contact: formData.get('contact') as string,
                  status: formData.get('status') as any,
                  notes: formData.get('notes') as string,
                  documentUrl: formData.get('documentUrl') as string,
                  budgetRequested: editingCert?.budgetRequested || false,
                  budgetReceived: editingCert?.budgetReceived || false
                };

                await storageService.saveOCACertificate(cert);
                setShowForm(false);
              }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Basic Info */}
                  <div className="md:col-span-3">
                    <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                      <Info className="w-3 h-3" /> Información General
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">Título / Identificador</label>
                        <input 
                          name="title"
                          defaultValue={editingCert?.title}
                          required
                          placeholder="Ej: Depósito Enterrado D-044-E"
                          className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-blue-500/20 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">Edificio</label>
                        <select 
                          name="buildingId"
                          defaultValue={editingCert?.buildingId}
                          required
                          className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-blue-500/20 transition-all"
                        >
                          {BUILDINGS.map(b => (
                            <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Technical Details */}
                  <div className="md:col-span-3">
                    <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4 mt-4 flex items-center gap-2">
                      <Activity className="w-3 h-3" /> Detalles Técnicos
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">Instalación</label>
                        <input 
                          name="installation"
                          defaultValue={editingCert?.installation}
                          placeholder="Ej: CALDERA"
                          className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-blue-500/20 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">Denominación</label>
                        <input 
                          name="denomination"
                          defaultValue={editingCert?.denomination}
                          placeholder="Ej: C-042"
                          className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-blue-500/20 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">Categoría</label>
                        <select 
                          name="category"
                          defaultValue={editingCert?.category || 'Baja Tensión'}
                          className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-blue-500/20 transition-all"
                        >
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">Legislación Aplicable</label>
                        <input 
                          name="legislation"
                          defaultValue={editingCert?.legislation}
                          placeholder="Ej: Real Decreto 809/2021 (ITC EP-1)"
                          className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-blue-500/20 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">Potencia / Capacidad</label>
                        <input 
                          name="capacity"
                          defaultValue={editingCert?.capacity}
                          placeholder="Ej: 5000 litros / 80 Kw"
                          className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-blue-500/20 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Inspection Info */}
                  <div className="md:col-span-3">
                    <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4 mt-4 flex items-center gap-2">
                      <Calendar className="w-3 h-3" /> Planificación e Inspección
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">Última Inspección</label>
                        <input 
                          type="date"
                          name="lastInspectionDate"
                          defaultValue={editingCert?.lastInspectionDate}
                          required
                          className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-blue-500/20 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">Próxima Fecha</label>
                        <input 
                          type="date"
                          name="expirationDate"
                          defaultValue={editingCert?.expirationDate}
                          required
                          className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-blue-500/20 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">Frecuencia</label>
                        <input 
                          name="frequency"
                          defaultValue={editingCert?.frequency}
                          placeholder="Ej: 1 AÑO, 5 AÑOS"
                          className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-blue-500/20 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">Periodicidad (Años)</label>
                        <input 
                          type="number"
                          name="periodicityYears"
                          defaultValue={editingCert?.periodicityYears || 1}
                          required
                          className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-blue-500/20 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">Tipo de Revisión</label>
                        <select 
                          name="type"
                          defaultValue={editingCert?.type || 'EM'}
                          className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-blue-500/20 transition-all"
                        >
                          <option value="EM">EM (Empresa Mantenedora)</option>
                          <option value="OCA">OCA (Organismo Control)</option>
                          <option value="EMOCA">EM + OCA</option>
                          <option value="MEMORIA">MEMORIA</option>
                          <option value="PROYECTO">PROYECTO</option>
                          <option value="INSP">INSPECCIÓN</option>
                          <option value="N/C">N/C</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">Contrato Sectorial</label>
                        <select 
                          name="isSectorial"
                          defaultValue={editingCert?.isSectorial ? 'true' : 'false'}
                          className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-blue-500/20 transition-all"
                        >
                          <option value="true">SÍ</option>
                          <option value="false">NO</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">Estado Actual</label>
                        <select 
                          name="status"
                          defaultValue={editingCert?.status || 'vigente'}
                          className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-blue-500/20 transition-all"
                        >
                          <option value="vigente">Vigente</option>
                          <option value="expirando">Expirando</option>
                          <option value="caducado">Caducado</option>
                          <option value="pendiente_presupuesto">Pendiente Presupuesto</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Company Info */}
                  <div className="md:col-span-3">
                    <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4 mt-4 flex items-center gap-2">
                      <ShieldCheck className="w-3 h-3" /> Empresa y Contacto
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">Empresa Mantenedora / OCA</label>
                        <ProviderAutocomplete 
                          value={formMaintenanceCompany}
                          onChange={setFormMaintenanceCompany}
                          onSelectProvider={handleSelectProvider}
                          placeholder="Ej: TÉRMICAS, SGS..."
                        />
                        <input type="hidden" name="maintenanceCompany" value={formMaintenanceCompany} />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">Contacto / Email</label>
                        <input 
                          name="contact"
                          value={formContact}
                          onChange={(e) => setFormContact(e.target.value)}
                          placeholder="Ej: contacto@empresa.com"
                          className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-blue-500/20 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">URL del Documento (PDF)</label>
                    <input 
                      name="documentUrl"
                      defaultValue={editingCert?.documentUrl}
                      placeholder="https://ejemplo.com/archivo.pdf"
                      className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-blue-500/20 transition-all"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">Observaciones</label>
                    <textarea 
                      name="notes"
                      defaultValue={editingCert?.notes}
                      className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-blue-500/20 transition-all h-32 resize-none"
                    />
                  </div>
                </div>

                <div className="pt-6 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-5 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-5 bg-gray-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all shadow-xl shadow-gray-900/20"
                  >
                    {editingCert ? 'Guardar Cambios' : 'Crear Registro'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OCAModule;
