
import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Trash2, Check, X } from 'lucide-react';

interface SignaturePadProps {
  onSave: (signature: string) => void;
  onCancel: () => void;
  title?: string;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onCancel, title = 'Firmar Permiso' }) => {
  const sigCanvas = useRef<SignatureCanvas>(null);

  const clear = () => {
    sigCanvas.current?.clear();
  };

  const save = () => {
    if (sigCanvas.current?.isEmpty()) {
      alert('Por favor, firma antes de guardar.');
      return;
    }
    const signatureData = sigCanvas.current?.getCanvas().toDataURL('image/png');
    if (signatureData) {
      onSave(signatureData);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white rounded-[3rem] overflow-hidden shadow-2xl flex flex-col">
        <header className="p-6 bg-gray-900 text-white flex justify-between items-center">
          <h3 className="text-xl font-black uppercase tracking-tight">{title}</h3>
          <button onClick={onCancel} className="p-2 text-white/30 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </header>
        
        <div className="p-6 space-y-6">
          <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 overflow-hidden">
            <SignatureCanvas 
              ref={sigCanvas}
              canvasProps={{
                width: 400,
                height: 250,
                className: 'w-full h-64 cursor-crosshair'
              }}
              backgroundColor="rgba(255,255,255,0)"
            />
          </div>
          
          <div className="flex gap-4">
            <button 
              onClick={clear}
              className="flex-1 p-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Trash2 className="w-4 h-4" /> Limpiar
            </button>
            <button 
              onClick={save}
              className="flex-1 p-4 bg-gray-900 text-yellow-400 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Check className="w-4 h-4" /> Confirmar Firma
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignaturePad;
