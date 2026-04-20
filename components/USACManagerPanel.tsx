
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ClipboardList, Clock, ShieldAlert, CheckCircle2, 
  XCircle, ChevronRight, User, Filter, AlertTriangle, 
  Search, MessageCircle, Wrench, Package, ArrowRightLeft, 
  MoreVertical, Eye, BarChart3, TrendingDown, MapPin, Loader2,
  CalendarDays, Timer, CheckCircle, Activity, Camera, FileText,
  BrainCircuit, TrendingUp, Sparkles, Box, Users, Zap, 
  Calendar, Layers, ShieldCheck, Truck, PlusCircle
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, 
  Cell, PieChart, Pie, LineChart, Line, CartesianGrid, Legend, AreaChart, Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { RequestItem, UrgencyLevel, User as UserType, RequestCategory, Role } from '../types';
import { storageService } from '../services/storageService';
import { getLocalDateString } from '../services/dateUtils';
import { db } from '../firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import ProvidersModule from './ProvidersModule';
import BlueprintsModule from './BlueprintsModule';
import PPTModule from './PPTModule';
import OCAModule from './OCAModule';

interface USACManagerPanelProps {
  currentUser: UserType;
}

// Fixed: Added 'Rutina' to satisfy Record<UrgencyLevel, number>
const SLA_HOURS: Record<UrgencyLevel, number> = {
  'Crítica': 2, 
  'Alta': 24,
  'Media': 48,
  'Baja': 72,
  'Rutina': 168
};

// Fixed: Added 'Rutina' to satisfy Record<UrgencyLevel, number>
const URGENCY_SCORE: Record<UrgencyLevel, number> = {
  'Crítica': 40,
  'Alta': 30,
  'Media': 20,
  'Baja': 10,
  'Rutina': 5
};

const USACManagerPanel: React.FC<USACManagerPanelProps> = ({ currentUser }) => {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'peticion' | 'material' | 'stats' | 'providers' | 'blueprints' | 'ppts' | 'oca'>('all');
  const [timeRange, setTimeRange] = useState<'month' | 'year'>('month');
  const [aiStructuralLoading, setAiStructuralLoading] = useState(false);
  const [now, setNow] = useState(new Date());
  const isMaster = currentUser.role === 'MASTER';

  // Reassignment State
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [technicians, setTechnicians] = useState<UserType[]>([]);
  const [selectedTechIds, setSelectedTechIds] = useState<string[]>([]);

  // Work Report State
  const [showWorkReportForm, setShowWorkReportForm] = useState(false);
  const [workPerformed, setWorkPerformed] = useState('');
  const [materialsUsed, setMaterialsUsed] = useState('');
  const [timeSpent, setTimeSpent] = useState('60');
  const [afterImage, setAfterImage] = useState<string | null>(null);
  const afterImageInputRef = useRef<HTMLInputElement>(null);

  // AI Advice State
  const [showMaterialAdvice, setShowMaterialAdvice] = useState(false);
  const [showExecutionAdvice, setShowExecutionAdvice] = useState(false);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [materialAdvice, setMaterialAdvice] = useState<{ materials: string[], advice: string } | null>(null);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [purchaseCategory, setPurchaseCategory] = useState<'fontanería' | 'electricidad' | 'ferretería' | 'construcción'>('fontanería');
  const [whatsappTechId, setWhatsappTechId] = useState<string>('');
  const [showMaterialConfirm, setShowMaterialConfirm] = useState(false);
  const [confirmMaterialAction, setConfirmMaterialAction] = useState<'warehouse' | 'purchase' | null>(null);
  const [executionAdvice, setExecutionAdvice] = useState<string | null>(null);
  const [extraMaterials, setExtraMaterials] = useState<string>('');

  useEffect(() => {
    // Real-time requests listener
    const qRequests = query(collection(db, 'requests'));
    const unsubscribeRequests = onSnapshot(qRequests, (snapshot) => {
      const all = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as RequestItem[];
      setRequests(all);
    });

    // Real-time users listener for technicians
    const qUsers = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as UserType[];
      // Match TeamPanel logic: isManto OR userCategory is Técnico, and must be approved
      const mantoTechs = allUsers.filter(u => 
        (u.isManto || u.userCategory === 'Técnico') && 
        u.status === 'approved'
      );
      setTechnicians(mantoTechs);
    });

    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => {
      unsubscribeRequests();
      unsubscribeUsers();
      clearInterval(timer);
    };
  }, []);

  const loadRequests = () => {
    const all = storageService.getRequests();
    setRequests(all);
  };

  const prioritizedRequests = useMemo(() => {
    if (filterType === 'stats') return [];
    return [...requests]
      .filter(r => r.status !== 'resolved_by_ai') // En la lista de tareas no mostramos las resueltas por IA
      .filter(r => filterType === 'all' || r.type === filterType)
      .sort((a, b) => {
        const chronicA = a.isChronic ? 50 : 0;
        const chronicB = b.isChronic ? 50 : 0;
        const scoreA = (URGENCY_SCORE[a.urgency || 'Baja'] || 0) + chronicA + (1000000000000 / new Date(a.date).getTime());
        const scoreB = (URGENCY_SCORE[b.urgency || 'Baja'] || 0) + chronicB + (1000000000000 / new Date(b.date).getTime());
        return scoreB - scoreA;
      });
  }, [requests, filterType]);

  const analytics = useMemo(() => {
    const all = requests;
    const closed = all.filter(r => r.status === 'closed' && r.resolvedAt);
    const resolvedByAi = all.filter(r => r.status === 'resolved_by_ai');
    const officialRequests = all.filter(r => r.status !== 'resolved_by_ai');
    
    // IA Savings
    const aiSavingRate = all.length > 0 ? (resolvedByAi.length / all.length) * 100 : 0;

    // SLA & Time
    let totalResolutionTime = 0;
    let slaCompliance = 0;
    closed.forEach(r => {
      const creation = new Date(r.date).getTime();
      const resolution = new Date(r.resolvedAt!).getTime();
      const diffHours = (resolution - creation) / (1000 * 60 * 60);
      totalResolutionTime += diffHours;
      if (diffHours <= SLA_HOURS[r.urgency || 'Baja']) slaCompliance++;
    });

    // Materials Counting
    const materialCounts: Record<string, number> = {};
    closed.forEach(r => {
      if (r.workDetails?.materialsUsed) {
        const mats = r.workDetails.materialsUsed.split(',').map(m => m.trim().toLowerCase());
        mats.forEach(m => { if(m) materialCounts[m] = (materialCounts[m] || 0) + 1; });
      }
    });
    const topMaterials = Object.entries(materialCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Categories & Units
    const categories: Record<string, number> = {};
    const units: Record<string, number> = {};
    officialRequests.forEach(r => {
      const cat = r.category || 'Otros';
      categories[cat] = (categories[cat] || 0) + 1;
      units[r.unit] = (units[r.unit] || 0) + 1;
    });

    // Time Series (Monthly for current year)
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const currentYear = new Date().getFullYear();
    const monthlyTrend = months.map((m, i) => {
      const monthRequests = all.filter(r => {
        const d = new Date(r.date);
        return d.getMonth() === i && d.getFullYear() === currentYear;
      });
      return {
        name: m,
        total: monthRequests.length,
        ia: monthRequests.filter(r => r.status === 'resolved_by_ai').length,
        oficial: monthRequests.filter(r => r.status !== 'resolved_by_ai').length
      };
    });

    return {
      totalPeticiones: all.length,
      aiSavings: resolvedByAi.length,
      aiSavingRate,
      totalOficial: officialRequests.length,
      avgResolutionTime: closed.length > 0 ? (totalResolutionTime / closed.length).toFixed(1) : '0',
      slaPercentage: closed.length > 0 ? ((slaCompliance / closed.length) * 100).toFixed(0) : '100',
      topCategories: Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 5),
      conflictiveUnits: Object.entries(units).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topMaterials,
      monthlyTrend,
      totalChronic: officialRequests.filter(r => r.isChronic).length
    };
  }, [requests]);

  const getSLAInfo = (request: RequestItem) => {
    if (request.status === 'closed' && request.resolvedAt) {
      const creation = new Date(request.date).getTime();
      const resolution = new Date(request.resolvedAt).getTime();
      const diffHours = (resolution - creation) / (1000 * 60 * 60);
      const compliant = diffHours <= SLA_HOURS[request.urgency || 'Baja'];
      return { expired: !compliant, text: compliant ? 'SLA Cumplido' : 'SLA Superado', color: compliant ? 'text-green-500' : 'text-red-500' };
    }

    const creationDate = new Date(request.date);
    const slaLimit = new Date(creationDate.getTime() + SLA_HOURS[request.urgency || 'Baja'] * 60 * 60 * 1000);
    const diff = slaLimit.getTime() - now.getTime();
    
    if (diff < 0) {
      return { expired: true, text: `Excedido ${Math.abs(Math.floor(diff / (1000 * 60 * 60)))}h`, color: 'text-red-500 animate-pulse font-black' };
    }
    
    const hoursRemaining = Math.floor(diff / (1000 * 60 * 60));
    return { expired: false, text: `Restan ${hoursRemaining}h`, color: hoursRemaining < 5 ? 'text-orange-500 font-bold' : 'text-gray-400' };
  };

  const handleAfterImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAfterImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const getMaterialAdvice = async (request: RequestItem) => {
    setAdviceLoading(true);
    setShowMaterialAdvice(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `Actúa como un experto en logística de mantenimiento. 
      Analiza esta incidencia: "${request.title} - ${request.description}".
      
      Devuelve un JSON con:
      - materials: Un array de strings con los materiales y herramientas específicos necesarios.
      - advice: Un breve consejo sobre el transporte o manejo de estos materiales.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: { parts: [{ text: prompt }] }
      });
      
      const text = response.text;
      const cleanText = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanText);
      setMaterialAdvice(parsed);
      setSelectedMaterials([]);
    } catch (error) {
      console.error("Error getting material advice:", error);
      setMaterialAdvice({ materials: [], advice: "No se pudo obtener el asesoramiento en este momento." });
    } finally {
      setAdviceLoading(false);
    }
  };

  const getExecutionAdvice = async (request: RequestItem) => {
    setAdviceLoading(true);
    setShowExecutionAdvice(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `Actúa como un maestro técnico de mantenimiento. 
      Analiza esta incidencia: "${request.title} - ${request.description}".
      
      Proporciona una guía paso a paso detallada sobre cómo ejecutar esta reparación de forma segura y eficiente. 
      Incluye consejos sobre riesgos laborales específicos (EPIs necesarios).`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: { parts: [{ text: prompt }] }
      });
      
      setExecutionAdvice(response.text);
    } catch (error) {
      console.error("Error getting execution advice:", error);
      setExecutionAdvice("No se pudo obtener el asesoramiento en este momento.");
    } finally {
      setAdviceLoading(false);
    }
  };

  const handleWarehouseRequest = (request: RequestItem) => {
    if (!selectedMaterials.length && !extraMaterials.trim()) {
      return alert("Seleccione o añada materiales para solicitar.");
    }
    
    const tech = technicians.find(t => t.id === whatsappTechId);
    if (!tech || !tech.phone) {
      return alert("Seleccione un técnico con número de teléfono configurado.");
    }

    setConfirmMaterialAction('warehouse');
    setShowMaterialConfirm(true);
  };

  const executeWarehouseRequest = (request: RequestItem) => {
    const tech = technicians.find(t => t.id === whatsappTechId);
    if (!tech) return;

    const allMaterials = [...selectedMaterials];
    if (extraMaterials.trim()) {
      allMaterials.push(...extraMaterials.split(',').map(m => m.trim()));
    }

    const dateStr = new Date().toLocaleDateString();
    const requestId = request.registrationNumber || request.id.slice(0, 5);
    
    const message = `*SOLICITUD DE MATERIAL - ALMACÉN*
--------------------------------
*Petición:* #${requestId}
*Fecha:* ${dateStr}
*Técnico:* ${tech.name}
*Edificio:* ${request.locationData?.buildingName || 'No especificado'}

*Materiales:*
${allMaterials.map(m => `• ${m}`).join('\n')}

_Solicitado vía SIGAI USAC_`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${tech.phone.replace(/\s+/g, '')}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
    setShowMaterialConfirm(false);
  };

  const handlePurchaseRequest = (request: RequestItem) => {
    if (!selectedMaterials.length && !extraMaterials.trim()) {
      return alert("Seleccione o añada materiales para la compra.");
    }
    setConfirmMaterialAction('purchase');
    setShowMaterialConfirm(true);
  };

  const executePurchaseRequest = async (request: RequestItem) => {
    try {
      const allMaterials = [...selectedMaterials];
      if (extraMaterials.trim()) {
        allMaterials.push(...extraMaterials.split(',').map(m => m.trim()));
      }

      const requestId = request.registrationNumber || request.id.slice(0, 5);
      const newId = `MAT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      
      const materialRequest: Partial<RequestItem> = {
        id: newId,
        userId: currentUser.id,
        unit: currentUser.role as Role,
        type: 'material',
        category: (purchaseCategory === 'electricidad' ? 'Eléctrico' : 
                   purchaseCategory === 'fontanería' ? 'Fontanería' : 
                   purchaseCategory === 'ferretería' ? 'Carpintería / Cerraduras' : 'Otros') as RequestCategory,
        title: `COMPRA: ${purchaseCategory.toUpperCase()} - Ref #${requestId}`,
        description: `Solicitud de COMPRA para la incidencia #${requestId}:
        
        Materiales a comprar:
        ${allMaterials.map(m => `- ${m}`).join('\n')}
        
        Categoría: ${purchaseCategory.toUpperCase()}
        Fecha: ${new Date().toLocaleString()}
        Justificación: Pendiente de compra para completar intervención.`,
        status: 'pendiente',
        date: new Date().toISOString(),
        priority: 'normal',
        items: allMaterials.map(m => ({
          id: Math.random().toString(36).substr(2, 9),
          name: m,
          category: purchaseCategory,
          quantity: 1,
          unit: 'ud'
        }))
      };

      await storageService.saveRequest(materialRequest as RequestItem);
      alert("Solicitud de compra guardada correctamente.");
      setShowMaterialAdvice(false);
      setShowMaterialConfirm(false);
      setExtraMaterials('');
      setSelectedMaterials([]);
    } catch (error) {
      console.error("Error saving purchase request:", error);
      alert("Error al guardar la solicitud de compra.");
    }
  };

  const submitWorkReport = () => {
    if (!selectedRequest || !workPerformed) return alert("Indique el trabajo realizado.");

    const workDetails = {
      workPerformed,
      materialsUsed,
      timeSpentMinutes: parseInt(timeSpent),
      afterImageUrl: afterImage || undefined
    };

    storageService.updateRequestStatus(selectedRequest.id, 'closed', undefined, workDetails);
    loadRequests();
    setSelectedRequest(null);
    setShowWorkReportForm(false);
    setWorkPerformed('');
    setMaterialsUsed('');
    setAfterImage(null);
  };

  const handleAssign = () => {
    if (!selectedRequest || selectedTechIds.length === 0) return;
    storageService.assignTechnicians(selectedRequest.id, selectedTechIds);
    loadRequests();
    setSelectedRequest(null);
    setShowReassignModal(false);
    setSelectedTechIds([]);
  };

  const toggleTechSelection = (id: string) => {
    setSelectedTechIds(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleAction = (id: string, newStatus: RequestItem['status'], technicianId?: string) => {
    if (newStatus === 'closed') {
      setShowWorkReportForm(true);
      return;
    }
    storageService.updateRequestStatus(id, newStatus, technicianId);
    loadRequests();
    setSelectedRequest(null);
    setShowReassignModal(false);
  };

  const getUrgencyColor = (urgency?: UrgencyLevel) => {
    switch (urgency) {
      case 'Crítica': return 'bg-red-500 text-white';
      case 'Alta': return 'bg-orange-500 text-white';
      case 'Media': return 'bg-yellow-400 text-black';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  const getStructuralSolution = async (request: RequestItem) => {
    setAiStructuralLoading(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analiza esta avería recurrente de tipo ${request.category} en la unidad ${request.unit}: "${request.description}".
        Propón una solución estructural definitiva (reforma, cambio de equipo, plan preventivo) para que no vuelva a ocurrir. Sé breve y técnico.`
      });
      const solution = response.text;
      storageService.updateRequestStatus(request.id, request.status, solution);
      loadRequests();
      setSelectedRequest(prev => prev ? { ...prev, structuralSolution: solution } : null);
    } catch (e) {
      console.error(e);
    } finally {
      setAiStructuralLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter text-gray-900 leading-none">Dashboard USAC</h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Análisis de Operaciones e IA</p>
        </div>
        <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center shadow-lg">
          <BarChart3 className="w-5 h-5 text-yellow-400" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-2">
        {(['all', 'peticion', 'material'] as const).map(f => (
          <button 
            key={f}
            onClick={() => setFilterType(f)}
            className={`px-2 py-3 rounded-xl font-black uppercase text-[8px] tracking-widest transition-all ${filterType === f ? 'bg-gray-900 text-white shadow-xl' : 'bg-white text-gray-400 border border-gray-100'}`}
          >
            {f === 'all' ? 'Ver Todo' : f === 'peticion' ? 'Incidencias' : 'Materiales'}
          </button>
        ))}
      </div>

      {/* SECCIÓN DE RECURSOS Y ANÁLISIS (Bento Grid) */}
      <div className="px-2">
        <div className="bg-gray-50 rounded-[2.5rem] p-4 border border-gray-100">
          <div className="flex items-center gap-2 mb-3 px-2">
            <Layers className="w-3 h-3 text-gray-400" />
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400">Recursos y Análisis</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => setFilterType('stats')}
              className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${filterType === 'stats' ? 'bg-gray-900 text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-100 hover:border-gray-900'}`}
            >
              <div className={`p-2 rounded-xl ${filterType === 'stats' ? 'bg-yellow-400/20' : 'bg-yellow-400/10'}`}>
                <BarChart3 className={`w-4 h-4 ${filterType === 'stats' ? 'text-yellow-400' : 'text-yellow-600'}`} />
              </div>
              <div className="text-left">
                <div className="text-[9px] font-black uppercase leading-none">Analytics</div>
                <div className="text-[7px] font-bold opacity-60 uppercase mt-0.5">IA & SLA</div>
              </div>
            </button>

            <button 
              onClick={() => setFilterType('providers')}
              className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${filterType === 'providers' ? 'bg-gray-900 text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-100 hover:border-gray-900'}`}
            >
              <div className={`p-2 rounded-xl ${filterType === 'providers' ? 'bg-blue-400/20' : 'bg-blue-400/10'}`}>
                <Truck className={`w-4 h-4 ${filterType === 'providers' ? 'text-blue-400' : 'text-blue-600'}`} />
              </div>
              <div className="text-left">
                <div className="text-[9px] font-black uppercase leading-none">Proveedores</div>
                <div className="text-[7px] font-bold opacity-60 uppercase mt-0.5">Contactos</div>
              </div>
            </button>

            <button 
              onClick={() => setFilterType('blueprints')}
              className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${filterType === 'blueprints' ? 'bg-gray-900 text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-100 hover:border-gray-900'}`}
            >
              <div className={`p-2 rounded-xl ${filterType === 'blueprints' ? 'bg-purple-400/20' : 'bg-purple-400/10'}`}>
                <Layers className={`w-4 h-4 ${filterType === 'blueprints' ? 'text-purple-400' : 'text-purple-600'}`} />
              </div>
              <div className="text-left">
                <div className="text-[9px] font-black uppercase leading-none">Planos</div>
                <div className="text-[7px] font-bold opacity-60 uppercase mt-0.5">Técnicos</div>
              </div>
            </button>

            <button 
              onClick={() => setFilterType('ppts')}
              className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${filterType === 'ppts' ? 'bg-gray-900 text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-100 hover:border-gray-900'}`}
            >
              <div className={`p-2 rounded-xl ${filterType === 'ppts' ? 'bg-red-400/20' : 'bg-red-400/10'}`}>
                <FileText className={`w-4 h-4 ${filterType === 'ppts' ? 'text-red-400' : 'text-red-600'}`} />
              </div>
              <div className="text-left">
                <div className="text-[9px] font-black uppercase leading-none">Sectoriales</div>
                <div className="text-[7px] font-bold opacity-60 uppercase mt-0.5">Pliegos</div>
              </div>
            </button>

            <button 
              onClick={() => setFilterType('oca')}
              className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${filterType === 'oca' ? 'bg-gray-900 text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-100 hover:border-gray-900'}`}
            >
              <div className={`p-2 rounded-xl ${filterType === 'oca' ? 'bg-green-400/20' : 'bg-green-400/10'}`}>
                <ShieldCheck className={`w-4 h-4 ${filterType === 'oca' ? 'text-green-400' : 'text-green-600'}`} />
              </div>
              <div className="text-left">
                <div className="text-[9px] font-black uppercase leading-none">OCA / Rev.</div>
                <div className="text-[7px] font-bold opacity-60 uppercase mt-0.5">Periódicas</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {filterType === 'providers' ? (
        <ProvidersModule />
      ) : filterType === 'blueprints' ? (
        <BlueprintsModule user={currentUser} />
      ) : filterType === 'ppts' ? (
        <PPTModule user={currentUser} />
      ) : filterType === 'oca' ? (
        <OCAModule />
      ) : filterType === 'stats' ? (
        <div className="space-y-6 px-2 animate-in slide-in-from-bottom-5">
           {/* Selector de periodo */}
           <div className="flex bg-gray-100 p-1 rounded-2xl">
              <button 
                onClick={() => setTimeRange('month')}
                className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${timeRange === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
              >
                Mensual
              </button>
              <button 
                onClick={() => setTimeRange('year')}
                className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${timeRange === 'year' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
              >
                Anual
              </button>
           </div>

           {/* KPIs Principales: Evitadas vs Creadas */}
           <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-900 rounded-[2rem] p-6 text-white shadow-2xl relative overflow-hidden group">
                 <div className="relative z-10">
                    <div className="p-2 bg-yellow-400/10 rounded-lg inline-block mb-3">
                       <BrainCircuit className="w-5 h-5 text-yellow-400" />
                    </div>
                    <p className="text-3xl font-black">{analytics.aiSavings}</p>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">Evitadas por IA</p>
                 </div>
                 <Sparkles className="absolute -bottom-2 -right-2 w-16 h-16 text-yellow-400/5 group-hover:scale-110 transition-transform" />
              </div>

              <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm relative overflow-hidden group">
                 <div className="relative z-10">
                    <div className="p-2 bg-blue-50 rounded-lg inline-block mb-3">
                       <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-3xl font-black text-gray-900">{analytics.totalOficial}</p>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">Partes Creados</p>
                 </div>
              </div>
           </div>

           {/* Métricas de Rendimiento */}
           <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-green-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Eficiencia Operativa</span>
                </div>
                <div className="bg-green-50 px-3 py-1 rounded-full">
                  <span className="text-[9px] font-black text-green-700">TMR: {analytics.avgResolutionTime}h</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-1">
                    <span className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Cumplimiento SLA</span>
                    <p className="text-2xl font-black text-gray-900">{analytics.slaPercentage}%</p>
                 </div>
                 <div className="space-y-1">
                    <span className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Ahorro Humano</span>
                    <p className="text-2xl font-black text-green-600">{analytics.aiSavingRate.toFixed(1)}%</p>
                 </div>
              </div>

              <div className="h-40 w-full mt-4">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.monthlyTrend}>
                       <defs>
                          <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.2}/>
                             <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/>
                          </linearGradient>
                       </defs>
                       <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 8, fill: '#9ca3af'}} />
                       <Area type="monotone" dataKey="oficial" stroke="#111827" strokeWidth={3} fillOpacity={1} fill="url(#colorTrend)" />
                       <Area type="monotone" dataKey="ia" stroke="#fbbf24" strokeWidth={3} strokeDasharray="5 5" fill="none" />
                    </AreaChart>
                 </ResponsiveContainer>
              </div>
           </div>

           {/* Materiales y Unidades */}
           <div className="grid grid-cols-1 gap-6">
              {/* Material Más Usado */}
              <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                   <Box className="w-5 h-5 text-amber-500" />
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Top Materiales Consumidos</h3>
                </div>
                <div className="space-y-4">
                   {analytics.topMaterials.length > 0 ? analytics.topMaterials.map(([mat, count]) => (
                     <div key={mat} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                           <span className="text-xs font-black uppercase text-gray-700 capitalize">{mat}</span>
                        </div>
                        <span className="px-3 py-1 bg-gray-50 text-gray-900 text-[10px] font-black rounded-lg">{count} uds</span>
                     </div>
                   )) : <p className="text-[9px] text-gray-300 italic uppercase">Sin registros de cierre aún</p>}
                </div>
              </div>

              {/* Unidades que más solicitan */}
              <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                   <Users className="w-5 h-5 text-blue-500" />
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Demanda por Unidad</h3>
                </div>
                <div className="space-y-4">
                   {analytics.conflictiveUnits.map(([unit, count]) => (
                     <div key={unit} className="space-y-2">
                        <div className="flex justify-between items-center">
                           <span className="text-[10px] font-black uppercase text-gray-600">{unit}</span>
                           <span className="text-[10px] font-black text-gray-900">{count} partes</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden">
                           <div 
                            className="h-full bg-blue-500" 
                            style={{ width: `${(count / analytics.totalOficial) * 100}%` }}
                           ></div>
                        </div>
                     </div>
                   ))}
                </div>
              </div>

              {/* Averías Comunes */}
              <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                   <Wrench className="w-5 h-5 text-gray-900" />
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tipología de Incidencias</h3>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.topCategories.map(([cat, val]) => ({ name: cat.substring(0,8), full: cat, val }))}>
                      <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '10px' }} />
                      <Bar dataKey="val" fill="#111827" radius={[8, 8, 0, 0]}>
                        {analytics.topCategories.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#111827' : '#e5e7eb'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
           </div>
        </div>
      ) : (
        <div className="space-y-4 px-2">
          {prioritizedRequests.length === 0 ? (
            <div className="py-20 text-center bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-100">
              <ClipboardList className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Sin trabajos pendientes</p>
            </div>
          ) : (
            prioritizedRequests.map(r => {
              const sla = getSLAInfo(r);
              return (
                <div 
                  key={r.id} 
                  onClick={() => setSelectedRequest(r)}
                  className={`bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100 hover:border-gray-900 transition-all active:scale-95 group relative overflow-hidden ${r.urgency === 'Crítica' ? 'ring-2 ring-red-500 ring-offset-2' : ''}`}
                >
                  {r.isChronic && (
                    <div className="absolute top-0 right-0 bg-red-600 text-white px-3 py-1 rounded-bl-xl text-[7px] font-black uppercase tracking-widest">
                      Crónico
                    </div>
                  )}
                  
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${r.type === 'peticion' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                        {r.type === 'peticion' ? <Wrench className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="font-black uppercase text-[10px] text-gray-900 leading-none mb-1">{r.unit}</div>
                        <div className="text-[8px] font-bold text-gray-400 uppercase">{new Date(r.date).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${getUrgencyColor(r.urgency)}`}>
                      {r.urgency}
                    </div>
                  </div>

                  <h3 className="font-black uppercase text-xs text-gray-900 mb-4 truncate pr-6">{r.title}</h3>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${r.status === 'closed' ? 'bg-green-500' : r.status === 'in_progress' ? 'bg-blue-500 animate-pulse' : r.status === 'asignada' ? 'bg-amber-500 animate-pulse' : 'bg-gray-300'}`}></div>
                      <span className="text-[9px] font-black uppercase text-gray-500">
                        {r.status === 'open' ? 'Abierta' : r.status === 'in_progress' ? 'En Curso' : r.status === 'asignada' ? 'Asignada' : 'Resuelta'}
                      </span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${sla.color}`}>
                      <Timer className="w-3 h-3" />
                      <span className="text-[9px] font-black uppercase">{sla.text}</span>
                    </div>
                  </div>

                  <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-200 group-hover:text-gray-900 transition-all" />
                </div>
              );
            })
          )}
        </div>
      )}

      {selectedRequest && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-xl p-6 flex flex-col items-center justify-center animate-in zoom-in-95 duration-300">
          <div className="w-full max-w-sm bg-white rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <header className="p-8 bg-gray-900 text-white flex justify-between items-center shrink-0">
               <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${selectedRequest.type === 'peticion' ? 'bg-blue-500' : 'bg-amber-500'}`}>
                    {selectedRequest.type === 'peticion' ? <Wrench className="w-6 h-6 text-white" /> : <Package className="w-6 h-6 text-white" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight leading-none">{selectedRequest.unit}</h3>
                    <p className="text-[9px] text-gray-400 font-black uppercase mt-1">{selectedRequest.category}</p>
                  </div>
               </div>
               <button onClick={() => { setSelectedRequest(null); setShowWorkReportForm(false); }} className="p-2 text-white/30 hover:text-white"><XCircle className="w-6 h-6" /></button>
            </header>

            <main className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Technician AI Support Buttons */}
              {selectedRequest.status !== 'closed' && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <button 
                    onClick={() => getMaterialAdvice(selectedRequest)}
                    className="p-5 bg-amber-50 border border-amber-100 text-amber-900 rounded-[2rem] font-black uppercase text-[9px] tracking-widest flex flex-col items-center justify-center gap-2 hover:bg-amber-100 transition-all shadow-sm"
                  >
                    <Package className="w-6 h-6 text-amber-600" />
                    <span>¿Qué material utilizo?</span>
                  </button>
                  <button 
                    onClick={() => getExecutionAdvice(selectedRequest)}
                    className="p-5 bg-blue-50 border border-blue-100 text-blue-900 rounded-[2rem] font-black uppercase text-[9px] tracking-widest flex flex-col items-center justify-center gap-2 hover:bg-blue-100 transition-all shadow-sm"
                  >
                    <BrainCircuit className="w-6 h-6 text-blue-600" />
                    <span>¿Cómo ejecutar?</span>
                  </button>
                </div>
              )}

              {!showWorkReportForm ? (
                <>
                  <div className="bg-gray-50 p-6 rounded-[2rem] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-gray-400" />
                      <div>
                        <span className="text-[8px] font-black uppercase text-gray-400 block tracking-widest">Creado el</span>
                        <span className="text-[10px] font-bold text-gray-900">{new Date(selectedRequest.date).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="text-right">
                       <span className="text-[8px] font-black uppercase text-gray-400 block tracking-widest">Estado SLA</span>
                       <span className={`text-[10px] font-black uppercase ${getSLAInfo(selectedRequest).color}`}>
                          {getSLAInfo(selectedRequest).text}
                       </span>
                    </div>
                  </div>

                  {selectedRequest.isChronic && (
                    <div className="p-5 bg-red-600 rounded-[2rem] text-white space-y-3">
                       <div className="flex items-center gap-3">
                          <AlertTriangle className="w-6 h-6" />
                          <h4 className="text-[11px] font-black uppercase tracking-widest">Problema Crónico</h4>
                       </div>
                       {selectedRequest.structuralSolution ? (
                         <div className="bg-black/20 p-4 rounded-2xl border border-white/10">
                            <span className="text-[8px] font-black uppercase text-yellow-400">Solución Estructural:</span>
                            <p className="text-[10px] font-bold mt-1">{selectedRequest.structuralSolution}</p>
                         </div>
                       ) : (
                         <button 
                          onClick={() => getStructuralSolution(selectedRequest)}
                          disabled={aiStructuralLoading}
                          className="w-full mt-2 p-4 bg-white text-red-600 rounded-xl font-black uppercase text-[8px] tracking-widest flex items-center justify-center gap-2"
                         >
                            {aiStructuralLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                            Analizar Solución Permanente
                         </button>
                       )}
                    </div>
                  )}

                  {selectedRequest.imageUrl && (
                    <div className="space-y-2">
                       <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Foto Antes:</span>
                       <div className="rounded-[2rem] overflow-hidden border border-gray-100 shadow-lg aspect-video bg-gray-50">
                          <img src={selectedRequest.imageUrl} className="w-full h-full object-cover" />
                       </div>
                    </div>
                  )}

                  {selectedRequest.workDetails?.afterImageUrl && (
                    <div className="space-y-2">
                       <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Foto Después:</span>
                       <div className="rounded-[2rem] overflow-hidden border border-gray-100 shadow-lg aspect-video bg-gray-50">
                          <img src={selectedRequest.workDetails.afterImageUrl} className="w-full h-full object-cover" />
                       </div>
                    </div>
                  )}

                  <div className="space-y-3">
                     <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Descripción:</span>
                     <p className="text-sm font-medium text-gray-700 leading-relaxed">{selectedRequest.description}</p>
                  </div>

                  {selectedRequest.assignedTechnicians && selectedRequest.assignedTechnicians.length > 0 && (
                    <div className="p-5 bg-gray-50 rounded-[2rem] border border-gray-100">
                      <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Users className="w-3 h-3" /> Personal Asignado
                      </h4>
                      <div className="space-y-2">
                        {selectedRequest.assignedTechnicians.map(techId => {
                          const tech = technicians.find(t => t.id === techId);
                          const status = selectedRequest.acceptanceStatus?.[techId] || 'pending';
                          return (
                            <div key={techId} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-gray-400">
                                  <User className="w-3 h-3" />
                                </div>
                                <span className="text-[10px] font-black text-gray-700 uppercase">{tech?.name || 'Técnico'}</span>
                              </div>
                              <div className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase ${
                                status === 'accepted' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                              }`}>
                                {status === 'accepted' ? 'Aceptado' : 'Pendiente'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedRequest.status === 'closed' && selectedRequest.workDetails && (
                    <div className="p-6 bg-blue-50 border border-blue-100 rounded-[2rem] space-y-4">
                      <div className="flex items-center gap-3 text-blue-800">
                        <FileText className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Parte de Trabajo</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1">
                            <span className="text-[8px] font-black text-blue-400 uppercase">Tiempo</span>
                            <p className="text-xs font-bold text-blue-900">{selectedRequest.workDetails.timeSpentMinutes} min</p>
                         </div>
                         <div className="space-y-1">
                            <span className="text-[8px] font-black text-blue-400 uppercase">Materiales</span>
                            <p className="text-xs font-bold text-blue-900">{selectedRequest.workDetails.materialsUsed || 'N/A'}</p>
                         </div>
                      </div>
                      <div className="space-y-1">
                         <span className="text-[8px] font-black text-blue-400 uppercase">Trabajo Realizado</span>
                         <p className="text-xs font-medium text-blue-900 italic leading-relaxed">"{selectedRequest.workDetails.workPerformed}"</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-6 animate-in slide-in-from-right-10">
                   <div className="text-center mb-6">
                      <h4 className="text-2xl font-black uppercase tracking-tighter text-gray-900">Parte de Trabajo</h4>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">Nº Petición: {selectedRequest.id.split('-')[0]}</p>
                   </div>

                   <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Trabajo Realizado</label>
                        <textarea 
                          value={workPerformed}
                          onChange={(e) => setWorkPerformed(e.target.value)}
                          placeholder="Describa la acción técnica efectuada..."
                          className="w-full bg-gray-50 border border-gray-100 p-5 rounded-2xl text-xs font-medium outline-none h-24"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Material Utilizado</label>
                        <input 
                          type="text"
                          value={materialsUsed}
                          onChange={(e) => setMaterialsUsed(e.target.value)}
                          placeholder="Ej: Bombilla 20W, Cable 2m..."
                          className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-xs font-medium outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                           <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tiempo (min)</label>
                           <input 
                              type="number"
                              value={timeSpent}
                              onChange={(e) => setTimeSpent(e.target.value)}
                              className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-xs font-black outline-none"
                           />
                         </div>
                         <div className="space-y-2">
                           <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Foto Después</label>
                           <button 
                             onClick={() => afterImageInputRef.current?.click()}
                             className={`w-full p-4 rounded-2xl flex items-center justify-center gap-2 border-2 border-dashed transition-all ${afterImage ? 'bg-green-50 border-green-200 text-green-600' : 'bg-gray-50 border-gray-100 text-gray-400'}`}
                           >
                              {afterImage ? <CheckCircle className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                              <span className="text-[9px] font-black uppercase">{afterImage ? 'Cargada' : 'Capturar'}</span>
                           </button>
                           <input type="file" ref={afterImageInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleAfterImageChange} />
                         </div>
                      </div>

                      {afterImage && (
                        <div className="relative rounded-2xl overflow-hidden border-2 border-green-100 shadow-md">
                           <img src={afterImage} className="w-full h-32 object-cover" />
                           <button onClick={() => setAfterImage(null)} className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full"><XCircle className="w-4 h-4" /></button>
                        </div>
                      )}
                   </div>

                   <div className="pt-6 space-y-3">
                      <button 
                        onClick={submitWorkReport}
                        className="w-full p-6 bg-green-600 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
                      >
                        <CheckCircle2 className="w-5 h-5" /> Firmar y Cerrar SLA
                      </button>
                      <button onClick={() => setShowWorkReportForm(false)} className="w-full p-2 text-gray-400 font-black uppercase text-[9px]">Cancelar Cierre</button>
                   </div>
                </div>
              )}
            </main>

            <footer className="p-8 bg-gray-50 border-t border-gray-100 shrink-0 grid grid-cols-2 gap-4">
              {!showWorkReportForm && selectedRequest.status !== 'closed' ? (
                <>
                  {selectedRequest.status === 'open' && (
                    <button 
                      onClick={() => handleAction(selectedRequest.id, 'in_progress')}
                      className="col-span-2 p-6 bg-gray-900 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
                    >
                      <CheckCircle2 className="w-5 h-5 text-green-400" /> Iniciar Intervención
                    </button>
                  )}
                  {selectedRequest.status === 'in_progress' && (
                    <button 
                      onClick={() => handleAction(selectedRequest.id, 'closed')}
                      className="col-span-2 p-6 bg-green-600 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
                    >
                      <CheckCircle2 className="w-5 h-5" /> Finalizar y Cerrar SLA
                    </button>
                  )}
                  <button 
                    onClick={() => handleAction(selectedRequest.id, 'returned')}
                    className="p-5 bg-white border border-gray-200 text-gray-500 rounded-[2rem] font-black uppercase text-[8px] tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <ArrowRightLeft className="w-4 h-4" /> Devolver
                  </button>
                  {(isMaster || currentUser.userCategory === 'Oficina de Control') && (
                    <button 
                      onClick={() => setShowReassignModal(true)}
                      className="p-5 bg-white border border-gray-200 text-gray-500 rounded-[2rem] font-black uppercase text-[8px] tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      <MoreVertical className="w-4 h-4" /> Reasignar
                    </button>
                  )}
                </>
              ) : selectedRequest.status === 'closed' && (
                <div className="col-span-2 p-4 bg-green-100 text-green-700 rounded-2xl text-center font-black uppercase text-[10px]">
                  Tarea completada y parte registrado
                </div>
              )}
            </footer>
          </div>
        </div>
      )}

      {/* Modal de Reasignación */}
      {showReassignModal && selectedRequest && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-full max-w-sm bg-white rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <header className="p-8 bg-gray-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500 rounded-2xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Asignar Técnico</h3>
                  <p className="text-[9px] text-gray-400 font-black uppercase mt-1">Selecciona quién realizará el trabajo</p>
                </div>
              </div>
              <button onClick={() => setShowReassignModal(false)} className="text-white/30 hover:text-white transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </header>

            <div className="p-6 overflow-y-auto space-y-3">
              {technicians.filter(t => {
                const todayStr = getLocalDateString(now);
                const isOnLeave = t.leaveDays?.includes(todayStr);
                return !isOnLeave;
              }).length > 0 ? (
                technicians
                  .filter(t => {
                    const todayStr = getLocalDateString(now);
                    const isOnLeave = t.leaveDays?.includes(todayStr);
                    return !isOnLeave;
                  })
                  .map(tech => (
                  <button
                    key={tech.id}
                    onClick={() => toggleTechSelection(tech.id)}
                    className={`w-full p-5 border rounded-2xl flex items-center justify-between group transition-all active:scale-95 ${
                      selectedTechIds.includes(tech.id) 
                        ? 'bg-blue-50 border-blue-500 shadow-md' 
                        : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        selectedTechIds.includes(tech.id) ? 'bg-blue-500 text-white' : 'bg-white text-gray-400 group-hover:bg-gray-900 group-hover:text-white'
                      }`}>
                        <User className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className={`text-[11px] font-black uppercase ${selectedTechIds.includes(tech.id) ? 'text-blue-900' : 'text-gray-900'}`}>{tech.name}</p>
                        <p className="text-[8px] font-bold text-gray-400 uppercase">{tech.role}</p>
                      </div>
                    </div>
                    {selectedTechIds.includes(tech.id) ? (
                      <CheckCircle2 className="w-5 h-5 text-blue-500" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-200" />
                    )}
                  </button>
                ))
              ) : (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-100 mx-auto mb-4" />
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">No hay técnicos disponibles</p>
                </div>
              )}
            </div>

            <footer className="p-6 bg-gray-50 border-t border-gray-100 space-y-3">
              <button 
                onClick={handleAssign}
                disabled={selectedTechIds.length === 0}
                className="w-full p-5 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
              >
                <CheckCircle2 className="w-5 h-5" /> Asignar Trabajo ({selectedTechIds.length})
              </button>
              <button 
                onClick={() => { setShowReassignModal(false); setSelectedTechIds([]); }}
                className="w-full py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-900 transition-colors"
              >
                Cancelar
              </button>
            </footer>
          </div>
        </div>
      )}
      {/* Modal Asesoramiento Materiales */}
      <AnimatePresence>
        {showMaterialAdvice && selectedRequest && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-lg bg-white rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <header className="p-8 bg-amber-500 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <Package className="w-8 h-8" />
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Asesor de Materiales</h3>
                    <p className="text-[9px] text-amber-100 font-black uppercase mt-1">Sugerencias de IA para esta intervención</p>
                  </div>
                </div>
                <button onClick={() => setShowMaterialAdvice(false)} className="text-white/50 hover:text-white transition-colors">
                  <XCircle className="w-6 h-6" />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {adviceLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Analizando requerimientos...</p>
                  </div>
                ) : materialAdvice ? (
                  <>
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                        <Box className="w-4 h-4" /> Materiales Recomendados (Selecciona)
                      </h4>
                      <div className="grid grid-cols-1 gap-2">
                        {materialAdvice.materials.map((m, i) => (
                          <button 
                            key={i} 
                            onClick={() => {
                              setSelectedMaterials(prev => 
                                prev.includes(m) ? prev.filter(item => item !== m) : [...prev, m]
                              );
                            }}
                            className={`p-4 rounded-2xl border transition-all flex items-center justify-between text-left ${
                              selectedMaterials.includes(m)
                                ? 'bg-amber-50 border-amber-200 text-amber-900'
                                : 'bg-gray-50 border-gray-100 text-gray-500'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${selectedMaterials.includes(m) ? 'bg-amber-500' : 'bg-gray-300'}`} />
                              <span className="text-xs font-bold">{m}</span>
                            </div>
                            {selectedMaterials.includes(m) && <CheckCircle2 className="w-4 h-4 text-amber-500" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-6 bg-amber-50 rounded-[2rem] border border-amber-100">
                      <h4 className="text-[10px] font-black uppercase text-amber-700 tracking-widest mb-3 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" /> Consejo Logístico
                      </h4>
                      <p className="text-xs text-amber-900 leading-relaxed font-medium italic">
                        "{materialAdvice.advice}"
                      </p>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                        <PlusCircle className="w-4 h-4" /> ¿Falta algo más?
                      </h4>
                      <textarea 
                        value={extraMaterials}
                        onChange={(e) => setExtraMaterials(e.target.value)}
                        placeholder="Ej: 2 metros de cable, 1 interruptor extra..."
                        className="w-full bg-gray-50 border border-gray-100 p-6 rounded-[2rem] text-xs font-medium outline-none focus:ring-2 focus:ring-amber-500/20 min-h-[100px]"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-4">Técnico (WhatsApp)</label>
                        <select 
                          value={whatsappTechId}
                          onChange={(e) => setWhatsappTechId(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-xs font-bold outline-none"
                        >
                          <option value="">Seleccionar técnico...</option>
                          {technicians
                            .filter(t => t.phone)
                            .filter(t => {
                              const todayStr = getLocalDateString(now);
                              const isOnLeave = t.leaveDays?.includes(todayStr);
                              return !isOnLeave;
                            })
                            .map(tech => (
                              <option key={tech.id} value={tech.id}>{tech.name}</option>
                            ))}
                        </select>
                        {technicians.length > 0 && technicians.filter(t => t.phone).length === 0 && (
                          <p className="text-[8px] text-amber-600 font-bold uppercase mt-1 px-2">
                            ⚠️ Ningún técnico tiene teléfono configurado
                          </p>
                        )}
                        {technicians.length > 0 && technicians.filter(t => t.phone).length > 0 && 
                         technicians.filter(t => t.phone).filter(t => !t.leaveDays?.includes(getLocalDateString(now))).length === 0 && (
                          <p className="text-[8px] text-red-600 font-bold uppercase mt-1 px-2">
                            🚫 Todos los técnicos están de permiso hoy
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-4">Categoría Compra</label>
                        <select 
                          value={purchaseCategory}
                          onChange={(e) => setPurchaseCategory(e.target.value as any)}
                          className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-xs font-bold outline-none"
                        >
                          <option value="fontanería">Fontanería</option>
                          <option value="electricidad">Electricidad</option>
                          <option value="ferretería">Ferretería</option>
                          <option value="construcción">Construcción</option>
                        </select>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              <footer className="p-8 bg-gray-50 border-t border-gray-100 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleWarehouseRequest(selectedRequest)}
                    disabled={adviceLoading || !materialAdvice}
                    className="p-6 bg-green-600 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl flex flex-col items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>Pedir a Almacén</span>
                  </button>
                  <button
                    onClick={() => handlePurchaseRequest(selectedRequest)}
                    disabled={adviceLoading || !materialAdvice}
                    className="p-6 bg-amber-600 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl flex flex-col items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <Truck className="w-5 h-5" />
                    <span>Pedir a Comprar</span>
                  </button>
                </div>
                <button onClick={() => setShowMaterialAdvice(false)} className="w-full p-2 text-gray-400 font-black uppercase text-[9px]">Cerrar</button>
              </footer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Asesoramiento Ejecución */}
      <AnimatePresence>
        {showExecutionAdvice && selectedRequest && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-lg bg-white rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <header className="p-8 bg-blue-600 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <BrainCircuit className="w-8 h-8" />
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Guía de Ejecución</h3>
                    <p className="text-[9px] text-blue-100 font-black uppercase mt-1">Soporte técnico paso a paso</p>
                  </div>
                </div>
                <button onClick={() => setShowExecutionAdvice(false)} className="text-white/50 hover:text-white transition-colors">
                  <XCircle className="w-6 h-6" />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-8">
                {adviceLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Generando guía técnica...</p>
                  </div>
                ) : executionAdvice ? (
                  <div className="prose prose-sm max-w-none text-gray-600 font-medium">
                    <Markdown>{executionAdvice}</Markdown>
                  </div>
                ) : null}
              </div>

              <footer className="p-8 bg-gray-50 border-t border-gray-100">
                <button
                  onClick={() => setShowExecutionAdvice(false)}
                  className="w-full p-6 bg-gray-900 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all"
                >
                  Entendido, manos a la obra
                </button>
              </footer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmación de Materiales */}
      <AnimatePresence>
        {showMaterialConfirm && selectedRequest && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-white rounded-[3rem] overflow-hidden shadow-2xl flex flex-col"
            >
              <header className="p-8 bg-gray-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-8 h-8 text-green-400" />
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight">¿Es correcto?</h3>
                    <p className="text-[9px] text-gray-400 font-black uppercase mt-1">Verifica los materiales seleccionados</p>
                  </div>
                </div>
              </header>

              <div className="p-8 space-y-6">
                <div className="space-y-3">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Materiales a solicitar:</span>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                    {selectedMaterials.map((m, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                        <span className="text-xs font-bold text-gray-700">{m}</span>
                      </div>
                    ))}
                    {extraMaterials.trim() && extraMaterials.split(',').map((m, i) => (
                      <div key={`extra-${i}`} className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                        <span className="text-xs font-bold text-blue-700">{m.trim()} (Extra)</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-bold text-amber-800 leading-relaxed">
                    {confirmMaterialAction === 'warehouse' 
                      ? "Se enviará un mensaje de WhatsApp al técnico seleccionado con esta lista."
                      : "Se registrará una solicitud de compra en la Oficina de Control."}
                  </p>
                </div>
              </div>

              <footer className="p-8 bg-gray-50 border-t border-gray-100 grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setShowMaterialConfirm(false)}
                  className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-900 transition-colors"
                >
                  Corregir
                </button>
                <button 
                  onClick={() => {
                    if (confirmMaterialAction === 'warehouse') executeWarehouseRequest(selectedRequest);
                    else executePurchaseRequest(selectedRequest);
                  }}
                  className="p-4 bg-gray-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all"
                >
                  Confirmar
                </button>
              </footer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default USACManagerPanel;
