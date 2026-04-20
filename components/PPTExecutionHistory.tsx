
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  User as UserIcon, 
  CheckCircle2, 
  XCircle, 
  FileText,
  Clock,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { PPT, PPTExecution } from '../types';
import { storageService } from '../services/storageService';

interface PPTExecutionHistoryProps {
  ppt: PPT;
  onBack: () => void;
}

const PPTExecutionHistory: React.FC<PPTExecutionHistoryProps> = ({ ppt, onBack }) => {
  const [executions, setExecutions] = useState<PPTExecution[]>([]);
  const [expandedExec, setExpandedExec] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const history = await storageService.getPPTExecutions(ppt.id);
        // Sort by date descending
        setExecutions(history.sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()));
      } catch (error) {
        console.error('Error fetching PPT history:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [ppt.id]);

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden animate-in fade-in duration-300">
      {/* Header */}
      <div className="p-6 flex items-center justify-between bg-gray-900 border-b border-white/10 z-10">
        <button onClick={onBack} className="p-3 bg-white/10 rounded-2xl text-white active:scale-95 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h3 className="text-lg font-black text-white uppercase tracking-tighter">Historial de Visitas</h3>
          <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">{ppt.title}</p>
        </div>
        <div className="w-11" />
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div className="max-w-md mx-auto space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Clock className="w-10 h-10 text-gray-300 animate-spin mb-4" />
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cargando historial...</p>
            </div>
          ) : executions.length > 0 ? (
            <div className="space-y-4">
              {executions.map(exec => (
                <div key={exec.id} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                  <div 
                    className="p-6 flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedExec(expandedExec === exec.id ? null : exec.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-900">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-900">{new Date(exec.visitDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                          <UserIcon className="w-2 h-2" /> {exec.performedByName}
                        </p>
                      </div>
                    </div>
                    {expandedExec === exec.id ? <ChevronUp className="w-5 h-5 text-gray-300" /> : <ChevronDown className="w-5 h-5 text-gray-300" />}
                  </div>

                  {expandedExec === exec.id && (
                    <div className="px-6 pb-6 pt-2 border-t border-gray-50 animate-in slide-in-from-top-2 duration-300">
                      <div className="space-y-3">
                        <h4 className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-2">Resultado de la Inspección</h4>
                        {exec.tasks.map(taskExec => {
                          const taskDef = ppt.tasks.find(t => t.id === taskExec.taskId);
                          return (
                            <div key={taskExec.taskId} className="p-4 bg-gray-50 rounded-2xl space-y-2">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3">
                                  {taskExec.status === 'done' ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                  )}
                                  <div>
                                    <p className="text-[10px] font-bold text-gray-800 leading-tight">
                                      {taskDef?.description || 'Tarea eliminada'}
                                    </p>
                                    {taskDef?.equipment && (
                                      <p className="text-[8px] text-gray-400 font-bold uppercase mt-1">
                                        {taskDef.equipment} - {taskDef.location}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${taskExec.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {taskExec.status === 'done' ? 'OK' : 'NO'}
                                </span>
                              </div>
                              {taskExec.notes && (
                                <div className="pl-7">
                                  <p className="text-[9px] text-red-600 font-bold italic bg-red-50 p-2 rounded-lg border border-red-100">
                                    Nota: {taskExec.notes}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
              <Info className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">No hay visitas registradas aún</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PPTExecutionHistory;
