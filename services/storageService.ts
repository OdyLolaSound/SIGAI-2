
import { Reading, Building, ServiceType, Role, User, UserStatus, UserCategory, RequestItem, GasoilTank, Boiler, BoilerTemperatureReading, BoilerMaintenanceRecord, BoilerPart, BoilerStatus, SaltWarehouse, SaltSoftener, CalendarTask, AppNotification, GasoilReading, RefuelRequest, SaltRefillLog, SaltEntryLog, ExternalUser, WaterAccount, WaterSyncLog, GasoilAlertStatus, Provider, MaterialCategory, MaterialItem, LeaveEntry, Blueprint, PPT, OCACertificate, PPTExecution, RTIWork, RTIReport } from '../types';
import { getLocalDateString, isWorkDay, isWeekend, parseDateString } from './dateUtils';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, getDocs, onSnapshot, query, updateDoc, deleteDoc, getDoc, where } from 'firebase/firestore';
import { ALL_BUILDINGS } from './buildingsData';
import { OCA_SEEDS } from './ocaSeeds';
import { RTI_REPORT_SEED, RTI_WORKS_SEED } from './rtiSeeds';

// Constants that don't change
export const BUILDINGS: Building[] = ALL_BUILDINGS;

export const PIEZAS_COMUNES: BoilerPart[] = [
  { id: 'p1', name: 'Fotocélula QRB1', category: 'Electrónica', price: 45.50 },
  { id: 'p2', name: 'Boquilla Danfoss 0.60', category: 'Combustión', price: 12.80 },
  { id: 'p3', name: 'Filtro Gasoil 3/8', category: 'Suministro', price: 8.50 },
  { id: 'p4', name: 'Junta de Estanqueidad', category: 'Mecánica', price: 3.20 },
  { id: 'p5', name: 'Termostato Inmersión', category: 'Control', price: 22.00 }
];

// Local cache for synchronous access (updated by real-time listeners)
let cache: any = {
  readings: [],
  users: [],
  requests: [],
  gasoil_tanks: [],
  gasoil_readings: [],
  refuel_requests: [],
  salt_stock: null,
  salt_softeners: [],
  salt_refill_logs: [],
  salt_entry_logs: [],
  water_accounts: [],
  water_sync_logs: [],
  tasks: [],
  notifications: [],
  external_contacts: [],
  boilers: [],
  boiler_readings: [],
  boiler_maintenance: [],
  providers: [],
  categories: [],
  leave_requests: [],
  blueprints: [],
  ppts: [],
  oca_certificates: [],
  ppt_executions: [],
  rti_works: [],
  rti_reports: []
};

// UI Listeners to trigger re-renders
let uiListeners: (() => void)[] = [];

// Helper to remove undefined values before saving to Firestore
export const cleanData = (data: any) => {
  if (!data || typeof data !== 'object') return data;
  const clean: any = Array.isArray(data) ? [] : {};
  Object.keys(data).forEach(key => {
    if (data[key] !== undefined) {
      clean[key] = (typeof data[key] === 'object' && data[key] !== null) 
        ? cleanData(data[key]) 
        : data[key];
    }
  });
  return clean;
};

let activeListeners: (() => void)[] = [];

// Helper to initialize a collection listener
function setupListener(collectionName: string, cacheKey: string, customQuery?: any) {
  const q = customQuery || query(collection(db, collectionName));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    console.log(`[DEBUG] Listener ${collectionName} updated: ${data.length} items`);
    if (cacheKey === 'salt_stock') {
      cache[cacheKey] = data[0] || null;
    } else {
      cache[cacheKey] = data;
    }

    // Trigger syncs for specific data types
    if (cacheKey === 'oca_certificates') {
      storageService.syncOCATasks();
    }
    if (cacheKey === 'ppts') {
      storageService.checkContractExpirations();
    }
    
    // Notify UI listeners
    uiListeners.forEach(l => l());
  }, (error) => {
    // Only log if it's not a permission error during logout/login transition
    const msg = error.message.toLowerCase();
    if (!msg.includes('insufficient permissions') && !msg.includes('permission-denied')) {
      handleFirestoreError(error, OperationType.LIST, collectionName);
    }
  });
}

const getFallbackAccount = (): WaterAccount => ({
  id: 'AGUAS_ALICANTE_BASE',
  buildingId: 'BASE_ALICANTE',
  buildingCode: 'ALC-01',
  buildingName: 'Base Alicante USAC',
  contractNumber: 'S0300017A',
  webUser: 'S0300017A',
  password: 'Usac15.',
  syncActive: true,
  status: 'conectada',
  peakThresholdPercent: 50,
  peakThresholdM3: 90,
  syncFrequency: 'diaria',
  selectors: {
    userField: '#username',
    passField: '#password',
    submitBtn: '#loginBtn',
    tableSelector: '.readings-table'
  }
});

export const storageService = {
  init: async () => {
    console.log('[DEBUG] storageService.init starting');
    // We don't seed here anymore because we need auth
    return true;
  },

  seedUsers: async () => {
    try {
      // We check if there are no technicians (only the master admin doesn't count as the full team)
      if (cache.users.length > 5) {
        console.log('[DEBUG] Skipping user seeding, team already exists');
        return;
      }

      console.log('[DEBUG] Seeding default technician team...');
      const defaultTechs: User[] = [
        {
          id: 'tech-1',
          name: 'Cabo 1º Antonio García',
          username: 'agarcia',
          password: '123',
          role: 'USAC',
          status: 'approved',
          userCategory: 'Técnico',
          assignedBuildings: ['BASE_ALICANTE'],
          assignedUnits: ['USAC'],
          phone: '600111222',
          isManto: true,
          specialty: 'Electricidad',
          leaveDays: []
        },
        {
          id: 'tech-2',
          name: 'Soldado Manuel Ruiz',
          username: 'mruiz',
          password: '123',
          role: 'GCG',
          status: 'approved',
          userCategory: 'Técnico',
          assignedBuildings: ['BASE_ALICANTE'],
          assignedUnits: ['GCG'],
          phone: '600333444',
          isManto: true,
          specialty: 'Fontanería',
          leaveDays: []
        },
        {
          id: 'tech-3',
          name: 'Paco Fontanero',
          username: 'paco',
          password: '123',
          role: 'USAC',
          status: 'approved',
          userCategory: 'Técnico',
          assignedBuildings: ['BASE_ALICANTE'],
          assignedUnits: ['USAC', 'CECOM'],
          phone: '600555666',
          isManto: true,
          specialty: 'Fontanería',
          leaveDays: []
        }
      ];

      for (const tech of defaultTechs) {
        const docRef = doc(db, 'users', tech.id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          await setDoc(docRef, cleanData(tech));
        }
      }
      console.log('[DEBUG] Technician team seeded.');
    } catch (e) {
      console.error('[DEBUG] Error seeding users:', e);
    }
  },

  seedWaterData: async () => {
    // Check if we already have readings to avoid redundant seeding
    if (cache.readings.length > 5) {
      console.log('[DEBUG] Skipping water data seeding, data already exists');
      return;
    }

    const realData = [
      { date: '2026-03-16', value: 290408.96, consumption: 73.8 },
      { date: '2026-03-15', value: 290335.16, consumption: 21.93 },
      { date: '2026-03-14', value: 290313.23, consumption: 22.28 },
      { date: '2026-03-13', value: 290290.95, consumption: 67.35 },
      { date: '2026-03-12', value: 290223.6, consumption: 64.89 },
      { date: '2026-03-11', value: 290158.71, consumption: 70.54 },
      { date: '2026-03-10', value: 290088.17, consumption: 65.27 },
      { date: '2026-03-09', value: 290022.9, consumption: 76.52 },
      { date: '2026-03-08', value: 289946.38, consumption: 35.21 },
      { date: '2026-03-07', value: 289911.17, consumption: 50.16 },
    ];

    const seededReadings: Reading[] = [];

    for (const item of realData) {
      const id = `real_water_${item.date}`;
      const reading: Reading = {
        id,
        buildingId: 'BASE_ALICANTE',
        date: item.date,
        timestamp: parseDateString(item.date).toISOString(),
        userId: 'system_seed',
        serviceType: 'agua',
        origin: 'telematica',
        value1: item.value,
        consumption1: item.consumption,
        isPeak: item.consumption > 60
      };
      
      seededReadings.push(reading);

      // Intelligent peak detection: lower threshold for weekends/holidays
      const threshold = isWorkDay(item.date) ? 90 : 60;
      reading.isPeak = item.consumption > threshold;

      try {
        console.log(`[DEBUG] Seeding reading for ${item.date}...`);
        await setDoc(doc(db, 'readings', id), cleanData(reading));
      } catch (e) {
        console.error(`[DEBUG] Error seeding reading for ${item.date}:`, e);
      }
    }

    // Update cache immediately for synchronous access
    cache.readings = [...cache.readings, ...seededReadings.filter(sr => !cache.readings.find((r: any) => r.id === sr.id))];
    
    console.log('[DEBUG] Real water data seeded in cache and Firestore. Total readings in cache:', cache.readings.length);
  },

  seedOCAData: async () => {
    // Check if we already have certificates
    if (cache.oca_certificates.length > 0) {
      console.log('[DEBUG] Skipping OCA data seeding, data already exists');
      return;
    }

    console.log('[DEBUG] Seeding OCA data...', OCA_SEEDS.length);
    for (const cert of OCA_SEEDS) {
      try {
        await setDoc(doc(db, 'oca_certificates', cert.id), cleanData(cert));
      } catch (e) {
        console.error(`[DEBUG] Error seeding OCA ${cert.id}:`, e);
      }
    }
  },

  seedPPTData: async () => {
    // Check if we already have PPTs
    if (cache.ppts.length > 0) {
      console.log('[DEBUG] Skipping PPT data seeding, data already exists');
      return;
    }

    const pptSeeds: PPT[] = [
      {
        id: 'ppt_ascensores_2026',
        title: 'Mantenimiento de Ascensores (Contrato Sectorial)',
        category: 'Ascensores',
        isSectorial: true,
        buildingIds: ['E0064'], // Edificio E0064 según Anexo B
        companyName: 'SCHINDLER',
        validFrom: '2025-10-01',
        validTo: '2026-09-30',
        status: 'active',
        createdAt: new Date().toISOString(),
        tasks: [
          // CABINA
          { id: 't1', description: 'Visita al Jefe de Mantenimiento y entrega del parte de visita', frequency: 'mensual', priority: 'Media' },
          { id: 't2', description: 'Comprobación estado general de cabina y sus componentes', frequency: 'mensual', priority: 'Media' },
          { id: 't3', description: 'Comprobar pulsadores, luminosos y posicional de cabina. Reponer lámparas', frequency: 'mensual', priority: 'Media' },
          { id: 't4', description: 'Comprobar telefonía y alarma de emergencia', frequency: 'mensual', priority: 'Crítica' },
          { id: 't5', description: 'Comprobar seguridades de puerta de cabina (pulsadores, contactos eléctricos)', frequency: 'mensual', priority: 'Alta' },
          { id: 't6', description: 'Comprobar apertura, reapertura y cierre de puertas', frequency: 'mensual', priority: 'Alta' },
          { id: 't7', description: 'Comprobar circuitos de seguridad, cierres electromecánicos y célula fotoeléctrica', frequency: 'mensual', priority: 'Alta' },
          { id: 't8', description: 'Comprobar arranque, parada y nivelación en pisos', frequency: 'mensual', priority: 'Media' },
          { id: 't9', description: 'Comprobar aplome, alineación, holgura y lubricación de cabina', frequency: 'mensual', priority: 'Media' },
          { id: 't10', description: 'Limpieza de pisadera y deslizaderas inferiores a puertas', frequency: 'mensual', priority: 'Baja' },
          { id: 't11', description: 'Comprobar sistema de sobrecarga y completo', frequency: 'mensual', priority: 'Alta' },
          { id: 't12', description: 'Comprobar iluminación de cabina, emergencia e instalación eléctrica', frequency: 'mensual', priority: 'Media' },
          
          // SALA DE MÁQUINAS
          { id: 't13', description: 'Limpieza y estado de máquina (poleas, bancada, reductor)', frequency: 'mensual', priority: 'Media' },
          { id: 't14', description: 'Comprobar accesos, ventilación y cerradura de sala de máquinas', frequency: 'mensual', priority: 'Media' },
          { id: 't15', description: 'Comprobar niveles de aceite y ruidos de rodamientos', frequency: 'mensual', priority: 'Media' },
          { id: 't16', description: 'Comprobar cables de tracción y limitador de velocidad', frequency: 'mensual', priority: 'Alta' },
          { id: 't17', description: 'Comprobar regulación y freno', frequency: 'mensual', priority: 'Alta' },
          { id: 't18', description: 'Comprobar guarda-cables y guarda-poleas', frequency: 'mensual', priority: 'Baja' },
          { id: 't19', description: 'Comprobar regulador de velocidad, tensión de cable y contacto seguridad', frequency: 'mensual', priority: 'Alta' },
          { id: 't20', description: 'Verificar precinto del limitador de velocidad', frequency: 'mensual', priority: 'Media' },
          { id: 't21', description: 'Comprobar desconexión de maniobra en finales de recorrido', frequency: 'mensual', priority: 'Alta' },
          { id: 't22', description: 'Pruebas en cuadro de protección (diferenciales, fusibles, conexiones)', frequency: 'mensual', priority: 'Crítica' },
          { id: 't23', description: 'Comprobar alumbrado general y emergencia en sala de máquinas', frequency: 'mensual', priority: 'Baja' },
          
          // TODOS LOS PISOS
          { id: 't24', description: 'Comprobar pulsadores y luminosos exteriores en todos los pisos', frequency: 'mensual', priority: 'Media' },
          { id: 't25', description: 'Comprobar dispositivo de preferencia de cabina', frequency: 'mensual', priority: 'Media' },
          { id: 't26', description: 'Comprobar contactos de presencia y bloqueo en puertas de piso', frequency: 'mensual', priority: 'Alta' },
          { id: 't27', description: 'Comprobar sujeción de cristales de puertas', frequency: 'mensual', priority: 'Media' },
          { id: 't28', description: 'Verificar que las puertas de piso no se paren al empujar/tirar en marcha', frequency: 'mensual', priority: 'Alta' },
          { id: 't29', description: 'Estado general de puertas de piso (alineación, holguras)', frequency: 'mensual', priority: 'Media' },
          
          // HUECO
          { id: 't30', description: 'Comprobar rozaderas, operador de puertas y fijaciones', frequency: 'mensual', priority: 'Media' },
          { id: 't31', description: 'Comprobar finales de recorrido superiores', frequency: 'mensual', priority: 'Alta' },
          { id: 't32', description: 'Comprobar contacto de aflojamiento de cables', frequency: 'mensual', priority: 'Alta' },
          { id: 't33', description: 'Comprobar contactos de acuñamiento y regulación', frequency: 'mensual', priority: 'Alta' },
          { id: 't34', description: 'Lubricación del mecanismo de acuñamiento', frequency: 'mensual', priority: 'Media' },
          { id: 't35', description: 'Verificar movimiento de cabina y distancias en todo el hueco', frequency: 'mensual', priority: 'Media' },
          { id: 't36', description: 'Comprobar cerraduras de puertas de piso', frequency: 'mensual', priority: 'Alta' },
          { id: 't37', description: 'Comprobar telefonía de emergencia encima de cabina', frequency: 'mensual', priority: 'Crítica' },
          { id: 't38', description: 'Lubricación de guías', frequency: 'mensual', priority: 'Media' },
          { id: 't39', description: 'Estado del cable del limitador de velocidad', frequency: 'mensual', priority: 'Alta' },
          
          // FOSO
          { id: 't40', description: 'Funcionamiento y lubricación de polea tensora del limitador', frequency: 'mensual', priority: 'Media' },
          { id: 't41', description: 'Comprobar finales de recorrido, STOP de foso y seguridades', frequency: 'mensual', priority: 'Alta' },
          { id: 't42', description: 'Comprobar telefonía de emergencia debajo de cabina', frequency: 'mensual', priority: 'Crítica' },
          { id: 't43', description: 'Comprobar alumbrado de foso', frequency: 'mensual', priority: 'Baja' },

          // INSTALACIONES HIDRÁULICAS (Si aplica)
          { id: 't44', description: 'Revisión central hidráulica (niveles aceite, tuberías, uniones)', frequency: 'mensual', priority: 'Media' },
          { id: 't45', description: 'Comprobar pérdidas de líquido hidráulico', frequency: 'mensual', priority: 'Alta' },
          { id: 't46', description: 'Comprobar elementos de seguridad y sujeción hidráulica', frequency: 'mensual', priority: 'Alta' },
          { id: 't47', description: 'Comprobar armarios de aparellaje y elementos móviles', frequency: 'mensual', priority: 'Media' },
          { id: 't48', description: 'Verificación válvulas seguridad, rotura y bomba manual', frequency: 'mensual', priority: 'Alta' },
          
          // GESTIÓN
          { id: 't49', description: 'Gestión documental y actualización de libros de seguimiento', frequency: 'mensual', priority: 'Media' }
        ]
      },
      {
        id: 'ppt_climatizacion_2026',
        title: 'Mantenimiento de Instalaciones de Climatización, Frío y Ventilación',
        category: 'Climatización',
        isSectorial: true,
        buildingIds: ['E0001', 'E0002', 'E0003', 'E0004', 'E0005', 'E0006', 'E0008', 'E0009', 'E0012', 'E0016', 'E0017', 'E0018', 'E0021', 'E0022', 'E0023', 'E0024', 'E0025', 'E0026', 'E0029', 'E0032', 'E0033', 'E0035', 'E0044', 'E0045', 'E0048', 'E0050', 'E0053', 'E0057', 'E0060', 'E0065', 'E0066', 'E0067', 'E0068', 'E0071', 'E0072', 'E0073', 'E0077', 'PAB_CORONEL', 'CABO_ROIG', 'E0013', 'E0064'], // Edificios Anexo B
        companyName: 'Empresa Especializada Climatización',
        validFrom: '2025-10-01',
        validTo: '2026-09-30',
        status: 'active',
        createdAt: new Date().toISOString(),
        tasks: [
          // CLIMATIZACIÓN PN <= 70kW (ANUAL/BIENAL)
          { id: 'cli1', description: 'CLIMA <= 70kW: Limpieza evaporadores/condensadores y revisión filtros aire', frequency: 'anual', priority: 'Media' },
          { id: 'cli2', description: 'CLIMA <= 70kW: Revisión unidades terminales, impulsión y retorno aire', frequency: 'anual', priority: 'Media' },
          { id: 'cli3', description: 'CLIMA <= 70kW: Comprobación estanqueidad y niveles refrigerante/aceite', frequency: 'anual', priority: 'Alta' },
          
          // CLIMATIZACIÓN PN > 70kW (MENSUAL/TRIMESTRAL/SEMESTRAL)
          { id: 'cli4', description: 'CLIMA > 70kW: Comprobación estanqueidad y niveles equipos frigoríficos', frequency: 'mensual', priority: 'Alta' },
          { id: 'cli5', description: 'CLIMA > 70kW: Revisión bombas, ventiladores y sistema preparación ACS', frequency: 'mensual', priority: 'Alta' },
          { id: 'cli6', description: 'CLIMA > 70kW: Evaluación periódica rendimiento generadores frío', frequency: 'trimestral', priority: 'Alta' },
          { id: 'cli7', description: 'CLIMA > 70kW: Limpieza filtros agua, recuperación calor y control automático', frequency: 'semestral', priority: 'Media' },
          { id: 'cli8', description: 'CLIMA > 70kW: Drenaje, limpieza y tratamiento circuito torres refrigeración', frequency: 'semestral', priority: 'Alta' },
          
          // VENTILACIÓN (TRIMESTRAL/SEMESTRAL)
          { id: 'cli9', description: 'VENTILACIÓN: Revisión filtros, conductos, rejillas y aspiradores/extractores', frequency: 'trimestral', priority: 'Media' },
          { id: 'cli10', description: 'VENTILACIÓN: Revisión automatismos control y estanqueidad conductos', frequency: 'semestral', priority: 'Media' },
          { id: 'cli11', description: 'VENTILACIÓN: Revisión funcionamiento recuperadores de calor', frequency: 'semestral', priority: 'Media' },
          
          // GASES FLUORADOS (CONTROL DE FUGAS)
          { id: 'cli12', description: 'GASES: Etiquetado de equipos con carga equivalente de CO2', frequency: 'otros', priority: 'Alta' },
          { id: 'cli13', description: 'GASES: Control de fugas según carga (Anual/Semestral/Bienal)', frequency: 'otros', priority: 'Crítica' },
          
          // GENERAL
          { id: 'cli14', description: 'ACTAS: Registro de consumo energía/agua y emisión certificados mantenimiento', frequency: 'mensual', priority: 'Media' },
          { id: 'cli15', description: 'CALIDAD: Revisión calidad ambiental (UNE 171330) y conductos (UNE 100012)', frequency: 'anual', priority: 'Media' }
        ]
      },
      {
        id: 'ppt_termicas_2026',
        title: 'Mantenimiento de Instalaciones Térmicas (RITE, GLP y Solar)',
        category: 'Térmicas',
        isSectorial: true,
        buildingIds: ['E0068', 'E0007', 'E0065', 'E0048', 'E0011', 'E0042', 'E0064', 'E0010', 'E0059', 'E0032', 'E0056', 'U0013'], // Edificios Anexo B
        companyName: 'Empresa Especializada Térmicas',
        validFrom: '2025-10-01',
        validTo: '2026-09-30',
        status: 'active',
        createdAt: new Date().toISOString(),
        tasks: [
          // CALEFACCIÓN Y ACS (PN <= 70kW) - ANUAL
          { id: 'ter1', description: 'RITE <= 70kW: Revisión aparatos ACS, circuito humos y limpieza quemador', frequency: 'anual', priority: 'Media' },
          { id: 'ter2', description: 'RITE <= 70kW: Revisión vaso expansión y sistemas tratamiento agua', frequency: 'anual', priority: 'Media' },
          { id: 'ter3', description: 'RITE <= 70kW: Comprobación estanqueidad quemador/caldera y niveles agua', frequency: 'anual', priority: 'Media' },
          { id: 'ter4', description: 'RITE <= 70kW: Evaluación rendimiento generadores calor y control automático', frequency: 'anual', priority: 'Media' },
          
          // CALEFACCIÓN Y ACS (PN > 70kW) - MENSUAL/SEMESTRAL
          { id: 'ter5', description: 'RITE > 70kW: Comprobación estanqueidad y niveles refrigerante/aceite equipos frigoríficos', frequency: 'mensual', priority: 'Alta' },
          { id: 'ter6', description: 'RITE > 70kW: Limpieza quemador, revisión vaso expansión y tratamiento agua', frequency: 'mensual', priority: 'Alta' },
          { id: 'ter7', description: 'RITE > 70kW: Comprobación niveles agua, tarado seguridad y filtros aire', frequency: 'mensual', priority: 'Alta' },
          { id: 'ter8', description: 'RITE > 70kW: Drenaje y limpieza circuito torres refrigeración', frequency: 'semestral', priority: 'Alta' },
          { id: 'ter9', description: 'RITE > 70kW: Limpieza circuito humos, chimenea y material refractario', frequency: 'semestral', priority: 'Media' },
          
          // SOLAR TÉRMICA
          { id: 'ter10', description: 'SOLAR: Inspección conexiones hidráulicas, fugas y niveles circuitos', frequency: 'mensual', priority: 'Media' },
          { id: 'ter11', description: 'SOLAR: Limpieza y verificación funcionamiento intercambiadores', frequency: 'mensual', priority: 'Media' },
          { id: 'ter12', description: 'SOLAR: Verificación estado paneles (limpieza, corrosión, juntas)', frequency: 'anual', priority: 'Baja' },
          { id: 'ter13', description: 'SOLAR: Revisión sistema acumulación (ánodos sacrificio, aislamiento)', frequency: 'anual', priority: 'Media' },
          
          // DEPÓSITOS COMBUSTIBLE (GLP / LÍQUIDO)
          { id: 'ter14', description: 'GLP: Verificación estanqueidad, instrumentos medida y cerramientos', frequency: 'anual', priority: 'Alta' },
          { id: 'ter15', description: 'GLP: Medición resistencia toma de tierra (< 80 ohmios)', frequency: 'anual', priority: 'Alta' },
          { id: 'ter16', description: 'COMBUSTIBLE: Verificación estado cubetos, cimentaciones y drenajes', frequency: 'otros', priority: 'Media' },
          { id: 'ter17', description: 'COMBUSTIBLE: Prueba estanqueidad tanques y tuberías (según periodicidad)', frequency: 'otros', priority: 'Alta' },
          
          // CALDERAS CLASE SEGUNDA (VIGILANCIA)
          { id: 'ter18', description: 'CLASE 2: Comprobación pureza vapor y purgas continuas', frequency: 'diaria', priority: 'Alta' },
          { id: 'ter19', description: 'CLASE 2: Limpieza lado humos (turbulador y tubería)', frequency: 'otros', priority: 'Media' },
          { id: 'ter20', description: 'CLASE 2: Análisis gases combustión y funcionamiento automático', frequency: 'mensual', priority: 'Alta' },
          
          // GENERAL
          { id: 'ter21', description: 'ACTAS: Registro de consumo energía/agua y emisión certificados mantenimiento', frequency: 'mensual', priority: 'Media' }
        ]
      },
      {
        id: 'ppt_at_pararrayos_2026',
        title: 'Mantenimiento de Centros de Transformación, Media Tensión y Pararrayos',
        category: 'Centros de Transformación',
        isSectorial: true,
        buildingIds: ['CT_1_2', 'CT_3', 'E0019', 'E0066', 'E0073', 'E0004', 'E0017', 'I0010', 'I0020', 'E0014', 'E0068', 'I0040', 'E0039'], // CTs y Pararrayos según Anexo B
        companyName: 'Empresa Especializada Alta Tensión',
        validFrom: '2025-10-01',
        validTo: '2026-09-30',
        status: 'active',
        createdAt: new Date().toISOString(),
        tasks: [
          // CENTROS DE TRANSFORMACIÓN (SEMESTRAL)
          { id: 'at1', description: 'CT: Revisión batería condensadores (protecciones, temp, bornes)', frequency: 'semestral', priority: 'Media' },
          { id: 'at2', description: 'CT: Comprobar interruptor automático (niveles dieléctrico, apertura/cierre)', frequency: 'semestral', priority: 'Alta' },
          { id: 'at3', description: 'CT: Inspección transformador (fugas aceite, aisladores, conexiones, tierra)', frequency: 'semestral', priority: 'Alta' },
          { id: 'at4', description: 'CT: Revisión de celdas (limpieza, humedad, tabiques, elementos auxiliares)', frequency: 'semestral', priority: 'Media' },
          { id: 'at5', description: 'CT: Verificación de puestas a tierra (arquetas, picas, conexiones)', frequency: 'semestral', priority: 'Alta' },
          { id: 'at6', description: 'CT: Inspección interior (ventilación, señalización, medios extinción, iluminación)', frequency: 'semestral', priority: 'Media' },
          
          // CENTROS DE TRANSFORMACIÓN (ANUAL)
          { id: 'at7', description: 'CT: Ensayos funcionales equipo eléctrico y medición tensiones paso/contacto', frequency: 'anual', priority: 'Alta' },
          { id: 'at8', description: 'CT: Medición resistencia aislamiento AT y transformador', frequency: 'anual', priority: 'Alta' },
          { id: 'at9', description: 'CT: Medición rigidez dieléctrica de aceites refrigerantes', frequency: 'anual', priority: 'Alta' },
          { id: 'at10', description: 'CT: Calibración de relés de protección y verificación enclavamientos', frequency: 'anual', priority: 'Crítica' },
          { id: 'at11', description: 'CT: Reapriete de bornes de conexión y limpieza de fusibles', frequency: 'anual', priority: 'Media' },
          
          // PARARRAYOS (ANUAL)
          { id: 'at12', description: 'PARARRAYOS: Comprobación cabezal, mástil (oxidación) y amarres', frequency: 'anual', priority: 'Alta' },
          { id: 'at13', description: 'PARARRAYOS: Verificación conductores, tubos protección y soldaduras tierra', frequency: 'anual', priority: 'Alta' },
          { id: 'at14', description: 'PARARRAYOS: Medición de resistencia de puesta a tierra', frequency: 'anual', priority: 'Alta' },
          { id: 'at15', description: 'PARARRAYOS: Verificación de área de cobertura y estado funcional', frequency: 'anual', priority: 'Media' },
          
          // LÍNEAS MEDIA TENSIÓN (SEMESTRAL/ANUAL)
          { id: 'at16', description: 'MT: Comprobación distancias seguridad y limpieza zona servidumbre', frequency: 'semestral', priority: 'Alta' },
          { id: 'at17', description: 'MT: Verificación conductores, empalmes, herrajes y cimentaciones', frequency: 'anual', priority: 'Alta' },
          { id: 'at18', description: 'MT: Revisión de derivaciones, protecciones y seccionadores', frequency: 'anual', priority: 'Alta' },
          
          // GENERAL
          { id: 'at19', description: 'ACTAS: Emisión de certificados e informes de inspección técnica', frequency: 'anual', priority: 'Media' }
        ]
      },
      {
        id: 'ppt_pci_2026',
        title: 'Mantenimiento de Instalaciones de Protección Contra Incendios (PCI)',
        category: 'Otros',
        isSectorial: true,
        buildingIds: ['E0066', 'E0065', 'E0023', 'E0060', 'E0032', 'E0073', 'E0019', 'E0012', 'E0064', 'E0068', 'E0018', 'E0044', 'E0045', 'E0014', 'E0048', 'E0049', 'E0050', 'E0052', 'E0056', 'E0057', 'E0058', 'E0059', 'E0061', 'E0062', 'E0039'], // Edificios Anexo B
        companyName: 'Empresa Especializada PCI',
        validFrom: '2025-10-01',
        validTo: '2026-09-30',
        status: 'active',
        createdAt: new Date().toISOString(),
        tasks: [
          // SISTEMAS DE DETECCIÓN Y ALARMA
          { id: 'pci1', description: 'DETECCIÓN: Comprobación funcionamiento instalaciones y sustitución pilotos/fusibles', frequency: 'trimestral', priority: 'Alta' },
          { id: 'pci2', description: 'DETECCIÓN: Revisión indicaciones luminosas de alarma y avería en central', frequency: 'trimestral', priority: 'Media' },
          { id: 'pci3', description: 'DETECCIÓN: Mantenimiento de acumuladores (limpieza bornas, reposición agua)', frequency: 'trimestral', priority: 'Media' },
          { id: 'pci4', description: 'DETECCIÓN: Verificación equipos de centralización y transmisión de alarma', frequency: 'trimestral', priority: 'Alta' },
          { id: 'pci5', description: 'DETECCIÓN: Comprobación funcionamiento maniobras programadas (paro aire, ascensores, etc.)', frequency: 'anual', priority: 'Alta' },
          { id: 'pci6', description: 'DETECCIÓN: Prueba individual de funcionamiento de todos los detectores automáticos', frequency: 'anual', priority: 'Alta' },
          { id: 'pci7', description: 'DETECCIÓN: Revisión sistemas de baterías y prueba de conmutación en fallo de red', frequency: 'trimestral', priority: 'Alta' },
          
          // PULSADORES Y AVISADORES
          { id: 'pci8', description: 'PULSADORES: Comprobación señalización de pulsadores manuales', frequency: 'trimestral', priority: 'Media' },
          { id: 'pci9', description: 'PULSADORES: Verificación ubicación, visibilidad y accesibilidad', frequency: 'semestral', priority: 'Media' },
          { id: 'pci10', description: 'PULSADORES: Prueba de funcionamiento de todos los pulsadores', frequency: 'anual', priority: 'Alta' },
          { id: 'pci11', description: 'AVISADORES: Comprobar funcionamiento avisadores luminosos, acústicos y megafonía', frequency: 'trimestral', priority: 'Alta' },
          
          // EXTINTORES
          { id: 'pci12', description: 'EXTINTORES: Verificación ubicación, accesibilidad, presión y precintos', frequency: 'trimestral', priority: 'Media' },
          { id: 'pci13', description: 'EXTINTORES: Mantenimiento anual según norma UNE 23120', frequency: 'anual', priority: 'Alta' },
          { id: 'pci14', description: 'EXTINTORES: Retimbrado (prueba nivel C) cada 5 años', frequency: 'otros', priority: 'Alta' },
          
          // BIEs (Bocas de Incendio Equipadas)
          { id: 'pci15', description: 'BIE: Comprobación de señalización', frequency: 'trimestral', priority: 'Media' },
          { id: 'pci16', description: 'BIE: Inspección y mantenimiento anual según UNE-EN 671-3', frequency: 'anual', priority: 'Alta' },
          { id: 'pci17', description: 'BIE: Prueba de presión de manguera cada 5 años', frequency: 'otros', priority: 'Alta' },
          
          // HIDRANTES Y COLUMNAS SECAS
          { id: 'pci18', description: 'HIDRANTES: Comprobar accesibilidad, señalización y estanquidad', frequency: 'trimestral', priority: 'Media' },
          { id: 'pci19', description: 'HIDRANTES: Engrase de tuerca y comprobación válvula principal', frequency: 'semestral', priority: 'Media' },
          { id: 'pci20', description: 'COLUMNAS SECAS: Comprobación accesibilidad, señalización y tapas', frequency: 'semestral', priority: 'Media' },
          
          // ROCIADORES Y SISTEMAS FIJOS
          { id: 'pci21', description: 'ROCIADORES: Comprobación visual estado general, presión y limpieza', frequency: 'trimestral', priority: 'Media' },
          { id: 'pci22', description: 'ROCIADORES: Verificación válvulas de cierre y suministro eléctrico bombas', frequency: 'semestral', priority: 'Alta' },
          { id: 'pci23', description: 'ROCIADORES: Comprobación respuesta sistema a señales activación', frequency: 'anual', priority: 'Alta' },
          
          // ABASTECIMIENTO DE AGUA
          { id: 'pci24', description: 'ABASTECIMIENTO: Inspección depósitos, válvulas, mandos y alarmas motobombas', frequency: 'trimestral', priority: 'Alta' },
          { id: 'pci25', description: 'ABASTECIMIENTO: Verificación velocidad motores y alimentación eléctrica', frequency: 'semestral', priority: 'Alta' },
          { id: 'pci26', description: 'ABASTECIMIENTO: Comprobación reserva agua y limpieza de filtros', frequency: 'anual', priority: 'Alta' },
          
          // CONTROL DE HUMOS Y SEÑALIZACIÓN
          { id: 'pci27', description: 'HUMOS: Inspección visual barreras y ausencia de obstrucciones', frequency: 'trimestral', priority: 'Media' },
          { id: 'pci28', description: 'HUMOS: Comprobación funcionamiento componentes mediante activación manual', frequency: 'semestral', priority: 'Alta' },
          { id: 'pci29', description: 'SEÑALIZACIÓN: Comprobación visual existencia, ubicación, limpieza y legibilidad', frequency: 'anual', priority: 'Media' },
          
          // GENERAL
          { id: 'pci30', description: 'ACTAS: Elaboración de actas de seguimiento según UNE 23580', frequency: 'trimestral', priority: 'Media' }
        ]
      },
      {
        id: 'ppt_legionella_2026',
        title: 'Prevención y Control de la Legionelosis',
        category: 'Legionella',
        isSectorial: true,
        buildingIds: ['E0042', 'E0065', 'E0056', 'E0007', 'E0059', 'E0064', 'E0048', 'E0010', 'E0068', 'E0032', 'I0022', 'I0005', 'I0006', 'E0044', 'E0022'], // Edificios Anexo B
        companyName: 'Empresa Especializada Legionella',
        validFrom: '2025-10-01',
        validTo: '2026-09-30',
        status: 'active',
        createdAt: new Date().toISOString(),
        tasks: [
          // AGUA CALIENTE SANITARIA (ACS)
          { id: 'leg1', description: 'ACS: Limpieza, desinfección y determinación de legionella en depósitos', frequency: 'trimestral', priority: 'Alta' },
          { id: 'leg2', description: 'ACS: Desinfección y determinación de legionella en cabezas pulverizadoras (duchas/grifos)', frequency: 'anual', priority: 'Alta' },
          { id: 'leg3', description: 'ACS: Revisión, limpieza y desinfección general de la instalación', frequency: 'anual', priority: 'Media' },
          { id: 'leg4', description: 'ACS: Toma de muestras en puntos representativos (depósito, acumulador, retorno, terminales)', frequency: 'trimestral', priority: 'Alta' },
          
          // AGUA FRÍA CONSUMO HUMANO (AFCH)
          { id: 'leg5', description: 'AFCH: Limpieza, desinfección y determinación de legionella en depósitos', frequency: 'anual', priority: 'Alta' },
          { id: 'leg6', description: 'AFCH: Revisión, limpieza y desinfección general de la instalación', frequency: 'anual', priority: 'Media' },
          
          // TORRES Y CONDENSADORES
          { id: 'leg7', description: 'TORRES: Revisión estado, limpieza y desinfección de bandeja y sistemas de purga', frequency: 'mensual', priority: 'Alta' },
          { id: 'leg8', description: 'TORRES: Revisión calidad físico-química y microbiológica (Temp, pH, Cond, Turb, Fe)', frequency: 'mensual', priority: 'Alta' },
          { id: 'leg9', description: 'TORRES: Recuento total aerobios y determinación de legionella en balsa', frequency: 'mensual', priority: 'Alta' },
          { id: 'leg10', description: 'TORRES: Revisión estado, limpieza y desinfección de condensador y relleno', frequency: 'semestral', priority: 'Media' },
          { id: 'leg11', description: 'TORRES: Revisión estado, limpieza y desinfección de separador de gotas', frequency: 'semestral', priority: 'Media' },
          
          // OTRAS INSTALACIONES
          { id: 'leg12', description: 'CONTRA INCENDIOS: Limpieza (coincidiendo con prueba hidráulica)', frequency: 'anual', priority: 'Baja' },
          { id: 'leg13', description: 'MENOR PROBABILIDAD: Limpieza según UNE 100030', frequency: 'anual', priority: 'Baja' },
          
          // GENERAL
          { id: 'leg14', description: 'Actualización de libros de seguimiento y registros RD 487/2022', frequency: 'mensual', priority: 'Media' }
        ]
      },
      {
        id: 'ppt_piscinas_2026',
        title: 'Mantenimiento de Áreas de Instrucción Subacuáticas',
        category: 'Piscinas',
        isSectorial: false,
        validFrom: '2026-04-14',
        validTo: '2026-11-25',
        status: 'active',
        createdAt: new Date().toISOString(),
        tasks: [
          { id: 'p1', description: 'Limpieza diaria manual con barredera y cepillado', frequency: 'diaria', priority: 'Media' },
          { id: 'p2', description: 'Limpieza diaria de línea de flotación y skimmers', frequency: 'diaria', priority: 'Media' },
          { id: 'p3', description: 'Soplado diario de zona de playas', frequency: 'diaria', priority: 'Baja' },
          { id: 'p4', description: 'Analítica diaria (Cloro, PH, Turbidez, Alcalinidad)', frequency: 'diaria', priority: 'Alta' },
          { id: 'p5', description: 'Analítica mensual en laboratorio acreditado', frequency: 'mensual', priority: 'Crítica' },
          { id: 'p6', description: 'Mantenimiento y actualización Plan Auto Control', frequency: 'mensual', priority: 'Media' },
          { id: 'p7', description: 'Gestión de envases de productos químicos', frequency: 'otros', priority: 'Baja' }
        ]
      },
      {
        id: 'ppt_jardines_2026',
        title: 'Mantenimiento de Zonas Ajardinadas',
        category: 'Jardinería',
        isSectorial: false,
        validFrom: '2026-04-14',
        validTo: '2026-11-25',
        status: 'active',
        createdAt: new Date().toISOString(),
        tasks: [
          { id: 'j1', description: 'Corte de césped según demanda estacional', frequency: 'semanal', priority: 'Media' },
          { id: 'j2', description: 'Poda de moreras (Noviembre)', frequency: 'anual', priority: 'Baja' },
          { id: 'j3', description: 'Poda y mantenimiento de cítricos y arbustos', frequency: 'otros', priority: 'Media' },
          { id: 'j4', description: 'Desbroce de malas hierbas y tratamiento herbicida', frequency: 'mensual', priority: 'Media' },
          { id: 'j5', description: 'Control de riego y programación de estaciones', frequency: 'diaria', priority: 'Alta' },
          { id: 'j6', description: 'Retirada y gestión de restos de poda y siega', frequency: 'semanal', priority: 'Baja' }
        ]
      }
    ];

    for (const ppt of pptSeeds) {
      try {
        await setDoc(doc(db, 'ppts', ppt.id), cleanData(ppt));
      } catch (e) {
        console.error(`[DEBUG] Error seeding PPT ${ppt.id}:`, e);
      }
    }
  },

  seedRTIData: async () => {
    // Check if we already have RTI data
    if (cache.rti_works.length > 0 || cache.rti_reports.length > 0) {
      console.log('[DEBUG] Skipping RTI data seeding, data already exists');
      return;
    }

    console.log('[DEBUG] Seeding RTI report...');
    try {
      await setDoc(doc(db, 'rti_reports', RTI_REPORT_SEED.id), cleanData(RTI_REPORT_SEED));
    } catch (e) {
      console.error('[DEBUG] Error seeding RTI Report:', e);
    }

    console.log('[DEBUG] Seeding RTI works...', RTI_WORKS_SEED.length);
    for (const work of RTI_WORKS_SEED) {
      try {
        await setDoc(doc(db, 'rti_works', work.id), cleanData(work));
      } catch (e) {
        console.error(`[DEBUG] Error seeding RTI Work ${work.id}:`, e);
      }
    }
  },

  startListeners: (userId?: string) => {
    if (activeListeners.length > 0) return;

    // Seed data once authenticated
    if (userId) {
      storageService.seedUsers();
      storageService.seedWaterData();
      storageService.seedOCAData();
      storageService.seedPPTData();
      storageService.seedRTIData();
      
      // Check expirations on start
      setTimeout(() => storageService.checkContractExpirations(), 2000);
    }

    activeListeners = [
      setupListener('readings', 'readings'),
      setupListener('users', 'users'),
      setupListener('requests', 'requests'),
      setupListener('gasoil_tanks', 'gasoil_tanks'),
      setupListener('gasoil_readings', 'gasoil_readings'),
      setupListener('refuel_requests', 'refuel_requests'),
      setupListener('salt_stock', 'salt_stock'),
      setupListener('salt_softeners', 'salt_softeners'),
      setupListener('salt_refill_logs', 'salt_refill_logs'),
      setupListener('salt_entry_logs', 'salt_entry_logs'),
      setupListener('water_accounts', 'water_accounts'),
      setupListener('water_sync_logs', 'water_sync_logs'),
      setupListener('tasks', 'tasks'),
      userId 
        ? setupListener('notifications', 'notifications', query(collection(db, 'notifications'), where('userId', 'in', Array.from(new Set([userId, 'all'])))))
        : setupListener('notifications', 'notifications'),
      setupListener('external_contacts', 'external_contacts'),
      setupListener('boilers', 'boilers'),
      setupListener('boiler_readings', 'boiler_readings'),
      setupListener('boiler_maintenance', 'boiler_maintenance'),
      setupListener('providers', 'providers'),
      setupListener('categories', 'categories'),
      setupListener('leave_requests', 'leave_requests'),
      setupListener('blueprints', 'blueprints'),
      setupListener('ppts', 'ppts'),
      setupListener('oca_certificates', 'oca_certificates'),
      setupListener('ppt_executions', 'ppt_executions'),
      setupListener('rti_works', 'rti_works'),
      setupListener('rti_reports', 'rti_reports'),
    ];
  },

  stopListeners: () => {
    activeListeners.forEach(unsubscribe => unsubscribe());
    activeListeners = [];
    // Clear cache on logout to prevent stale data flash
    Object.keys(cache).forEach(key => {
      if (key === 'salt_stock') cache[key] = null;
      else cache[key] = [];
    });
  },

  // --- READINGS ---
  getReadings: (buildingId?: string, serviceType?: ServiceType): Reading[] => {
    let readings = cache.readings;
    if (buildingId) readings = readings.filter((r: any) => r.buildingId === buildingId);
    if (serviceType) readings = readings.filter((r: any) => r.serviceType === serviceType);
    return readings;
  },
  saveReading: async (reading: Reading) => {
    try {
      // Normalize timestamp for water readings to 00:00
      if (reading.serviceType === 'agua') {
        const dateObj = parseDateString(reading.date);
        reading.timestamp = dateObj.toISOString();
      }

      // Optimistic update
      const index = cache.readings.findIndex((r: any) => r.id === reading.id);
      if (index > -1) {
        cache.readings[index] = reading;
      } else {
        cache.readings.push(reading);
      }
      
      await setDoc(doc(db, 'readings', reading.id), cleanData(reading));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'readings');
    }
  },
  deleteReading: async (id: string) => {
    try {
      // Optimistic update
      cache.readings = cache.readings.filter((r: any) => r.id !== id);
      
      await deleteDoc(doc(db, 'readings', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'readings');
    }
  },

  // --- USERS ---
  getUsers: (): User[] => {
    if (cache.users.length === 0) {
      // Fallback to a master user if empty (for first run)
      return [{
        id: 'master-1',
        name: 'Administrador Maestro',
        username: 'admin',
        password: '123',
        role: 'MASTER',
        status: 'approved',
        assignedBuildings: BUILDINGS.map(b => b.id),
        assignedUnits: ['USAC', 'GCG', 'BOEL', 'GOE4'],
        isManto: true
      }];
    }
    return cache.users;
  },
  getUserById: (id: string): User | null => {
    return cache.users.find((u: any) => u.id === id) || null;
  },
  saveUser: async (user: User) => {
    try {
      await setDoc(doc(db, 'users', user.id), cleanData(user));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'users');
    }
  },
  updateUser: async (user: User) => {
    try {
      await setDoc(doc(db, 'users', user.id), cleanData(user));
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'users');
    }
  },
  updateUserStatus: async (userId: string, status: UserStatus, assignedBuildings: string[], assignedUnits: Role[], userCategory?: UserCategory, isManto?: boolean) => {
    try {
      const updateData: any = { status, assignedBuildings, assignedUnits, userCategory };
      if (isManto !== undefined) updateData.isManto = isManto;
      await updateDoc(doc(db, 'users', userId), cleanData(updateData));
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'users');
    }
  },
  resetUserPassword: async (userId: string, newPassword: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), cleanData({ password: newPassword }));
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'users');
    }
  },
  updateUserLeaveDays: async (userId: string, leaveDays: string[]) => {
    try {
      await updateDoc(doc(db, 'users', userId), cleanData({ leaveDays }));
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'users');
    }
  },
  deleteUser: async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'users');
    }
  },
  
  // --- LEAVE REQUESTS ---
  getLeaveRequests: (): LeaveEntry[] => cache.leave_requests,
  saveLeaveRequest: async (request: LeaveEntry) => {
    try {
      await setDoc(doc(db, 'leave_requests', request.id), cleanData(request));
      
      // If it's approved, we also update the user's leaveDays for the calendar view
      if (request.status === 'approved') {
        const user = cache.users.find((u: any) => u.id === request.userId);
        if (user) {
          const updatedLeaveDays = [...new Set([...(user.leaveDays || []), request.startDate])];
          await updateDoc(doc(db, 'users', request.userId), cleanData({ leaveDays: updatedLeaveDays }));
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'leave_requests');
    }
  },
  deleteLeaveRequest: async (id: string) => {
    try {
      await deleteDoc(doc(db, 'leave_requests', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'leave_requests');
    }
  },
  addLeaveEntry: async (userId: string, entry: LeaveEntry) => {
    try {
      // New logic: save to leave_requests collection
      await setDoc(doc(db, 'leave_requests', entry.id), cleanData(entry));
      
      // Legacy support: also update user doc if needed (though we'll move to collection)
      const user = cache.users.find((u: any) => u.id === userId);
      if (user) {
        const updatedLeaveEntries = [...(user.leaveEntries || []), entry];
        await updateDoc(doc(db, 'users', userId), cleanData({ 
          leaveEntries: updatedLeaveEntries
        }));
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'users');
    }
  },

  // --- REQUESTS ---
  getRequests: (): RequestItem[] => cache.requests,
  saveRequest: async (request: RequestItem) => {
    try {
      await setDoc(doc(db, 'requests', request.id), cleanData(request));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'requests');
    }
  },
  updateRequestStatus: async (requestId: string, status: RequestItem['status'], technicianId?: string, workDetails?: any) => {
    try {
      const updateData: any = { status };
      if (technicianId) {
        updateData.assignedTechnicians = [technicianId];
        updateData.acceptanceStatus = { [technicianId]: 'pending' };
      }
      if (workDetails) updateData.workDetails = workDetails;
      await updateDoc(doc(db, 'requests', requestId), cleanData(updateData));
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'requests');
    }
  },
  assignTechnicians: async (requestId: string, technicianIds: string[]) => {
    try {
      const request = cache.requests.find((r: any) => r.id === requestId);
      const acceptanceStatus: Record<string, 'pending'> = {};
      technicianIds.forEach(id => { acceptanceStatus[id] = 'pending'; });
      
      await updateDoc(doc(db, 'requests', requestId), cleanData({
        status: 'asignada',
        assignedTechnicians: technicianIds,
        acceptanceStatus
      }));

      // Send notifications to technicians
      for (const techId of technicianIds) {
        await storageService.addNotification({
          id: crypto.randomUUID(),
          userId: techId,
          title: 'Nueva Tarea Asignada',
          message: `Se te ha asignado la tarea: ${request?.title || 'Sin título'}. Por favor, acepta la recepción.`,
          type: 'task_assigned',
          relatedId: requestId,
          read: false,
          date: new Date().toISOString()
        });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'requests');
    }
  },
  acceptRequest: async (requestId: string, userId: string) => {
    try {
      const request = cache.requests.find((r: any) => r.id === requestId);
      if (!request) return;
      
      const newAcceptanceStatus = { ...(request.acceptanceStatus || {}) };
      newAcceptanceStatus[userId] = 'accepted';
      
      // Check if all assigned technicians have accepted
      const allAccepted = request.assignedTechnicians?.every((id: string) => newAcceptanceStatus[id] === 'accepted');
      
      const updateData: any = { acceptanceStatus: newAcceptanceStatus };
      if (allAccepted) {
        updateData.status = 'in_progress';
      }
      
      await updateDoc(doc(db, 'requests', requestId), cleanData(updateData));

      // Notify the creator of the request
      if (request.userId) {
        const tech = cache.users.find((u: any) => u.id === userId);
        await storageService.addNotification({
          id: crypto.randomUUID(),
          userId: request.userId,
          title: 'Tarea Aceptada',
          message: `${tech?.name || 'Un técnico'} ha aceptado la tarea: ${request.title}`,
          type: 'system',
          relatedId: requestId,
          read: false,
          date: new Date().toISOString()
        });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'requests');
    }
  },
  getNextRegistrationNumber: (): string => {
    const count = cache.requests.length + 1;
    const year = new Date().getFullYear();
    return `USAC/${year}/${count.toString().padStart(4, '0')}`;
  },

  // --- GASOIL ---
  getGasoilTanks: (): GasoilTank[] => cache.gasoil_tanks,
  getGasoilReadings: (): GasoilReading[] => cache.gasoil_readings,
  getRefuelRequests: (): RefuelRequest[] => cache.refuel_requests,
  saveGasoilReading: async (reading: GasoilReading) => {
    try {
      await setDoc(doc(db, 'gasoil_readings', reading.id), cleanData(reading));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'gasoil_readings');
    }
  },
  saveRefuelRequest: async (request: RefuelRequest) => {
    try {
      await setDoc(doc(db, 'refuel_requests', request.id), cleanData(request));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'refuel_requests');
    }
  },
  updateRefuelRequestStatus: async (id: string, status: RefuelRequest['status']) => {
    try {
      await updateDoc(doc(db, 'refuel_requests', id), cleanData({ status }));
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'refuel_requests');
    }
  },

  // --- SALT ---
  getSaltStock: (): SaltWarehouse | null => cache.salt_stock,
  getSaltWarehouse: (): SaltWarehouse | null => cache.salt_stock,
  getSaltSofteners: (): SaltSoftener[] => cache.salt_softeners,
  getSaltRefillLogs: (): SaltRefillLog[] => cache.salt_refill_logs,
  getSaltEntryLogs: (): SaltEntryLog[] => cache.salt_entry_logs,
  updateSaltStock: async (stock: SaltWarehouse) => {
    try {
      await setDoc(doc(db, 'salt_stock', 'current'), cleanData(stock));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'salt_stock');
    }
  },
  saveSaltRefill: async (log: any) => {
    try {
      const warehouse = cache.salt_stock;
      const stockBefore = warehouse?.sacksAvailable || 0;
      const stockAfter = stockBefore - log.sacksUsed;
      
      const fullLog: SaltRefillLog = {
        id: crypto.randomUUID(),
        stockBefore,
        stockAfter,
        ...log
      };
      
      await setDoc(doc(db, 'salt_refill_logs', fullLog.id), cleanData(fullLog));
      
      // Update warehouse stock
      if (warehouse) {
        await setDoc(doc(db, 'salt_stock', 'current'), cleanData({
          ...warehouse,
          sacksAvailable: stockAfter
        }));
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'salt_refill_logs');
    }
  },
  saveSaltRefillLog: async (log: SaltRefillLog) => {
    try {
      await setDoc(doc(db, 'salt_refill_logs', log.id), cleanData(log));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'salt_refill_logs');
    }
  },
  saveSaltEntry: async (log: any) => {
    try {
      const warehouse = cache.salt_stock;
      const fullLog: SaltEntryLog = {
        id: crypto.randomUUID(),
        ...log
      };
      await setDoc(doc(db, 'salt_entry_logs', fullLog.id), cleanData(fullLog));
      
      // Update warehouse stock
      if (warehouse) {
        await setDoc(doc(db, 'salt_stock', 'current'), cleanData({
          ...warehouse,
          sacksAvailable: warehouse.sacksAvailable + log.sacksReceived,
          lastSupplier: log.supplier
        }));
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'salt_entry_logs');
    }
  },
  saveSaltEntryLog: async (log: SaltEntryLog) => {
    try {
      await setDoc(doc(db, 'salt_entry_logs', log.id), cleanData(log));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'salt_entry_logs');
    }
  },

  // --- WATER ACCOUNTS ---
  getWaterAccounts: (): WaterAccount[] => cache.water_accounts,
  getWaterAccount: (id?: string): WaterAccount | null => {
    const fallbackId = 'AGUAS_ALICANTE_BASE';
    if (id) {
      const found = cache.water_accounts.find((a: any) => a.id === id);
      if (found) return found;
      if (id === fallbackId) return getFallbackAccount();
      return null;
    }
    if (cache.water_accounts.length > 0) return cache.water_accounts[0];
    return getFallbackAccount();
  },
  getWaterSyncLogs: (): WaterSyncLog[] => cache.water_sync_logs,
  saveWaterAccount: async (account: WaterAccount) => {
    try {
      await setDoc(doc(db, 'water_accounts', account.id), cleanData(account));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'water_accounts');
    }
  },
  saveWaterSyncLog: async (log: WaterSyncLog) => {
    try {
      await setDoc(doc(db, 'water_sync_logs', log.id), cleanData(log));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'water_sync_logs');
    }
  },
  simulateWaterSync: async (accountId: string, onProgress?: (msg: string) => void): Promise<any> => {
    console.log(`[DEBUG] simulateWaterSync called for accountId: ${accountId}`);
    const account = cache.water_accounts.find((a: any) => a.id === accountId) || storageService.getWaterAccount(accountId);
    
    if (!account) {
      console.error(`[DEBUG] Account not found for ID: ${accountId}`);
      return { success: false, message: "Cuenta no encontrada" };
    }

    if (onProgress) {
      onProgress("[BROWSER] Iniciando motor Puppeteer...");
      await new Promise(r => setTimeout(r, 600));
      onProgress(`[AUTH] Intentando login en Aguas de Alicante con usuario: ${account.webUser}...`);
      await new Promise(r => setTimeout(r, 500));
      onProgress("[SCRAPE] Acceso concedido. Navegando a 'Mis Consumos'...");
      await new Promise(r => setTimeout(r, 800));
      onProgress("[URL] https://www.aguasdealicante.es/es/group/amaem/mis-consumos...");
      await new Promise(r => setTimeout(r, 1000));
      onProgress("[SCRAPE] Localizando tabla de consumos históricos...");
      await new Promise(r => setTimeout(r, 1200));
      onProgress("[DATA] Analizando periodos pendientes de sincronización...");
    }

    const readings = cache.readings.filter((r: any) => r.buildingId === account.buildingId && r.serviceType === 'agua')
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
    
    const lastReading = readings[readings.length - 1];
    const todayStr = getLocalDateString();
    
    let startDate: Date;
    if (lastReading) {
      const lastDate = new Date(lastReading.date);
      startDate = new Date(lastDate);
      startDate.setDate(lastDate.getDate() + 1);
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7); // Default to last 7 days if no data
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);

    const missingDays: string[] = [];
    let current = new Date(startDate);
    
    while (current <= today) {
      missingDays.push(getLocalDateString(current));
      current.setDate(current.getDate() + 1);
    }

    if (missingDays.length === 0) {
      if (onProgress) onProgress("[INFO] No se han detectado días pendientes. El histórico está actualizado.");
      return { success: true, message: "Histórico ya actualizado" };
    }

    if (onProgress) onProgress(`[SYNC] Detectados ${missingDays.length} días pendientes. Iniciando volcado...`);

    let lastVal = lastReading?.value1 || 290408.96;
    const syncedReadings: Reading[] = [];

    for (const dateStr of missingDays) {
      if (onProgress) onProgress(`[DATA] Procesando lectura: ${dateStr}...`);
      
      const weekend = isWeekend(dateStr);
      const baseCons = weekend ? 15 : 65;
      const consumption = baseCons + (Math.random() * 20 - 10);
      lastVal += consumption;

      const reading: Reading = {
        id: `water_${account.buildingId}_${dateStr}`, // Deterministic ID to prevent duplicates
        buildingId: account.buildingId,
        date: dateStr,
        timestamp: parseDateString(dateStr).toISOString(), // Normalized to 00:00 local
        userId: auth.currentUser?.uid || 'system_fallback',
        serviceType: 'agua',
        origin: 'telematica',
        value1: parseFloat(lastVal.toFixed(2)),
        consumption1: parseFloat(consumption.toFixed(2)),
        isPeak: consumption > (isWorkDay(dateStr) ? account.peakThresholdM3 : account.peakThresholdM3 * 0.6)
      };

      try {
        // Check if reading already exists in cache to avoid unnecessary calls (though setDoc is idempotent)
        if (cache.readings.find((r: any) => r.id === reading.id)) {
          if (onProgress) onProgress(`[DATA] La lectura para ${dateStr} ya existe. Saltando...`);
          continue;
        }

        await setDoc(doc(db, 'readings', reading.id), cleanData(reading));
        syncedReadings.push(reading);
        // Update cache
        cache.readings.push(reading);
      } catch (e) {
        console.error(`[DEBUG] Error saving reading for ${dateStr}:`, e);
      }
      
      // Small delay to simulate network
      await new Promise(r => setTimeout(r, 200));
    }

    return { 
      success: true, 
      message: `Sincronizados ${syncedReadings.length} días correctamente`,
      count: syncedReadings.length
    };
  },

  // --- TASKS ---
  getTasks: (): CalendarTask[] => cache.tasks,
  saveTask: async (task: CalendarTask) => {
    try {
      await setDoc(doc(db, 'tasks', task.id), cleanData(task));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'tasks');
    }
  },
  deleteTask: async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'tasks');
    }
  },

  // --- NOTIFICATIONS ---
  getNotifications: (userId?: string): AppNotification[] => {
    if (userId) {
      return cache.notifications.filter((n: any) => n.userId === userId || n.userId === 'all');
    }
    return cache.notifications;
  },
  addNotification: async (notification: AppNotification) => {
    try {
      await setDoc(doc(db, 'notifications', notification.id), cleanData(notification));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'notifications');
    }
  },
  saveNotification: async (notification: AppNotification) => {
    try {
      await setDoc(doc(db, 'notifications', notification.id), cleanData(notification));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'notifications');
    }
  },
  markNotificationAsRead: async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), cleanData({ read: true }));
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'notifications');
    }
  },
  markNotificationRead: async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), cleanData({ read: true }));
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'notifications');
    }
  },
  deleteNotification: async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'notifications');
    }
  },
  clearNotifications: async (userId?: string) => {
    try {
      const batch: any = [];
      const toDelete = userId 
        ? cache.notifications.filter((n: any) => n.userId === userId || n.userId === 'all')
        : cache.notifications;
      
      toDelete.forEach((n: any) => {
        batch.push(deleteDoc(doc(db, 'notifications', n.id)));
      });
      await Promise.all(batch);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'notifications');
    }
  },

  // --- EXTERNAL CONTACTS ---
  getExternalContacts: (): ExternalUser[] => cache.external_contacts,
  saveExternalContact: async (contact: ExternalUser) => {
    try {
      await setDoc(doc(db, 'external_contacts', contact.id), cleanData(contact));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'external_contacts');
    }
  },

  // --- BOILERS ---
  getBoilers: (): Boiler[] => cache.boilers,
  getBoilerReadings: (): BoilerTemperatureReading[] => cache.boiler_readings,
  getBoilerMaintenance: (): BoilerMaintenanceRecord[] => cache.boiler_maintenance,
  saveBoilerReading: async (reading: BoilerTemperatureReading) => {
    try {
      await setDoc(doc(db, 'boiler_readings', reading.id), cleanData(reading));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'boiler_readings');
    }
  },
  saveBoilerMaintenance: async (record: BoilerMaintenanceRecord) => {
    try {
      await setDoc(doc(db, 'boiler_maintenance', record.id), cleanData(record));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'boiler_maintenance');
    }
  },
  updateBoilerStatus: async (boilerId: string, status: BoilerStatus) => {
    try {
      await updateDoc(doc(db, 'boilers', boilerId), cleanData({ status }));
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'boilers');
    }
  },

  // --- PROVIDERS & CATEGORIES ---
  getProviders: (): Provider[] => cache.providers,
  findProvider: (criteria: { name?: string, email?: string, phone?: string, cif?: string }): Provider | null => {
    return cache.providers.find((p: any) => {
      if (criteria.name && p.name === criteria.name) return true;
      if (criteria.email && (p.email === criteria.email || p.contactEmail === criteria.email)) return true;
      if (criteria.phone && (p.phone === criteria.phone || p.contactPhone === criteria.phone)) return true;
      if (criteria.cif && p.cif === criteria.cif) return true;
      return false;
    }) || null;
  },
  getCategories: (): MaterialCategory[] => cache.categories,
  saveProvider: async (provider: Provider) => {
    try {
      await setDoc(doc(db, 'providers', provider.id), cleanData(provider));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'providers');
    }
  },
  updateProvider: async (provider: Provider) => {
    try {
      await setDoc(doc(db, 'providers', provider.id), cleanData(provider));
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'providers');
    }
  },
  deleteProvider: async (id: string) => {
    try {
      await deleteDoc(doc(db, 'providers', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'providers');
    }
  },
  saveCategory: async (category: MaterialCategory) => {
    try {
      await setDoc(doc(db, 'categories', category.id), cleanData(category));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'categories');
    }
  },

  // --- SESSION (Still using localStorage for non-sensitive UI state) ---
  getCurrentUser: (): User | null => {
    const saved = localStorage.getItem('sigai_current_user_v1');
    return saved ? JSON.parse(saved) : null;
  },
  setCurrentUser: (user: User | null) => {
    if (user) {
      localStorage.setItem('sigai_current_user_v1', JSON.stringify(user));
    } else {
      localStorage.removeItem('sigai_current_user_v1');
    }
  },

  // --- BLUEPRINTS ---
  async saveBlueprint(blueprint: Blueprint) {
    try {
      await setDoc(doc(db, 'blueprints', blueprint.id), cleanData(blueprint));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'blueprints');
    }
  },

  async deleteBlueprint(id: string) {
    try {
      await deleteDoc(doc(db, 'blueprints', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'blueprints');
    }
  },

  getBlueprints(): Blueprint[] {
    return cache.blueprints;
  },

  // --- PPTS ---
  async savePPT(ppt: PPT) {
    try {
      await setDoc(doc(db, 'ppts', ppt.id), cleanData(ppt));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'ppts');
    }
  },

  async deletePPT(id: string) {
    try {
      await deleteDoc(doc(db, 'ppts', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'ppts');
    }
  },

  getPPTS(): PPT[] {
    return cache.ppts;
  },

  getOCACertificates(): OCACertificate[] {
    return cache.oca_certificates;
  },

  async saveOCACertificate(cert: OCACertificate): Promise<string> {
    const id = cert.id || crypto.randomUUID();
    const data = { ...cert, id };
    try {
      await setDoc(doc(db, 'oca_certificates', id), cleanData(data));
      return id;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'oca_certificates');
      return id;
    }
  },

  async deleteOCACertificate(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'oca_certificates', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'oca_certificates');
    }
  },

  async checkContractExpirations(): Promise<void> {
    const ppts = cache.ppts as PPT[];
    const currentUser = storageService.getCurrentUser();
    
    // Solo avisar a Oficina de Control (MASTER o USAC con categoría Oficina de Control)
    if (!currentUser || (currentUser.role !== 'MASTER' && currentUser.userCategory !== 'Oficina de Control')) {
      return;
    }

    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    for (const ppt of ppts) {
      if (ppt.status !== 'active') continue;

      const expDate = new Date(ppt.validTo);
      const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 30 && diffDays > 0) {
        const notificationId = `ppt_expiry_${ppt.id}_${ppt.validTo}`;
        const existingNotification = cache.notifications.find((n: AppNotification) => n.id === notificationId);

        if (!existingNotification) {
          const notification: AppNotification = {
            id: notificationId,
            userId: currentUser.id,
            title: '⚠️ VENCIMIENTO DE CONTRATO',
            message: `El contrato sectorial "${ppt.title}" está próximo a vencer el ${ppt.validTo} (${diffDays} días restantes). Iniciar trámites de prórroga o nueva licitación.`,
            type: 'alert',
            read: false,
            date: new Date().toISOString()
          };

          try {
            await setDoc(doc(db, 'notifications', notificationId), cleanData(notification));
          } catch (e) {
            console.error(`[DEBUG] Error creating expiry notification for ${ppt.id}:`, e);
          }
        }
      }
    }
  },

  async syncOCATasks(): Promise<void> {
    const certs = cache.oca_certificates as OCACertificate[];
    const tasks = cache.tasks as CalendarTask[];
    
    if (!certs.length) return;

    // Sync existing tasks: create missing ones and potentially update
    for (const cert of certs) {
      const taskId = `oca_task_${cert.id}`;
      const existingTask = tasks.find(t => t.id === taskId);
      
      const expDate = new Date(cert.expirationDate);
      const sixMonthsFromNow = new Date();
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
      
      if (expDate <= sixMonthsFromNow && !existingTask) {
        const newTask: CalendarTask = {
          id: taskId,
          title: `REVISIÓN OCA: ${cert.title}`,
          description: `Trámite de inspección reglamentaria para ${cert.buildingName}. Categoría: ${cert.category}. Caduca el ${cert.expirationDate}. Solicitar presupuesto y coordinar con habilitación.`,
          type: 'Mantenimiento Legal',
          startDate: cert.expirationDate,
          priority: 'Alta',
          status: 'Pendiente',
          assignedTo: ['USAC'],
          location: cert.buildingName,
          createdBy: 'system_oca',
          createdAt: new Date().toISOString()
        };
        
        try {
          await setDoc(doc(db, 'tasks', taskId), cleanData(newTask));
        } catch (e) {
          console.error(`[DEBUG] Error syncing OCA task ${taskId}:`, e);
        }
      }
    }

    // Cleanup: Delete tasks belonging to deleted certificates
    const ocaTasks = tasks.filter(t => t.id.startsWith('oca_task_'));
    for (const task of ocaTasks) {
      const certId = task.id.replace('oca_task_', '');
      const exists = certs.some(c => c.id === certId);
      if (!exists) {
        try {
          console.log(`[DEBUG] Cleaning up orphaned OCA task: ${task.id}`);
          await deleteDoc(doc(db, 'tasks', task.id));
        } catch (e) {
          console.error(`[DEBUG] Error deleting orphaned task ${task.id}:`, e);
        }
      }
    }
  },

  async savePPTExecution(execution: Omit<PPTExecution, 'id' | 'createdAt'>): Promise<string> {
    const id = `exec_${Date.now()}`;
    const newExecution: PPTExecution = {
      ...execution,
      id,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'ppt_executions', id), cleanData(newExecution));
      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'ppt_executions');
      throw error;
    }
  },

  async getPPTExecutions(pptId?: string): Promise<PPTExecution[]> {
    if (pptId) {
      return (cache.ppt_executions as PPTExecution[]).filter(e => e.pptId === pptId);
    }
    return cache.ppt_executions as PPTExecution[];
  },

  // --- RTI (Revista Técnica de la Infraestructura) ---
  getRTIWorks: (unitId?: string): RTIWork[] => {
    let works = cache.rti_works;
    if (unitId) works = works.filter((w: any) => w.unitId === unitId);
    return works;
  },
  getRTIReports: (): RTIReport[] => cache.rti_reports,
  saveRTIWork: async (work: RTIWork) => {
    try {
      await setDoc(doc(db, 'rti_works', work.id), cleanData(work));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'rti_works');
    }
  },
  saveRTIReport: async (report: RTIReport) => {
    try {
      await setDoc(doc(db, 'rti_reports', report.id), cleanData(report));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'rti_reports');
    }
  },
  deleteRTIWork: async (id: string) => {
    try {
      await deleteDoc(doc(db, 'rti_works', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'rti_works');
    }
  },
  subscribe: (listener: () => void) => {
    uiListeners.push(listener);
    return () => {
      uiListeners = uiListeners.filter(l => l !== listener);
    };
  }
};
