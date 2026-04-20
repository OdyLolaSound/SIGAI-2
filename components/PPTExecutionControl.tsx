
import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Calendar,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  FileDown,
  Mail,
  Info,
  Check,
  MapPin,
  Settings,
  Loader2
} from 'lucide-react';
import { PPT, PPTTask, PPTExecution, PPTTaskExecution } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { storageService } from '../services/storageService';
import { auth } from '../firebase';

interface PPTExecutionControlProps {
  ppt: PPT;
  onBack: () => void;
}

const PPTExecutionControl: React.FC<PPTExecutionControlProps> = ({ ppt, onBack }) => {
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [completionStatus, setCompletionStatus] = useState<Record<string, 'done' | 'not_done' | 'pending'>>({});
  const [nonCompletionNotes, setNonCompletionNotes] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const frequencies = {
    diaria: 1,
    semanal: 1,
    mensual: 1,
    trimestral: 3,
    semestral: 6,
    anual: 12,
    bienal: 24,
    otros: 0
  };

  const applicableTasks = useMemo(() => {
    const selectedDate = new Date(visitDate);
    const startMonth = new Date(ppt.validFrom).getMonth();
    const startYear = new Date(ppt.validFrom).getFullYear();
    const diffMonths = (selectedDate.getFullYear() - startYear) * 12 + (selectedDate.getMonth() - startMonth);

    return ppt.tasks.filter(task => {
      const freqMonths = frequencies[task.frequency as keyof typeof frequencies] || 0;
      
      if (task.frequency === 'diaria' || task.frequency === 'semanal' || task.frequency === 'mensual') {
        return true;
      }
      if (freqMonths > 0 && diffMonths >= 0 && diffMonths % freqMonths === 0) {
        return true;
      }
      return false;
    });
  }, [ppt, visitDate]);

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const dateFormatted = new Date(visitDate).toLocaleDateString('es-ES');
    
    doc.setFontSize(18);
    doc.text(`Control de Ejecución - ${ppt.title}`, 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Empresa: ${ppt.companyName || 'N/A'}`, 14, 30);
    doc.text(`Fecha de Visita: ${dateFormatted}`, 14, 35);
    doc.text(`Generado el: ${new Date().toLocaleDateString()}`, 14, 40);

    const tableData = applicableTasks.map(t => {
      const status = completionStatus[t.id] || 'pending';
      const statusText = status === 'done' ? 'REALIZADO' : status === 'not_done' ? 'NO REALIZADO' : 'PENDIENTE';
      const note = nonCompletionNotes[t.id] || '';
      
      return [
        `${t.description}${t.equipment ? `\n[Equipo: ${t.equipment}]` : ''}${t.location ? `\n[Ubicación: ${t.location}]` : ''}`,
        t.frequency.toUpperCase(),
        statusText,
        note
      ];
    });

    autoTable(doc, {
      startY: 50,
      head: [['Tarea', 'Frecuencia', 'Estado', 'Observaciones/Motivo']],
      body: tableData,
      headStyles: { fillColor: [17, 24, 39], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      styles: { fontSize: 9 },
      columnStyles: {
        2: { fontStyle: 'bold' }
      }
    });

    // Signatures section
    const finalY = (doc as any).lastAutoTable.finalY + 30;
    doc.line(14, finalY, 80, finalY);
    doc.text('Firma Responsable Unidad', 14, finalY + 5);
    
    doc.line(120, finalY, 186, finalY);
    doc.text('Firma Responsable Empresa', 120, finalY + 5);

    doc.save(`Parte_Trabajo_${ppt.title.replace(/\s+/g, '_')}_${visitDate}.pdf`);
  };

  const handleFinishVisit = async () => {
    // Check if all applicable tasks have a status
    const pendingTasks = applicableTasks.filter(t => !completionStatus[t.id] || completionStatus[t.id] === 'pending');
    if (pendingTasks.length > 0) {
      alert(`Por favor, complete el estado de todas las tareas (${pendingTasks.length} pendientes).`);
      return;
    }

    // Check if all 'not_done' tasks have a note
    const missingNotes = applicableTasks.filter(t => completionStatus[t.id] === 'not_done' && !nonCompletionNotes[t.id]);
    if (missingNotes.length > 0) {
      alert('Por favor, indique el motivo para todas las tareas no realizadas.');
      return;
    }

    setIsSaving(true);
    try {
      const taskExecutions: PPTTaskExecution[] = applicableTasks.map(t => ({
        taskId: t.id,
        status: completionStatus[t.id] as 'done' | 'not_done',
        notes: nonCompletionNotes[t.id]
      }));

      await storageService.savePPTExecution({
        pptId: ppt.id,
        visitDate,
        performedBy: auth.currentUser?.uid || 'anonymous',
        performedByName: auth.currentUser?.displayName || 'Técnico Externo',
        tasks: taskExecutions
      });

      handleDownloadPDF();
      alert('Control de ejecución guardado correctamente.');
      onBack();
    } catch (error) {
      console.error('Error saving execution:', error);
      alert('Error al guardar el control de ejecución.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden animate-in fade-in duration-300">
      {/* Header */}
      <div className="p-6 flex items-center justify-between bg-gray-900 border-b border-white/10 z-10">
        <button onClick={onBack} className="p-3 bg-white/10 rounded-2xl text-white active:scale-95 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h3 className="text-lg font-black text-white uppercase tracking-tighter">Control de Ejecución</h3>
          <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">{ppt.title}</p>
        </div>
        <div className="w-11" />
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div className="max-w-md mx-auto space-y-6">
          {/* Date Selector */}
          <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-gray-100 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Fecha de la Visita</h4>
            </div>
            <input 
              type="date" 
              value={visitDate}
              onChange={e => setVisitDate(e.target.value)}
              className="w-full p-5 bg-gray-50 rounded-2xl font-black text-sm outline-none border-2 border-transparent focus:border-gray-900 transition-all"
            />
            <p className="text-[9px] text-gray-400 font-bold uppercase leading-relaxed px-2">
              El sistema filtrará automáticamente las tareas que corresponden realizar según la frecuencia y la fecha seleccionada.
            </p>
          </div>

          {/* Tasks List */}
          <div className="space-y-4 pb-24">
            <div className="flex items-center justify-between px-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tareas Aplicables ({applicableTasks.length})</h4>
              <button 
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600"
              >
                <FileDown className="w-4 h-4" /> Generar Parte
              </button>
            </div>

            {applicableTasks.length > 0 ? (
              applicableTasks.map(task => (
                <div key={task.id} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-900 shrink-0">
                        <Check className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[8px] font-black bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full uppercase tracking-widest">{task.frequency}</span>
                          {task.equipment && (
                            <span className="text-[8px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1">
                              <Settings className="w-2 h-2" /> {task.equipment}
                            </span>
                          )}
                          {task.location && (
                            <span className="text-[8px] font-black bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1">
                              <MapPin className="w-2 h-2" /> {task.location}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-gray-800 leading-tight">{task.description}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => setCompletionStatus(prev => ({ ...prev, [task.id]: 'done' }))}
                        className={`p-3 rounded-2xl transition-all ${completionStatus[task.id] === 'done' ? 'bg-green-500 text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-green-50 hover:text-green-500'}`}
                      >
                        <CheckCircle2 className="w-6 h-6" />
                      </button>
                      <button 
                        onClick={() => setCompletionStatus(prev => ({ ...prev, [task.id]: 'not_done' }))}
                        className={`p-3 rounded-2xl transition-all ${completionStatus[task.id] === 'not_done' ? 'bg-red-500 text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500'}`}
                      >
                        <XCircle className="w-6 h-6" />
                      </button>
                    </div>
                  </div>

                  {completionStatus[task.id] === 'not_done' && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                      <label className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-2 block px-2">Motivo del Incumplimiento</label>
                      <textarea 
                        value={nonCompletionNotes[task.id] || ''}
                        onChange={e => setNonCompletionNotes(prev => ({ ...prev, [task.id]: e.target.value }))}
                        placeholder="Indique por qué no se ha realizado la tarea..."
                        className="w-full p-4 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-900 outline-none focus:ring-2 ring-red-500/20 h-20 resize-none"
                      />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
                <Info className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">No hay tareas para esta fecha</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="p-6 bg-white border-t border-gray-100 shadow-2xl">
        <button 
          onClick={handleFinishVisit}
          disabled={isSaving}
          className="w-full max-w-md mx-auto p-6 bg-gray-900 text-yellow-400 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <FileDown className="w-6 h-6" />
          )}
          {isSaving ? 'Guardando...' : 'Finalizar y Guardar Control'}
        </button>
      </div>
    </div>
  );
};

export default PPTExecutionControl;
