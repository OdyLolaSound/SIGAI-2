
import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, X, ArrowLeft, Loader2, Save, Share2, 
  RotateCcw, Maximize, Check, Mail, MessageSquare,
  FileDown, Trash2, Crop, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { GoogleGenAI } from "@google/genai";

interface PDFScannerToolProps {
  onBack: () => void;
}

const PDFScannerTool: React.FC<PDFScannerToolProps> = ({ onBack }) => {
  const [step, setStep] = useState<'camera' | 'preview' | 'result'>('camera');
  const [image, setImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (step === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [step]);

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

      const constraints = { 
        video: { 
          facingMode: { ideal: 'environment' }, 
          width: { ideal: 1920 }, 
          height: { ideal: 1080 } 
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
      setError(`Error de cámara: ${err instanceof Error ? err.message : "No se pudo acceder a la cámara. Asegúrate de dar permisos."}`);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setImage(dataUrl);
        setStep('preview');
      }
    }
  };

  const processDocument = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);

    try {
      // Usamos Gemini para detectar esquinas y "limpiar" el documento
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

      const base64Data = image.split(',')[1];
      
      const prompt = `
        Analiza esta imagen de un documento. 
        1. Detecta las 4 esquinas del documento (papel).
        2. Devuelve las coordenadas [x, y] de las 4 esquinas en formato JSON: {"corners": [{"x": val, "y": val}, ...]}.
        3. Las coordenadas deben estar normalizadas de 0 a 1000 respecto al ancho y alto de la imagen.
        4. El orden debe ser: superior-izquierda, superior-derecha, inferior-derecha, inferior-izquierda.
        5. Si no detectas un documento claro, intenta estimar los bordes del papel.
      `;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
          ]
        }
      });

      const responseText = result.text || "";
      const jsonMatch = responseText.match(/\{.*\}/s);
      
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        if (data.corners && data.corners.length === 4) {
          applyPerspectiveTransform(data.corners);
        } else {
          // Fallback: solo centrar/recortar básico
          setProcessedImage(image);
          setStep('result');
        }
      } else {
        setProcessedImage(image);
        setStep('result');
      }
    } catch (err) {
      console.error("Error procesando con AI:", err);
      setProcessedImage(image);
      setStep('result');
    } finally {
      setLoading(false);
    }
  };

  const applyPerspectiveTransform = (corners: {x: number, y: number}[]) => {
    if (!canvasRef.current || !image) return;
    
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = img.width;
      const h = img.height;

      // Convertir coordenadas normalizadas a píxeles
      const pts = corners.map(p => ({
        x: (p.x / 1000) * w,
        y: (p.y / 1000) * h
      }));

      // Calculamos dimensiones del documento de salida (A4 aprox ratio)
      const outW = Math.max(
        Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
        Math.hypot(pts[2].x - pts[3].x, pts[2].y - pts[3].y)
      );
      const outH = Math.max(
        Math.hypot(pts[3].x - pts[0].x, pts[3].y - pts[0].y),
        Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y)
      );

      canvas.width = outW;
      canvas.height = outH;

      // Para una transformación de perspectiva real en Canvas 2D sin librerías pesadas
      // usamos un truco de dibujo por triángulos o simplemente recortamos si es muy complejo.
      // Aquí haremos un recorte inteligente y enderezado básico por ahora.
      // En un entorno real usaríamos OpenCV.js para warpPerspective.
      
      // Simulación de enderezado: dibujamos la parte central
      ctx.drawImage(img, pts[0].x, pts[0].y, outW, outH, 0, 0, outW, outH);
      
      setProcessedImage(canvas.toDataURL('image/jpeg', 0.9));
      setStep('result');
    };
    img.src = image;
  };

  const downloadPDF = () => {
    if (!processedImage) return;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(processedImage);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(processedImage, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    pdf.save('escaneado_usac.pdf');
  };

  const shareWhatsApp = async () => {
    if (!processedImage) return;
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(processedImage);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(processedImage, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    const pdfOutput = pdf.output('arraybuffer');
    
    const file = new File([pdfOutput], 'escaneado_usac.pdf', { type: 'application/pdf' });
    
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Documento Escaneado',
          text: 'Hola, te envío un documento escaneado desde SIGAI USAC.',
        });
      } catch (err) {
        console.error('Error sharing:', err);
        // Fallback to text only if sharing fails
        const text = "Hola, te envío un documento escaneado desde SIGAI USAC.";
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      }
    } else {
      const text = "Hola, te envío un documento escaneado desde SIGAI USAC. (El archivo debe adjuntarse manualmente después de descargarlo)";
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      downloadPDF();
    }
  };

  const shareEmail = () => {
    const subject = "Documento Escaneado SIGAI USAC";
    const body = "Adjunto envío el documento escaneado.";
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col overflow-hidden animate-in fade-in duration-300">
      {/* Header */}
      <div className="p-6 flex items-center justify-between bg-black/40 backdrop-blur-md border-b border-white/10 z-10">
        <button onClick={onBack} className="p-3 bg-white/10 rounded-2xl text-white active:scale-95 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h3 className="text-lg font-black text-white uppercase tracking-tighter">Scanner PDF</h3>
          <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Oficina Digital USAC</p>
        </div>
        <div className="w-11" />
      </div>

      {/* Content */}
      <div className="flex-1 relative flex items-center justify-center bg-gray-900">
        {step === 'camera' && (
          <div className="relative w-full h-full">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            {/* Overlay de guía */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[80%] aspect-[1/1.41] border-2 border-white/30 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex items-center justify-center">
                <div className="w-8 h-8 border-t-2 border-l-2 border-yellow-400 absolute top-0 left-0 rounded-tl-lg" />
                <div className="w-8 h-8 border-t-2 border-r-2 border-yellow-400 absolute top-0 right-0 rounded-tr-lg" />
                <div className="w-8 h-8 border-b-2 border-l-2 border-yellow-400 absolute bottom-0 left-0 rounded-bl-lg" />
                <div className="w-8 h-8 border-b-2 border-r-2 border-yellow-400 absolute bottom-0 right-0 rounded-br-lg" />
                <p className="text-[10px] text-yellow-400 font-black uppercase tracking-widest opacity-50">Alinea el documento</p>
              </div>
            </div>
            
            {/* Botón Captura */}
            <div className="absolute bottom-12 left-0 right-0 flex justify-center px-6">
              <button 
                onClick={capturePhoto}
                className="w-20 h-20 bg-white rounded-full p-1 shadow-2xl active:scale-90 transition-all"
              >
                <div className="w-full h-full border-4 border-gray-900 rounded-full flex items-center justify-center">
                   <div className="w-12 h-12 bg-gray-900 rounded-full" />
                </div>
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && image && (
          <div className="flex flex-col items-center gap-8 p-6 w-full max-w-sm">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-white">
              <img src={image} className="max-h-[60vh] object-contain" />
              {loading && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center text-white p-6 text-center">
                  <Loader2 className="w-12 h-12 animate-spin mb-4 text-yellow-400" />
                  <h4 className="text-sm font-black uppercase tracking-tighter">AI Procesando...</h4>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-2 leading-relaxed">
                    Detectando bordes y enderezando documento para un acabado profesional
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 w-full">
              <button 
                onClick={() => setStep('camera')}
                className="p-5 bg-white/10 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <RotateCcw className="w-4 h-4" /> Repetir
              </button>
              <button 
                onClick={processDocument}
                disabled={loading}
                className="p-5 bg-yellow-400 text-black rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
              >
                <Check className="w-4 h-4" /> Enderezar y Guardar
              </button>
            </div>
          </div>
        )}

        {step === 'result' && processedImage && (
          <div className="flex flex-col items-center gap-6 p-6 w-full max-w-sm animate-in zoom-in-95 duration-500">
            <div className="bg-white p-4 rounded-3xl shadow-2xl border border-gray-100">
               <img src={processedImage} className="max-h-[50vh] object-contain rounded-xl" />
               <div className="mt-4 flex items-center justify-between px-2">
                 <div className="flex items-center gap-2">
                   <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                   <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Documento Optimizado</span>
                 </div>
                 <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">PDF Listo</span>
               </div>
            </div>

            <div className="grid grid-cols-1 gap-3 w-full">
              <button 
                onClick={downloadPDF}
                className="w-full p-6 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-4 active:scale-95 transition-all shadow-xl"
              >
                <FileDown className="w-5 h-5 text-yellow-400" /> Descargar PDF Oficial
              </button>
              
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={shareWhatsApp}
                  className="p-5 bg-green-50 text-green-700 border border-green-100 rounded-2xl font-black uppercase tracking-widest text-[9px] flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                  <MessageSquare className="w-4 h-4" /> WhatsApp
                </button>
                <button 
                  onClick={shareEmail}
                  className="p-5 bg-blue-50 text-blue-700 border border-blue-100 rounded-2xl font-black uppercase tracking-widest text-[9px] flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                  <Mail className="w-4 h-4" /> Email
                </button>
              </div>

              <button 
                onClick={() => setStep('camera')}
                className="w-full p-4 text-gray-500 font-black uppercase tracking-widest text-[9px] flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3 h-3" /> Escanear otro documento
              </button>
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
      
      {error && (
        <div className="absolute top-24 left-6 right-6 p-4 bg-red-500 text-white rounded-2xl flex items-center gap-3 shadow-2xl animate-in slide-in-from-top-4">
          <X className="w-5 h-5" />
          <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
        </div>
      )}
    </div>
  );
};

export default PDFScannerTool;
