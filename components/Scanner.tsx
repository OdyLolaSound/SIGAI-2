
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Camera, X, Loader2, Keyboard, Droplets, Zap, Flame, Upload, Globe, Thermometer, Gauge, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { extractReadingsForService, parseEuropeanNumber } from '../services/geminiService';
import { storageService } from '../services/storageService';
import { getLocalDateString, parseDateString } from '../services/dateUtils';
import { Reading, ServiceType, Building, ReadingOrigin, User } from '../types';

interface ScannerProps {
  serviceType: ServiceType;
  building: Building;
  user: User;
  onComplete: () => void;
}

const Scanner: React.FC<ScannerProps> = ({ serviceType, building, user, onComplete }) => {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [val1, setVal1] = useState<string>("");
  const [val2, setVal2] = useState<string>("");
  const [pressure, setPressure] = useState<string>("");
  const [temp, setTemp] = useState<string>("");
  const [note, setNote] = useState("");
  const [origin, setOrigin] = useState<ReadingOrigin>('manual');
  const [date, setDate] = useState(getLocalDateString());
  const [step, setStep] = useState<'selection' | 'confirm'>('selection');
  const [saving, setSaving] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [lastReading, setLastReading] = useState<Reading | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const readings = storageService.getReadings(building.id, serviceType);
    if (readings.length > 0) {
      setLastReading(readings.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]);
    }
  }, [building, serviceType]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImage(base64);
        processImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (base64: string) => {
    setLoading(true);
    setStep('confirm');
    
    try {
      const result = await extractReadingsForService(base64, serviceType);
      
      if (result.v1 !== null) {
        setVal1(result.v1.toString().replace('.', ','));
        setOrigin('ai');
      } else {
        setOrigin('manual');
      }
      
      if (result.v2 !== null) {
        setVal2(result.v2.toString().replace('.', ','));
      }
    } catch (error) {
      console.error("Error procesando imagen:", error);
      setOrigin('manual');
    } finally {
      setLoading(false);
    }
  };

  const handleTelemetrySync = async () => {
    setLoading(true);
    // Fix: storageService.getWaterAccounts() does not exist, using getWaterAccount()
    const account = storageService.getWaterAccount();
    
    if (!account || account.buildingId !== building.id) {
      alert("⚠️ No hay cuenta de telemetría configurada para este edificio. Configure las credenciales de Aguas de Alicante en el módulo correspondiente.");
      setLoading(false);
      return;
    }

    const res = await storageService.simulateWaterSync(account.id);
    setLoading(false);
    
    if (res.success && res.reading) {
      alert(`✅ Sincronización Puppeteer Exitosa.\nLectura obtenida: ${res.reading.value1} m³\nConsumo periodo: ${res.reading.consumption1} m³${res.reading.isPeak ? '\n\n🚨 ALERTA: Pico de consumo detectado' : ''}`);
      onComplete();
    } else {
      alert(`❌ Error: ${res.message}`);
    }
  };

  const v1Status = useMemo(() => {
    const cur = parseEuropeanNumber(val1);
    const prev = lastReading?.value1;
    if (cur === null || prev === undefined) return { valid: true, diff: 0 };
    return { valid: cur >= prev, diff: cur - prev };
  }, [val1, lastReading]);

  const v2Status = useMemo(() => {
    const cur = parseEuropeanNumber(val2);
    const prev = lastReading?.value2;
    if (cur === null || prev === undefined) return { valid: true, diff: 0 };
    return { valid: cur >= prev, diff: cur - prev };
  }, [val2, lastReading]);

  const handleSave = async (force = false) => {
    setErrorMsg(null);
    const n1 = parseEuropeanNumber(val1);
    if (n1 === null) {
      setErrorMsg("La lectura principal es obligatoria");
      return;
    }

    if (!force && (!v1Status.valid || (val2 && !v2Status.valid))) {
      setShowWarning(true);
      return;
    }

    setSaving(true);
    
    const c1 = lastReading ? Math.max(0, n1 - lastReading.value1) : 0;
    const n2 = serviceType === 'luz' ? parseEuropeanNumber(val2) : null;
    const c2 = (serviceType === 'luz' && n2 !== null && lastReading?.value2 !== undefined) 
      ? Math.max(0, n2 - lastReading.value2) 
      : (serviceType === 'luz' && n2 !== null ? 0 : undefined);

    const timestamp = serviceType === 'agua' 
      ? parseDateString(date).toISOString() 
      : new Date().toISOString();
      
    const readingId = serviceType === 'agua' 
      ? `water_${building.id}_${date}` 
      : `reading-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const newReading: Reading = {
      id: readingId,
      buildingId: building.id,
      date,
      timestamp,
      userId: user.id,
      serviceType,
      origin,
      imageUrl: image || undefined,
      value1: n1,
      consumption1: c1,
      value2: n2 || undefined,
      consumption2: c2,
      pressure: serviceType === 'caldera' ? parseFloat(pressure) : undefined,
      temperature: serviceType === 'caldera' ? parseFloat(temp) : undefined,
      note
    };

    try {
      await storageService.saveReading(newReading);
      onComplete();
    } catch (error) {
      console.error("Error saving reading:", error);
      setErrorMsg("Error al guardar la lectura. Inténtelo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  if (step === 'selection') {
    return (
      <div className="flex flex-col items-center py-6 gap-8 animate-in fade-in slide-in-from-bottom-10">
        <div className="text-center px-4">
          <div className="bg-white text-tactical-orange px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest mb-4 shadow-sm inline-block border border-gray-100">
             INSTALACIÓN: {building.code}
          </div>
          <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter leading-none">{building.name}</h2>
          <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mt-3">Módulo {serviceType.toUpperCase()}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 w-full px-2 max-w-sm">
          <button onClick={() => cameraInputRef.current?.click()} className="group flex items-center gap-6 bg-white text-gray-900 p-7 rounded-[2.5rem] font-bold shadow-sm active:scale-95 transition-all border border-gray-100 hover:border-tactical-orange/30">
            <div className="p-4 bg-gray-50 rounded-2xl group-hover:bg-tactical-orange group-hover:text-black transition-all shadow-md"><Camera className="w-8 h-8" /></div>
            <div className="text-left">
              <div className="text-xl font-black uppercase leading-none mb-1">Cámara</div>
              <div className="text-[10px] opacity-40 uppercase font-black tracking-widest">Captura y OCR AI</div>
            </div>
          </button>

          <div className="grid grid-cols-2 gap-4">
             <button onClick={() => galleryInputRef.current?.click()} className="group flex flex-col items-center justify-center gap-3 bg-white border border-gray-100 p-7 rounded-[2.5rem] font-bold active:scale-95 transition-all hover:border-tactical-orange/30 shadow-sm">
               <Upload className="w-6 h-6 text-gray-400 group-hover:text-tactical-orange transition-colors" />
               <div className="text-[9px] text-gray-400 uppercase font-black tracking-widest">Archivos</div>
             </button>
             <button onClick={() => { setImage(null); setStep('confirm'); setOrigin('manual'); }} className="group flex flex-col items-center justify-center gap-3 bg-white border border-gray-100 p-7 rounded-[2.5rem] font-bold active:scale-95 transition-all hover:border-tactical-orange/30 shadow-sm">
               <Keyboard className="w-6 h-6 text-gray-400 group-hover:text-tactical-orange transition-colors" />
               <div className="text-[9px] text-gray-400 uppercase font-black tracking-widest">Manual</div>
             </button>
          </div>

          {serviceType === 'agua' && (
            <button 
              onClick={handleTelemetrySync} 
              disabled={loading}
              className="group flex items-center gap-6 bg-blue-50 border border-blue-100 text-blue-900 p-7 rounded-[2.5rem] font-bold active:scale-95 transition-all hover:bg-blue-100 shadow-sm disabled:opacity-50"
            >
              <div className="p-4 bg-blue-600 rounded-2xl text-white shadow-lg">
                {loading ? <Loader2 className="w-8 h-8 animate-spin" /> : <Globe className="w-8 h-8" />}
              </div>
              <div className="text-left">
                <div className="text-xl font-black uppercase leading-none mb-1">Telemetría</div>
                <div className="text-[10px] text-blue-600 uppercase font-black tracking-widest">Aguas de Alicante Portal</div>
              </div>
            </button>
          )}
        </div>

        <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
        <input type="file" ref={galleryInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in zoom-in-95 duration-300 w-full max-w-sm mx-auto">
      <div className="flex items-center justify-between px-2">
        <button onClick={() => setStep('selection')} className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-2xl text-gray-400 active:scale-90 hover:bg-gray-200 transition-all"><X className="w-6 h-6" /></button>
        <div className="text-center">
          <div className="text-[9px] font-black text-gray-400 uppercase tracking-[0.3em] mb-1">{building.code}</div>
          <div className="text-sm font-black uppercase text-gray-900">{serviceType}</div>
        </div>
        <div className="w-12 h-12 flex items-center justify-center bg-tactical-orange text-black rounded-2xl shadow-lg shadow-tactical-orange/20">
           <ShieldCheck className="w-6 h-6" />
        </div>
      </div>

      {image && (
        <div className="relative aspect-video rounded-[2.5rem] overflow-hidden border-4 border-white shadow-xl bg-gray-100 mx-2">
          <img src={image} className="w-full h-full object-cover" />
          {loading && (
            <div className="absolute inset-0 bg-white/60 flex flex-col items-center justify-center text-gray-900 backdrop-blur-md">
              <Loader2 className="w-10 h-10 animate-spin mb-3 text-tactical-orange" />
              <p className="text-[11px] font-black uppercase tracking-[0.2em]">Analizando Fotografía...</p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4 px-2">
        <div className={`p-6 rounded-[2.5rem] border transition-all ${!v1Status.valid ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-4">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] block">
              {serviceType === 'luz' 
                ? (building.id === 'CT_1_2' ? 'Contador CT 1 (kWh)' : building.id === 'CT_3' ? 'Contador CT 3 (kWh)' : 'Contador A (kWh)') 
                : serviceType === 'agua' ? 'Caudalímetro (m³)' : 'Consumo (Horas)'}
            </label>
            {origin === 'ai' && val1 && (
              <span className="flex items-center gap-1 text-[8px] font-black text-emerald-600 uppercase bg-emerald-50 px-2 py-1 rounded-full animate-pulse border border-emerald-100">
                <CheckCircle2 className="w-3 h-3" /> Detectado por AI
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mb-4">
             <div className="flex-1 text-center opacity-30">
                <div className="text-[8px] font-black uppercase mb-1">Anterior</div>
                <div className="font-mono text-sm font-bold text-gray-900">{lastReading?.value1 || '0'}</div>
             </div>
             <div className="flex-1 text-center">
                <div className="text-[8px] font-black uppercase text-emerald-600 mb-1">Delta</div>
                <div className="font-mono text-sm font-bold text-emerald-600">+{v1Status.diff.toFixed(1)}</div>
             </div>
          </div>
          <input type="text" inputMode="decimal" value={val1} onChange={e => setVal1(e.target.value)} className="w-full p-6 bg-gray-50 rounded-3xl text-4xl font-mono text-center outline-none border-2 border-transparent focus:border-tactical-orange transition-all font-black text-gray-900 placeholder-gray-200" placeholder="00000.0" />
        </div>

        {serviceType === 'luz' && (building.id !== 'CT_3') && (
          <div className={`p-6 rounded-[2.5rem] border transition-all ${!v2Status.valid ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100 shadow-sm'}`}>
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 block">
              {building.id === 'CT_1_2' ? 'Contador CT 2 (kWh)' : 'Contador B (kWh)'}
            </label>
            <div className="flex items-center gap-4 mb-4">
               <div className="flex-1 text-center opacity-30"><div className="text-[8px] font-black uppercase mb-1">Anterior</div><div className="font-mono text-sm font-bold text-gray-900">{lastReading?.value2 || '0'}</div></div>
               <div className="flex-1 text-center"><div className="text-[8px] font-black uppercase text-blue-600 mb-1">Delta</div><div className="font-mono text-sm font-bold text-blue-600">+{v2Status.diff.toFixed(1)}</div></div>
            </div>
            <input type="text" inputMode="decimal" value={val2} onChange={e => setVal2(e.target.value)} className="w-full p-6 bg-gray-50 rounded-3xl text-4xl font-mono text-center outline-none border-2 border-transparent focus:border-tactical-orange transition-all font-black text-gray-900 placeholder-gray-200" placeholder="00000.0" />
          </div>
        )}

        <div className="p-6 rounded-[2.5rem] bg-white border border-gray-100 shadow-sm">
          <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 block">Fecha de Lectura</label>
          <input 
            type="date" 
            value={date} 
            onChange={e => setDate(e.target.value)} 
            className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold text-xs outline-none focus:border-tactical-orange transition-all text-gray-900"
          />
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 animate-in shake">
            <AlertTriangle className="w-4 h-4" />
            {errorMsg}
          </div>
        )}

        {showWarning && (
          <div className="p-6 bg-red-50 border border-red-100 rounded-[2rem] space-y-4 animate-in slide-in-from-top-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              <div className="text-[11px] font-black uppercase tracking-widest">Atención: Lectura Inferior</div>
            </div>
            <p className="text-[10px] font-bold text-red-600/60 leading-relaxed">
              La lectura introducida es menor que la anterior registrada ({lastReading?.value1}). 
              Esto puede deberse a un error o a un cambio de contador. ¿Desea continuar?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowWarning(false)}
                className="flex-1 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
              >
                Corregir
              </button>
              <button 
                onClick={() => handleSave(true)}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg"
              >
                Forzar Registro
              </button>
            </div>
          </div>
        )}

        <button 
          onClick={() => handleSave()} 
          disabled={saving || showWarning}
          className="w-full p-7 bg-tactical-orange text-black rounded-[2.5rem] font-black shadow-lg active:scale-95 transition-all uppercase tracking-[0.2em] text-sm mt-4 hover:bg-tactical-orange/90 disabled:opacity-50 disabled:scale-100 shadow-tactical-orange/20"
        >
          {saving ? (
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Guardando...</span>
            </div>
          ) : (
            'Validar Lectura Oficial'
          )}
        </button>
      </div>
    </div>
  );
};

export default Scanner;
