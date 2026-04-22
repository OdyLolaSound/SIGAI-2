
import React, { useState, useMemo } from 'react';
import { 
  Search, Phone, Smartphone, Mail, Building2, 
  User, Hash, Filter, ChevronRight, X,
  ExternalLink, MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PhoneContact, User as AppUser } from '../types';
import { storageService } from '../services/storageService';

interface PhoneGuideProps {
  currentUser: AppUser;
}

const PhoneGuide: React.FC<PhoneGuideProps> = ({ currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [selectedContact, setSelectedContact] = useState<PhoneContact | null>(null);

  const contacts = storageService.getPhoneContacts();

  const units = useMemo(() => {
    const u = new Set(contacts.map(c => c.unit));
    return ['all', ...Array.from(u).sort()];
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      const matchesSearch = 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.organization.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm) ||
        c.mobile.includes(searchTerm);
      
      const matchesUnit = selectedUnit === 'all' || c.unit === selectedUnit;

      return matchesSearch && matchesUnit;
    });
  }, [contacts, searchTerm, selectedUnit]);

  const groupedContacts = useMemo(() => {
    const groups: { [key: string]: PhoneContact[] } = {};
    filteredContacts.forEach(contact => {
      if (!groups[contact.organization]) {
        groups[contact.organization] = [];
      }
      groups[contact.organization].push(contact);
    });
    return groups;
  }, [filteredContacts]);

  const sortedOrganizations = useMemo(() => {
    return Object.keys(groupedContacts).sort();
  }, [groupedContacts]);

  const handleCall = (number: string) => {
    const cleanNumber = number.replace(/\D/g, '');
    window.location.href = `tel:${cleanNumber}`;
  };

  const handleWhatsApp = (number: string) => {
    // Extract first mobile if multiple
    const firstMobile = number.split('-')[0].split('/')[0].trim();
    const cleanNumber = firstMobile.replace(/\D/g, '');
    if (cleanNumber.length >= 9) {
      window.open(`https://wa.me/34${cleanNumber}`, '_blank');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="bg-gray-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-yellow-400 rounded-2xl text-black shadow-lg">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight leading-none">Guía de Teléfonos</h2>
              <p className="text-[10px] font-black text-yellow-400 uppercase tracking-[0.2em] mt-1">Directorio SIGAI-USAC</p>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Hash className="w-32 h-32" />
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white border border-gray-100 rounded-[2.5rem] p-6 shadow-sm sticky top-2 z-30 space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-5 h-5" />
          <input
            type="text"
            placeholder="BUSCAR POR NOMBRE, CARGO, TELÉFONO..."
            className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 text-xs font-black uppercase tracking-widest focus:ring-2 focus:ring-yellow-400 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {units.map(unit => (
            <button
              key={unit}
              onClick={() => setSelectedUnit(unit)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${
                selectedUnit === unit 
                  ? 'bg-yellow-400 text-black shadow-md' 
                  : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
              }`}
            >
              {unit === 'all' ? 'Ver Todo' : unit}
            </button>
          ))}
        </div>
      </div>

      {/* Contacts List grouped by Organization */}
      <div className="space-y-8">
        <AnimatePresence mode="popLayout">
          {sortedOrganizations.map((org, orgIdx) => (
            <motion.div
              layout
              key={org}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: orgIdx * 0.05 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 px-4 italic">
                <div className="h-px flex-1 bg-gray-100"></div>
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{org}</h4>
                <div className="h-px flex-1 bg-gray-100"></div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {groupedContacts[org].map((contact, idx) => (
                  <motion.div
                    layout
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className="group bg-white border border-gray-100 rounded-[2rem] p-5 shadow-sm hover:shadow-xl transition-all active:scale-[0.98] cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-yellow-400 group-hover:text-black transition-colors shrink-0">
                        <User className="w-6 h-6" />
                      </div>
                      <div className="overflow-hidden">
                        <div className="flex items-center gap-2">
                          {contact.employment && (
                            <span className="text-[10px] font-black text-yellow-500 uppercase tracking-tighter shrink-0">{contact.employment}</span>
                          )}
                          <h3 className="text-sm font-black text-gray-900 uppercase truncate">
                            {contact.name || contact.lastName ? `${contact.name} ${contact.lastName}` : contact.role}
                          </h3>
                        </div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest truncate">{contact.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden sm:flex flex-col text-right pr-4 border-r border-gray-50">
                        <span className="text-[10px] font-mono font-black text-gray-900">{contact.phone}</span>
                        <span className="text-[8px] font-mono font-bold text-gray-400">{contact.mobile}</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-200 group-hover:text-gray-900 transition-all" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {sortedOrganizations.length === 0 && (
          <div className="text-center py-20 bg-gray-50/50 rounded-[3rem] border border-dashed border-gray-200">
            <Filter className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No se han encontrado contactos</p>
          </div>
        )}
      </div>

      {/* Contact Details Modal */}
      <AnimatePresence>
        {selectedContact && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-gray-900 p-8 text-white relative">
                <button 
                  onClick={() => setSelectedContact(null)}
                  className="absolute top-6 right-6 p-2 rounded-full bg-white/10 text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-yellow-400 rounded-3xl flex items-center justify-center text-black shadow-xl">
                    <User className="w-8 h-8" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-yellow-400 uppercase">{selectedContact.employment}</span>
                    <h2 className="text-2xl font-black uppercase tracking-tight">{selectedContact.name} {selectedContact.lastName}</h2>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-gray-50 rounded-[2rem] p-6 space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-white rounded-xl text-gray-400 shadow-sm"><Building2 className="w-5 h-5" /></div>
                      <div>
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1">Unidad y Organización</span>
                        <p className="text-xs font-black text-gray-900 uppercase">{selectedContact.unit}</p>
                        <p className="text-[10px] font-bold text-gray-600 uppercase">{selectedContact.organization}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 border-t border-gray-100 pt-4">
                      <div className="p-3 bg-white rounded-xl text-gray-400 shadow-sm"><Hash className="w-5 h-5" /></div>
                      <div>
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1">Cargo / Puesto</span>
                        <p className="text-xs font-black text-gray-900 uppercase">{selectedContact.role}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button 
                      onClick={() => handleCall(selectedContact.phone)}
                      className="bg-gray-900 text-white rounded-[2rem] p-6 flex items-center gap-4 active:scale-95 transition-all shadow-lg text-left"
                    >
                      <div className="p-3 bg-white/10 rounded-xl"><Phone className="w-5 h-5 text-yellow-400" /></div>
                      <div>
                        <span className="text-[8px] font-black text-white/50 uppercase tracking-widest block">Teléfono (OF)</span>
                        <p className="text-lg font-mono font-black">{selectedContact.phone}</p>
                      </div>
                    </button>
                    
                    <button 
                      onClick={() => handleCall(selectedContact.mobile)}
                      className="bg-yellow-400 text-black rounded-[2rem] p-6 flex items-center gap-4 active:scale-95 transition-all shadow-lg text-left"
                    >
                      <div className="p-3 bg-black/10 rounded-xl"><Smartphone className="w-5 h-5" /></div>
                      <div>
                        <span className="text-[8px] font-black text-black/40 uppercase tracking-widest block">Móvil / Oficial</span>
                        <p className="text-lg font-mono font-black">{selectedContact.mobile}</p>
                      </div>
                    </button>
                  </div>

                  <div className="flex gap-4">
                    {selectedContact.email && (
                      <button 
                        onClick={() => window.open(`mailto:${selectedContact.email}`, '_blank')}
                        className="flex-1 bg-blue-50 text-blue-600 rounded-[2rem] p-6 flex items-center gap-4 active:scale-95 transition-all border border-blue-100"
                      >
                        <div className="p-3 bg-blue-600 text-white rounded-xl"><Mail className="w-5 h-5" /></div>
                        <div className="text-left">
                          <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest block">Email Oficial</span>
                          <p className="text-[10px] font-bold lowercase truncate">{selectedContact.email}</p>
                        </div>
                      </button>
                    )}
                    <button 
                      onClick={() => handleWhatsApp(selectedContact.mobile)}
                      className="flex-1 bg-green-50 text-green-600 rounded-[2rem] p-6 flex items-center gap-4 active:scale-95 transition-all border border-green-100"
                    >
                      <div className="p-3 bg-green-500 text-white rounded-xl"><MessageCircle className="w-5 h-5 fill-current" /></div>
                      <div className="text-left">
                        <span className="text-[8px] font-black text-green-400 uppercase tracking-widest block">WhatsApp</span>
                        <p className="text-[10px] font-bold uppercase">Enviar Mensaje</p>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="flex justify-center pt-2">
                  <p className="text-[8px] font-black text-gray-300 uppercase tracking-[0.3em]">SIGAI-USAC Directorio de Contactos</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PhoneGuide;
