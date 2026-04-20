
import React, { useState, useRef } from 'react';
import { 
  FileText, X, ArrowLeft, Check, 
  Download, Share2, PenTool,
  Loader2, Mail, User, Building, Calendar, MapPin
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface VisitCertificateProps {
  onBack: () => void;
}

const VisitCertificate: React.FC<VisitCertificateProps> = ({ onBack }) => {
  const [step, setStep] = useState<'form' | 'sign_unit' | 'sign_bidder' | 'result'>('form');
  const [loading, setLoading] = useState(false);
  const [processedPdf, setProcessedPdf] = useState<Uint8Array | null>(null);

  // Form Data
  const [formData, setFormData] = useState({
    unitName: 'USAC "ALFÉREZ ROJAS NAVARRETE"',
    location: 'Alicante',
    date: new Date().toISOString().split('T')[0],
    bidderName: '',
    bidderCif: '',
    bidderRepresentative: '',
    projectTitle: '',
    visitDate: new Date().toISOString().split('T')[0],
    visitTime: '10:00',
    unitRepresentative: ''
  });

  const [unitSignature, setUnitSignature] = useState<string | null>(null);
  const [bidderSignature, setBidderSignature] = useState<string | null>(null);

  const unitSigRef = useRef<SignatureCanvas>(null);
  const bidderSigRef = useRef<SignatureCanvas>(null);

  const handleGeneratePdf = async () => {
    setLoading(true);
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]); // A4
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Header
      page.drawText('MINISTERIO DE DEFENSA', { x: 50, y: height - 50, size: 12, font: fontBold });
      page.drawText('EJÉRCITO DE TIERRA', { x: 50, y: height - 65, size: 10, font: font });
      page.drawText(formData.unitName, { x: 50, y: height - 80, size: 10, font: font });

      // Title
      page.drawText('CERTIFICADO DE VISITA A LAS INSTALACIONES', { 
        x: width / 2 - 150, 
        y: height - 150, 
        size: 14, 
        font: fontBold 
      });

      // Body text
      const bodyText = `D. ${formData.unitRepresentative}, en calidad de Responsable de la Unidad ${formData.unitName},`;
      page.drawText(bodyText, { x: 50, y: height - 200, size: 11, font: font });

      page.drawText('CERTIFICA:', { x: 50, y: height - 230, size: 11, font: fontBold });

      const certText = `Que la empresa ${formData.bidderName} con CIF ${formData.bidderCif}, representada por D. ${formData.bidderRepresentative}, ha procedido en el día de la fecha a realizar la visita técnica a las instalaciones objeto de la licitación:`;
      
      // Wrap text manually for simplicity
      page.drawText(certText.substring(0, 90), { x: 50, y: height - 260, size: 11, font: font });
      page.drawText(certText.substring(90), { x: 50, y: height - 275, size: 11, font: font });

      page.drawText(`PROYECTO: ${formData.projectTitle}`, { x: 50, y: height - 310, size: 11, font: fontBold });

      const footerText = `Y para que conste a los efectos de su participación en el proceso de licitación, se firma el presente certificado en ${formData.location} a ${new Date(formData.date).toLocaleDateString('es-ES')}.`;
      page.drawText(footerText.substring(0, 90), { x: 50, y: height - 360, size: 11, font: font });
      page.drawText(footerText.substring(90), { x: 50, y: height - 375, size: 11, font: font });

      // Signatures Labels
      page.drawText('POR LA UNIDAD (USAC)', { x: 80, y: height - 450, size: 10, font: fontBold });
      page.drawText('POR EL LICITADOR', { x: 380, y: height - 450, size: 10, font: fontBold });

      // Embed Signatures
      if (unitSignature) {
        const unitSigImg = await pdfDoc.embedPng(unitSignature);
        page.drawImage(unitSigImg, { x: 60, y: height - 550, width: 150, height: 80 });
      }

      if (bidderSignature) {
        const bidderSigImg = await pdfDoc.embedPng(bidderSignature);
        page.drawImage(bidderSigImg, { x: 360, y: height - 550, width: 150, height: 80 });
      }

      page.drawText(`Fdo: ${formData.unitRepresentative}`, { x: 60, y: height - 570, size: 9, font: font });
      page.drawText(`Fdo: ${formData.bidderRepresentative}`, { x: 360, y: height - 570, size: 9, font: font });

      const pdfBytes = await pdfDoc.save();
      setProcessedPdf(pdfBytes);
      setStep('result');
    } catch (err) {
      console.error(err);
      alert('Error al generar el certificado');
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = () => {
    if (!processedPdf) return;
    const blob = new Blob([processedPdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Certificado_Visita_${formData.bidderName.replace(/\s+/g, '_')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sharePdf = async () => {
    if (!processedPdf) return;
    const fileName = `Certificado_Visita_${formData.bidderName.replace(/\s+/g, '_')}.pdf`;
    const file = new File([processedPdf], fileName, { type: 'application/pdf' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Certificado de Visita',
          text: 'Certificado de visita técnica para licitación.',
        });
      } catch (err) {
        console.error(err);
      }
    } else {
      downloadPdf();
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
          <h3 className="text-lg font-black text-white uppercase tracking-tighter">Certificado de Visita</h3>
          <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Modelo Oficial Licitación</p>
        </div>
        <div className="w-11" />
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        {step === 'form' && (
          <div className="max-w-md mx-auto space-y-6 animate-in slide-in-from-bottom-4">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100 space-y-6">
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                  <Building className="w-4 h-4" /> Datos de la Unidad
                </h4>
                <div className="space-y-3">
                  <input 
                    type="text" 
                    placeholder="Nombre de la Unidad"
                    value={formData.unitName}
                    onChange={e => setFormData({...formData, unitName: e.target.value})}
                    className="w-full p-4 bg-gray-50 rounded-2xl text-xs font-bold outline-none border-2 border-transparent focus:border-gray-900 transition-all"
                  />
                  <input 
                    type="text" 
                    placeholder="Responsable de la Unidad"
                    value={formData.unitRepresentative}
                    onChange={e => setFormData({...formData, unitRepresentative: e.target.value})}
                    className="w-full p-4 bg-gray-50 rounded-2xl text-xs font-bold outline-none border-2 border-transparent focus:border-gray-900 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                  <User className="w-4 h-4" /> Datos del Licitador
                </h4>
                <div className="space-y-3">
                  <input 
                    type="text" 
                    placeholder="Nombre de la Empresa"
                    value={formData.bidderName}
                    onChange={e => setFormData({...formData, bidderName: e.target.value})}
                    className="w-full p-4 bg-gray-50 rounded-2xl text-xs font-bold outline-none border-2 border-transparent focus:border-gray-900 transition-all"
                  />
                  <input 
                    type="text" 
                    placeholder="CIF de la Empresa"
                    value={formData.bidderCif}
                    onChange={e => setFormData({...formData, bidderCif: e.target.value})}
                    className="w-full p-4 bg-gray-50 rounded-2xl text-xs font-bold outline-none border-2 border-transparent focus:border-gray-900 transition-all"
                  />
                  <input 
                    type="text" 
                    placeholder="Representante (D./Dña.)"
                    value={formData.bidderRepresentative}
                    onChange={e => setFormData({...formData, bidderRepresentative: e.target.value})}
                    className="w-full p-4 bg-gray-50 rounded-2xl text-xs font-bold outline-none border-2 border-transparent focus:border-gray-900 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Objeto de la Visita
                </h4>
                <textarea 
                  placeholder="Título del Proyecto / Licitación"
                  value={formData.projectTitle}
                  onChange={e => setFormData({...formData, projectTitle: e.target.value})}
                  className="w-full p-4 bg-gray-50 rounded-2xl text-xs font-bold outline-none border-2 border-transparent focus:border-gray-900 transition-all h-24 resize-none"
                />
              </div>

              <button 
                onClick={() => setStep('sign_unit')}
                disabled={!formData.bidderName || !formData.projectTitle || !formData.unitRepresentative}
                className="w-full p-6 bg-gray-900 text-yellow-400 rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-2xl active:scale-95 transition-all disabled:opacity-50"
              >
                Siguiente: Firmas
              </button>
            </div>
          </div>
        )}

        {(step === 'sign_unit' || step === 'sign_bidder') && (
          <div className="max-w-md mx-auto space-y-6 animate-in slide-in-from-bottom-4">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100 text-center space-y-6">
              <div>
                <h4 className="text-xl font-black uppercase tracking-tighter">
                  {step === 'sign_unit' ? 'Firma Responsable Unidad' : 'Firma Licitador'}
                </h4>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                  {step === 'sign_unit' ? formData.unitRepresentative : formData.bidderRepresentative}
                </p>
              </div>

              <div className="bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 overflow-hidden">
                <SignatureCanvas 
                  ref={step === 'sign_unit' ? unitSigRef : bidderSigRef}
                  penColor='black'
                  canvasProps={{
                    className: "w-full h-64 cursor-crosshair"
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => step === 'sign_unit' ? unitSigRef.current?.clear() : bidderSigRef.current?.clear()}
                  className="p-5 bg-gray-100 text-gray-400 rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all"
                >
                  Limpiar
                </button>
                <button 
                  onClick={() => {
                    if (step === 'sign_unit') {
                      if (unitSigRef.current?.isEmpty()) return alert('Por favor, firme');
                      setUnitSignature(unitSigRef.current.getCanvas().toDataURL());
                      setStep('sign_bidder');
                    } else {
                      if (bidderSigRef.current?.isEmpty()) return alert('Por favor, firme');
                      setBidderSignature(bidderSigRef.current.getCanvas().toDataURL());
                      handleGeneratePdf();
                    }
                  }}
                  className="p-5 bg-gray-900 text-yellow-400 rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all"
                >
                  {step === 'sign_unit' ? 'Siguiente' : 'Finalizar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'result' && (
          <div className="max-w-md mx-auto space-y-8 text-center animate-in zoom-in-95 py-12">
            <div className="w-24 h-24 bg-green-500/20 rounded-[2.5rem] flex items-center justify-center mx-auto border-2 border-green-500/30">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            <div>
              <h4 className="text-2xl font-black uppercase tracking-tighter">Certificado Generado</h4>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2">
                El documento está listo para ser enviado o descargado
              </p>
            </div>

            <div className="space-y-4">
              <button 
                onClick={downloadPdf}
                className="w-full p-7 bg-gray-900 text-white rounded-[2rem] font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-4 active:scale-95 transition-all shadow-2xl"
              >
                <Download className="w-5 h-5 text-yellow-400" /> Descargar PDF
              </button>
              <button 
                onClick={sharePdf}
                className="w-full p-7 bg-blue-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-4 active:scale-95 transition-all shadow-2xl"
              >
                <Share2 className="w-5 h-5" /> Enviar por WhatsApp / Mail
              </button>
              <button 
                onClick={() => setStep('form')}
                className="w-full p-4 text-gray-400 font-black uppercase tracking-widest text-[9px]"
              >
                Crear otro certificado
              </button>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[60] flex flex-col items-center justify-center text-white">
          <Loader2 className="w-12 h-12 animate-spin text-yellow-400 mb-4" />
          <p className="font-black uppercase tracking-widest text-xs">Generando Documento Oficial...</p>
        </div>
      )}
    </div>
  );
};

export default VisitCertificate;
