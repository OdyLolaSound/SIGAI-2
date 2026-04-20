
import React, { useState, useRef, useEffect } from 'react';
import { 
  Wrench, Ruler, Box, Camera, ArrowLeft, 
  RefreshCw, Maximize, Save, Trash2, 
  Layers, Move, RotateCcw, Info,
  ChevronRight, Calculator, Scaling, FileSpreadsheet, PlusCircle,
  FileCode, Home, CheckCircle, Target, Smartphone, Zap, Flame, Droplets,
  Download, Plus, Cloud, FolderOpen, FileUp, FileDown, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp, 
  doc, 
  deleteDoc,
  orderBy
} from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

import * as THREE from 'three';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import PDFScannerTool from './PDFScannerTool';
import PDFSignerTool from './PDFSignerTool';

type CategoryType = 'menu' | 'medidas' | 'electricidad' | 'oficina';
type ToolType = 'none' | 'converter' | 'ar_measure' | 'scan_3d' | 'level' | 'panel_designer' | 'pdf_scanner' | 'pdf_signer';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

const ToolsModule: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeCategory, setActiveCategory] = useState<CategoryType>('menu');
  const [activeTool, setActiveTool] = useState<ToolType>('none');

  const renderTool = () => {
    if (activeTool !== 'none') {
      switch (activeTool) {
        case 'converter':
          return <MeasurementConverter onBack={() => setActiveTool('none')} />;
        case 'ar_measure':
          return <ARMeasureTool onBack={() => setActiveTool('none')} />;
        case 'scan_3d':
          return <Scan3DTool onBack={() => setActiveTool('none')} />;
        case 'level':
          return <LevelTool onBack={() => setActiveTool('none')} />;
        case 'panel_designer':
          return <ElectricalPanelDesigner onBack={() => setActiveTool('none')} />;
        case 'pdf_scanner':
          return <PDFScannerTool onBack={() => setActiveTool('none')} />;
        case 'pdf_signer':
          return <PDFSignerTool onBack={() => setActiveTool('none')} />;
        default:
          return null;
      }
    }

    switch (activeCategory) {
      case 'medidas':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-4 mb-8">
              <button onClick={() => setActiveCategory('menu')} className="p-3 bg-gray-100 rounded-2xl"><ArrowLeft className="w-5 h-5" /></button>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter">Medidas y Planos</h3>
                <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Herramientas de precisión</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <ToolCard 
                icon={<Scaling className="w-6 h-6" />}
                title="Conversor de Medidas"
                desc="Longitud, área, volumen y peso"
                onClick={() => setActiveTool('converter')}
                color="bg-blue-50 border-blue-100 text-blue-900"
              />
              <ToolCard 
                icon={<Camera className="w-6 h-6" />}
                title="Medidor de Distancia AR"
                desc="Usa la cámara para medir espacios"
                onClick={() => setActiveTool('ar_measure')}
                color="bg-purple-50 border-purple-100 text-purple-900"
              />
              <ToolCard 
                icon={<Box className="w-6 h-6" />}
                title="Escaneado 3D / Planos"
                desc="Modelado de habitaciones (Pro)"
                onClick={() => setActiveTool('scan_3d')}
                color="bg-amber-50 border-amber-100 text-amber-900"
              />
              <ToolCard 
                icon={<Target className="w-6 h-6" />}
                title="Nivel de Burbuja"
                desc="Nivelación de superficies"
                onClick={() => setActiveTool('level')}
                color="bg-green-50 border-green-100 text-green-900"
              />
            </div>
          </div>
        );
      case 'electricidad':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-4 mb-8">
              <button onClick={() => setActiveCategory('menu')} className="p-3 bg-gray-100 rounded-2xl"><ArrowLeft className="w-5 h-5" /></button>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter">Electricidad</h3>
                <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Cálculo y diseño eléctrico</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <ToolCard 
                icon={<FileCode className="w-6 h-6" />}
                title="Diseñador de Cuadros"
                desc="Esquemas de cuadros eléctricos"
                onClick={() => setActiveTool('panel_designer')}
                color="bg-orange-50 border-orange-100 text-orange-900"
              />
            </div>
          </div>
        );
      case 'oficina':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-4 mb-8">
              <button onClick={() => setActiveCategory('menu')} className="p-3 bg-gray-100 rounded-2xl"><ArrowLeft className="w-5 h-5" /></button>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter">Oficina y Documentos</h3>
                <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Gestión de archivos y escaneado</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <ToolCard 
                icon={<Camera className="w-6 h-6" />}
                title="Scanner PDF"
                desc="Escanea y endereza documentos"
                onClick={() => setActiveTool('pdf_scanner')}
                color="bg-emerald-50 border-emerald-100 text-emerald-900"
              />
              <ToolCard 
                icon={<FileText className="w-6 h-6" />}
                title="Firmar PDF"
                desc="Añade tu firma a cualquier PDF"
                onClick={() => setActiveTool('pdf_signer')}
                color="bg-blue-50 border-blue-100 text-blue-900"
              />
            </div>
          </div>
        );
      default:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
              <div className="inline-flex p-4 bg-yellow-400 rounded-3xl mb-4 shadow-xl">
                <Wrench className="w-8 h-8 text-black" />
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tighter">Herramientas</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em]">Utilidades de Campo USAC</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <CategoryCard 
                icon={<Scaling className="w-6 h-6" />}
                title="Medidas y Planos"
                desc="Conversor, AR, 3D y Nivel"
                onClick={() => setActiveCategory('medidas')}
                color="bg-white border-gray-100"
              />
              <CategoryCard 
                icon={<Zap className="w-6 h-6" />}
                title="Electricidad"
                desc="Diseño de cuadros y cálculos"
                onClick={() => setActiveCategory('electricidad')}
                color="bg-white border-gray-100"
              />
              <CategoryCard 
                icon={<FileText className="w-6 h-6" />}
                title="Oficina"
                desc="Scanner PDF y documentos"
                onClick={() => setActiveCategory('oficina')}
                color="bg-white border-gray-100"
              />
            </div>

            <button 
              onClick={onBack}
              className="w-full p-6 bg-gray-900 text-white rounded-[2rem] font-black uppercase tracking-widest text-[10px] shadow-2xl flex items-center justify-center gap-4 active:scale-95 transition-all mt-8"
            >
              <ArrowLeft className="w-5 h-5" /> Volver al Menú
            </button>
          </div>
        );
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto px-2 py-6">
      {renderTool()}
    </div>
  );
};

const ToolCard: React.FC<{ icon: React.ReactNode, title: string, desc: string, onClick: () => void, color: string }> = ({ icon, title, desc, onClick, color }) => (
  <button 
    onClick={onClick}
    className={`${color} border-2 rounded-[2.5rem] p-6 text-left flex items-center justify-between transition-all active:scale-95 group shadow-sm`}
  >
    <div className="flex items-center gap-4">
      <div className="p-4 bg-white/50 rounded-2xl shadow-sm">
        {icon}
      </div>
      <div>
        <h4 className="font-black text-sm uppercase leading-none mb-1">{title}</h4>
        <p className="opacity-60 text-[9px] font-bold uppercase tracking-widest">{desc}</p>
      </div>
    </div>
    <ChevronRight className="w-5 h-5 opacity-20 group-hover:translate-x-1 transition-transform" />
  </button>
);

const CategoryCard: React.FC<{ icon: React.ReactNode, title: string, desc: string, onClick: () => void, color: string }> = ({ icon, title, desc, onClick, color }) => (
  <button 
    onClick={onClick}
    className={`${color} border-2 rounded-[2.5rem] p-6 text-left flex items-center justify-between transition-all active:scale-95 group shadow-sm`}
  >
    <div className="flex items-center gap-4">
      <div className="p-4 bg-gray-900 text-yellow-400 rounded-2xl shadow-xl">
        {icon}
      </div>
      <div>
        <h4 className="font-black text-sm uppercase leading-none mb-1 text-gray-900">{title}</h4>
        <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest">{desc}</p>
      </div>
    </div>
    <div className="p-2 bg-gray-50 rounded-xl group-hover:bg-gray-100 transition-colors">
      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
    </div>
  </button>
);

// --- CONVERSOR DE MEDIDAS ---
const MeasurementConverter: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [value, setValue] = useState<string>('1');
  const [fromUnit, setFromUnit] = useState('m');
  const [toUnit, setToUnit] = useState('ft');
  
  const units: Record<string, number> = {
    'mm': 0.001,
    'cm': 0.01,
    'm': 1,
    'km': 1000,
    'in': 0.0254,
    'ft': 0.3048,
    'yd': 0.9144,
    'mi': 1609.34
  };

  const convert = () => {
    const val = parseFloat(value) || 0;
    const inMeters = val * units[fromUnit];
    const result = inMeters / units[toUnit];
    return result.toFixed(4);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-3 bg-gray-100 rounded-2xl"><ArrowLeft className="w-5 h-5" /></button>
        <h3 className="text-xl font-black uppercase tracking-tighter">Conversor</h3>
      </div>

      <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-100 space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-2">Cantidad</label>
          <input 
            type="number" 
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full p-6 bg-gray-50 rounded-3xl border-2 border-transparent focus:border-blue-500 outline-none font-black text-2xl transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-2">De</label>
            <select 
              value={fromUnit}
              onChange={(e) => setFromUnit(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-sm uppercase"
            >
              {Object.keys(units).map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-2">A</label>
            <select 
              value={toUnit}
              onChange={(e) => setToUnit(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-sm uppercase"
            >
              {Object.keys(units).map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-100 text-center">
          <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">Resultado</div>
          <div className="text-4xl font-black text-blue-600">{convert()} <span className="text-sm text-gray-400 uppercase">{toUnit}</span></div>
        </div>
      </div>
    </div>
  );
};

const Step: React.FC<{ num: string, text: string }> = ({ num, text }) => (
  <div className="flex gap-4 items-start">
    <div className="w-8 h-8 shrink-0 bg-gray-900 text-white rounded-full flex items-center justify-center font-black text-xs shadow-lg">{num}</div>
    <p className="text-[11px] text-gray-600 font-bold leading-relaxed pt-1">{text}</p>
  </div>
);

// --- MEDIDOR AR (SIMULADO / INTERACTIVO) ---
const ARMeasureTool: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [points, setPoints] = useState<{ x: number, y: number, angle: { beta: number, gamma: number } }[]>([]);
  const [currentAngle, setCurrentAngle] = useState({ beta: 0, gamma: 0 });
  const [distance, setDistance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (!showIntro) {
      startCamera();
      window.addEventListener('deviceorientation', handleOrientation);
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [showIntro]);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleOrientation = (event: DeviceOrientationEvent) => {
    setCurrentAngle({
      beta: event.beta || 0,
      gamma: event.gamma || 0
    });
  };

  const startCamera = async () => {
    try {
      setError(null);
      
      if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        throw new Error("La cámara requiere una conexión segura (HTTPS).");
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("El navegador no soporta el acceso a la cámara o está bloqueado.");
      }

      const constraints = { 
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false 
      };
      
      let s;
      try {
        s = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        console.warn("Fallo con ideal, intentando básico", e);
        s = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      
      setStream(s);
      streamRef.current = s;
    } catch (err) {
      console.error("Error de cámara:", err);
      setError(`Error de cámara: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleAction = () => {
    if (points.length === 0) {
      // Mark start point
      setPoints([{ x: window.innerWidth / 2, y: window.innerHeight / 2, angle: currentAngle }]);
      setDistance(0);
      // Visual feedback
      if (navigator.vibrate) navigator.vibrate(50);
    } else if (points.length === 1) {
      // Mark end point
      const endPoint = { x: window.innerWidth / 2, y: window.innerHeight / 2, angle: currentAngle };
      const finalDist = calculateDistance(points[0].angle, endPoint.angle);
      setPoints([...points, endPoint]);
      setDistance(finalDist);
      if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
    } else {
      // Reset
      setPoints([]);
      setDistance(null);
    }
  };

  const calculateDistance = (a1: { beta: number, gamma: number }, a2: { beta: number, gamma: number }) => {
    // Heurística: calculamos la diferencia angular y la convertimos a metros
    // Asumimos que el usuario está a una distancia media de 2-3 metros
    const dBeta = Math.abs(a1.beta - a2.beta);
    const dGamma = Math.abs(a1.gamma - a2.gamma);
    const angularDiff = Math.sqrt(dBeta * dBeta + dGamma * dGamma);
    
    // Factor de escala: aprox 0.05 metros por grado de inclinación
    // Esto es una simulación visual para el prototipo
    return angularDiff * 0.085;
  };

  // Dibujar la línea en el canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (points.length > 0) {
        const start = points[0];
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // Dibujar punto inicial
        ctx.beginPath();
        ctx.arc(start.x, start.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24'; // yellow-400
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Dibujar línea elástica
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        
        const isFinished = points.length === 2;
        const targetX = isFinished ? points[1].x : centerX;
        const targetY = isFinished ? points[1].y : centerY;
        
        ctx.lineTo(targetX, targetY);
        
        if (isFinished) {
          ctx.setLineDash([]); 
          ctx.strokeStyle = '#fbbf24'; // Yellow-400 for finished
          ctx.lineWidth = 6;
        } else {
          ctx.setLineDash([]); // Solid line as requested
          ctx.strokeStyle = '#ef4444'; // Red-500 while measuring
          ctx.lineWidth = 4;
        }
        
        ctx.stroke();

        // Dibujar etiqueta de distancia sobre la línea
        if (distance !== null) {
          const midX = (start.x + targetX) / 2;
          const midY = (start.y + targetY) / 2;
          
          ctx.save();
          ctx.translate(midX, midY);
          
          // Fondo de la etiqueta (Pill shape)
          const labelText = `${distance.toFixed(2)} m`;
          ctx.font = 'bold 14px Inter, sans-serif';
          const textWidth = ctx.measureText(labelText).width;
          const padding = 12;
          
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(-(textWidth/2 + padding), -15, textWidth + padding * 2, 30, 15);
          } else {
            ctx.rect(-(textWidth/2 + padding), -15, textWidth + padding * 2, 30);
          }
          ctx.fillStyle = isFinished ? '#fbbf24' : '#ef4444';
          ctx.fill();
          
          // Texto
          ctx.fillStyle = isFinished ? 'black' : 'white';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, 0, 0);
          
          ctx.restore();
        }

        // Si estamos midiendo, actualizar distancia en tiempo real
        if (points.length === 1) {
          const liveDist = calculateDistance(points[0].angle, currentAngle);
          setDistance(liveDist);
        }

        // Dibujar punto final si existe
        if (points.length === 2) {
          ctx.beginPath();
          ctx.arc(points[1].x, points[1].y, 8, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444'; // red-500
          ctx.fill();
          ctx.stroke();
        }
      }

      animationFrame = requestAnimationFrame(draw);
    };

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();

    return () => cancelAnimationFrame(animationFrame);
  }, [points, currentAngle]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col overflow-hidden">
      <AnimatePresence>
        {showIntro && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-gray-900/95 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl space-y-6">
              <div className="text-center">
                <div className="inline-flex p-4 bg-purple-100 rounded-2xl mb-4">
                  <Ruler className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tighter text-gray-900">Medidor AR</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Herramienta de Medición</p>
              </div>

              <div className="space-y-4">
                <Step num="1" text="Apunta al punto de inicio y pulsa 'Marcar Inicio'." />
                <Step num="2" text="Mueve el móvil hacia el punto final. Verás la línea estirarse." />
                <Step num="3" text="Pulsa 'Fijar Punto' para obtener la distancia final en metros." />
              </div>

              <button 
                onClick={() => setShowIntro(false)}
                className="w-full p-5 bg-purple-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-[11px] shadow-lg active:scale-95 transition-all"
              >
                Comenzar Medición
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex-1">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {error && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-8 max-w-xs text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <Camera className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tighter text-gray-900">Error de Cámara</h3>
              <p className="text-sm text-gray-500 font-medium leading-relaxed">{error}</p>
              <button 
                onClick={startCamera}
                className="w-full p-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all"
              >
                Reintentar
              </button>
              <button 
                onClick={onBack}
                className="w-full p-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <canvas 
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* UI OVERLAY */}
        <div className="absolute inset-0 flex flex-col justify-between p-6 pointer-events-none">
          <div className="flex justify-between items-center pointer-events-auto">
            <button onClick={onBack} className="p-4 bg-black/40 backdrop-blur-md rounded-2xl text-white">
              <ArrowLeft />
            </button>
            <div className="flex flex-col items-end gap-2">
              <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl text-white text-[10px] font-black uppercase tracking-widest">
                {points.length === 0 ? 'Busca el punto de inicio' : 
                 points.length === 1 ? 'Mueve el móvil al punto final' : 
                 'Medición completada'}
              </div>
              {/* Level Indicator */}
              <div className="flex gap-1">
                <div className={`w-2 h-2 rounded-full ${Math.abs(currentAngle.beta) < 2 ? 'bg-green-500' : 'bg-white/20'}`} />
                <div className={`w-2 h-2 rounded-full ${Math.abs(currentAngle.gamma) < 2 ? 'bg-green-500' : 'bg-white/20'}`} />
              </div>
            </div>
          </div>

          {/* Crosshair */}
          {points.length < 2 && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 flex items-center justify-center pointer-events-none">
              <div className="w-full h-[1px] bg-white/40 absolute" />
              <div className="h-full w-[1px] bg-white/40 absolute" />
              <div className="w-8 h-8 border border-white/20 rounded-full absolute" />
              <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full shadow-[0_0_15px_rgba(251,191,36,1)]" />
            </div>
          )}

          <div className="space-y-6 pointer-events-auto">
            {/* Panel de Distancia Flotante (Opcional, ya que ahora está en la línea) */}
            {distance !== null && points.length === 2 && (
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-gray-900/90 backdrop-blur-md rounded-[2rem] p-4 shadow-2xl text-center border border-white/10"
              >
                <div className="text-[8px] font-black uppercase text-gray-400 tracking-[0.2em] mb-1">
                  Medición Guardada
                </div>
                <div className="text-3xl font-black text-white">
                  {distance.toFixed(2)} <span className="text-xs text-yellow-400">m</span>
                </div>
              </motion.div>
            )}

            <button 
              onClick={handleAction}
              className={`w-full p-8 rounded-[2.5rem] font-black uppercase tracking-widest text-sm shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4 ${
                points.length === 0 ? 'bg-yellow-400 text-black' : 
                points.length === 1 ? 'bg-red-500 text-white' : 
                'bg-gray-900 text-white'
              }`}
            >
              {points.length === 0 && <><PlusCircle className="w-6 h-6" /> Marcar Inicio</>}
              {points.length === 1 && <><CheckCircle className="w-6 h-6" /> Fijar Punto Final</>}
              {points.length === 2 && <><RefreshCw className="w-6 h-6" /> Nueva Medición</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- ESCANEADO 3D (AVANZADO) ---
const Scan3DTool: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [corners, setCorners] = useState<Point3D[]>([]);
  const [roomHeight, setRoomHeight] = useState(2.5);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);

  // Three.js refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const roomMeshRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    if (!showIntro) {
      startCamera();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [showIntro]);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const startCamera = async () => {
    try {
      setError(null);

      if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        throw new Error("La cámara requiere una conexión segura (HTTPS).");
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("El navegador no soporta el acceso a la cámara o está bloqueado.");
      }

      const constraints = { 
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false 
      };
      
      let s;
      try {
        s = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        console.warn("Fallo con ideal, intentando básico", e);
        s = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      
      setStream(s);
      streamRef.current = s;
    } catch (err) {
      console.error("Error de cámara:", err);
      setError(`Error de cámara: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const markCorner = () => {
    // En una app real usaríamos DeviceOrientationEvent para calcular la posición en el espacio 3D
    // Aquí simulamos una posición basada en la orientación actual (simplificada)
    // Para el prototipo, generamos puntos que formen una habitación lógica
    const lastCorner = corners[corners.length - 1];
    let newCorner: Point3D;
    
    if (corners.length === 0) {
      newCorner = { x: 0, y: 0, z: 0 };
    } else {
      // Simulación: el usuario se mueve y marca el siguiente punto
      // Usamos un desplazamiento aleatorio pero controlado para que parezca real
      const angle = (corners.length * Math.PI) / 2; // Intentamos formar un cuadrado
      const dist = 3 + Math.random();
      newCorner = {
        x: lastCorner.x + Math.cos(angle) * dist,
        y: 0,
        z: lastCorner.z + Math.sin(angle) * dist
      };
    }
    
    setCorners([...corners, newCorner]);
  };

  const finishScan = () => {
    if (corners.length < 3) {
      alert("Marca al menos 3 esquinas para generar el plano.");
      return;
    }
    setShowPreview(true);
  };

  useEffect(() => {
    if (showPreview && canvasRef.current) {
      initThree();
    }
    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [showPreview]);

  const initThree = () => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f4f6);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(canvasRef.current!.clientWidth, canvasRef.current!.clientWidth);
    canvasRef.current!.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Luces
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);

    // Crear geometría de la habitación
    const shape = new THREE.Shape();
    shape.moveTo(corners[0].x, corners[0].z);
    for (let i = 1; i < corners.length; i++) {
      shape.lineTo(corners[i].x, corners[i].z);
    }
    shape.lineTo(corners[0].x, corners[0].z);

    const extrudeSettings = {
      steps: 1,
      depth: roomHeight,
      bevelEnabled: false
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.rotateX(Math.PI / 2); // Orientar correctamente
    
    const material = new THREE.MeshPhongMaterial({ 
      color: 0x3b82f6, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    roomMeshRef.current = mesh;

    // Bordes
    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1e3a8a }));
    scene.add(line);

    // Grid
    const grid = new THREE.GridHelper(20, 20);
    scene.add(grid);

    const animate = () => {
      requestAnimationFrame(animate);
      mesh.rotation.y += 0.005;
      line.rotation.y += 0.005;
      renderer.render(scene, camera);
    };
    animate();
  };

  const exportOBJ = () => {
    if (!roomMeshRef.current) return;
    const exporter = new OBJExporter();
    const result = exporter.parse(roomMeshRef.current);
    downloadFile(result, 'plano_3d_usac.obj', 'text/plain');
  };

  const exportDXF = () => {
    // Generación básica de DXF para AutoCAD
    let dxf = "0\nSECTION\n2\nENTITIES\n";
    for (let i = 0; i < corners.length; i++) {
      const next = (i + 1) % corners.length;
      dxf += `0\nLINE\n8\n0\n10\n${corners[i].x}\n20\n${corners[i].z}\n30\n0\n11\n${corners[next].x}\n21\n${corners[next].z}\n31\n0\n`;
    }
    dxf += "0\nENDSEC\n0\nEOF";
    downloadFile(dxf, 'plano_2d_usac.dxf', 'application/dxf');
  };

  const downloadFile = (content: string, fileName: string, contentType: string) => {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <AnimatePresence>
        {showIntro && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-gray-900/95 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl space-y-6">
              <div className="text-center">
                <div className="inline-flex p-4 bg-blue-100 rounded-2xl mb-4">
                  <Box className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tighter text-gray-900">Escaneado 3D</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Características del Sistema</p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="p-2 bg-gray-50 rounded-lg"><Maximize className="w-4 h-4 text-gray-400" /></div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-gray-900">Modelado 3D</h4>
                    <p className="text-[9px] text-gray-500 font-medium">Generación automática de volúmenes a partir de puntos.</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="p-2 bg-gray-50 rounded-lg"><FileCode className="w-4 h-4 text-gray-400" /></div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-gray-900">Exportación CAD</h4>
                    <p className="text-[9px] text-gray-500 font-medium">Formatos compatibles con SketchUp (.OBJ) y AutoCAD (.DXF).</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="p-2 bg-gray-50 rounded-lg"><Home className="w-4 h-4 text-gray-400" /></div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-gray-900">Medición USAC</h4>
                    <p className="text-[9px] text-gray-500 font-medium">Ideal para levantamiento de planos de dependencias militares.</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <button 
                  onClick={() => setShowInstructions(true)}
                  className="w-full p-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Calculator className="w-4 h-4" /> Instrucciones de uso
                </button>
                <button 
                  onClick={() => setShowIntro(false)}
                  className="w-full p-5 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-[11px] shadow-lg shadow-blue-200 active:scale-95 transition-all"
                >
                  Aceptar y Comenzar
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {showInstructions && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 z-[70] bg-white flex flex-col p-8"
          >
            <div className="flex-1 space-y-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-xl text-blue-600"><Info className="w-6 h-6" /></div>
                <h3 className="text-xl font-black uppercase tracking-tighter">Guía de Escaneado</h3>
              </div>

              <div className="space-y-6">
                <Step num="1" text="Sitúate en el centro de la habitación y apunta a la primera esquina." />
                <Step num="2" text="Pulsa 'Marcar Esquina' en cada vértice de la planta de la habitación." />
                <Step num="3" text="Una vez marcadas todas (mínimo 3), pulsa 'Generar Plano 3D'." />
                <Step num="4" text="Ajusta la altura y exporta el archivo para tu software de diseño." />
              </div>

              <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100">
                <p className="text-[10px] text-blue-800 font-bold leading-relaxed">
                  <span className="uppercase tracking-widest block mb-1">Consejo:</span>
                  Para mejores resultados, realiza el escaneado en sentido de las agujas del reloj y asegúrate de que haya buena iluminación.
                </p>
              </div>
            </div>

            <button 
              onClick={() => setShowInstructions(false)}
              className="w-full p-6 bg-gray-900 text-white rounded-[2rem] font-black uppercase tracking-widest text-[10px] shadow-2xl active:scale-95 transition-all"
            >
              Entendido, Volver
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {!showPreview ? (
        <div className="relative flex-1 overflow-hidden">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-gray-900">
              <Camera className="w-12 h-12 text-gray-600 mb-4" />
              <p className="text-white font-bold uppercase text-[10px] mb-6 leading-relaxed max-w-[200px]">{error}</p>
              <button 
                onClick={startCamera}
                className="px-8 py-4 bg-yellow-400 text-black rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all"
              >
                Reintentar Cámara
              </button>
            </div>
          ) : (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              onLoadedMetadata={() => videoRef.current?.play()}
              className="absolute inset-0 w-full h-full object-cover opacity-60" 
            />
          )}
          
          {/* AR UI */}
          <div className="absolute inset-0 flex flex-col justify-between p-6 pointer-events-none">
            <div className="flex justify-between items-center pointer-events-auto">
              <button onClick={onBack} className="p-4 bg-black/40 backdrop-blur-md rounded-2xl text-white">
                <ArrowLeft />
              </button>
              <div className="bg-yellow-400 px-4 py-2 rounded-xl text-black text-[10px] font-black uppercase tracking-widest shadow-lg">
                Escáner Pro USAC
              </div>
            </div>

            {/* Retícula de puntería */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
               <div className="w-12 h-12 border-2 border-white/30 rounded-full flex items-center justify-center">
                 <div className="w-1 h-1 bg-yellow-400 rounded-full" />
               </div>
               <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-black text-yellow-400 uppercase tracking-widest bg-black/40 px-2 py-1 rounded">
                 Apunta a la esquina
               </div>
            </div>

            <div className="space-y-4 pointer-events-auto">
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {corners.map((c, i) => (
                  <div key={i} className="shrink-0 bg-white/10 backdrop-blur-md px-3 py-2 rounded-xl border border-white/20 text-[8px] font-black text-white uppercase">
                    Punto {i + 1}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={markCorner}
                  className="p-6 bg-white text-black rounded-[2rem] font-black uppercase tracking-widest text-[10px] shadow-2xl flex items-center justify-center gap-2 active:scale-95"
                >
                  <PlusCircle className="w-5 h-5" /> Marcar Esquina
                </button>
                <button 
                  onClick={finishScan}
                  disabled={corners.length < 3}
                  className="p-6 bg-yellow-400 text-black rounded-[2rem] font-black uppercase tracking-widest text-[10px] shadow-2xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className="w-5 h-5" /> Generar Plano
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-gray-50 flex flex-col p-6 overflow-y-auto scrollbar-hide">
          <div className="flex justify-between items-center mb-8">
            <button onClick={() => setShowPreview(false)} className="p-4 bg-white rounded-2xl shadow-sm"><ArrowLeft /></button>
            <h3 className="text-xl font-black uppercase tracking-tighter">Vista Previa 3D</h3>
          </div>

          <div ref={canvasRef} className="w-full aspect-square bg-white rounded-[3rem] shadow-2xl border border-gray-100 overflow-hidden mb-8" />

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Altura de Techo</span>
                <span className="text-sm font-black">{roomHeight}m</span>
              </div>
              <input 
                type="range" 
                min="2" 
                max="5" 
                step="0.1" 
                value={roomHeight} 
                onChange={(e) => setRoomHeight(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-yellow-400"
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={exportOBJ}
                className="w-full p-6 bg-blue-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-[10px] shadow-xl flex items-center justify-center gap-3 active:scale-95"
              >
                <Box className="w-5 h-5" /> Exportar SketchUp (.OBJ)
              </button>
              <button 
                onClick={exportDXF}
                className="w-full p-6 bg-gray-900 text-white rounded-[2rem] font-black uppercase tracking-widest text-[10px] shadow-xl flex items-center justify-center gap-3 active:scale-95"
              >
                <FileSpreadsheet className="w-5 h-5" /> Exportar AutoCAD (.DXF)
              </button>
            </div>

            <button 
              onClick={() => { setCorners([]); setShowPreview(false); }}
              className="w-full p-6 bg-red-50 text-red-600 rounded-[2rem] font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 active:scale-95"
            >
              <Trash2 className="w-5 h-5" /> Descartar y Repetir
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- NIVEL DE BURBUJA ---
const LevelTool: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [orientation, setOrientation] = useState({ beta: 0, gamma: 0 });
  const [isLevel, setIsLevel] = useState(false);

  useEffect(() => {
    let lastUpdate = Date.now();
    const smoothingFactor = 0.15; // Adjust for more/less smoothing

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const now = Date.now();
      if (now - lastUpdate < 16) return; // Limit updates to ~60fps
      lastUpdate = now;

      const targetBeta = event.beta || 0; 
      const targetGamma = event.gamma || 0; 
      
      setOrientation(prev => ({
        beta: prev.beta + (targetBeta - prev.beta) * smoothingFactor,
        gamma: prev.gamma + (targetGamma - prev.gamma) * smoothingFactor
      }));
      
      // Check for leveling using the smoothed values for better stability
      const isFlat = Math.abs(orientation.beta) < 1.2 && Math.abs(orientation.gamma) < 1.2;
      const isVerticalPortrait = Math.abs(orientation.gamma) < 1.2 && (Math.abs(orientation.beta) > 88.8 && Math.abs(orientation.beta) < 91.2);
      const isVerticalLandscape = Math.abs(orientation.beta) < 1.2 && (Math.abs(orientation.gamma) > 88.8 && Math.abs(orientation.gamma) < 91.2);

      const currentlyLevel = isFlat || isVerticalPortrait || isVerticalLandscape;

      if (currentlyLevel) {
        if (!isLevel) {
          setIsLevel(true);
          if (navigator.vibrate) navigator.vibrate(80);
        }
      } else {
        setIsLevel(false);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [isLevel]);

  // Calculate bubble positions
  const bubbleX = Math.max(-100, Math.min(100, orientation.gamma * 5));
  const bubbleY = Math.max(-100, Math.min(100, orientation.beta * 5));
  
  // Linear vials positions (clamped to -100 to 100 range for the UI)
  const linearHX = Math.max(-80, Math.min(80, orientation.gamma * 2));
  const linearVY = Math.max(-80, Math.min(80, (orientation.beta - 90) * 2));

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 pb-10">
      <div className="flex items-center gap-4 mb-4">
        <button onClick={onBack} className="p-3 bg-gray-100 rounded-2xl active:scale-90 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="text-xl font-black uppercase tracking-tighter">Nivel Multi-Eje</h3>
          <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Precisión USAC 360°</p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-[3rem] p-8 shadow-2xl border border-gray-800 relative overflow-hidden flex flex-col items-center">
        {/* Background Grid */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(circle, #4ade80 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        
        {/* Horizontal Vial (Top) */}
        <div className="w-48 h-8 bg-gray-800 rounded-full border border-gray-700 mb-8 relative flex items-center justify-center overflow-hidden">
          <div className="absolute inset-y-0 w-[1px] bg-gray-600 left-1/2" />
          <div className="absolute inset-y-0 w-10 border-x border-gray-600 left-1/2 -translate-x-1/2" />
          <motion.div 
            animate={{ x: linearHX }}
            transition={{ type: 'spring', damping: 40, stiffness: 80 }}
            className={`w-6 h-6 rounded-full shadow-lg ${Math.abs(orientation.gamma) < 1.2 ? 'bg-green-400' : 'bg-yellow-400'}`}
          />
        </div>

        <div className="flex items-center gap-8">
          {/* Main Bullseye Level */}
          <div className="relative flex flex-col items-center justify-center">
            <div className="w-48 h-48 rounded-full border-4 border-gray-800 flex items-center justify-center relative">
              <div className="absolute w-full h-[1px] bg-gray-800" />
              <div className="absolute h-full w-[1px] bg-gray-800" />
              <div className="absolute w-24 h-24 rounded-full border-2 border-gray-800" />
              <div className="absolute w-8 h-8 rounded-full border-2 border-gray-800" />

              <motion.div 
                animate={{ x: bubbleX, y: bubbleY }}
                transition={{ type: 'spring', damping: 40, stiffness: 80 }}
                className={`w-8 h-8 rounded-full shadow-2xl flex items-center justify-center transition-colors duration-300 ${isLevel ? 'bg-green-400' : 'bg-yellow-400'}`}
              >
                <div className="w-2 h-2 bg-white/40 rounded-full blur-[1px] -mt-1 -ml-1" />
              </motion.div>
            </div>
          </div>

          {/* Vertical Vial (Side) */}
          <div className="w-8 h-48 bg-gray-800 rounded-full border border-gray-700 relative flex flex-col items-center justify-center overflow-hidden">
            <div className="absolute inset-x-0 h-[1px] bg-gray-600 top-1/2" />
            <div className="absolute inset-x-0 h-10 border-y border-gray-600 top-1/2 -translate-y-1/2" />
            <motion.div 
              animate={{ y: linearVY }}
              transition={{ type: 'spring', damping: 40, stiffness: 80 }}
              className={`w-6 h-6 rounded-full shadow-lg ${Math.abs(orientation.beta - 90) < 1.2 ? 'bg-green-400' : 'bg-yellow-400'}`}
            />
          </div>
        </div>

        {/* Digital Readout */}
        <div className="mt-10 grid grid-cols-2 gap-8 w-full">
          <div className="text-center">
            <div className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">Inclinación (X)</div>
            <div className={`text-2xl font-black font-mono transition-colors ${Math.abs(orientation.beta) < 1 || Math.abs(Math.abs(orientation.beta) - 90) < 1 ? 'text-green-400' : 'text-white'}`}>
              {orientation.beta.toFixed(1)}°
            </div>
          </div>
          <div className="text-center">
            <div className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">Rotación (Y)</div>
            <div className={`text-2xl font-black font-mono transition-colors ${Math.abs(orientation.gamma) < 1 || Math.abs(Math.abs(orientation.gamma) - 90) < 1 ? 'text-green-400' : 'text-white'}`}>
              {orientation.gamma.toFixed(1)}°
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="mt-8 flex justify-center">
          <div className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border transition-all ${isLevel ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
            {isLevel ? 'Nivel Correcto' : 'Ajustando...'}
          </div>
        </div>
      </div>

      <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 flex gap-4">
        <Smartphone className="w-8 h-8 text-amber-500 shrink-0" />
        <div className="space-y-1">
          <p className="text-[9px] font-black text-amber-900 uppercase">Instrucciones de Nivelado:</p>
          <p className="text-[8px] font-bold text-amber-800 uppercase leading-relaxed tracking-tight">
            • <span className="text-amber-900">Plano:</span> Usa el círculo central.<br/>
            • <span className="text-amber-900">Vertical/Horizontal:</span> Usa los tubos superior y lateral apoyando el canto del móvil.
          </p>
        </div>
      </div>
    </div>
  );
};

// --- DISEÑADOR DE CUADROS ELÉCTRICOS ---
interface Appliance {
  id: string;
  name: string;
  type: 'lighting' | 'socket' | 'oven' | 'washing' | 'dishwasher' | 'heater' | 'ac' | 'special';
  power?: number; // Watts
}

interface Room {
  id: string;
  name: string;
  appliances: Appliance[];
}

interface Circuit {
  id: string;
  code: string;
  label: string;
  amps: number;
  cable: string;
  appliances: string[];
  idGroup: number; // Which differential it belongs to
}

const DINModule: React.FC<{ 
  type: 'IGA' | 'PCS' | 'ID' | 'PIA', 
  label: string, 
  amps?: number, 
  color?: string,
  width?: string 
}> = ({ type, label, amps, color = 'bg-gray-200', width = 'w-16' }) => (
  <div className={`${width} h-32 ${color} rounded-md border-x-2 border-gray-400 shadow-md flex flex-col items-center py-2 relative shrink-0`}>
    <div className="w-full h-1 bg-gray-400 absolute top-4" />
    <div className="w-full h-1 bg-gray-400 absolute bottom-4" />
    
    <div className="text-[7px] font-black uppercase text-gray-600 mb-1">{type}</div>
    <div className="bg-white/50 px-1 rounded text-[6px] font-bold mb-2 truncate w-full text-center">{label}</div>
    
    {/* Switch */}
    <div className="w-4 h-10 bg-gray-300 rounded border border-gray-400 flex flex-col items-center justify-between p-1 shadow-inner my-1">
      <div className="w-full h-4 bg-gray-400 rounded-sm" />
      <div className="w-full h-1 bg-red-500 rounded-full" />
    </div>

    {amps && (
      <div className="mt-auto text-[10px] font-black font-mono text-gray-800">
        {type === 'ID' ? '40A/30mA' : `${amps}A`}
      </div>
    )}
    
    {/* Status Indicator */}
    <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-green-500 border border-white/50" />
  </div>
);

interface BudgetItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

const ElectricalPanelDesigner: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [step, setStep] = useState<'input' | 'result'>('input');
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [showCustomAppliance, setShowCustomAppliance] = useState(false);
  const [customAppName, setCustomAppName] = useState('');
  const [budget, setBudget] = useState<BudgetItem[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedDesigns, setSavedDesigns] = useState<any[]>([]);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [projectName, setProjectName] = useState('Mi Proyecto Eléctrico');
  
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (auth.currentUser) {
      fetchSavedDesigns();
    }
  }, []);

  const saveToFirestore = async () => {
    if (!auth.currentUser) {
      const provider = new GoogleAuthProvider();
      try {
        await signInWithPopup(auth, provider);
      } catch (error) {
        console.error("Error logging in:", error);
        return;
      }
    }

    setIsSaving(true);
    try {
      const designData = {
        userId: auth.currentUser?.uid,
        name: projectName,
        rooms,
        circuits,
        budget,
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'electrical_designs'), designData);
      alert("Proyecto guardado correctamente en la nube.");
      fetchSavedDesigns();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'electrical_designs');
    } finally {
      setIsSaving(false);
    }
  };

  const fetchSavedDesigns = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(
        collection(db, 'electrical_designs'), 
        where('userId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const designs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSavedDesigns(designs);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'electrical_designs');
    }
  };

  const loadDesign = (design: any) => {
    setRooms(design.rooms);
    setCircuits(design.circuits || []);
    setBudget(design.budget || []);
    setProjectName(design.name);
    setStep('input');
    setShowSavedModal(false);
  };

  const deleteDesign = async (id: string) => {
    if (!confirm("¿Seguro que quieres borrar este proyecto?")) return;
    try {
      await deleteDoc(doc(db, 'electrical_designs', id));
      fetchSavedDesigns();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'electrical_designs');
    }
  };

  const exportToJSON = () => {
    const data = {
      name: projectName,
      rooms,
      circuits,
      budget,
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName.replace(/\s+/g, '_')}_export.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importFromJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.rooms) {
          setRooms(data.rooms);
          setCircuits(data.circuits || []);
          setBudget(data.budget || []);
          setProjectName(data.name || 'Proyecto Importado');
          alert("Proyecto importado con éxito.");
        }
      } catch (error) {
        alert("Error al importar el archivo. Formato no válido.");
      }
    };
    reader.readAsText(file);
  };
  
  // Default rooms and appliances
  const defaultRooms: Room[] = [
    {
      id: 'def-salon',
      name: 'Salón',
      appliances: [
        { id: 's1', name: 'Punto de Luz', type: 'lighting' },
        { id: 's2', name: 'Toma de Corriente', type: 'socket' },
        { id: 's3', name: 'Toma de Corriente', type: 'socket' },
        { id: 's4', name: 'Aire Acondicionado', type: 'ac' }
      ]
    },
    {
      id: 'def-cocina',
      name: 'Cocina',
      appliances: [
        { id: 'k1', name: 'Punto de Luz', type: 'lighting' },
        { id: 'k2', name: 'Cocina/Horno', type: 'oven' },
        { id: 'k3', name: 'Lavadora', type: 'washing' },
        { id: 'k4', name: 'Lavavajillas', type: 'dishwasher' },
        { id: 'k5', name: 'Toma de Corriente', type: 'socket' },
        { id: 'k6', name: 'Toma de Corriente', type: 'socket' }
      ]
    },
    {
      id: 'def-bano',
      name: 'Baño',
      appliances: [
        { id: 'b1', name: 'Punto de Luz', type: 'lighting' },
        { id: 'b2', name: 'Toma de Corriente', type: 'socket' },
        { id: 'b3', name: 'Termo Eléctrico', type: 'heater' }
      ]
    }
  ];

  const [rooms, setRooms] = useState<Room[]>(defaultRooms);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(defaultRooms[0].id);
  const [circuits, setCircuits] = useState<Circuit[]>([]);

  const addRoom = () => {
    if (newRoomName.trim()) {
      const newRoom: Room = { id: crypto.randomUUID(), name: newRoomName, appliances: [] };
      setRooms([...rooms, newRoom]);
      setActiveRoomId(newRoom.id);
      setNewRoomName('');
      setShowRoomModal(false);
    }
  };

  const handleAddCustomAppliance = () => {
    if (customAppName.trim() && activeRoomId) {
      const lower = customAppName.toLowerCase();
      let type: Appliance['type'] = 'socket';
      if (lower.includes('luz') || lower.includes('lampara')) type = 'lighting';
      else if (lower.includes('horno') || lower.includes('vitro')) type = 'oven';
      else if (lower.includes('lavadora')) type = 'washing';
      else if (lower.includes('lavavajillas')) type = 'dishwasher';
      else if (lower.includes('termo') || lower.includes('calentador')) type = 'heater';
      else if (lower.includes('aire') || lower.includes('ac')) type = 'ac';
      else if (lower.includes('coche') || lower.includes('piscina') || lower.includes('depuradora')) type = 'special';
      
      addAppliance(activeRoomId, type, customAppName);
      setCustomAppName('');
      setShowCustomAppliance(false);
    }
  };

  const addAppliance = (roomId: string, type: Appliance['type'], name: string) => {
    setRooms(rooms.map(r => {
      if (r.id === roomId) {
        return {
          ...r,
          appliances: [...r.appliances, { id: crypto.randomUUID(), type, name }]
        };
      }
      return r;
    }));
  };

  const removeAppliance = (roomId: string, applianceId: string) => {
    setRooms(rooms.map(r => {
      if (r.id === roomId) {
        return {
          ...r,
          appliances: r.appliances.filter(a => a.id !== applianceId)
        };
      }
      return r;
    }));
  };

  const removeRoom = (id: string) => {
    setRooms(rooms.filter(r => r.id !== id));
    if (activeRoomId === id) setActiveRoomId(null);
  };

  const getRecommendations = (roomName: string): { label: string, type: Appliance['type'], name: string }[] => {
    const name = roomName.toLowerCase();
    const common = [
      { label: 'Punto de Luz', type: 'lighting' as const, name: 'Punto de Luz' },
      { label: 'Enchufe', type: 'socket' as const, name: 'Toma de Corriente' },
    ];

    if (name.includes('cocina')) {
      return [
        ...common,
        { label: 'Horno/Vitro', type: 'oven', name: 'Cocina/Horno' },
        { label: 'Lavadora', type: 'washing', name: 'Lavadora' },
        { label: 'Lavavajillas', type: 'dishwasher', name: 'Lavavajillas' },
        { label: 'Nevera', type: 'socket', name: 'Nevera' },
        { label: 'Microondas', type: 'socket', name: 'Microondas' },
      ];
    }
    if (name.includes('baño') || name.includes('aseo')) {
      return [
        ...common,
        { label: 'Termo Eléctrico', type: 'heater', name: 'Termo Eléctrico' },
        { label: 'Enchufe Espejo', type: 'socket', name: 'Toma Espejo' },
        { label: 'Extractor', type: 'lighting', name: 'Extractor' },
      ];
    }
    if (name.includes('salón') || name.includes('comedor') || name.includes('estar')) {
      return [
        ...common,
        { label: 'Aire Acondicionado', type: 'ac', name: 'Aire Acondicionado' },
        { label: 'Televisión', type: 'socket', name: 'Televisión' },
        { label: 'Home Cinema', type: 'socket', name: 'Home Cinema' },
      ];
    }
    if (name.includes('dormitorio') || name.includes('habitación')) {
      return [
        ...common,
        { label: 'Aire Acondicionado', type: 'ac', name: 'Aire Acondicionado' },
        { label: 'Enchufe Mesita', type: 'socket', name: 'Toma Mesita' },
      ];
    }
    if (name.includes('garaje') || name.includes('cochera')) {
      return [
        ...common,
        { label: 'Cargador Coche Eléctrico', type: 'special', name: 'Cargador Vehículo Eléctrico' },
        { label: 'Puerta Automática', type: 'socket', name: 'Motor Puerta' },
      ];
    }
    if (name.includes('piscina') || name.includes('jardín') || name.includes('exterior')) {
      return [
        ...common,
        { label: 'Bomba Piscina', type: 'special', name: 'Bomba de Piscina' },
        { label: 'Depuradora', type: 'special', name: 'Depuradora' },
        { label: 'Focos Piscina', type: 'lighting', name: 'Iluminación Exterior' },
      ];
    }
    return [
      ...common,
      { label: 'Aire Acondicionado', type: 'ac', name: 'Aire Acondicionado' },
    ];
  };

  const generateDesign = () => {
    if (rooms.length === 0) {
      alert("Añade al menos una habitación.");
      return;
    }

    const newCircuits: Circuit[] = [];
    const allAppliances = rooms.flatMap(r => r.appliances.map(a => ({ ...a, roomName: r.name })));

    // C1: Lighting
    const lighting = allAppliances.filter(a => a.type === 'lighting');
    if (lighting.length > 0) {
      newCircuits.push({
        id: 'c1', code: 'C1', label: 'Alumbrado', amps: 10, cable: '1.5 mm²', idGroup: 0,
        appliances: lighting.map(a => `${a.name} (${a.roomName})`)
      });
    }

    // C2: General Sockets
    const sockets = allAppliances.filter(a => a.type === 'socket' && !['Cocina', 'Baño'].includes(a.roomName));
    if (sockets.length > 0) {
      newCircuits.push({
        id: 'c2', code: 'C2', label: 'Tomas Generales', amps: 16, cable: '2.5 mm²', idGroup: 0,
        appliances: sockets.map(a => `${a.name} (${a.roomName})`)
      });
    }

    // C5: Wet area sockets (Kitchen/Bath)
    const wetSockets = allAppliances.filter(a => a.type === 'socket' && ['Cocina', 'Baño'].includes(a.roomName));
    if (wetSockets.length > 0) {
      newCircuits.push({
        id: 'c5', code: 'C5', label: 'Baños y Cocina', amps: 16, cable: '2.5 mm²', idGroup: 0,
        appliances: wetSockets.map(a => `${a.name} (${a.roomName})`)
      });
    }

    // C3: Oven/Cooker
    const ovens = allAppliances.filter(a => a.type === 'oven');
    ovens.forEach((o, i) => {
      newCircuits.push({
        id: `c3-${i}`, code: 'C3', label: 'Cocina y Horno', amps: 25, cable: '6 mm²', idGroup: 0,
        appliances: [`${o.name} (${o.roomName})`]
      });
    });

    // C4: Large Appliances
    const c4Items = allAppliances.filter(a => ['washing', 'dishwasher', 'heater'].includes(a.type));
    c4Items.forEach((item, i) => {
      newCircuits.push({
        id: `c4-${i}`, code: 'C4', 
        label: item.type === 'washing' ? 'Lavadora' : item.type === 'dishwasher' ? 'Lavavajillas' : 'Termo Eléctrico',
        amps: 20, cable: '4 mm²', idGroup: 0,
        appliances: [`${item.name} (${item.roomName})`]
      });
    });

    // C12: AC
    const acs = allAppliances.filter(a => a.type === 'ac');
    acs.forEach((ac, i) => {
      newCircuits.push({
        id: `c12-${i}`, code: 'C12', label: 'Aire Acondic.', amps: 25, cable: '6 mm²', idGroup: 0,
        appliances: [`${ac.name} (${ac.roomName})`]
      });
    });

    // C13: EV Charger (REBT ITC-BT-52)
    const evChargers = allAppliances.filter(a => a.name.toLowerCase().includes('coche') || a.name.toLowerCase().includes('vehículo eléctrico'));
    evChargers.forEach((ev, i) => {
      newCircuits.push({
        id: `c13-${i}`, code: 'C13', label: 'Vehículo Eléctrico', amps: 32, cable: '10 mm²', idGroup: 0,
        appliances: [`${ev.name} (${ev.roomName})`]
      });
    });

    // C14: Pool / Garden
    const poolItems = allAppliances.filter(a => a.name.toLowerCase().includes('piscina') || a.name.toLowerCase().includes('depuradora'));
    if (poolItems.length > 0) {
      newCircuits.push({
        id: 'c14', code: 'C14', label: 'Piscina / Exterior', amps: 16, cable: '2.5 mm²', idGroup: 0,
        appliances: poolItems.map(a => `${a.name} (${a.roomName})`)
      });
    }

    // Assign groups (Max 5 PIAs per Differential)
    let currentGroup = 1;
    newCircuits.forEach((c, i) => {
      c.idGroup = Math.floor(i / 5) + 1;
    });

    setCircuits(newCircuits);
    
    // Generate initial budget
    const initialBudget: BudgetItem[] = [
      { id: 'b-iga', name: 'IGA 40A 2P', quantity: 1, price: 28.50 },
      { id: 'b-pcs', name: 'Protector Sobretensiones (PCS)', quantity: 1, price: 85.00 },
    ];

    const diffCount = [...new Set(newCircuits.map(c => c.idGroup))].length;
    initialBudget.push({ id: 'b-id', name: 'Diferencial 40A/30mA Clase AC', quantity: diffCount, price: 35.00 * diffCount });

    newCircuits.forEach(c => {
      let price = 12.00;
      if (c.amps >= 25) price = 18.00;
      initialBudget.push({ id: `b-${c.id}`, name: `PIA ${c.amps}A (${c.code})`, quantity: 1, price });
    });

    initialBudget.push({ id: 'b-box', name: 'Cuadro Eléctrico Empotrar 24 Módulos', quantity: 1, price: 45.00 });
    
    setBudget(initialBudget);
    setStep('result');
  };

  const exportToPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('Memoria_Tecnica_Cuadro_USAC.pdf');
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const updateBudgetItem = (id: string, field: keyof BudgetItem, value: any) => {
    setBudget(budget.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const removeBudgetItem = (id: string) => {
    setBudget(budget.filter(item => item.id !== id));
  };

  const addBudgetItem = () => {
    const name = prompt("Nombre del material:");
    if (name) {
      setBudget([...budget, { id: crypto.randomUUID(), name, quantity: 1, price: 0 }]);
    }
  };

  const activeRoom = rooms.find(r => r.id === activeRoomId);

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 pb-10">
      <div className="flex items-center gap-4 mb-4">
        <button onClick={step === 'result' ? () => setStep('input') : onBack} className="p-3 bg-gray-100 rounded-2xl active:scale-90 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <input 
            type="text" 
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-xl font-black uppercase tracking-tighter p-0 w-full"
          />
          <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">
            {step === 'input' ? 'Ingeniería de Instalaciones' : 'Cumplimiento REBT 2026'}
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              if (auth.currentUser) {
                fetchSavedDesigns();
                setShowSavedModal(true);
              } else {
                saveToFirestore(); // This will trigger login
              }
            }}
            className="p-3 bg-white border border-gray-100 rounded-2xl shadow-sm active:scale-90 transition-all flex items-center gap-2"
          >
            <FolderOpen className="w-4 h-4 text-blue-500" />
            <span className="text-[10px] font-black uppercase hidden sm:inline">Proyectos</span>
          </button>
          <label className="p-3 bg-white border border-gray-100 rounded-2xl shadow-sm active:scale-90 transition-all flex items-center gap-2 cursor-pointer">
            <FileUp className="w-4 h-4 text-green-500" />
            <span className="text-[10px] font-black uppercase hidden sm:inline">Importar</span>
            <input type="file" accept=".json" onChange={importFromJSON} className="hidden" />
          </label>
        </div>
      </div>

      {showSavedModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl max-h-[80vh] flex flex-col"
          >
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-xl font-black uppercase">Mis Proyectos Guardados</h4>
              <button onClick={() => setShowSavedModal(false)} className="p-2 bg-gray-100 rounded-full"><ArrowLeft className="w-4 h-4" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {savedDesigns.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-gray-100 rounded-3xl">
                  <p className="text-[10px] font-black text-gray-300 uppercase">No tienes proyectos guardados en la nube</p>
                </div>
              ) : (
                savedDesigns.map((design) => (
                  <div key={design.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex justify-between items-center group hover:border-blue-200 transition-all">
                    <div>
                      <p className="font-black uppercase text-gray-900 text-xs">{design.name}</p>
                      <p className="text-[8px] font-bold text-gray-400 uppercase">
                        {design.createdAt?.toDate ? design.createdAt.toDate().toLocaleDateString() : 'Reciente'} • {design.rooms?.length || 0} Estancias
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => loadDesign(design)}
                        className="p-2 bg-blue-500 text-white rounded-xl font-black uppercase text-[8px] px-4"
                      >
                        Cargar
                      </button>
                      <button 
                        onClick={() => deleteDesign(design.id)}
                        className="p-2 bg-red-100 text-red-500 rounded-xl"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}

      {step === 'input' ? (
        <div className="space-y-6">
          {/* Room Selector */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {rooms.map(room => (
              <button 
                key={room.id}
                onClick={() => setActiveRoomId(room.id)}
                className={`shrink-0 px-6 py-3 rounded-2xl font-black uppercase text-[10px] transition-all border-2 ${activeRoomId === room.id ? 'bg-gray-900 text-yellow-400 border-gray-900' : 'bg-white text-gray-400 border-gray-100'}`}
              >
                {room.name}
              </button>
            ))}
            <button 
              onClick={() => setShowRoomModal(true)}
              className="shrink-0 px-4 py-3 bg-yellow-400 text-black rounded-2xl font-black uppercase text-[10px] flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" /> Nueva
            </button>
          </div>

          {/* Room Modal */}
          {showRoomModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl"
              >
                <h4 className="text-xl font-black uppercase mb-6">Nueva Estancia</h4>
                <input 
                  autoFocus
                  type="text" 
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Ej: Terraza, Garaje..."
                  className="w-full p-4 bg-gray-100 rounded-2xl border-none focus:ring-2 focus:ring-yellow-400 font-bold mb-6"
                  onKeyDown={(e) => e.key === 'Enter' && addRoom()}
                />
                <div className="flex gap-3">
                  <button onClick={() => setShowRoomModal(false)} className="flex-1 p-4 bg-gray-100 rounded-2xl font-black uppercase text-[10px]">Cancelar</button>
                  <button onClick={addRoom} className="flex-1 p-4 bg-yellow-400 rounded-2xl font-black uppercase text-[10px]">Añadir</button>
                </div>
              </motion.div>
            </div>
          )}

          {activeRoom ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-gray-100"
            >
              <div className="flex justify-between items-center mb-6">
                <h4 className="font-black uppercase text-gray-900">{activeRoom.name}</h4>
                <button onClick={() => removeRoom(activeRoom.id)} className="text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
              </div>

              <div className="space-y-3 mb-8">
                {activeRoom.appliances.map(app => (
                  <div key={app.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-xl shadow-sm">
                        {app.type === 'lighting' ? <Zap className="w-3 h-3 text-yellow-500" /> : <Smartphone className="w-3 h-3 text-blue-500" />}
                      </div>
                      <span className="text-[10px] font-black uppercase text-gray-700">{app.name}</span>
                    </div>
                    <button onClick={() => removeAppliance(activeRoom.id, app.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-2">¿Qué vas a poner en esta dependencia?</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {getRecommendations(activeRoom.name).map((rec, idx) => (
                      <button 
                        key={idx}
                        onClick={() => addAppliance(activeRoom.id, rec.type, rec.name)}
                        className="p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-gray-100 transition-all flex flex-col items-center gap-2 group active:scale-95"
                      >
                        <div className="p-2 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                          {rec.type === 'lighting' ? <Zap className="w-4 h-4 text-yellow-500" /> : 
                           rec.type === 'socket' ? <Smartphone className="w-4 h-4 text-blue-500" /> :
                           rec.type === 'oven' ? <Flame className="w-4 h-4 text-orange-500" /> :
                           rec.type === 'ac' ? <Zap className="w-4 h-4 text-cyan-500" /> :
                           <RefreshCw className="w-4 h-4 text-purple-500" />}
                        </div>
                        <span className="text-[9px] font-black uppercase text-gray-600 text-center">{rec.label}</span>
                      </button>
                    ))}
                    
                    <button 
                      onClick={() => setShowCustomAppliance(true)}
                      className="p-4 bg-yellow-50 rounded-2xl border border-yellow-100 hover:bg-yellow-100 transition-all flex flex-col items-center gap-2 active:scale-95"
                    >
                      <div className="p-2 bg-white rounded-xl shadow-sm text-yellow-600"><PlusCircle className="w-4 h-4" /></div>
                      <span className="text-[9px] font-black uppercase text-yellow-700">Otro equipo</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Custom Appliance Modal */}
              {showCustomAppliance && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl"
                  >
                    <h4 className="text-xl font-black uppercase mb-2">¿Qué vas a poner?</h4>
                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-6">Escribe el nombre del equipo</p>
                    <input 
                      autoFocus
                      type="text" 
                      value={customAppName}
                      onChange={(e) => setCustomAppName(e.target.value)}
                      placeholder="Ej: Televisión, Secadora, Nevera..."
                      className="w-full p-4 bg-gray-100 rounded-2xl border-none focus:ring-2 focus:ring-yellow-400 font-bold mb-6"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCustomAppliance()}
                    />
                    <div className="flex gap-3">
                      <button onClick={() => setShowCustomAppliance(false)} className="flex-1 p-4 bg-gray-100 rounded-2xl font-black uppercase text-[10px]">Cancelar</button>
                      <button onClick={handleAddCustomAppliance} className="flex-1 p-4 bg-yellow-400 rounded-2xl font-black uppercase text-[10px]">Añadir</button>
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-gray-100">
              <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Selecciona una estancia</p>
            </div>
          )}

          <button 
            onClick={generateDesign}
            className="w-full p-6 bg-gray-900 text-yellow-400 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl flex items-center justify-center gap-4 active:scale-95 transition-all"
          >
            <RefreshCw className="w-5 h-5" /> Generar Esquema Técnico
          </button>
        </div>
      ) : (
        <div className="space-y-8" ref={reportRef}>
          {/* Single-line Diagram (Unifilar) */}
          <section className="space-y-4">
            <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-2">Esquema Unifilar Técnico</h4>
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-100 overflow-x-auto">
              <div className="min-w-[800px] p-4">
                <svg width="100%" height="300" viewBox="0 0 800 300" className="overflow-visible">
                  {/* Main Bus */}
                  <line x1="0" y1="50" x2="800" y2="50" stroke="#111" strokeWidth="2" />
                  <text x="10" y="40" className="text-[10px] font-black uppercase fill-gray-400">Acometida 10mm²</text>
                  
                  {/* IGA */}
                  <rect x="40" y="30" width="40" height="40" fill="#111" rx="4" />
                  <text x="60" y="55" textAnchor="middle" className="fill-white text-[8px] font-black">IGA</text>
                  <text x="60" y="85" textAnchor="middle" className="fill-gray-900 text-[10px] font-black">40A</text>
                  
                  {/* PCS */}
                  <rect x="100" y="30" width="40" height="40" fill="#333" rx="4" />
                  <text x="120" y="55" textAnchor="middle" className="fill-white text-[8px] font-black">PCS</text>
                  <text x="120" y="85" textAnchor="middle" className="fill-gray-900 text-[10px] font-black">OVR</text>

                  {/* Differentials and Circuits */}
                  {[...new Set(circuits.map(c => c.idGroup))].map((groupId, gIdx) => {
                    const groupCircuits = circuits.filter(c => c.idGroup === groupId);
                    const startX = 180 + (gIdx * 300); // Increased spacing between groups
                    
                    return (
                      <g key={groupId}>
                        {/* Connection from main bus */}
                        <line x1={startX + 20} y1="50" x2={startX + 20} y2="100" stroke="#111" strokeWidth="2" />
                        
                        {/* ID */}
                        <rect x={startX} y="100" width="40" height="50" fill="#2563eb" rx="4" />
                        <text x={startX + 20} y="130" textAnchor="middle" className="fill-white text-[8px] font-black">ID {groupId}</text>
                        <text x={startX + 20} y="165" textAnchor="middle" className="fill-blue-600 text-[9px] font-black">40A/30mA</text>

                        {/* PIAs */}
                        {groupCircuits.map((c, cIdx) => {
                          const piaX = startX - 70 + (cIdx * 60); // Increased spacing between PIAs
                          return (
                            <g key={c.id}>
                              {/* Orthogonal lines instead of diagonals */}
                              <path 
                                d={`M ${startX + 20} 150 L ${startX + 20} 165 L ${piaX + 15} 165 L ${piaX + 15} 180`} 
                                fill="none" 
                                stroke="#94a3b8" 
                                strokeWidth="1.5" 
                              />
                              <rect x={piaX} y="180" width="30" height="40" fill="#111" rx="4" />
                              <text x={piaX + 15} y="205" textAnchor="middle" className="fill-yellow-400 text-[8px] font-black">{c.code}</text>
                              <text x={piaX + 15} y="235" textAnchor="middle" className="fill-gray-900 text-[9px] font-black">{c.amps}A</text>
                              <text x={piaX + 15} y="250" textAnchor="middle" className="fill-blue-600 text-[7px] font-black">{c.cable}</text>
                              <text x={piaX + 15} y="265" textAnchor="middle" className="fill-gray-400 text-[6px] font-bold uppercase">{c.label}</text>
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </section>

          {/* Physical Layout */}
          <section className="space-y-4">
            <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-2">Montaje en Carril DIN</h4>
            <div className="bg-gray-200 rounded-[3rem] p-10 border-8 border-gray-300 shadow-2xl relative">
              <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[8px] font-black text-gray-400 uppercase">Cuadro de Distribución Principal</div>
              
              <div className="bg-gray-300 h-4 w-full absolute top-1/2 -translate-y-1/2 left-0 shadow-inner" />
              
              <div className="relative flex gap-1 items-end overflow-x-auto pb-4 scrollbar-hide">
                <DINModule type="IGA" label="General" amps={40} color="bg-gray-800 text-white" width="w-20" />
                <DINModule type="PCS" label="Sobretensiones" color="bg-gray-700 text-white" width="w-20" />
                
                <div className="w-4 shrink-0" /> {/* Spacer */}

                {[...new Set(circuits.map(c => c.idGroup))].map(groupId => (
                  <React.Fragment key={groupId}>
                    <DINModule type="ID" label={`Diferencial ${groupId}`} amps={40} color="bg-blue-700 text-white" width="w-24" />
                    {circuits.filter(c => c.idGroup === groupId).map(c => (
                      <DINModule key={c.id} type="PIA" label={c.label} amps={c.amps} color="bg-gray-100" width="w-14" />
                    ))}
                    <div className="w-4 shrink-0" /> {/* Spacer */}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </section>

          {/* Technical Specs */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
              <h5 className="text-[10px] font-black uppercase text-gray-400 mb-4">Resumen de Cargas</h5>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold">
                  <span>Potencia Estimada:</span>
                  <span className="text-gray-900">{(circuits.reduce((acc, c) => acc + (c.amps * 230), 0) * 0.4 / 1000).toFixed(2)} kW (Simult.)</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold">
                  <span>Circuitos Totales:</span>
                  <span className="text-gray-900">{circuits.length}</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold">
                  <span>Diferenciales:</span>
                  <span className="text-gray-900">{[...new Set(circuits.map(c => c.idGroup))].length}</span>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 p-6 rounded-[2rem] border border-yellow-100">
              <h5 className="text-[10px] font-black uppercase text-yellow-700 mb-4">Nota Técnica</h5>
              <p className="text-[9px] font-bold text-yellow-800 leading-relaxed uppercase">
                Diseño generado bajo normativa REBT. Se recomienda el uso de peines de conexión para los PIAs y punteras en todos los terminales. Verifique la sección de la derivación individual.
              </p>
            </div>
          </section>

          {/* Budget Section */}
          <section className="space-y-4">
            <div className="flex justify-between items-center px-2">
              <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Presupuesto Estimado de Materiales</h4>
              <button 
                onClick={addBudgetItem}
                className="p-2 bg-yellow-400 text-black rounded-xl font-black uppercase text-[8px] flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Añadir Material
              </button>
            </div>
            <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-4 text-[8px] font-black uppercase text-gray-400">Descripción</th>
                    <th className="pb-4 text-[8px] font-black uppercase text-gray-400 text-center">Cant.</th>
                    <th className="pb-4 text-[8px] font-black uppercase text-gray-400 text-right">Precio (€)</th>
                    <th className="pb-4 text-[8px] font-black uppercase text-gray-400 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {budget.map(item => (
                    <tr key={item.id} className="group">
                      <td className="py-4">
                        <input 
                          type="text" 
                          value={item.name} 
                          onChange={(e) => updateBudgetItem(item.id, 'name', e.target.value)}
                          className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-bold p-0"
                        />
                      </td>
                      <td className="py-4 text-center">
                        <input 
                          type="number" 
                          value={item.quantity} 
                          onChange={(e) => updateBudgetItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-12 bg-transparent border-none focus:ring-0 text-[10px] font-bold p-0 text-center"
                        />
                      </td>
                      <td className="py-4 text-right">
                        <input 
                          type="number" 
                          value={item.price} 
                          onChange={(e) => updateBudgetItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                          className="w-20 bg-transparent border-none focus:ring-0 text-[10px] font-bold p-0 text-right"
                        />
                      </td>
                      <td className="py-4 text-right">
                        <button onClick={() => removeBudgetItem(item.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-900">
                    <td colSpan={2} className="pt-4 text-[10px] font-black uppercase">Total Estimado (IVA no incl.)</td>
                    <td className="pt-4 text-right text-[12px] font-black text-gray-900">
                      {budget.reduce((acc, item) => acc + (item.price * item.quantity), 0).toFixed(2)} €
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <div className="flex gap-4">
            <button 
              onClick={saveToFirestore}
              disabled={isSaving}
              className="flex-1 p-6 bg-blue-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl flex items-center justify-center gap-4 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Cloud className="w-5 h-5" />}
              {isSaving ? 'Guardando...' : 'Guardar en la Nube'}
            </button>
            <button 
              onClick={exportToJSON}
              className="p-6 bg-white border-2 border-gray-900 rounded-[2rem] text-gray-900 font-black uppercase text-[10px] flex items-center justify-center gap-2 active:scale-95"
            >
              <FileDown className="w-5 h-5" /> Exportar JSON
            </button>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={exportToPDF}
              disabled={isExporting}
              className="flex-1 p-6 bg-gray-900 text-yellow-400 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl flex items-center justify-center gap-4 active:scale-95 transition-all disabled:opacity-50"
            >
              {isExporting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              {isExporting ? 'Generando PDF...' : 'Exportar Memoria Técnica (PDF)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ApplianceBtn: React.FC<{ icon: React.ReactNode, label: string, onClick: () => void }> = ({ icon, label, onClick }) => (
  <button 
    onClick={onClick}
    className="p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-gray-100 transition-colors flex flex-col items-center gap-2"
  >
    <div className="text-gray-400">{icon}</div>
    <span className="text-[9px] font-black uppercase text-gray-600">{label}</span>
  </button>
);

export default ToolsModule;
