
import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, X, Trash2, AlertCircle, User as UserIcon, CheckCircle2, Clock, FileText, Download, ShieldCheck, MessageSquare } from 'lucide-react';
import { User, LeaveType, LeaveEntry, Approval } from '../types';
import { storageService } from '../services/storageService';
import { getLocalDateString, isHoliday } from '../services/dateUtils';
import SignaturePad from './SignaturePad';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface LaborCalendarProps {
  user: User;
  onUpdate: (updatedUser: User) => void;
}

const LEAVE_TYPES: LeaveType[] = [
  'VA - VACACIONES',
  'AP - ASUNTOS PROPIOS',
  'DO - DESCANSO OBLIGATORIO',
  'DA - DESCANSO ADICIONAL',
  'MA - MANIOBRAS',
  'BM - BAJA MÉDICA',
  'AZ - ENFERMO DOMICILIO',
  'PV - PERMISOS VARIOS',
  'VA - VACACIONES (AÑO ANTERIOR)',
  'AP - ASUNTOS PROPIOS (AÑO ANTERIOR)',
  'CON - CONCILIACIÓN FAMILIAR',
  'CS - COMISIÓN DE SERVICIO',
  'CS - EJERCICIOS VARIOS',
  'SG - SERVICIO DE GUARDIA',
  'JIP - JORNADA DE INSTRUCCIÓN PROLONGADA',
  'JIC - JORNADA DE INSTRUCCIÓN CONTINUA',
  'CU - CURSO',
  'FH - FLEXIBILIDAD HORARIA',
  'RJ - REDUCCIÓN DE JORNADA',
  'Otro'
];

const LaborCalendar: React.FC<LaborCalendarProps> = ({ user, onUpdate }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<LeaveType>(LEAVE_TYPES[0]);
  const [notes, setNotes] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedApprovers, setSelectedApprovers] = useState<string[]>([]);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<LeaveEntry[]>([]);
  const [signingApprovalId, setSigningApprovalId] = useState<string | null>(null);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);

  const isTecnico = user.userCategory === 'Técnico';
  const isOficina = user.userCategory === 'Oficina de Control' || user.role === 'MASTER';
  const oficinaUsers = useMemo(() => storageService.getUsers().filter(u => u.userCategory === 'Oficina de Control' && u.id !== user.id), []);

  useEffect(() => {
    if (isOficina) {
      const allRequests = storageService.getLeaveRequests();
      const pending = allRequests.filter(r => 
        r.approvers.includes(user.id) && 
        !r.approvals.find(a => a.userId === user.id) &&
        r.status !== 'rejected' &&
        r.status !== 'approved'
      );
      setPendingApprovals(pending);
    }
  }, [isOficina, user.id, storageService.getLeaveRequests()]);

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const date = new Date(year, month, 1);
    const days = [];
    const firstDay = date.getDay() === 0 ? 6 : date.getDay() - 1; 
    
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [currentDate]);

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  const handleDateClick = (dateStr: string) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(dateStr);
      setEndDate(null);
    } else {
      if (dateStr < startDate) {
        setStartDate(dateStr);
      } else {
        setEndDate(dateStr);
      }
    }
  };

  const handleAddLeave = () => {
    if (!startDate) return;
    if (selectedApprovers.length < 2) {
      alert("Debes seleccionar 2 usuarios de Oficina de Control para la aprobación.");
      return;
    }
    setShowSignaturePad(true);
  };

  const submitLeaveRequest = async (signature: string) => {
    const finalEndDate = endDate || startDate;
    const newEntry: LeaveEntry = {
      id: editingRequestId || crypto.randomUUID(),
      userId: user.id,
      userName: user.name,
      type: selectedType,
      startDate: startDate!,
      endDate: finalEndDate!,
      notes: selectedType === 'PV - PERMISOS VARIOS' ? notes : '',
      status: 'pending',
      createdAt: new Date().toISOString(),
      requesterSignature: signature,
      approvers: selectedApprovers,
      approvals: []
    };

    await storageService.saveLeaveRequest(newEntry);
    
    // Notify approvers
    selectedApprovers.forEach(approverId => {
      storageService.addNotification({
        id: crypto.randomUUID(),
        userId: approverId,
        title: editingRequestId ? 'Solicitud de Permiso Modificada' : 'Nueva Solicitud de Permiso',
        message: `${user.name} ha ${editingRequestId ? 'modificado' : 'solicitado'} un permiso de ${selectedType}.`,
        type: 'system',
        read: false,
        date: new Date().toISOString(),
        relatedId: newEntry.id
      });
    });

    setStartDate(null);
    setEndDate(null);
    setNotes('');
    setSelectedApprovers([]);
    setShowSignaturePad(false);
    setIsAdding(false);
    setEditingRequestId(null);
  };

  const handleApprove = (requestId: string) => {
    setSigningApprovalId(requestId);
  };

  const submitApproval = async (signature: string) => {
    if (!signingApprovalId) return;
    
    const request = storageService.getLeaveRequests().find(r => r.id === signingApprovalId);
    if (!request) return;

    const newApproval: Approval = {
      userId: user.id,
      userName: user.name,
      status: 'approved',
      signature,
      date: new Date().toISOString()
    };

    const updatedApprovals = [...request.approvals, newApproval];
    let newStatus: LeaveEntry['status'] = 'partially_approved';
    
    // Check if all required approvers have approved
    if (updatedApprovals.length >= request.approvers.length) {
      newStatus = 'approved';
    }

    const updatedRequest: LeaveEntry = {
      ...request,
      approvals: updatedApprovals,
      status: newStatus
    };

    await storageService.saveLeaveRequest(updatedRequest);
    
    // Notify requester
    storageService.addNotification({
      id: crypto.randomUUID(),
      userId: request.userId,
      title: newStatus === 'approved' ? 'Permiso Aprobado' : 'Permiso Parcialmente Aprobado',
      message: `${user.name} ha firmado tu solicitud de permiso.`,
      type: 'system',
      read: false,
      date: new Date().toISOString(),
      relatedId: request.id
    });

    setSigningApprovalId(null);
  };

  const generatePDF = (entry: LeaveEntry) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.text('SOLICITUD DE PERMISO / LICENCIA', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`ID Solicitud: ${entry.id}`, 20, 35);
    doc.text(`Fecha de Solicitud: ${new Date(entry.createdAt).toLocaleDateString()}`, 20, 42);
    
    // User Info
    doc.setFontSize(14);
    doc.text('DATOS DEL SOLICITANTE', 20, 55);
    doc.line(20, 57, 190, 57);
    
    doc.setFontSize(12);
    doc.text(`Nombre: ${entry.userName}`, 20, 65);
    doc.text(`Categoría: ${isTecnico ? 'Técnico' : 'Oficina de Control'}`, 20, 72);
    
    // Leave Info
    doc.setFontSize(14);
    doc.text('DETALLES DEL PERMISO', 20, 85);
    doc.line(20, 87, 190, 87);
    
    doc.setFontSize(12);
    doc.text(`Tipo: ${entry.type}`, 20, 95);
    doc.text(`Periodo: Del ${entry.startDate} al ${entry.endDate}`, 20, 102);
    if (entry.notes) {
      doc.text(`Observaciones: ${entry.notes}`, 20, 109);
    }
    
    // Signatures
    doc.setFontSize(14);
    doc.text('FIRMAS Y APROBACIONES', 20, 125);
    doc.line(20, 127, 190, 127);
    
    // Requester Signature
    if (entry.requesterSignature) {
      doc.setFontSize(10);
      doc.text('Firma del Solicitante:', 20, 140);
      doc.addImage(entry.requesterSignature, 'PNG', 20, 145, 50, 25);
      doc.text(entry.userName, 20, 175);
    }
    
    // Approver Signatures
    let yPos = 140;
    entry.approvals.forEach((app, idx) => {
      const xPos = 80 + (idx * 60);
      doc.setFontSize(10);
      doc.text(`Aprobado por:`, xPos, yPos);
      if (app.signature) {
        doc.addImage(app.signature, 'PNG', xPos, yPos + 5, 50, 25);
      }
      doc.text(app.userName, xPos, yPos + 35);
      doc.text(new Date(app.date!).toLocaleDateString(), xPos, yPos + 40);
    });
    
    // Status Stamp
    doc.setFontSize(20);
    doc.setTextColor(entry.status === 'approved' ? 0 : 200, entry.status === 'approved' ? 150 : 0, 0);
    doc.text(entry.status.toUpperCase(), 105, 250, { align: 'center' });
    
    doc.save(`Permiso_${entry.userName}_${entry.startDate}.pdf`);
  };

  const toggleApprover = (id: string) => {
    setSelectedApprovers(prev => 
      prev.includes(id) ? prev.filter(aid => aid !== id) : [...prev, id]
    );
  };

  const handleRemoveEntry = async (entryId: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta solicitud?')) {
      await storageService.deleteLeaveRequest(entryId);
    }
  };

  const handleEditEntry = (entry: LeaveEntry) => {
    setEditingRequestId(entry.id);
    setStartDate(entry.startDate);
    setEndDate(entry.endDate);
    setSelectedType(entry.type);
    setNotes(entry.notes || '');
    setSelectedApprovers(entry.approvers || []);
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNotifyWhatsApp = (entry: LeaveEntry, approverId: string) => {
    const approver = storageService.getUsers().find(u => u.id === approverId);
    if (!approver || !approver.phone) {
      alert("Este responsable no tiene configurado su número de teléfono en su perfil.");
      return;
    }
    
    const phone = approver.phone.replace(/\+/g, '').replace(/\s/g, '');
    const dates = entry.startDate === entry.endDate ? entry.startDate : `del ${entry.startDate} al ${entry.endDate}`;
    const appUrl = window.location.origin;
    const message = `🔔 *SIGAI USAC: Firma Pendiente*\n\nHola ${approver.name.split(' ')[0]}, tienes una solicitud de permiso pendiente de tu firma.\n\n*Solicitante:* ${user.name}\n*Tipo:* ${entry.type}\n*Fechas:* ${dates}\n\n👉 *Firma aquí:* ${appUrl}\n\nGracias.`;
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const isInRange = (dateStr: string) => {
    if (!startDate) return false;
    if (dateStr === startDate) return true;
    if (!endDate) return false;
    return dateStr >= startDate && dateStr <= endDate;
  };

  const getLeaveTypeForDate = (dateStr: string) => {
    return storageService.getLeaveRequests().find(e => e.userId === user.id && dateStr >= e.startDate && dateStr <= e.endDate);
  };

  return (
    <div className="space-y-6">
      {/* SECCIÓN DE APROBACIONES PENDIENTES (Solo Oficina) */}
      {isOficina && pendingApprovals.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-100 rounded-[2.5rem] p-6 space-y-4 animate-in slide-in-from-top-4">
          <div className="flex items-center gap-3 px-2">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-800">Aprobaciones Pendientes</h4>
            <span className="bg-amber-200 text-amber-800 text-[8px] font-black px-2 py-0.5 rounded-full">{pendingApprovals.length}</span>
          </div>
          
          <div className="space-y-3">
            {pendingApprovals.map(req => (
              <div key={req.id} className="bg-white rounded-2xl p-4 shadow-sm border border-amber-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center font-black text-[10px]">
                    {req.userName.substring(0,2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-gray-900 uppercase leading-none mb-1">{req.userName}</div>
                    <div className="text-[8px] font-bold text-amber-600 uppercase tracking-widest">{req.type}</div>
                    <div className="text-[8px] text-gray-400 font-bold mt-1">Del {req.startDate} al {req.endDate}</div>
                  </div>
                </div>
                <button 
                  onClick={() => handleApprove(req.id)}
                  className="px-4 py-2 bg-gray-900 text-yellow-400 rounded-xl font-black uppercase text-[8px] tracking-widest active:scale-95 transition-all"
                >
                  Firmar y Aprobar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-[2.5rem] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            {currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
          </h4>
          <div className="flex gap-2">
            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-50 rounded-lg transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-50 rounded-lg transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-4">
          {['L','M','X','J','V','S','D'].map(d => (
            <div key={d} className="text-center text-[9px] font-black text-gray-300 uppercase py-2">{d}</div>
          ))}
          {daysInMonth.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="h-10" />;
            const dateStr = getLocalDateString(day);
            const isHolidayDay = isHoliday(day);
            const leaveEntry = getLeaveTypeForDate(dateStr);
            const selected = isInRange(dateStr);
            const isToday = new Date().toDateString() === day.toDateString();

            return (
              <button 
                key={dateStr}
                onClick={() => handleDateClick(dateStr)}
                className={`
                  relative h-10 flex flex-col items-center justify-center rounded-xl transition-all text-[10px] font-black
                  ${selected ? 'bg-yellow-400 text-black z-10 scale-105 shadow-md' : 
                    leaveEntry ? 'bg-red-50 text-red-600 border border-red-100' :
                    isHolidayDay ? 'bg-amber-50 text-amber-700' :
                    isToday ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}
                `}
              >
                <span>{day.getDate()}</span>
                {isHolidayDay && !selected && !leaveEntry && (
                  <div className="absolute bottom-1 w-1 h-1 bg-amber-400 rounded-full" />
                )}
                {leaveEntry && !selected && (
                  <div className="absolute bottom-1 w-1 h-1 bg-red-400 rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-amber-50 border border-amber-100 rounded-full" />
            <span className="text-[8px] font-black uppercase text-gray-400">Festivo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-50 border border-red-100 rounded-full" />
            <span className="text-[8px] font-black uppercase text-gray-400">Permiso</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-400 rounded-full" />
            <span className="text-[8px] font-black uppercase text-gray-400">Selección</span>
          </div>
        </div>
      </div>

      {startDate && (
        <div className="bg-gray-900 text-white rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-4">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h5 className="text-[10px] font-black uppercase tracking-widest text-yellow-400 mb-1">
                {editingRequestId ? 'Modificar Solicitud' : 'Nuevo Permiso'}
              </h5>
              <p className="text-lg font-black uppercase tracking-tight">
                {endDate ? `Del ${new Date(startDate).getDate()} al ${new Date(endDate).getDate()}` : `Día ${new Date(startDate).getDate()}`}
                <span className="text-xs text-gray-400 ml-2">de {new Date(startDate).toLocaleString('es-ES', { month: 'long' })}</span>
              </p>
            </div>
            <button onClick={() => { setStartDate(null); setEndDate(null); setEditingRequestId(null); }} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[8px] font-black uppercase tracking-widest text-gray-500 block mb-2">Tipo de Permiso</label>
              <select 
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as LeaveType)}
                className="w-full bg-white/10 border border-white/10 rounded-xl p-4 text-xs font-bold outline-none focus:border-yellow-400 transition-colors"
              >
                {LEAVE_TYPES.map(type => (
                  <option key={type} value={type} className="bg-gray-900 text-white">{type}</option>
                ))}
              </select>
            </div>

            {selectedType === 'PV - PERMISOS VARIOS' && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <label className="text-[8px] font-black uppercase tracking-widest text-gray-500 block mb-2">Detalle del Permiso (Hospitalización, Grado, etc.)</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Hospitalización familiar 1º grado..."
                  className="w-full bg-white/10 border border-white/10 rounded-xl p-4 text-xs font-bold outline-none focus:border-yellow-400 transition-colors h-20 resize-none"
                />
              </div>
            )}

            {/* Selección de Aprobadores (Obligatorio para todos) */}
            <div className="space-y-3">
              <label className="text-[8px] font-black uppercase tracking-widest text-gray-500 block px-1">Seleccionar 2 Responsables (Oficina de Control)</label>
              <div className="grid grid-cols-2 gap-2">
                {oficinaUsers.map(oficina => (
                  <button
                    key={oficina.id}
                    onClick={() => toggleApprover(oficina.id)}
                    className={`p-3 rounded-xl border-2 transition-all flex items-center gap-2 ${selectedApprovers.includes(oficina.id) ? 'bg-yellow-400 border-yellow-400 text-black' : 'bg-white/5 border-white/10 text-white/40'}`}
                  >
                    <UserIcon className="w-3 h-3" />
                    <span className="text-[9px] font-black uppercase truncate">{oficina.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
              {selectedApprovers.length < 2 && (
                <p className="text-[7px] font-bold text-red-400 uppercase tracking-widest flex items-center gap-1">
                  <AlertCircle className="w-2 h-2" /> Faltan {2 - selectedApprovers.length} responsables
                </p>
              )}
            </div>

            <button 
              onClick={handleAddLeave}
              className="w-full p-5 bg-yellow-400 text-black rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> {editingRequestId ? 'Guardar Cambios y Re-firmar' : 'Solicitar y Firmar'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-2">Mis Solicitudes de Permiso</h5>
        {storageService.getLeaveRequests().filter(r => r.userId === user.id).length === 0 ? (
          <div className="bg-gray-50 border-2 border-dashed border-gray-100 rounded-[2rem] p-8 text-center">
            <CalendarIcon className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">No hay permisos registrados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {storageService.getLeaveRequests().filter(r => r.userId === user.id).sort((a,b) => b.startDate.localeCompare(a.startDate)).map(entry => (
              <div key={entry.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between group hover:border-yellow-100 transition-all">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] ${
                    entry.status === 'approved' ? 'bg-green-50 text-green-600' :
                    entry.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {entry.type.split(' - ')[0]}
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-gray-900 uppercase leading-none mb-1">
                      {entry.type.split(' - ')[1] || entry.type}
                      <span className={`ml-2 text-[7px] px-1.5 py-0.5 rounded-full ${
                        entry.status === 'approved' ? 'bg-green-100 text-green-700' :
                        entry.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {entry.status === 'approved' ? 'APROBADO' : 
                         entry.status === 'partially_approved' ? 'PARCIAL' : 'PENDIENTE'}
                      </span>
                    </div>
                    <div className="text-xs font-black text-gray-500 uppercase tracking-tight">
                      {entry.startDate === entry.endDate ? entry.startDate : `Del ${entry.startDate} al ${entry.endDate}`}
                    </div>
                    
                    {/* Botones de notificación WhatsApp para responsables pendientes */}
                    {(entry.status === 'pending' || entry.status === 'partially_approved') && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {entry.approvers.map(approverId => {
                          const hasSigned = entry.approvals.some(a => a.userId === approverId);
                          if (hasSigned) return null;
                          const approver = storageService.getUsers().find(u => u.id === approverId);
                          return (
                            <button
                              key={approverId}
                              onClick={() => handleNotifyWhatsApp(entry, approverId)}
                              className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-600 rounded-lg border border-green-100 hover:bg-green-100 transition-all active:scale-95"
                              title={`Notificar a ${approver?.name || 'Responsable'} por WhatsApp`}
                            >
                              <MessageSquare className="w-2.5 h-2.5" />
                              <span className="text-[7px] font-black uppercase tracking-tighter">Avisar a {approver?.name.split(' ')[0]}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {entry.status === 'pending' && (
                    <button 
                      onClick={() => handleEditEntry(entry)}
                      className="p-2 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Editar Solicitud"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  )}
                  {entry.status === 'approved' && (
                    <button 
                      onClick={() => generatePDF(entry)}
                      className="p-2 text-blue-400 hover:bg-blue-50 rounded-lg transition-all"
                      title="Descargar PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => handleRemoveEntry(entry.id)}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showSignaturePad && (
        <SignaturePad 
          onSave={submitLeaveRequest}
          onCancel={() => setShowSignaturePad(false)}
          title="Firma del Solicitante"
        />
      )}

      {signingApprovalId && (
        <SignaturePad 
          onSave={submitApproval}
          onCancel={() => setSigningApprovalId(null)}
          title="Firma de Aprobación"
        />
      )}
    </div>
  );
};

export default LaborCalendar;
