
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, Loader2, Maximize2, Minimize2, Sparkles } from 'lucide-react';
import Markdown from 'react-markdown';
import { askGeminiAboutData } from '../services/geminiService';
import { storageService } from '../services/storageService';

const GlobalAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'usuario' | 'asistente', content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!query.trim() || loading) return;

    const userMessage = query.trim();
    setQuery('');
    setMessages(prev => [...prev, { role: 'usuario', content: userMessage }]);
    setLoading(true);

    try {
      // Gather context
      const context = {
        readings: storageService.getReadings(),
        tasks: storageService.getTasks(),
        requests: storageService.getRequests(),
        users: storageService.getUsers().map(u => ({ name: u.name, role: u.role, status: u.status })),
        notifications: storageService.getNotifications().filter(n => !n.read)
      };

      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const response = await askGeminiAboutData(userMessage, context, history);
      
      setMessages(prev => [...prev, { role: 'asistente', content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'asistente', content: "Error al conectar con el centro de inteligencia." }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-tactical-orange text-black rounded-2xl shadow-2xl flex items-center justify-center active:scale-90 transition-all z-50 group overflow-hidden"
      >
        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
        <Sparkles className="w-6 h-6 relative z-10 animate-pulse" />
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 ${isExpanded ? 'w-[90vw] h-[80vh] md:w-[600px]' : 'w-[350px] h-[500px]'} bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl flex flex-col z-50 animate-in zoom-in-95 duration-200 overflow-hidden border border-gray-100`}>
      {/* Header */}
      <header className="p-6 bg-white border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-tactical-orange/10 rounded-xl flex items-center justify-center">
            <Bot className="w-5 h-5 text-tactical-orange" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-900">SIGAI Intelligence</h3>
            <p className="text-[8px] font-bold text-tactical-emerald uppercase tracking-widest">En Línea · Analizando Datos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button onClick={() => setIsOpen(false)} className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide bg-gray-50/50">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
            <Sparkles className="w-12 h-12 text-tactical-orange" />
            <p className="text-[10px] font-black uppercase tracking-widest max-w-[200px] text-gray-400">
              Pregúntame sobre consumos, tareas pendientes o estado de la unidad.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'usuario' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-3xl text-[11px] leading-relaxed ${
              m.role === 'usuario' 
                ? 'bg-tactical-orange text-black font-bold' 
                : 'bg-white border border-gray-100 text-gray-700 shadow-sm'
            }`}>
              <div className="markdown-body">
                <Markdown>{m.content}</Markdown>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 p-4 rounded-3xl flex items-center gap-3 shadow-sm">
              <Loader2 className="w-4 h-4 text-tactical-orange animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Procesando...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <footer className="p-6 bg-white border-t border-gray-100">
        <div className="relative">
          <input 
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Escribe tu consulta..."
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 pr-14 text-[11px] font-bold outline-none focus:ring-2 ring-tactical-orange/20 transition-all text-gray-900"
          />
          <button 
            onClick={handleSend}
            disabled={!query.trim() || loading}
            className="absolute right-2 top-2 w-10 h-10 bg-tactical-orange text-black rounded-xl flex items-center justify-center active:scale-90 transition-all disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
};

export default GlobalAssistant;
