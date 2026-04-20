
import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, Upload, X, ArrowLeft, Check, 
  Download, Share2, MousePointer2, PenTool,
  Loader2, Mail, MessageSquare, ChevronLeft, ChevronRight, Maximize
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';

// Configurar el worker de pdfjs usando unpkg que es más fiable para archivos estáticos
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFSignerToolProps {
  onBack: () => void;
}

const PDFSignerTool: React.FC<PDFSignerToolProps> = ({ onBack }) => {
  const [step, setStep] = useState<'upload' | 'sign' | 'place' | 'result'>('upload');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [processedPdf, setProcessedPdf] = useState<Uint8Array | null>(null);
  const [sigPos, setSigPos] = useState({ x: 10, y: 10, width: 150, height: 75 });
  
  const sigCanvasRef = useRef<SignatureCanvas>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Cargar PDF para visualización
  useEffect(() => {
    if (pdfFile && (step === 'place')) {
      renderPage(currentPage);
    }
  }, [pdfFile, step, currentPage]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setLoading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        // Usar un worker local o de unpkg para mayor fiabilidad
        const loadingTask = pdfjs.getDocument({ 
          data: arrayBuffer
        });
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setStep('sign');
      } catch (err) {
        console.error(err);
        alert("Error al cargar el PDF. Asegúrate de que sea un archivo válido.");
      } finally {
        setLoading(false);
      }
    }
  };

  const renderPage = async (pageNo: number) => {
    if (!pdfDoc || !canvasRef.current) return;
    
    const page = await pdfDoc.getPage(pageNo);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    const renderContext = {
      canvasContext: context!,
      viewport: viewport
    };
    await page.render(renderContext).promise;
  };

  const saveSignature = () => {
    if (sigCanvasRef.current) {
      if (sigCanvasRef.current.isEmpty()) {
        alert("Por favor, firma antes de continuar");
        return;
      }
      const canvas = sigCanvasRef.current.getCanvas();
      setSignatureImage(canvas.toDataURL('image/png'));
      
      // Guardar el aspect ratio original de la firma
      const ratio = canvas.height / canvas.width;
      setSigPos(prev => ({ ...prev, height: prev.width * ratio }));
      
      setStep('place');
    }
  };

  const handlePlaceSignature = async () => {
    if (!pdfFile || !signatureImage) return;
    setLoading(true);
    
    try {
      const existingPdfBytes = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();
      const targetPage = pages[currentPage - 1];
      
      const signatureImageBytes = await fetch(signatureImage).then(res => res.arrayBuffer());
      const signatureImg = await pdfDoc.embedPng(signatureImageBytes);
      
      const { width: pdfWidth, height: pdfHeight } = targetPage.getSize();
      const rotation = targetPage.getRotation().angle;
      
      const canvasElement = canvasRef.current;
      if (!canvasElement) throw new Error("Canvas not found");
      
      const visualWidth = canvasElement.clientWidth;
      const visualHeight = canvasElement.clientHeight;
      
      // Escala de píxeles visuales a puntos PDF
      // Si la rotación es 90 o 270, el ancho visual corresponde al alto del PDF y viceversa
      const isRotated = rotation === 90 || rotation === 270;
      const scaleX = (isRotated ? pdfHeight : pdfWidth) / visualWidth;
      const scaleY = (isRotated ? pdfWidth : pdfHeight) / visualHeight;

      // Convertir sigPos (porcentajes) a coordenadas en píxeles visuales
      const visualX = (sigPos.x / 100) * visualWidth;
      const visualY = (sigPos.y / 100) * visualHeight;
      const visualW = sigPos.width;
      const visualH = sigPos.height;

      let x, y, width, height;

      if (rotation === 90) {
        x = visualY * scaleY;
        y = visualX * scaleX;
        width = visualH * scaleY;
        height = visualW * scaleX;
      } else if (rotation === 180) {
        x = pdfWidth - (visualX * scaleX) - (visualW * scaleX);
        y = visualY * scaleY;
        width = visualW * scaleX;
        height = visualH * scaleY;
      } else if (rotation === 270) {
        x = pdfWidth - (visualY * scaleY) - (visualH * scaleY);
        y = pdfHeight - (visualX * scaleX) - (visualW * scaleX);
        width = visualH * scaleY;
        height = visualW * scaleX;
      } else {
        // rotation === 0
        x = visualX * scaleX;
        y = pdfHeight - (visualY * scaleY) - (visualH * scaleY);
        width = visualW * scaleX;
        height = visualH * scaleY;
      }
      
      targetPage.drawImage(signatureImg, {
        x,
        y,
        width,
        height,
        rotate: degrees(-rotation),
      });
      
      const pdfBytes = await pdfDoc.save();
      setProcessedPdf(pdfBytes);
      setStep('result');
    } catch (err) {
      console.error(err);
      alert("Error al procesar el PDF");
    } finally {
      setLoading(false);
    }
  };

  const downloadSignedPdf = () => {
    if (!processedPdf) return;
    const blob = new Blob([processedPdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firmado_${pdfFile?.name || 'documento.pdf'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareFile = async () => {
    if (!processedPdf) return;
    
    const fileName = `firmado_${pdfFile?.name || 'documento.pdf'}`;
    const file = new File([processedPdf], fileName, { type: 'application/pdf' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Documento Firmado',
          text: 'Te envío el documento firmado desde SIGAI USAC.',
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Error sharing:', err);
          alert("No se pudo compartir el archivo directamente. Por favor, descárgalo primero.");
        }
      }
    } else {
      // Fallback: Descargar y avisar
      alert("Tu navegador no permite compartir archivos directamente. El archivo se descargará para que puedas adjuntarlo manualmente.");
      downloadSignedPdf();
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col overflow-hidden animate-in fade-in duration-300">
      {/* Header */}
      <div className="p-6 flex items-center justify-between bg-black/40 backdrop-blur-md border-b border-white/10 z-10">
        <button onClick={onBack} className="p-3 bg-white/10 rounded-2xl text-white active:scale-95 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h3 className="text-lg font-black text-white uppercase tracking-tighter">Firmar PDF</h3>
          <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Oficina Digital USAC</p>
        </div>
        <div className="w-11" />
      </div>

      {/* Content */}
      <div className="flex-1 relative flex flex-col items-center justify-center bg-gray-900 overflow-y-auto p-4">
        
        {step === 'upload' && (
          <div className="w-full max-w-xs space-y-8 text-center animate-in zoom-in-95">
            <label className="cursor-pointer group">
              <div className="w-24 h-24 bg-blue-500/20 rounded-[2rem] flex items-center justify-center mx-auto border-2 border-blue-500/30 group-hover:bg-blue-500/30 group-hover:border-blue-500/50 transition-all active:scale-95">
                <Upload className="w-10 h-10 text-blue-400" />
              </div>
              <input 
                type="file" 
                accept=".pdf" 
                onChange={onFileChange}
                className="hidden"
              />
            </label>
            <div>
              <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Subir Documento</h4>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
                Pulsa en el icono o selecciona el archivo PDF que deseas firmar
              </p>
            </div>
            <div className="pt-4">
              <label className="inline-block">
                <span className="sr-only">Elegir PDF</span>
                <input 
                  type="file" 
                  accept=".pdf" 
                  onChange={onFileChange}
                  className="block w-full text-sm text-gray-400 file:mr-4 file:py-4 file:px-8 file:rounded-2xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-blue-600 file:text-white hover:file:bg-blue-700 transition-all cursor-pointer shadow-lg"
                />
              </label>
            </div>
            {loading && <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto" />}
          </div>
        )}

        {step === 'sign' && (
          <div className="w-full max-w-sm space-y-6 animate-in slide-in-from-bottom-8">
            <div className="text-center mb-4">
              <h4 className="text-lg font-black text-white uppercase tracking-tighter">Dibuja tu Firma</h4>
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Usa tu dedo o el ratón</p>
            </div>
            
            <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
              <SignatureCanvas 
                ref={sigCanvasRef}
                penColor='black'
                canvasProps={{
                  className: "w-full h-64 cursor-crosshair",
                  style: { background: 'white' }
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => sigCanvasRef.current?.clear()}
                className="p-5 bg-white/10 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <X className="w-4 h-4" /> Limpiar
              </button>
              <button 
                onClick={saveSignature}
                className="p-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
              >
                <Check className="w-4 h-4" /> Continuar
              </button>
            </div>
          </div>
        )}

        {step === 'place' && (
          <div className="w-full h-full flex flex-col gap-4 animate-in fade-in">
            <div className="flex justify-between items-center px-2">
              <div className="flex items-center gap-2">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="p-2 bg-white/10 rounded-xl text-white disabled:opacity-20"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Página {currentPage} de {numPages}</span>
                <button 
                  disabled={currentPage === numPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="p-2 bg-white/10 rounded-xl text-white disabled:opacity-20"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[8px] text-blue-400 font-black uppercase tracking-widest">Arrastra la firma</p>
            </div>

            <div 
              ref={containerRef}
              className="relative flex-1 bg-gray-800 rounded-3xl overflow-hidden border border-white/10 flex items-center justify-center p-4"
              onMouseMove={(e) => {
                const rect = wrapperRef.current?.getBoundingClientRect();
                if (!rect) return;

                if (isDragging) {
                  const x = ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100;
                  const y = ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100;
                  setSigPos(prev => ({ 
                    ...prev, 
                    x: Math.max(0, Math.min(x, 100 - (prev.width / rect.width) * 100)), 
                    y: Math.max(0, Math.min(y, 100 - (prev.height / rect.height) * 100)) 
                  }));
                } else if (isResizing) {
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const newWidth = Math.max(50, (x - sigPos.x) * (rect.width / 100));
                  const canvas = sigCanvasRef.current?.getCanvas();
                  const ratio = canvas ? canvas.height / canvas.width : 0.5;
                  const newHeight = newWidth * ratio;
                  setSigPos(prev => ({ ...prev, width: newWidth, height: newHeight }));
                }
              }}
              onMouseUp={() => {
                setIsDragging(false);
                setIsResizing(false);
              }}
              onMouseLeave={() => {
                setIsDragging(false);
                setIsResizing(false);
              }}
              onTouchMove={(e) => {
                const touch = e.touches[0];
                const rect = wrapperRef.current?.getBoundingClientRect();
                if (!rect) return;

                if (isDragging) {
                  const x = ((touch.clientX - rect.left - dragOffset.x) / rect.width) * 100;
                  const y = ((touch.clientY - rect.top - dragOffset.y) / rect.height) * 100;
                  setSigPos(prev => ({ 
                    ...prev, 
                    x: Math.max(0, Math.min(x, 100 - (prev.width / rect.width) * 100)), 
                    y: Math.max(0, Math.min(y, 100 - (prev.height / rect.height) * 100)) 
                  }));
                } else if (isResizing) {
                  const x = ((touch.clientX - rect.left) / rect.width) * 100;
                  const newWidth = Math.max(50, (x - sigPos.x) * (rect.width / 100));
                  const canvas = sigCanvasRef.current?.getCanvas();
                  const ratio = canvas ? canvas.height / canvas.width : 0.5;
                  const newHeight = newWidth * ratio;
                  setSigPos(prev => ({ ...prev, width: newWidth, height: newHeight }));
                }
              }}
              onTouchEnd={() => {
                setIsDragging(false);
                setIsResizing(false);
              }}
            >
              <div ref={wrapperRef} className="relative shadow-2xl inline-block">
                <canvas ref={canvasRef} className="max-w-full max-h-[70vh] object-contain block" />
                
                {signatureImage && (
                  <div 
                    style={{ 
                      left: `${sigPos.x}%`, 
                      top: `${sigPos.y}%`,
                      width: `${sigPos.width}px`,
                      height: `${sigPos.height}px`
                    }}
                    className="absolute cursor-move border-2 border-blue-500 bg-blue-500/10 rounded-lg flex items-center justify-center group touch-none"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const target = e.target as HTMLElement;
                      const rect = target.closest('.absolute')?.getBoundingClientRect();
                      if (rect) {
                        if (target.closest('.resize-handle')) {
                          setIsResizing(true);
                        } else {
                          setIsDragging(true);
                          setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                        }
                      }
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      const touch = e.touches[0];
                      const target = e.target as HTMLElement;
                      const rect = target.closest('.absolute')?.getBoundingClientRect();
                      if (rect) {
                        if (target.closest('.resize-handle')) {
                          setIsResizing(true);
                        } else {
                          setIsDragging(true);
                          setDragOffset({ x: touch.clientX - rect.left, y: touch.clientY - rect.top });
                        }
                      }
                    }}
                  >
                    <img src={signatureImage} className="w-full h-full object-contain pointer-events-none" />
                    <div className="absolute -top-3 -right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg pointer-events-none">
                      <MousePointer2 className="w-3 h-3" />
                    </div>
                    {/* Resize Handle */}
                    <div className="resize-handle absolute -bottom-3 -right-3 w-8 h-8 bg-white border-2 border-blue-500 rounded-full flex items-center justify-center text-blue-500 shadow-lg cursor-nwse-resize active:scale-125 transition-transform">
                      <Maximize className="w-4 h-4 rotate-45" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button 
              onClick={handlePlaceSignature}
              disabled={loading}
              className="w-full p-6 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-4 active:scale-95 transition-all shadow-xl"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              Fijar Firma y Procesar
            </button>
          </div>
        )}

        {step === 'result' && (
          <div className="w-full max-w-xs space-y-8 text-center animate-in zoom-in-95">
            <div className="w-24 h-24 bg-green-500/20 rounded-[2rem] flex items-center justify-center mx-auto border-2 border-green-500/30">
              <FileText className="w-10 h-10 text-green-400" />
            </div>
            <div>
              <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-2">¡Documento Firmado!</h4>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
                Tu firma ha sido integrada correctamente en el PDF
              </p>
            </div>

            <div className="space-y-3">
              <button 
                onClick={downloadSignedPdf}
                className="w-full p-6 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-4 active:scale-95 transition-all shadow-xl border border-white/5"
              >
                <Download className="w-5 h-5 text-blue-400" /> Descargar PDF Firmado
              </button>
              
              <button 
                onClick={shareFile}
                className="w-full p-6 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-4 active:scale-95 transition-all shadow-xl"
              >
                <Share2 className="w-5 h-5" /> Compartir por WhatsApp / Email
              </button>

              <button 
                onClick={() => setStep('upload')}
                className="w-full p-4 text-gray-500 font-black uppercase tracking-widest text-[9px] flex items-center justify-center gap-2"
              >
                Firmar otro documento
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default PDFSignerTool;
