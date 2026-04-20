
import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Loader2, X, AlertCircle, CheckCircle2, 
  Phone, Calendar as CalendarIcon, User as UserIcon,
  Zap, Droplets, Flame, Users, Bell, Info, ArrowRight
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { AppTab, CalendarTask, User, Provider, ServiceType, Reading } from '../types';
import { storageService, BUILDINGS } from '../services/storageService';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceAssistantProps {
  user: User | null;
  onNavigate: (tab: AppTab) => void;
  isOpen: boolean;
  onClose: () => void;
}

type VoiceActionType = 
  | 'NAVIGATE' 
  | 'CREATE_TASK' 
  | 'SEARCH_PROVIDER' 
  | 'GET_STATUS' 
  | 'ADD_READING' 
  | 'CHECK_TEAM' 
  | 'CHECK_ALERTS' 
  | 'UNKNOWN';

interface VoiceActionResult {
  type: VoiceActionType;
  tab?: AppTab;
  task?: {
    title: string;
    description: string;
    startDate: string;
    priority: 'Baja' | 'Media' | 'Alta' | 'Crítica';
  };
  providerQuery?: string;
  statusQuery?: {
    service: ServiceType;
    buildingId?: string;
  };
  reading?: {
    service: ServiceType;
    value: number;
    buildingId: string;
  };
  message?: string;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ user, onNavigate, isOpen, onClose }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [foundProvider, setFoundProvider] = useState<Provider | null>(null);
  const [statusResult, setStatusResult] = useState<any>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'es-ES';

      recognitionRef.current.onresult = (event: any) => {
        const current = event.resultIndex;
        const transcriptText = event.results[current][0].transcript;
        setTranscript(transcriptText);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (transcript) {
          processCommand(transcript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setError('Error al escuchar. Por favor, inténtalo de nuevo.');
        setIsListening(false);
      };
    } else {
      setError('Tu navegador no soporta reconocimiento de voz.');
    }
  }, []);

  const startListening = () => {
    if (!recognitionRef.current) return;
    setTranscript('');
    setError(null);
    setSuccessMessage(null);
    setFoundProvider(null);
    setStatusResult(null);
    setIsListening(true);
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) {
      setIsListening(false);
      return;
    }
    try {
      recognitionRef.current.stop();
    } catch (e) {
      console.error(e);
    }
    setIsListening(false);
  };

  const processCommand = async (text: string) => {
    if (!text.trim()) return;
    setIsProcessing(true);
    setError(null);
    setSuccessMessage(null);
    setFoundProvider(null);
    setStatusResult(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const buildingsList = BUILDINGS.map(b => `${b.id}: ${b.name}`).join(', ');
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `El usuario ha dicho: "${text}". Hoy es ${new Date().toLocaleDateString('es-ES')}.
        Tu tarea es analizar la intención del usuario y devolver un JSON estructurado.
        
        Pestañas: home, history, settings, ai_request, ai_material, usac_manager, calendar, team, gasoil, boilers, salt, temperatures, maintenance, water_sync, tools, oca, ppts, blueprints, rti.
        Edificios disponibles: ${buildingsList}
        Servicios: luz, agua, caldera, gasoil, sal.

        Estructura del JSON:
        {
          "type": "NAVIGATE" | "CREATE_TASK" | "SEARCH_PROVIDER" | "GET_STATUS" | "ADD_READING" | "CHECK_TEAM" | "CHECK_ALERTS" | "UNKNOWN",
          "tab": "nombre_pestaña",
          "task": { "title": "título", "description": "desc", "startDate": "YYYY-MM-DD", "priority": "Baja"|"Media"|"Alta"|"Crítica" },
          "providerQuery": "nombre",
          "statusQuery": { "service": "luz"|"agua"|"caldera"|"gasoil"|"sal", "buildingId": "ID_EDIFICIO" },
          "reading": { "service": "luz"|"agua", "value": 123.45, "buildingId": "ID_EDIFICIO" },
          "message": "mensaje para el usuario"
        }

        Responde ÚNICAMENTE con el objeto JSON.`,
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ["NAVIGATE", "CREATE_TASK", "SEARCH_PROVIDER", "GET_STATUS", "ADD_READING", "CHECK_TEAM", "CHECK_ALERTS", "UNKNOWN"] },
              tab: { type: Type.STRING },
              task: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  startDate: { type: Type.STRING },
                  priority: { type: Type.STRING, enum: ["Baja", "Media", "Alta", "Crítica"] }
                }
              },
              providerQuery: { type: Type.STRING },
              statusQuery: {
                type: Type.OBJECT,
                properties: {
                  service: { type: Type.STRING, enum: ["luz", "agua", "caldera", "gasoil", "sal"] },
                  buildingId: { type: Type.STRING }
                }
              },
              reading: {
                type: Type.OBJECT,
                properties: {
                  service: { type: Type.STRING, enum: ["luz", "agua"] },
                  value: { type: Type.NUMBER },
                  buildingId: { type: Type.STRING }
                }
              },
              message: { type: Type.STRING }
            },
            required: ["type"]
          }
        }
      });

      const result = JSON.parse(response.text) as VoiceActionResult;
      console.log('Voice Action Result:', result);

      switch (result.type) {
        case 'NAVIGATE':
          if (result.tab && Object.values(AppTab).includes(result.tab as AppTab)) {
            onNavigate(result.tab as AppTab);
            setSuccessMessage(result.message || `Navegando a ${result.tab}...`);
            setTimeout(onClose, 1500);
          } else {
            setError('No he encontrado esa sección.');
          }
          break;

        case 'CREATE_TASK':
          if (result.task && user) {
            // Similarity Check for Voice Tasks
            const allTasks = storageService.getTasks();
            const normalizedTitle = result.task.title.toLowerCase().trim();
            const similar = allTasks.find(t => {
              const tTitle = t.title.toLowerCase().trim();
              return (tTitle === normalizedTitle || tTitle.includes(normalizedTitle) || normalizedTitle.includes(tTitle)) 
                     && t.checklist && t.checklist.length > 0;
            });

            const newTask: CalendarTask = {
              id: crypto.randomUUID(),
              title: result.task.title,
              description: result.task.description,
              type: 'Tarea de Voz',
              startDate: result.task.startDate,
              priority: result.task.priority as any,
              status: 'Pendiente',
              assignedTo: [user.id],
              createdBy: user.id,
              createdAt: new Date().toISOString(),
              checklist: similar ? similar.checklist.map(item => ({ ...item, id: crypto.randomUUID(), completed: false })) : []
            };
            await storageService.saveTask(newTask);
            setSuccessMessage(`Tarea creada: "${result.task.title}" para el ${result.task.startDate}${similar ? ' (con procedimiento importado)' : ''}`);
            setTimeout(onClose, 2500);
          } else {
            setError('Faltan datos para crear la tarea.');
          }
          break;

        case 'SEARCH_PROVIDER':
          if (result.providerQuery) {
            const providers = storageService.getProviders();
            const query = result.providerQuery.toLowerCase();
            const found = providers.find(p => 
              p.name.toLowerCase().includes(query) || 
              p.commercialName?.toLowerCase().includes(query)
            );
            
            if (found) {
              setFoundProvider(found);
              setSuccessMessage(`He encontrado al proveedor: ${found.name}`);
            } else {
              setError(`No he encontrado ningún proveedor que coincida con "${result.providerQuery}".`);
            }
          }
          break;

        case 'GET_STATUS':
          if (result.statusQuery) {
            const { service, buildingId } = result.statusQuery;
            if (service === 'agua' || service === 'luz') {
              const readings = storageService.getReadings(buildingId, service);
              const last = readings[readings.length - 1];
              if (last) {
                setStatusResult({ type: 'reading', service, value: last.value1, date: last.date, building: BUILDINGS.find(b => b.id === last.buildingId)?.name });
                setSuccessMessage(`Última lectura de ${service}: ${last.value1}`);
              } else {
                setError(`No hay lecturas recientes de ${service}.`);
              }
            } else if (service === 'gasoil') {
              const tanks = storageService.getGasoilTanks();
              const total = tanks.reduce((acc, t) => acc + t.currentLitres, 0);
              setStatusResult({ type: 'gasoil', total, count: tanks.length });
              setSuccessMessage(`Estado Gasoil: ${total} litros totales en ${tanks.length} depósitos.`);
            } else if (service === 'sal') {
              const stock = storageService.getSaltStock();
              setStatusResult({ type: 'sal', stock: stock?.sacksAvailable || 0 });
              setSuccessMessage(`Stock de Sal: ${stock?.sacksAvailable || 0} sacos disponibles.`);
            }
          }
          break;

        case 'CHECK_TEAM':
          const techs = storageService.getUsers().filter(u => u.status === 'approved' && u.isManto);
          setStatusResult({ type: 'team', techs: techs.map(t => ({ name: t.name, role: t.role })) });
          setSuccessMessage(`Hay ${techs.length} técnicos registrados en el equipo.`);
          break;

        case 'CHECK_ALERTS':
          if (user) {
            const alerts = storageService.getNotifications(user.id).filter(n => !n.read);
            setStatusResult({ type: 'alerts', count: alerts.length, items: alerts.slice(0, 3) });
            setSuccessMessage(`Tienes ${alerts.length} alertas pendientes de revisar.`);
          }
          break;

        case 'ADD_READING':
          if (result.reading && user) {
            const newReading: Reading = {
              id: crypto.randomUUID(),
              buildingId: result.reading.buildingId,
              date: new Date().toISOString().split('T')[0],
              timestamp: new Date().toISOString(),
              userId: user.id,
              serviceType: result.reading.service,
              origin: 'ai',
              value1: result.reading.value
            };
            await storageService.saveReading(newReading);
            setSuccessMessage(`Lectura de ${result.reading.service} registrada: ${result.reading.value} para ${BUILDINGS.find(b => b.id === result.reading.buildingId)?.name}`);
            setTimeout(onClose, 3000);
          } else {
            setError('No he podido registrar la lectura. Asegúrate de decir el valor y el edificio.');
          }
          break;

        default:
          setError(result.message || 'No he entendido bien lo que necesitas. Prueba con "ir a calderas" o "crear tarea para mañana".');
      }
    } catch (e) {
      console.error(e);
      setError('Error al procesar el comando con IA.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-md animate-in fade-in duration-300">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl overflow-hidden p-8 flex flex-col items-center text-center space-y-6"
      >
        <div className="w-full flex justify-end">
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${isListening ? 'bg-red-500 animate-pulse scale-110' : isProcessing ? 'bg-blue-500' : 'bg-gray-900'}`}>
            {isProcessing ? (
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            ) : isListening ? (
              <Mic className="w-10 h-10 text-white" />
            ) : (
              <MicOff className="w-10 h-10 text-gray-400" />
            )}
          </div>
          {isListening && (
            <div className="absolute -inset-4 border-4 border-red-500/30 rounded-full animate-ping" />
          )}
        </div>

        <div className="space-y-1">
          <h3 className="text-xl font-black uppercase tracking-tighter text-gray-900">
            {isListening ? 'Escuchando...' : isProcessing ? 'Procesando...' : 'Asistente SIGAI'}
          </h3>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">IA de Apoyo Operativo</p>
        </div>

        <div className="w-full min-h-[80px] flex flex-col items-center justify-center px-2">
          {transcript && (
            <p className="text-sm font-bold text-gray-700 italic mb-4">"{transcript}"</p>
          )}
          
          <AnimatePresence mode="wait">
            {successMessage && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-2 text-green-600 bg-green-50 p-4 rounded-2xl w-full"
              >
                <CheckCircle2 className="w-6 h-6" />
                <p className="text-[11px] font-black uppercase leading-tight">{successMessage}</p>
              </motion.div>
            )}

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-2 text-red-500 bg-red-50 p-4 rounded-2xl w-full"
              >
                <AlertCircle className="w-6 h-6" />
                <p className="text-[11px] font-black uppercase leading-tight">{error}</p>
              </motion.div>
            )}

            {foundProvider && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gray-50 border border-gray-100 p-5 rounded-3xl w-full text-left space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl shadow-sm">
                    <UserIcon className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase text-gray-900 leading-none">{foundProvider.name}</div>
                    <div className="text-[8px] text-gray-400 font-bold uppercase tracking-widest mt-1">{foundProvider.commercialName || 'Proveedor'}</div>
                  </div>
                </div>
                
                {foundProvider.phone && (
                  <a href={`tel:${foundProvider.phone}`} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-100 text-gray-900 active:scale-95 transition-all">
                    <Phone className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-black">{foundProvider.phone}</span>
                  </a>
                )}
              </motion.div>
            )}

            {statusResult && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gray-900 text-white p-6 rounded-[2rem] w-full text-left space-y-4 shadow-xl"
              >
                {statusResult.type === 'reading' && (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[8px] font-black uppercase text-gray-400 tracking-widest mb-1">Última Lectura {statusResult.service}</div>
                      <div className="text-2xl font-black">{statusResult.value}</div>
                      <div className="text-[9px] font-bold text-yellow-400 uppercase mt-1">{statusResult.building}</div>
                    </div>
                    <div className="p-3 bg-white/10 rounded-2xl">
                      {statusResult.service === 'agua' ? <Droplets className="text-blue-400" /> : <Zap className="text-yellow-400" />}
                    </div>
                  </div>
                )}

                {statusResult.type === 'gasoil' && (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[8px] font-black uppercase text-gray-400 tracking-widest mb-1">Total Gasoil Base</div>
                      <div className="text-2xl font-black">{statusResult.total} L</div>
                      <div className="text-[9px] font-bold text-gray-500 uppercase mt-1">{statusResult.count} Depósitos</div>
                    </div>
                    <div className="p-3 bg-white/10 rounded-2xl">
                      <Flame className="text-orange-500" />
                    </div>
                  </div>
                )}

                {statusResult.type === 'sal' && (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[8px] font-black uppercase text-gray-400 tracking-widest mb-1">Stock de Sal</div>
                      <div className="text-2xl font-black">{statusResult.stock} Sacos</div>
                    </div>
                    <div className="p-3 bg-white/10 rounded-2xl">
                      <div className="w-6 h-6 bg-white rounded-sm rotate-45" />
                    </div>
                  </div>
                )}

                {statusResult.type === 'team' && (
                  <div className="space-y-3">
                    <div className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Equipo de Mantenimiento</div>
                    <div className="grid grid-cols-1 gap-2">
                      {statusResult.techs.slice(0, 3).map((t: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-[10px] font-bold">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                          <span className="uppercase">{t.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {statusResult.type === 'alerts' && (
                  <div className="space-y-3">
                    <div className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Alertas Pendientes ({statusResult.count})</div>
                    <div className="space-y-2">
                      {statusResult.items.map((item: any, i: number) => (
                        <div key={i} className="bg-white/5 p-2 rounded-xl border border-white/10">
                          <div className="text-[9px] font-black uppercase leading-tight">{item.title}</div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => { onNavigate(AppTab.HOME); onClose(); }} className="w-full py-2 bg-yellow-400 text-black rounded-xl text-[8px] font-black uppercase flex items-center justify-center gap-1">
                      Ver todas <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {!transcript && !error && !successMessage && !foundProvider && !statusResult && (
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Di "estado del gasoil", "quién está hoy" o "registrar lectura..."</p>
          )}
        </div>

        <div className="w-full space-y-3">
          {!isListening && !isProcessing && (
            <button 
              onClick={startListening}
              className="w-full py-5 bg-gray-900 text-yellow-400 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <Mic className="w-5 h-5" /> Iniciar Escucha
            </button>
          )}
          {isListening && (
            <button 
              onClick={stopListening}
              className="w-full py-5 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <MicOff className="w-5 h-5" /> Detener
            </button>
          )}
          
          <div className="pt-4 border-t border-gray-100">
            <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest mb-3">Capacidades Operativas</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 bg-gray-50 rounded-xl flex flex-col items-center gap-1">
                <Users className="w-3 h-3 text-gray-400" />
                <span className="text-[6px] font-black text-gray-400 uppercase">Equipo</span>
              </div>
              <div className="p-2 bg-gray-50 rounded-xl flex flex-col items-center gap-1">
                <Zap className="w-3 h-3 text-gray-400" />
                <span className="text-[6px] font-black text-gray-400 uppercase">Estados</span>
              </div>
              <div className="p-2 bg-gray-50 rounded-xl flex flex-col items-center gap-1">
                <Bell className="w-3 h-3 text-gray-400" />
                <span className="text-[6px] font-black text-gray-400 uppercase">Alertas</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default VoiceAssistant;
