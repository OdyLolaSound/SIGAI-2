
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Camera, Upload, Send, Loader2, CheckCircle2, AlertCircle, ChevronRight, X, ShieldAlert, Wrench, ArrowLeft, Bot, User as UserIcon, MapPin, Building2, Navigation, Maximize2, Minimize2, FileText } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import Markdown from 'react-markdown';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { User, RequestCategory, UrgencyLevel, RequestItem, Building } from '../types';
import { storageService, BUILDINGS } from '../services/storageService';

interface AIRequestFlowProps {
  user: User;
  onClose: () => void;
  onComplete: () => void;
}

type FlowStep = 'INPUT' | 'ANALYZING' | 'AI_SUGGESTION' | 'IMAGES' | 'LOCATION' | 'FINAL_CONFIRM';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const AIRequestFlow: React.FC<AIRequestFlowProps> = ({ user, onClose, onComplete }) => {
  const [step, setStep] = useState<FlowStep>('INPUT');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDocumentMode, setIsDocumentMode] = useState(false);
  const [documentImage, setDocumentImage] = useState<string | null>(null);
  
  // AI Results
  const [aiAnalysis, setAiAnalysis] = useState<{
    category: RequestCategory;
    urgency: UrgencyLevel;
    explanation: string;
    steps: string[];
    isChronic?: boolean;
    structuralSolution?: string;
  } | null>(null);

  // Chat States
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Location States
  const [locationType, setLocationType] = useState<'building' | 'gps' | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [markerPos, setMarkerPos] = useState<{ lat: number, lng: number } | null>(null);
  const [specificLocation, setSpecificLocation] = useState('');
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [buildingSearch, setBuildingSearch] = useState('');

  // Leaflet Marker Icon Fix
  const customIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  useEffect(() => {
    if (locationType === 'gps' && !markerPos) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const pos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            setMarkerPos(pos);
          },
          (error) => {
            console.error("Error getting location:", error);
          }
        );
      }
    }
  }, [locationType]);

  // Helper component to handle map clicks
  const MapEvents = () => {
    useMapEvents({
      click(e) {
        setMarkerPos({ lat: e.latlng.lat, lng: e.latlng.lng });
      },
    });
    return null;
  };

  // Helper component to center map
  const MapCenterer = ({ center }: { center: { lat: number, lng: number } | null }) => {
    const map = useMap();
    useEffect(() => {
      if (center) {
        map.setView([center.lat, center.lng], map.getZoom());
      }
    }, [center, map]);
    return null;
  };

  // Fix for blank tiles: forces map to recalculate size after container is ready
  const MapResizer = () => {
    const map = useMap();
    useEffect(() => {
      const timer = setTimeout(() => {
        map.invalidateSize();
      }, 400);
      return () => clearTimeout(timer);
    }, [map]);
    return null;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: userMessage }];
    setChatMessages(newMessages);
    setChatLoading(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
      const ai = new GoogleGenAI({ apiKey });
      const history = newMessages.map(m => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.content }]
      }));

      const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: `Eres un asistente técnico experto en mantenimiento de la USAC. 
          Tu trato es educado, cercano y profesional. Ayudas al usuario a solucionar problemas técnicos de forma clara y detallada.
          
          REGLAS DE FORMATO:
          1. Usa Markdown para que la respuesta sea legible.
          2. Usa negritas (**texto**) para resaltar puntos clave.
          3. Usa listas con viñetas o numeradas para pasos.
          4. Deja espacios (líneas en blanco) entre párrafos para que no se vea todo agrupado.
          5. No uses lenguaje militar. Sé un profesional de mantenimiento amable.
          
          El usuario ya tiene un diagnóstico inicial y ahora busca detalles específicos.`
        }
      });

      const response = await chat.sendMessage({ message: userMessage });
      setChatMessages([...newMessages, { role: 'assistant', content: response.text }]);
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error("Chat Error:", error);
      setChatMessages([...newMessages, { role: 'assistant', content: "Lo siento, he tenido un problema de conexión. ¿Puedes repetir?" }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (isDocumentMode) {
          setDocumentImage(result);
        } else {
          setImages(prev => [...prev, result]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const startDocumentAnalysis = async () => {
    if (!documentImage) return alert("Por favor, sube una foto del parte.");
    
    setStep('ANALYZING');
    setLoading(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: documentImage.split(',')[1]
            }
          },
          { text: `Analiza este documento de parte de avería. 
          Extrae la descripción de la deficiencia, la ubicación mencionada y clasifica la incidencia.
          
          Devuelve JSON con:
          - category: (Eléctrico, Fontanería, Calderas / Climatización, Carpintería / Cerraduras, Mobiliario, Informática, Otros)
          - urgency: (Baja, Media, Alta, Crítica)
          - explanation: Resumen de lo que dice el parte
          - description: Texto completo de la deficiencia extraída
          - location: Ubicación mencionada en el papel
          - steps: Pasos sugeridos para el técnico
          - isChronic: false` }
        ]},
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              urgency: { type: Type.STRING },
              explanation: { type: Type.STRING },
              description: { type: Type.STRING },
              location: { type: Type.STRING },
              steps: { type: Type.ARRAY, items: { type: Type.STRING } },
              isChronic: { type: Type.BOOLEAN }
            },
            required: ["category", "urgency", "explanation", "description", "location", "steps", "isChronic"]
          }
        }
      });

      const result = JSON.parse(response.text);
      setAiAnalysis(result);
      setDescription(result.description);
      setSpecificLocation(result.location);
      setImages([documentImage]); // Use the document as the first image
      setStep('AI_SUGGESTION');
    } catch (error) {
      console.error("Document AI Error:", error);
      alert("Error al analizar el documento. Por favor, descríbelo manualmente.");
      setStep('INPUT');
      setIsDocumentMode(false);
    } finally {
      setLoading(false);
    }
  };

  const startAIAnalysis = async () => {
    if (!description.trim()) return alert("Por favor, describe el problema.");
    
    setStep('ANALYZING');
    setLoading(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
      const ai = new GoogleGenAI({ apiKey });
      
      // Get historical context to detect chronic problems
      const history = storageService.getRequests().slice(0, 20).map(r => ({
        title: r.title,
        desc: r.description,
        cat: r.category,
        date: r.date
      }));

      const parts: any[] = [{ 
        text: `Actúa como un experto técnico de mantenimiento profesional y educado. 
        Analiza esta incidencia: "${description}".
        
        CONTEXTO HISTÓRICO (Últimas 20 peticiones):
        ${JSON.stringify(history)}
        
        Si detectas que este problema es recurrente o "crónico" (ha pasado varias veces de forma similar), indícalo como isChronic: true y propón una solución estructural permanente en structuralSolution.` 
      }];
      
      if (images.length > 0) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: images[0].split(',')[1]
          }
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [
          ...parts,
          { text: "Clasifica la categoría (Eléctrico, Fontanería, Calderas / Climatización, Carpintería / Cerraduras, Mobiliario, Informática, Otros), nivel de urgencia (Baja, Media, Alta, Crítica) y da una solución paso a paso si es posible que el usuario lo arregle solo. Devuelve JSON." }
        ]},
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              urgency: { type: Type.STRING },
              explanation: { type: Type.STRING },
              steps: { type: Type.ARRAY, items: { type: Type.STRING } },
              isChronic: { type: Type.BOOLEAN },
              structuralSolution: { type: Type.STRING }
            },
            required: ["category", "urgency", "explanation", "steps", "isChronic"]
          }
        }
      });

      const result = JSON.parse(response.text);
      setAiAnalysis(result);
      setStep('AI_SUGGESTION');
    } catch (error) {
      console.error("AI Error:", error);
      alert("Error al conectar con el asistente técnico. Intentando modo manual.");
      setStep('FINAL_CONFIRM');
    } finally {
      setLoading(false);
    }
  };

  const createFormalRequest = (resolvedByAi: boolean = false) => {
    const newItem: RequestItem = {
      id: crypto.randomUUID(),
      userId: user.id,
      unit: user.role,
      type: 'peticion',
      category: aiAnalysis?.category || 'Otros',
      urgency: aiAnalysis?.urgency || 'Media',
      title: description.substring(0, 30) + '...',
      description: description,
      status: resolvedByAi ? 'resolved_by_ai' : 'open',
      date: new Date().toISOString(),
      imageUrl: images.length > 0 ? images[0] : undefined,
      aiExplanation: aiAnalysis?.explanation || undefined,
      aiSteps: aiAnalysis?.steps || undefined,
      isChronic: aiAnalysis?.isChronic ?? false,
      structuralSolution: aiAnalysis?.structuralSolution || undefined,
      locationData: {
        buildingId: selectedBuilding?.id || undefined,
        buildingName: selectedBuilding?.name || undefined,
        coordinates: markerPos || undefined,
        specificLocation: specificLocation || undefined
      }
    };

    storageService.saveRequest(newItem);
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-white/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-300">
      {/* Header Asistente */}
      <header className="p-6 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-400 rounded-2xl flex items-center justify-center shadow-lg">
            <MessageSquare className="w-5 h-5 text-black" />
          </div>
          <div>
            <h2 className="text-gray-900 font-black uppercase tracking-tighter text-lg leading-none">Asistente SIGAI</h2>
            <p className="text-yellow-600 text-[8px] font-black uppercase tracking-widest mt-1">Soporte Técnico con IA</p>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="p-3 bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded-xl transition-all active:scale-90"
          title="Cerrar Asistente"
        >
          <X className="w-6 h-6" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain p-6 flex flex-col items-center">
        <div className="w-full max-w-2xl">
          {step === 'INPUT' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-5">
              {!isDocumentMode ? (
                <>
                  <div className="bg-gray-50 border border-gray-100 p-6 rounded-[2.5rem] space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">¿Cuál es el problema?</label>
                    <textarea 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ej: Hay una fuga de agua en el baño del bloque A..."
                      className="w-full bg-transparent text-gray-900 text-lg font-bold outline-none resize-none h-32 placeholder:text-gray-300"
                    />
                  </div>

                  <div className="space-y-3">
                    <button 
                      onClick={startAIAnalysis}
                      className="w-full p-6 bg-yellow-400 text-black rounded-[2.5rem] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all"
                    >
                      Analizar con IA <ChevronRight className="w-5 h-5" />
                    </button>

                    <button 
                      onClick={() => setIsDocumentMode(true)}
                      className="w-full p-6 bg-white border-2 border-gray-900 text-gray-900 rounded-[2.5rem] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all"
                    >
                      <FileText className="w-5 h-5" /> Ya tengo un parte (Subir foto)
                    </button>
                    
                    <button 
                      onClick={onClose}
                      className="w-full p-4 text-gray-400 font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:text-gray-900 transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" /> Cancelar y Volver
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-8">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
                      <FileText className="w-10 h-10" />
                    </div>
                    <h3 className="text-gray-900 text-2xl font-black uppercase tracking-tight">Escanear Parte</h3>
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-2">Sube una foto del parte físico para que la IA lo procese</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => cameraInputRef.current?.click()}
                      className={`aspect-square rounded-[2.5rem] flex flex-col items-center justify-center gap-3 transition-all group shadow-sm border-2 ${documentImage ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white border-gray-100 text-gray-900 hover:border-yellow-400'}`}
                    >
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${documentImage ? 'bg-green-100' : 'bg-yellow-50 text-yellow-600'}`}>
                        <Camera className="w-7 h-7" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest">{documentImage ? 'Cambiar Foto' : 'Hacer Foto'}</span>
                    </button>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className={`aspect-square rounded-[2.5rem] flex flex-col items-center justify-center gap-3 transition-all group shadow-sm border-2 ${documentImage ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white border-gray-100 text-gray-900 hover:border-blue-400'}`}
                    >
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${documentImage ? 'bg-green-100' : 'bg-blue-50 text-blue-600'}`}>
                        <Upload className="w-7 h-7" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest">{documentImage ? 'Cambiar Archivo' : 'Subir Archivo'}</span>
                    </button>
                  </div>

                  {documentImage && (
                    <div className="rounded-[2rem] overflow-hidden border-4 border-white shadow-xl aspect-[3/4] bg-gray-100 relative group">
                      <img src={documentImage} className="w-full h-full object-cover" />
                      <button 
                        onClick={() => setDocumentImage(null)}
                        className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}

                  <div className="space-y-3">
                    <button 
                      onClick={startDocumentAnalysis}
                      disabled={!documentImage}
                      className="w-full p-6 bg-yellow-400 text-black rounded-[2.5rem] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                    >
                      Procesar Parte con IA <ChevronRight className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => {
                        setIsDocumentMode(false);
                        setDocumentImage(null);
                      }}
                      className="w-full p-4 text-gray-400 font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" /> Volver a escribir
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'ANALYZING' && (
            <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center">
              <div className="relative">
                <div className="w-24 h-24 border-4 border-yellow-400/20 rounded-full animate-ping absolute inset-0"></div>
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center relative z-10 shadow-2xl border border-gray-100">
                  <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
                </div>
              </div>
              <div>
                <h3 className="text-gray-900 text-xl font-black uppercase tracking-tighter">Consultando Experto...</h3>
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Clasificando incidencia y urgencia</p>
              </div>
            </div>
          )}

          {step === 'AI_SUGGESTION' && aiAnalysis && (
            <div className="space-y-6 animate-in zoom-in-95 duration-500 pb-10">
              {!showChat ? (
                <>
                  <div className="bg-white border border-gray-100 rounded-[2.5rem] overflow-hidden shadow-sm">
                    <div className="p-6 bg-yellow-400 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-black">
                        <ShieldAlert className="w-6 h-6" />
                        <span className="font-black uppercase text-xs tracking-tighter">Diagnóstico Final</span>
                      </div>
                      <div className="px-3 py-1 bg-black text-white rounded-full text-[8px] font-black uppercase">
                        {aiAnalysis.urgency}
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      {aiAnalysis.isChronic && (
                        <div className="bg-red-50 border border-red-100 p-4 rounded-2xl space-y-2">
                          <div className="flex items-center gap-2 text-red-600">
                            <ShieldAlert className="w-4 h-4" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Problema Crónico Detectado</span>
                          </div>
                          <p className="text-gray-600 text-[10px] leading-relaxed">
                            Este problema se ha reportado anteriormente. La IA sugiere una **solución estructural**:
                          </p>
                          <p className="text-red-700 text-[11px] font-bold italic">
                            {aiAnalysis.structuralSolution}
                          </p>
                        </div>
                      )}

                      <p className="text-gray-900 text-sm font-bold leading-relaxed">{aiAnalysis.explanation}</p>
                      
                      <div className="space-y-3">
                        <p className="text-[10px] font-black text-yellow-600 uppercase tracking-widest">Pasos sugeridos:</p>
                        {aiAnalysis.steps.map((step, i) => (
                          <div key={i} className="flex gap-4 items-start bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            <div className="w-6 h-6 bg-yellow-400/20 text-yellow-700 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0">{i+1}</div>
                            <p className="text-gray-700 text-[11px] font-medium leading-snug">{step}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <button 
                      onClick={() => setShowChat(true)}
                      className="w-full p-6 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
                    >
                      <MessageSquare className="w-5 h-5" /> Necesito más ayuda / Chat
                    </button>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => createFormalRequest(true)}
                        className="p-5 bg-green-600 text-white rounded-[1.5rem] font-black uppercase text-[9px] tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Solucionado
                      </button>
                      <button 
                        onClick={() => setStep('IMAGES')}
                        className="p-5 bg-gray-100 text-gray-600 rounded-[1.5rem] font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        <AlertCircle className="w-4 h-4" /> No puedo
                      </button>
                    </div>
                    
                    <button 
                      onClick={() => setStep('INPUT')}
                      className="w-full p-2 text-gray-400 font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-3 h-3" /> Corregir descripción
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4 flex flex-col h-[78vh] animate-in slide-in-from-right-5 duration-500">
                  {/* Chat Header Info */}
                  <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 border border-blue-100 rounded-2xl">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-blue-700 text-[10px] font-black uppercase leading-none">Asistente Técnico</p>
                      <p className="text-blue-600/60 text-[8px] font-bold uppercase tracking-widest mt-1">En línea • Soporte Educado</p>
                    </div>
                  </div>

                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto overscroll-contain space-y-6 pr-2 scrollbar-hide">
                    <div className="bg-yellow-50 border border-yellow-100 p-5 rounded-3xl relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-yellow-400/30"></div>
                      <p className="text-yellow-700 text-[9px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                        <ShieldAlert className="w-3 h-3" /> Diagnóstico Inicial:
                      </p>
                      <p className="text-gray-600 text-[11px] leading-relaxed font-medium italic">"{aiAnalysis.explanation}"</p>
                    </div>

                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} gap-2`}>
                        <div className={`flex items-center gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                            msg.role === 'user' ? 'bg-blue-600' : 'bg-gray-100 border border-gray-200'
                          }`}>
                            {msg.role === 'user' ? <UserIcon className="w-3 h-3 text-white" /> : <Bot className="w-3 h-3 text-yellow-600" />}
                          </div>
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">
                            {msg.role === 'user' ? 'Tú' : 'Asistente'}
                          </span>
                        </div>
                        
                        <div className={`max-w-[90%] p-5 rounded-3xl text-[12px] leading-relaxed shadow-sm ${
                          msg.role === 'user' 
                            ? 'bg-blue-600 text-white rounded-tr-none' 
                            : 'bg-gray-50 text-gray-800 rounded-tl-none border border-gray-100'
                        }`}>
                          <div className="markdown-body prose prose-sm max-w-none">
                            <Markdown>{msg.content}</Markdown>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {chatLoading && (
                      <div className="flex flex-col items-start gap-2 animate-pulse">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
                            <Bot className="w-3 h-3 text-yellow-600" />
                          </div>
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Asistente</span>
                        </div>
                        <div className="bg-gray-50 p-5 rounded-3xl rounded-tl-none border border-gray-100 flex gap-2">
                          <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-bounce"></div>
                          <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                          <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input & Actions Area - Pushed to bottom */}
                  <div className="mt-auto space-y-4 bg-white/50 pt-4 border-t border-gray-100">
                    <div className="relative group">
                      <input 
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Escribe tu duda técnica aquí..."
                        className="w-full bg-gray-50 border border-gray-200 p-5 pr-16 rounded-[2rem] text-gray-900 text-xs font-bold outline-none focus:border-yellow-400 focus:bg-white transition-all placeholder:text-gray-400"
                      />
                      <button 
                        onClick={handleSendMessage}
                        disabled={!chatInput.trim() || chatLoading}
                        className="absolute right-2 top-2 bottom-2 w-12 bg-yellow-400 text-black rounded-2xl flex items-center justify-center disabled:opacity-30 disabled:grayscale transition-all hover:scale-105 active:scale-95 shadow-lg shadow-yellow-400/20"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pb-2">
                      <button 
                        onClick={() => createFormalRequest(true)}
                        className="p-4 bg-green-50 border border-green-100 text-green-600 rounded-2xl font-black uppercase text-[8px] tracking-widest flex items-center justify-center gap-2 hover:bg-green-600 hover:text-white transition-all active:scale-95"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Solucionado
                      </button>
                      <button 
                        onClick={() => setStep('IMAGES')}
                        className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl font-black uppercase text-[8px] tracking-widest flex items-center justify-center gap-2 hover:bg-red-600 hover:text-white transition-all active:scale-95"
                      >
                        <AlertCircle className="w-3 h-3" /> No puedo
                      </button>
                    </div>

                    <button 
                      onClick={() => setShowChat(false)}
                      className="w-full py-2 text-gray-400 font-black uppercase text-[8px] tracking-[0.2em] flex items-center justify-center gap-2 hover:text-gray-600 transition-colors"
                    >
                      <ArrowLeft className="w-3 h-3" /> Volver al diagnóstico
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'IMAGES' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-5 pb-10">
              <div className="text-center">
                <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
                  <Camera className="w-10 h-10" />
                </div>
                <h3 className="text-gray-900 text-2xl font-black uppercase tracking-tight">Evidencia Visual</h3>
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-2">Añade fotos de la avería para el equipo técnico</p>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-[3rem] p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => cameraInputRef.current?.click()}
                    className="aspect-square bg-white border-2 border-gray-100 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 hover:border-yellow-400 transition-all group shadow-sm"
                  >
                    <div className="w-14 h-14 bg-yellow-50 text-yellow-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Camera className="w-7 h-7" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Hacer Foto</span>
                  </button>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square bg-white border-2 border-gray-100 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 hover:border-blue-400 transition-all group shadow-sm"
                  >
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload className="w-7 h-7" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Subir Archivo</span>
                  </button>
                </div>

                {images.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Fotos seleccionadas ({images.length})</span>
                      <button onClick={() => setImages([])} className="text-[8px] font-black text-red-500 uppercase tracking-widest">Borrar todas</button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {images.map((img, idx) => (
                        <div key={idx} className="aspect-square rounded-2xl overflow-hidden relative border-2 border-white shadow-md group">
                          <img src={img} alt="Avería" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <button 
                            onClick={() => removeImage(idx)}
                            className="absolute top-1 right-1 bg-red-500 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <button 
                  onClick={() => setStep('LOCATION')}
                  className="w-full p-6 bg-yellow-400 text-black rounded-[2.5rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  Continuar a Ubicación <ChevronRight className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setStep('AI_SUGGESTION')}
                  className="w-full p-2 text-gray-400 font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-3 h-3" /> Volver al diagnóstico
                </button>
              </div>
            </div>
          )}

          {step === 'LOCATION' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-5 pb-10">
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-yellow-50 text-yellow-600 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-yellow-100">
                  <MapPin className="w-10 h-10" />
                </div>
                <h3 className="text-gray-900 text-2xl font-black uppercase tracking-tight">Ubicación de la Avería</h3>
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-2">Indica dónde se ha producido el problema</p>
              </div>

              {!locationType ? (
                <div className="grid grid-cols-1 gap-4">
                  <button 
                    onClick={() => setLocationType('building')}
                    className="p-8 bg-white border-2 border-gray-100 rounded-[2.5rem] flex items-center gap-6 hover:border-yellow-400 transition-all group"
                  >
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Building2 className="w-8 h-8" />
                    </div>
                    <div className="text-left">
                      <p className="text-gray-900 font-black uppercase text-sm tracking-tighter">Seleccionar Edificio</p>
                      <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">Esquema de dependencias USAC</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => setLocationType('gps')}
                    className="p-8 bg-white border-2 border-gray-100 rounded-[2.5rem] flex items-center gap-6 hover:border-yellow-400 transition-all group"
                  >
                    <div className="w-16 h-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Navigation className="w-8 h-8" />
                    </div>
                    <div className="text-left">
                      <p className="text-gray-900 font-black uppercase text-sm tracking-tighter">Ubicación GPS / Mapa</p>
                      <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">Marcar punto exacto en el plano</p>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {locationType === 'building' ? (
                    <div className="space-y-4">
                      <div className="bg-gray-50 border border-gray-100 rounded-[2rem] p-4">
                        <div className="mb-4 px-2">
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Buscar edificio:</label>
                          <div className="relative">
                            <input 
                              type="text"
                              value={buildingSearch}
                              onChange={(e) => setBuildingSearch(e.target.value)}
                              placeholder="Escribe el nombre del edificio..."
                              className="w-full bg-white border border-gray-200 p-3 rounded-xl text-xs font-bold outline-none focus:border-yellow-400 transition-all"
                            />
                            {buildingSearch && (
                              <button 
                                onClick={() => setBuildingSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-3 px-2">Selecciona el edificio:</label>
                        <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2">
                          {BUILDINGS
                            .filter(b => {
                              const search = buildingSearch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                              const name = b.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                              const code = b.code.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                              return name.includes(search) || code.includes(search);
                            })
                            .map(b => (
                            <button
                              key={b.id}
                              onClick={() => setSelectedBuilding(b)}
                              className={`p-4 rounded-2xl text-left transition-all flex items-center justify-between ${
                                selectedBuilding?.id === b.id 
                                  ? 'bg-yellow-400 text-black shadow-lg ring-2 ring-yellow-400 ring-offset-2' 
                                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-100'
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="text-[11px] font-black uppercase">{b.name}</span>
                                <span className="text-[8px] font-bold text-gray-400 uppercase">{b.code}</span>
                              </div>
                              {selectedBuilding?.id === b.id && <CheckCircle2 className="w-4 h-4" />}
                            </button>
                          ))}
                          {BUILDINGS.filter(b => {
                              const search = buildingSearch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                              const name = b.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                              const code = b.code.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                              return name.includes(search) || code.includes(search);
                            }).length === 0 && (
                            <div className="p-8 text-center">
                              <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">No se encontraron edificios</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 border border-gray-100 rounded-[2rem] p-6">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Detalle específico (Opcional)</label>
                        <input 
                          type="text"
                          value={specificLocation}
                          onChange={(e) => setSpecificLocation(e.target.value)}
                          placeholder="Ej: Planta 1, Baño Izquierda..."
                          className="w-full bg-transparent text-gray-900 text-sm font-bold outline-none border-b border-gray-200 pb-2 focus:border-yellow-400 transition-colors"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className={`space-y-4 transition-all duration-500 ${isMapExpanded ? 'fixed inset-0 z-[2000] bg-white p-4' : ''}`}>
                      <div className={`rounded-[2.5rem] overflow-hidden border-2 border-gray-100 relative shadow-2xl bg-gray-100 transition-all duration-500 ${isMapExpanded ? 'h-full' : 'h-[400px]'}`}>
                        <MapContainer 
                          key={`${locationType}-${isMapExpanded}`}
                          center={markerPos || { lat: 38.3452, lng: -0.4815 }} 
                          zoom={18} 
                          style={{ height: '100%', width: '100%' }}
                          zoomControl={false}
                        >
                          {/* Satellite Layer (Esri World Imagery) - Reverted as requested */}
                          <TileLayer
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                          />
                          {/* Hybrid Labels Layer for context */}
                          <TileLayer
                            url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                          />
                          <MapEvents />
                          <MapCenterer center={markerPos} />
                          <MapResizer />
                          {markerPos && (
                            <Marker position={[markerPos.lat, markerPos.lng]} icon={customIcon} />
                          )}
                        </MapContainer>

                        {!markerPos && (
                          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-10 text-center pointer-events-none z-[1000]">
                            <p className="text-white font-black uppercase text-xs tracking-widest">Toca en el mapa para marcar la avería</p>
                          </div>
                        )}
                        
                        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
                          <button 
                            onClick={() => setIsMapExpanded(!isMapExpanded)}
                            className="bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-lg border border-gray-200 hover:bg-white transition-all active:scale-95"
                          >
                            {isMapExpanded ? <Minimize2 className="w-5 h-5 text-gray-700" /> : <Maximize2 className="w-5 h-5 text-gray-700" />}
                          </button>
                          
                          <div className="bg-white/90 backdrop-blur-md p-2 rounded-xl shadow-lg border border-gray-200">
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest text-center mb-1">Mapa Realista</p>
                            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white">
                              <Navigation className="w-4 h-4" />
                            </div>
                          </div>
                        </div>

                        {isMapExpanded && (
                          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-xs px-4">
                            <button 
                              onClick={() => setIsMapExpanded(false)}
                              className="w-full p-4 bg-yellow-400 text-black rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all"
                            >
                              Confirmar Ubicación
                            </button>
                          </div>
                        )}
                      </div>
                      {!isMapExpanded && (
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest text-center">
                          {markerPos ? `Coordenadas: ${markerPos.lat.toFixed(5)}, ${markerPos.lng.toFixed(5)}` : 'Pendiente de marcar'}
                        </p>
                      )}
                    </div>
                  )}

                    <div className="flex gap-3">
                      <button 
                        onClick={() => {
                          setLocationType(null);
                          setSelectedBuilding(null);
                          setMarkerPos(null);
                        }}
                        className="flex-1 p-5 bg-gray-100 text-gray-500 rounded-[1.5rem] font-black uppercase text-[9px] tracking-widest active:scale-95 transition-all"
                      >
                        Cambiar Modo
                      </button>
                    <button 
                      disabled={!selectedBuilding && !markerPos}
                      onClick={() => setStep('FINAL_CONFIRM')}
                      className="flex-[2] p-5 bg-yellow-400 text-black rounded-[1.5rem] font-black uppercase text-[9px] tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50"
                    >
                      Continuar a Confirmación
                    </button>
                  </div>
                </div>
              )}

              <button 
                onClick={() => setStep('IMAGES')}
                className="w-full p-2 text-gray-400 font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-3 h-3" /> Volver a fotos
              </button>
            </div>
          )}

          {step === 'FINAL_CONFIRM' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-5">
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
                  <Wrench className="w-10 h-10" />
                </div>
                <h3 className="text-gray-900 text-2xl font-black uppercase tracking-tight">Crear Petición Oficial</h3>
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-2">Se notificará al equipo técnico USAC</p>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-[2.5rem] p-6 space-y-5">
                <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Categoría</span>
                  <span className="text-gray-900 font-black uppercase text-[10px]">{aiAnalysis?.category || 'General'}</span>
                </div>
                <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Urgencia</span>
                  <span className="text-red-600 font-black uppercase text-[10px]">{aiAnalysis?.urgency || 'Media'}</span>
                </div>
                <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Unidad</span>
                  <span className="text-gray-900 font-black uppercase text-[10px]">{user.role}</span>
                </div>
                {images.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-3">Imágenes Adjuntas ({images.length})</span>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {images.map((img, idx) => (
                        <div key={idx} className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 border-white shadow-sm">
                          <img src={img} alt="Adjunto" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-start border-b border-gray-200 pb-4">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Ubicación</span>
                  <div className="text-right">
                    <p className="text-gray-900 font-black uppercase text-[10px]">
                      {selectedBuilding ? selectedBuilding.name : markerPos ? 'Marcado en Mapa' : 'No especificada'}
                    </p>
                    {specificLocation && (
                      <p className="text-gray-400 text-[8px] font-bold uppercase mt-1">{specificLocation}</p>
                    )}
                    {markerPos && (
                      <p className="text-gray-400 text-[8px] font-bold uppercase mt-1">
                        {markerPos.lat.toFixed(4)}, {markerPos.lng.toFixed(4)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={() => createFormalRequest(false)}
                  className="w-full p-7 bg-blue-600 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all"
                >
                  Confirmar y Enviar Parte
                </button>
                <button 
                  onClick={() => setStep('LOCATION')}
                  className="w-full p-4 text-gray-400 font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Corregir Ubicación
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Hidden Inputs */}
      <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
      <input type="file" ref={fileInputRef} accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
    </div>
  );
};

export default AIRequestFlow;
